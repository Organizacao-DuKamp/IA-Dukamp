// Chat Core — orquestração agnóstica de canal, com contexto em camadas.
//
// Regra central da arquitetura ChatGPT-first: ferramentas, SQL, RAG, mercado,
// clima e dados privados produzem CONTEXTO; a resposta normal ao usuário é
// sempre redigida pelo GPT. Respostas determinísticas ficam restritas a
// degradação técnica/segurança quando o modelo ou a validação falham.

import { askOpenAI, chatModelKindForChannel, OpenAIError, openAIModel } from "./openai.server";
import { researchChatGPT } from "./perplexity.server";
import { checkRateLimit } from "./rate-limit.server";
import { productContextBlock, routeQuery } from "./query-router.server";
import { assessEvidence, sourceDirective } from "./source-policy";
import { classifyDomainIntent } from "./intent";
import {
  stripUnmappedCitations,
  validateGrounding,
  validateWeatherGrounding,
} from "./response-validation";
import { sanitizeRetrievedContent } from "./security";
import {
  buildWeatherResearchQuery,
  resolveWeatherTurn,
  weatherSourceDirective,
} from "./weather.ts";
import {
  fetchWeatherIntelligence,
  renderWeatherFallbackReply,
  renderWeatherIntelligenceContext,
  type WeatherIntelligence,
} from "./weather-intelligence.server.ts";
import {
  applyAssistantTurn,
  applyUserTurn,
  buildHistoryWindow,
  buildInterpretationDirective,
  classifyUserIntent,
  createConversationState,
  estimateMessagesTokens,
  normalizeState,
  renderStateForModel,
  renderSummaryForModel,
  updateSummary,
  type ConversationState,
} from "./state";
import {
  HISTORY_TOKEN_BUDGET,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  type ChatMessage,
  type IncomingMessage,
} from "./types";
import type { LivestockConversationContext } from "@/lib/market/livestock-parse";

function sanitize(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
      .replace(/\s+\n/g, "\n")
      .trim()
  );
}

function livestockContextFromState(state: ConversationState): LivestockConversationContext | null {
  const read = (key: string) => {
    const value = state.confirmed_data[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  };
  const context: LivestockConversationContext = {
    categorySlug: read("market_category"),
    placeSlug: read("market_place"),
    uf: read("market_uf"),
    unit: read("market_unit"),
  };
  return Object.values(context).some(Boolean) ? context : null;
}

// Classifica conversa casual somente para evitar roteamento/pesquisa inúteis.
// Diferente da implementação antiga, esta função NUNCA produz a resposta.
function isSmallTalk(raw: string): boolean {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[!.?…]+$/g, "")
    .replace(/\s+/g, " ");
  if (!t || t.length > 60) return false;

  return (
    /^(oi|ol[aá]|e\s?a[ií]|opa|bom\s+dia|boa\s+tarde|boa\s+noite|hey|hi|hello)$/i.test(t) ||
    /^(obrigad[ao]|valeu|vlw|thanks|obg|grat[oa])$/i.test(t) ||
    /^(ah\s+)?(que\s+)?(legal|bacana|[óo]timo|show|massa|top|bom|dahora|maneiro|interessante|bem\s+legal|muito\s+bom)$/i.test(
      t,
    ) ||
    /^(nossa|uau|wow|caramba|s[eé]rio|puxa)$/i.test(t) ||
    /^ah\s+(sim|ok|entendi|legal|bacana)$/i.test(t) ||
    /^(tchau|at[eé]\s+mais|falou|flw|adeus|bye)$/i.test(t) ||
    /^(acho\s+que\s+n[aã]o|sei\s+l[aá]|n[aã]o\s+sei|hmm+|humm+|nop|nao\s+mesmo|agora\s+n[aã]o|depois|mais\s+tarde|de\s+boa|tranquilo|suave|nada)$/i.test(
      t,
    ) ||
    /^(toma\s+jeito+|para\s+com\s+isso|par[ae]\s+com\s+isso|melhora(\s+a[ií])?|se\s+ajeita|ajeita\s+isso|arruma\s+isso|ta\s+ruim|est[aá]\s+ruim|nao\s+ta\s+bom|n[aã]o\s+est[aá]\s+bom|que\s+isso|credo|aff+|eita)$/i.test(
      t,
    )
  );
}

export class ChatError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ChatResult {
  reply: string;
  state: ConversationState;
  conversationId: string;
  diagnostics: {
    conversation_id: string;
    messages_loaded: number;
    estimated_tokens: number;
    current_topic: string | null;
    user_intent: string;
    domain_intent: string;
    has_pending_action: boolean;
    last_assistant_question: string | null;
    model: string;
    retrieved_blocks: string[];
    truncation_reason: string | null;
    state_changed: boolean;
  };
}

/** Locks lógicos por conversa: evita condição de corrida entre dois envios. */
const inFlight = new Map<string, number>();
const IN_FLIGHT_TTL_MS = 60_000;
/** Cache de idempotência: mesma clientMessageId ⇒ mesma resposta. */
const idempotency = new Map<string, { at: number; result: ChatResult }>();
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

function gc() {
  const now = Date.now();
  for (const [k, at] of inFlight) if (now - at > IN_FLIGHT_TTL_MS) inFlight.delete(k);
  for (const [k, v] of idempotency) if (now - v.at > IDEMPOTENCY_TTL_MS) idempotency.delete(k);
}

export async function handleIncoming(input: IncomingMessage): Promise<ChatResult> {
  gc();
  const text = sanitize(input.text ?? "");
  if (!text) throw new ChatError("Mensagem vazia.", 400);
  if (text.length > MAX_MESSAGE_CHARS) {
    throw new ChatError(`Mensagem excede ${MAX_MESSAGE_CHARS} caracteres.`, 400);
  }

  const conversationId = (input.conversationId || input.sessionId || "anon").slice(0, 128);
  const idemKey = input.clientMessageId ? `${conversationId}:${input.clientMessageId}` : null;
  if (idemKey) {
    const hit = idempotency.get(idemKey);
    if (hit) return hit.result;
  }

  const rl = checkRateLimit(input.sessionId || conversationId);
  if (!rl.ok) {
    throw new ChatError(
      `Muitas mensagens em pouco tempo. Tente novamente em ${rl.retryAfterSec}s.`,
      429,
    );
  }

  const lockedAt = inFlight.get(conversationId);
  if (lockedAt && Date.now() - lockedAt < IN_FLIGHT_TTL_MS) {
    throw new ChatError(
      "Ainda estou processando a mensagem anterior desta conversa. Aguarde a resposta antes de enviar outra.",
      409,
    );
  }
  inFlight.set(conversationId, Date.now());

  try {
    const result = await runTurn(input, text, conversationId);
    if (idemKey) idempotency.set(idemKey, { at: Date.now(), result });
    return result;
  } finally {
    inFlight.delete(conversationId);
  }
}

async function runTurn(
  input: IncomingMessage,
  text: string,
  conversationId: string,
): Promise<ChatResult> {
  const rawHistory: ChatMessage[] = (input.history ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.length > 0)
    .map((m) => ({ role: m.role, content: sanitize(m.content).slice(0, 8000) }));

  const windowed = buildHistoryWindow(rawHistory, HISTORY_TOKEN_BUDGET, MAX_HISTORY_TURNS);
  const history = windowed.kept;
  const stateBefore = input.state
    ? normalizeState(input.state as Partial<ConversationState>, conversationId)
    : createConversationState(conversationId);

  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  const lastUser = [...history].reverse().find((m) => m.role === "user");

  const analysis = classifyUserIntent(text, stateBefore);
  let domainIntent = classifyDomainIntent(text, history.length > 0);
  const weatherTurn = resolveWeatherTurn(text, stateBefore, lastAssistant?.content ?? null);
  const state = applyUserTurn(stateBefore, text, analysis);
  state.conversation_summary = updateSummary(state, windowed.dropped);

  const continuity =
    stateBefore.awaiting_user_response ||
    analysis.intent === "resposta_a_confirmacao" ||
    analysis.intent === "selecao_de_opcao" ||
    analysis.intent === "fornecimento_de_dado" ||
    analysis.intent === "correcao" ||
    (analysis.intent === "continuacao" && !!lastAssistant);

  const conversationalOnly =
    analysis.intent === "user_acknowledgement" || (!continuity && isSmallTalk(text));

  let weatherLocation: string | null = null;
  let weatherLocationRequired = false;
  if (weatherTurn.isWeatherTurn) {
    state.current_topic = "clima e previsão do tempo";
    state.user_goal = state.user_goal || stateBefore.user_goal || text.slice(0, 300);
    state.pending_action = "consultar_previsao_tempo";
    domainIntent = classifyDomainIntent(
      `previsão do tempo${weatherTurn.location ? ` em ${weatherTurn.location}` : ""}`,
      history.length > 0,
    );

    if (!weatherTurn.location) {
      weatherLocationRequired = true;
      if (!state.missing_data.includes("weather_location")) {
        state.missing_data.push("weather_location");
      }
    } else {
      weatherLocation = weatherTurn.location;
      state.confirmed_data.weather_location = weatherLocation;
      state.missing_data = state.missing_data.filter((field) => field !== "weather_location");
    }
  }

  let routerInput = resolveLookupText(
    text,
    analysis,
    stateBefore,
    lastUser?.content ?? null,
    lastAssistant?.content ?? null,
  );
  if (weatherLocation) {
    routerInput =
      `${text}\nLocalização meteorológica confirmada: ${weatherLocation}, Brasil.`.slice(0, 600);
  }

  let routed: Awaited<ReturnType<typeof routeQuery>>;
  if (conversationalOnly || weatherLocationRequired) {
    routed = { kind: "passthrough" as const };
  } else {
    try {
      routed = await routeQuery(routerInput, {
        history,
        livestock: livestockContextFromState(stateBefore),
      });
    } catch (err) {
      console.error("[router] falhou:", err instanceof Error ? err.message : err);
      routed = { kind: "passthrough" as const };
    }
  }

  if (routed.kind === "passthrough" && routed.livestockContext) {
    const marketFields: Array<[key: string, value: string | null | undefined]> = [
      ["market_category", routed.livestockContext.categorySlug],
      ["market_place", routed.livestockContext.placeSlug],
      ["market_uf", routed.livestockContext.uf],
      ["market_unit", routed.livestockContext.unit],
    ];
    for (const [key, value] of marketFields) {
      if (value) state.confirmed_data[key] = value;
      else delete state.confirmed_data[key];
    }
    state.current_topic = "cotações pecuárias";
    if (!state.user_goal) state.user_goal = routerInput.slice(0, 300);
  }

  const isCalc = analysis.intent === "pedido_de_calculo";
  if (isCalc && routed.kind === "structural") {
    routed = { kind: "passthrough" as const };
  }

  // A partir daqui, respostas estruturais são contexto para o GPT; não existe
  // mais retorno SQL direto ao usuário.
  const contextParts: string[] = [];
  const retrieved: string[] = [];
  let hasCatalogEvidence = false;
  let hasSiteEvidence = false;
  let hasMarketEvidence = false;
  let needsExternalProductFallback = false;
  const requiresCurrentMarketSearch =
    routed.kind === "passthrough" &&
    (routed.marketFreshness === "stale" || routed.marketFreshness === "missing");
  const isCurrentMarketTurn =
    domainIntent.intent === "market_quote" ||
    (routed.kind === "passthrough" && Boolean(routed.marketContext));
  const knowledgeScores: number[] = [];
  let weatherIntelligence: WeatherIntelligence | null = null;
  let weatherStructuredError: unknown = null;

  if (conversationalOnly) {
    contextParts.push(
      "CONVERSA CASUAL: responda pelo próprio GPT de forma natural e breve, usando o histórico. Não pesquise na web e não transforme a mensagem em atendimento comercial se o usuário não pediu isso.",
    );
    retrieved.push("chatgpt:conversation-only");
  }

  if (weatherLocationRequired) {
    contextParts.push(
      "CLIMA — LOCALIZAÇÃO NECESSÁRIA: o usuário pediu informação meteorológica, mas ainda não há cidade/UF ou região suficientemente confirmada. Não invente previsão e não pesquise uma localidade por suposição. Responda pelo próprio GPT pedindo somente cidade e UF/região necessária, de forma natural e curta.",
    );
    retrieved.push("weather:location-required");
  }

  if (routed.kind === "structural") {
    contextParts.push(
      `DADOS ESTRUTURADOS DO CATÁLOGO (use se ajudar o pedido atual):\n${routed.text}`,
    );
    retrieved.push("sql:context");
    hasCatalogEvidence = true;
  }
  if (routed.kind !== "structural" && routed.marketContext) {
    contextParts.push(routed.marketContext);
    retrieved.push("mercado");
    hasMarketEvidence = true;
  }
  if (routed.kind !== "structural" && routed.productHint) {
    contextParts.push(productContextBlock(routed.productHint.product));
    retrieved.push("produto");
    hasCatalogEvidence = true;
  }

  const lookupText = routerInput !== text ? `${routerInput} ${text}` : text;

  if (!weatherLocation && !weatherLocationRequired && !conversationalOnly) {
    try {
      const { executeCommercialLookup, querySiteProducts, siteBlock } =
        await import("../site/site-lookup.server");
      const productHint = routed.kind !== "structural" ? routed.productHint : undefined;
      const commercial = await executeCommercialLookup(domainIntent, lookupText);
      const lookup = commercial.lookup;
      retrieved.push(...commercial.statuses);
      if (productHint && !lookup.products) {
        const result = await querySiteProducts(productHint.product.official_name, 6);
        if (result.data.length) lookup.products = result.data;
        retrieved.push(`site-products:${result.status}`);
      }
      if (domainIntent.intent === "product_recommendation") {
        const liveMatch =
          lookup.products?.some(
            (product) =>
              product.source !== "snapshot" && (product.stock == null || product.stock > 0),
          ) ?? false;
        const productStatus = commercial.statuses.find((status) =>
          status.startsWith("site-products:"),
        );
        if (liveMatch) {
          contextParts.push(
            "PRIORIDADE DUKAMP: há produto(s) oficial(is), ativo(s) e disponível(is) recuperado(s) do catálogo vivo. Se forem tecnicamente adequados ao objetivo informado, recomende primeiro a melhor opção da DuKamp e explique por quê. Não force uma opção inadequada apenas por ser da DuKamp.",
          );
          retrieved.push("dukamp:priority-match");
        } else {
          needsExternalProductFallback = true;
          const confirmedEmpty = productStatus === "site-products:empty_result";
          contextParts.push(
            confirmedEmpty
              ? "FALLBACK COMERCIAL: o catálogo vivo da DuKamp foi consultado e não retornou produto adequado disponível para este objetivo. Pesquise na web uma alternativa externa confiável e deixe claro que ela NÃO é um produto DuKamp."
              : "FALLBACK COMERCIAL: não foi possível confirmar uma opção adequada no catálogo vivo da DuKamp neste turno. Pesquise na web uma alternativa externa confiável, sem afirmar que a DuKamp não possui o produto e sem apresentar a alternativa como DuKamp.",
          );
          retrieved.push(confirmedEmpty ? "dukamp:fallback-empty" : "dukamp:fallback-unavailable");
        }
      }
      if (lookup.sellers?.length) {
        const normalizedLookup = lookupText.toLocaleLowerCase("pt-BR");
        const matchedRegion = lookup.sellers.some(
          (seller) =>
            seller.region && normalizedLookup.includes(seller.region.toLocaleLowerCase("pt-BR")),
        );
        if (matchedRegion) {
          contextParts.push(
            "INSTRUÇÃO DE ATENDIMENTO: se o pedido realmente for comercial e a região tiver vendedor correspondente nos dados recuperados, recomende diretamente um vendedor dessa região, usando somente nome e contato oficiais disponíveis no contexto.",
          );
        }
      }
      const block = siteBlock(lookup);
      if (block) {
        contextParts.push(block);
        retrieved.push("site");
        hasSiteEvidence = true;
      }
    } catch (err) {
      console.error("[site] lookup falhou:", err instanceof Error ? err.message : err);
    }
  }

  const skipRag =
    conversationalOnly ||
    weatherLocationRequired ||
    (analysis.isShort &&
      (analysis.intent === "resposta_a_confirmacao" ||
        analysis.intent === "selecao_de_opcao" ||
        analysis.intent === "fornecimento_de_dado"));
  if (!skipRag && !weatherLocation) {
    try {
      const { searchKnowledge } = await import("../rag/search.server");
      const matches = await searchKnowledge(lookupText, 6);
      // searchKnowledge já aplica o limiar forte da arquitetura ChatGPT-first.
      if (matches.length > 0) {
        knowledgeScores.push(...matches.map((match) => match.similarity));
        const rag = matches
          .map((m, i) => `[TRECHO ${i + 1}]\n${sanitizeRetrievedContent(m.content)}`)
          .join("\n\n---\n\n");
        contextParts.push(
          `TRECHOS TÉCNICOS DA BASE INTERNA (uso interno; NÃO cite fontes, arquivos nem porcentagens; use só o que servir ao pedido atual):\n\n${rag}`,
        );
        retrieved.push(`rag:${matches.length}`);
      }
    } catch (err) {
      console.error("[RAG] busca falhou:", err instanceof Error ? err.message : err);
    }
  }

  if (weatherLocation) {
    try {
      weatherIntelligence = await fetchWeatherIntelligence(weatherLocation, text);
      contextParts.push(
        sanitizeRetrievedContent(renderWeatherIntelligenceContext(weatherIntelligence), 20_000),
      );
      retrieved.push(`weather:structured:${weatherIntelligence.analysis.depth}`);
    } catch (error) {
      weatherStructuredError = error;
      console.warn(
        "[weather] inteligência estruturada falhou:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // O planejador não consulta um segundo provedor: ele apenas sinaliza ao mesmo
  // GPT que deve usar seu Web Search nativo na chamada final da Responses API.
  const needsWebResearch =
    conversationalOnly || weatherLocationRequired
      ? false
      : weatherLocation
        ? !weatherIntelligence || weatherIntelligence.analysis.needsWebCrosscheck
        : domainIntent.needs_web_search ||
          requiresCurrentMarketSearch ||
          needsExternalProductFallback;

  if (needsWebResearch) {
    const livestock = livestockContextFromState(state);
    const currentMarketDetails = isCurrentMarketTurn
      ? [
          livestock?.categorySlug ? `categoria=${livestock.categorySlug}` : null,
          livestock?.placeSlug ? `praça=${livestock.placeSlug}` : null,
          livestock?.uf ? `UF=${livestock.uf}` : null,
          livestock?.unit ? `unidade=${livestock.unit}` : null,
        ]
          .filter(Boolean)
          .join(", ")
      : "";
    const researchQuery = weatherLocation
      ? buildWeatherResearchQuery(text, weatherLocation)
      : [
          routerInput,
          needsExternalProductFallback
            ? "O catálogo vivo da DuKamp não trouxe uma opção adequada confirmada. Pesquise uma alternativa comercial externa tecnicamente pertinente e confiável; não a apresente como produto DuKamp."
            : null,
          currentMarketDetails ? `Contexto confirmado da cotação: ${currentMarketDetails}.` : null,
        ]
          .filter(Boolean)
          .join("\n");

    const researchPlan = await researchChatGPT(researchQuery, {
      currentMarketSearch: !weatherLocation && isCurrentMarketTurn,
      weatherSearch: Boolean(weatherLocation),
      weatherLocation,
      deepResearch: weatherLocation ? false : undefined,
    });

    if (researchPlan) {
      contextParts.push(
        `${weatherLocation ? "PESQUISA METEOROLÓGICA DE CRUZAMENTO" : "PESQUISA EXTERNA ATUAL"} — PLANO PARA WEB SEARCH NATIVO DO CHATGPT:\n\n${sanitizeRetrievedContent(researchPlan, 8_000)}`,
      );
      retrieved.push(weatherLocation ? "chatgpt:web-weather" : "chatgpt:web");
      if (isCurrentMarketTurn) hasMarketEvidence = true;
    }
  }

  const directive = buildInterpretationDirective(stateBefore, analysis, text);
  const evidence = assessEvidence({
    catalog: hasCatalogEvidence,
    site: hasSiteEvidence,
    market: hasMarketEvidence,
    knowledgeScores,
    requiresCurrentMarketSearch,
  });
  const conversation: ChatMessage[] = [...history, { role: "user", content: text }];

  console.info("[chat] turno", {
    conversation_id: conversationId,
    messages_loaded: conversation.length,
    estimated_tokens: estimateMessagesTokens(conversation),
    current_topic: state.current_topic,
    user_intent: analysis.intent,
    domain_intent: domainIntent.intent,
    has_pending_action: !!stateBefore.pending_action,
    awaiting_confirmation: stateBefore.awaiting_confirmation,
    retrieved,
    truncation_reason: windowed.reason,
  });

  try {
    const baseSourcePolicy = conversationalOnly
      ? "CONVERSA CASUAL: responda naturalmente pelo próprio GPT, sem Web Search, sem catálogo e sem transformar reconhecimento/cumprimento em resposta comercial longa."
      : weatherLocationRequired
        ? "CLIMA SEM LOCALIZAÇÃO: não use Web Search neste turno. Peça somente a localização necessária para consultar a previsão corretamente."
        : sourceDirective(evidence);
    const sourcePolicy = weatherLocation
      ? `${baseSourcePolicy}\n${weatherSourceDirective(weatherLocation)}`
      : baseSourcePolicy;
    const modelContext = contextParts.length > 0 ? contextParts.join("\n\n") : null;
    const modelKind = chatModelKindForChannel(input.channel);

    let reply = await askOpenAI(conversation, {
      model: modelKind,
      channel: input.channel,
      summary: renderSummaryForModel(state.conversation_summary),
      state: renderStateForModel(state),
      directive,
      sourcePolicy,
      context: modelContext,
      researchDepth: conversationalOnly || weatherLocationRequired ? "none" : undefined,
    });

    let grounding = validateGrounding(reply, {
      commercial: hasCatalogEvidence || hasSiteEvidence || hasMarketEvidence,
      citations: 0,
      currentMarket: isCurrentMarketTurn,
    });

    const marketIssues = grounding.issues.filter(
      (issue) => issue.startsWith("market_price_") || issue === "deferred_current_market_lookup",
    );
    if (marketIssues.length > 0) {
      reply = await askOpenAI(conversation, {
        model: modelKind,
        channel: input.channel,
        summary: renderSummaryForModel(state.conversation_summary),
        state: renderStateForModel(state),
        directive,
        sourcePolicy:
          `${sourcePolicy}\nCORREÇÃO OBRIGATÓRIA ANTES DE RESPONDER: a tentativa anterior não pode ser enviada porque falhou em: ${marketIssues.join(", ")}. ` +
          "Use a pesquisa web já habilitada neste turno e entregue a publicação confiável mais recente. Todo preço precisa trazer unidade, praça, data explícita com ano e fonte identificada. Não ofereça pesquisar depois.",
        context: modelContext,
        researchDepth: "high",
      });
      grounding = validateGrounding(reply, {
        commercial: hasCatalogEvidence || hasSiteEvidence || hasMarketEvidence,
        citations: 0,
        currentMarket: true,
      });
      if (
        grounding.issues.some(
          (issue) =>
            issue.startsWith("market_price_") || issue === "deferred_current_market_lookup",
        )
      ) {
        // Guardrail de segurança após duas tentativas do GPT: não inventar preço.
        reply =
          "🔴 Não consegui confirmar agora uma cotação com preço, unidade, praça, data e fonte verificáveis. Para não repetir uma referência antiga ou sem data, não vou apresentar um valor sem confirmação.";
        grounding = validateGrounding(reply, {
          commercial: hasCatalogEvidence || hasSiteEvidence || hasMarketEvidence,
          citations: 0,
          currentMarket: true,
        });
      }
    }

    if (weatherLocation) {
      const requiresFullWeatherGrounding =
        !weatherIntelligence || weatherIntelligence.analysis.depth !== "quick";
      let weatherGrounding = validateWeatherGrounding(reply, weatherLocation);
      if (!weatherGrounding.valid && requiresFullWeatherGrounding) {
        reply = await askOpenAI(conversation, {
          model: modelKind,
          channel: input.channel,
          summary: renderSummaryForModel(state.conversation_summary),
          state: renderStateForModel(state),
          directive,
          sourcePolicy:
            `${sourcePolicy}\nCORREÇÃO METEOROLÓGICA OBRIGATÓRIA: a tentativa anterior falhou em ${weatherGrounding.issues.join(", ")}. ` +
            `Reescreva a resposta para ${weatherLocation} usando os dados estruturados e, quando marcado no contexto, o Web Search nativo. Inclua localização, data explícita com ano, hora/fuso da atualização, fontes identificadas, chuva, temperatura, vento/rajadas, umidade e alertas quando disponíveis. Se os modelos divergirem, informe faixa/consenso e confiança.`,
          context: modelContext,
          researchDepth: needsWebResearch ? "high" : undefined,
        });
        weatherGrounding = validateWeatherGrounding(reply, weatherLocation);
        grounding = validateGrounding(reply, {
          commercial: hasCatalogEvidence || hasSiteEvidence || hasMarketEvidence,
          citations: 0,
          currentMarket: false,
        });
        if (!weatherGrounding.valid) {
          // Guardrail final: só entra após duas sínteses do GPT falharem validação.
          reply = weatherIntelligence
            ? renderWeatherFallbackReply(weatherIntelligence)
            : `Não consegui confirmar agora uma previsão meteorológica completa e verificável para ${weatherLocation}, com data e fontes suficientes. Para não te passar dados imprecisos, tente novamente em alguns instantes.`;
        }
      }
    }

    if (grounding.issues.includes("unmapped_citation")) reply = stripUnmappedCitations(reply, 0);

    if (grounding.issues.includes("unsupported_commercial_fact")) {
      reply = await askOpenAI(conversation, {
        model: modelKind,
        channel: input.channel,
        summary: renderSummaryForModel(state.conversation_summary),
        state: renderStateForModel(state),
        directive,
        sourcePolicy: `${sourcePolicy}\nCORREÇÃO COMERCIAL: remova qualquer preço, estoque, disponibilidade, vendedor ou contato não confirmado pelos dados oficiais presentes no contexto. Responda de forma útil apenas com o que está sustentado.`,
        context: modelContext,
        researchDepth: "none",
      });
    }

    const finalState = applyAssistantTurn(
      state,
      reply,
      analysis.intent === "user_acknowledgement" ? { acknowledgement: true } : undefined,
    );
    finalState.conversation_summary = updateSummary(finalState, windowed.dropped);
    return {
      reply,
      state: finalState,
      conversationId,
      diagnostics: diag(
        conversationId,
        conversation,
        windowed,
        analysis,
        stateBefore,
        retrieved,
        openAIModel(modelKind),
      ),
    };
  } catch (err) {
    // Degradação técnica: se o GPT estiver indisponível mas a camada
    // meteorológica estruturada tiver dados válidos, não descartamos os fatos.
    if (err instanceof OpenAIError && weatherIntelligence) {
      const fallbackReply = renderWeatherFallbackReply(weatherIntelligence);
      const finalState = applyAssistantTurn(state, fallbackReply);
      finalState.conversation_summary = updateSummary(finalState, windowed.dropped);
      return {
        reply: fallbackReply,
        state: finalState,
        conversationId,
        diagnostics: diag(
          conversationId,
          conversation,
          windowed,
          analysis,
          stateBefore,
          [...retrieved, "weather:llm-fallback"],
          "weather:deterministic-fallback",
        ),
      };
    }
    if (err instanceof OpenAIError) throw new ChatError(err.message, err.status);

    const reason = weatherStructuredError ?? err;
    if (reason instanceof Error && "status" in reason) {
      const status = (reason as Error & { status?: unknown }).status;
      if (typeof status === "number") throw new ChatError(reason.message, status);
    }
    throw new ChatError("Erro inesperado ao processar a mensagem.", 500);
  }
}

function resolveLookupText(
  text: string,
  analysis: ReturnType<typeof classifyUserIntent>,
  state: ConversationState,
  lastUser: string | null,
  lastAssistant: string | null,
): string {
  const trimmed = text.trim();

  if (
    analysis.intent === "resposta_a_confirmacao" ||
    analysis.intent === "selecao_de_opcao" ||
    (analysis.intent === "fornecimento_de_dado" && analysis.isShort)
  ) {
    const base = state.pending_question || lastUser || trimmed;
    const picked =
      analysis.selectedOption !== null ? state.offered_options[analysis.selectedOption - 1] : null;
    return [state.user_goal, base, picked].filter(Boolean).join(" ").slice(0, 600) || trimmed;
  }

  const prevBlob = `${lastAssistant ?? ""} ${lastUser ?? ""}`.toLowerCase();
  const prevTopic: "vendedores" | "categorias" | "produtos" | "unidades" | null =
    /vendedor|vendedores|representante/.test(prevBlob)
      ? "vendedores"
      : /unidade|filial|matriz|endere/.test(prevBlob)
        ? "unidades"
        : /categoria|categorias/.test(prevBlob)
          ? "categorias"
          : /produto|produtos|destaque/.test(prevBlob)
            ? "produtos"
            : null;

  const isBareFollowUp =
    /^(quem\s+s[aã]o(\s+eles|\s+elas)?|quais\s+s[aã]o(\s+eles|\s+elas)?|me\s+diga(\s+os)?(\s+nomes?)?|diga(\s+os)?(\s+nomes?)?|os?\s+nomes?|liste(\s+eles|\s+elas)?|todos|todas)\s*[?.!]*$/i.test(
      trimmed,
    );
  if (isBareFollowUp) {
    if (prevTopic === "vendedores") return "liste todos os vendedores";
    if (prevTopic === "categorias") return "liste todas as categorias";
    if (prevTopic === "produtos") return "liste os produtos";
  }

  const regionFollowUp = trimmed.match(
    /^(?:e\s+)?(?:em|no|na|nos|nas)\s+([a-zà-ú][a-zà-ú\s.'-]{2,60})\s*[?.!]*$/i,
  );
  if (regionFollowUp && prevTopic) {
    const region = regionFollowUp[1].trim();
    const verb = /\b(quanto|quantos|quantas|quantidade|n[uú]mero|total)\b/i.test(lastUser ?? "")
      ? "quantos"
      : "quais";
    return `${verb} ${prevTopic} em ${region}`;
  }

  return text;
}

function diag(
  conversationId: string,
  messages: ChatMessage[],
  windowed: ReturnType<typeof buildHistoryWindow>,
  analysis: ReturnType<typeof classifyUserIntent>,
  stateBefore: ConversationState,
  retrieved: string[],
  model: string,
): ChatResult["diagnostics"] {
  return {
    conversation_id: conversationId,
    messages_loaded: messages.length,
    estimated_tokens: estimateMessagesTokens(messages),
    current_topic: stateBefore.current_topic,
    user_intent: analysis.intent,
    domain_intent: classifyDomainIntent(messages.at(-1)?.content ?? "", messages.length > 1).intent,
    has_pending_action: !!stateBefore.pending_action,
    last_assistant_question: stateBefore.pending_question,
    model,
    retrieved_blocks: retrieved,
    truncation_reason: windowed.reason,
    state_changed: true,
  };
}
