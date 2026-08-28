import type { ConversationState } from "./state.ts";

export const WEATHER_INTENT_RE =
  /\b(previs[aã]o\s+(?:do\s+)?tempo|condi[cç][aã]o\s+(?:do\s+)?tempo|tempo\s+(?:hoje|amanh[aã]|agora|essa\s+semana|nos\s+pr[oó]ximos)|meteorolog\w*|vai\s+chover|vai\s+fazer\s+(?:frio|calor)|risco\s+de\s+(?:calor|frio|chuva|tempestade|geada|granizo)|(?:calor|frio)\s+(?:hoje|amanh[aã]|agora|nesta\s+semana|essa\s+semana|em\s+)|chuva\w*|temperatura\w*|umidade\w*|vento\w*|rajada\w*|tempestade\w*|granizo|geada\w*|onda\s+de\s+(?:calor|frio)|alerta\s+(?:do\s+)?tempo|clima\s+(?:hoje|amanh[aã]|agora|em\s+|na\s+|no\s+|da\s+regi[aã]o|do\s+munic[ií]pio|da\s+semana|para\s+os\s+pr[oó]ximos))\b/i;

export const WEATHER_LOCATION_QUESTION =
  "Qual é a sua cidade e o estado (UF) para eu buscar a previsão detalhada?";

const NON_WEATHER_RE =
  /\b(tempo\s+de\s+(?:entrega|espera|viagem|trabalho|servi[cç]o|uso|car[eê]ncia)|quanto\s+tempo|previs[aã]o\s+de\s+(?:venda|pre[cç]o|mercado|entrega|abate|parto)|clima\s+organizacional)\b/i;
const WEATHER_TOPIC_RE = /clima|meteorolog|previs[aã]o do tempo/i;
const WEATHER_PENDING_RE = /consultar_previsao_tempo/i;
const TOPIC_CHANGE_RE =
  /\b(?:outro\s+assunto|outra\s+coisa|mudei\s+de\s+assunto|mudando\s+de\s+assunto|vamos\s+falar\s+de\s+outra|estou\s+falando\s+de\s+outra)\b/i;
const EXPLICIT_NON_WEATHER_RE =
  /\b(?:n[aã]o\s+(?:me\s+)?refiro|n[aã]o\s+estou\s+falando|n[aã]o\s+[ée]\s+sobre)\b[\s\S]{0,120}\b(?:tempo|clima|previs[aã]o|meteorolog\w*|dukamp|produto|pre[cç]o|valor|cat[aá]logo|tesoura|vendedor)\b/i;
const NON_WEATHER_TOPIC_RE =
  /\b(?:pre[cç]o|valor|produto|dukamp|cat[aá]logo|vendedor(?:es)?|tesoura|estoque|ra[cç][aã]o|suplemento|proteinado|mineral|pedido|compra|entrega)\b/i;
const WEATHER_LOCATION_PROMPT_RE =
  /\bqual\s+(?:é\s+)?(?:a\s+sua\s+)?cidade[\s\S]{0,100}(?:estado|uf)\b|\bcidade[\s\S]{0,50}(?:estado|uf)\b/i;
const WEATHER_FOLLOW_UP_RE =
  /^(?:e\s+)?(?:amanh[aã]|depois\s+de\s+amanh[aã]|hoje|essa\s+semana|no\s+fim\s+de\s+semana|nos\s+pr[oó]ximos\s+dias|e?\s*a\s+chuva|e?\s*o\s+vento|e?\s*a\s+umidade|e?\s*a\s+temperatura|e?\s*a\s+geada|e\s+para\s+.+)[?.!]*$/i;
const TEMPORAL_TAIL_RE =
  /(?:^|\s)(?:hoje|amanh[aã]|depois\s+de\s+amanh[aã]|agora|n?esta\s+semana|n?essa\s+semana|pr[oó]xima\s+semana|nos\s+pr[oó]ximos\s+dias|no\s+fim\s+de\s+semana|pel[ao]\s+(?:manh[aã]|tarde|noite))(?=$|\s|[,.;!?])[\s\S]*$/i;
const DETAIL_TAIL_RE =
  /\s+(?:e|com)\s+(?:a\s+|o\s+)?(?:chuva|temperatura|umidade|vento|rajadas?|alertas?|detalhes?)[\s\S]*$/i;
const GENERIC_LOCATION_RE =
  /^(?:aqui|por\s+aqui|minha\s+(?:cidade|regi[aã]o|fazenda|propriedade)|na\s+fazenda|no\s+campo|minha\s+localiza[cç][aã]o|essa\s+regi[aã]o|esta\s+regi[aã]o)$/i;

export interface WeatherTurnResolution {
  isWeatherTurn: boolean;
  location: string | null;
  usedRememberedLocation: boolean;
}

export function isWeatherRequest(text: string): boolean {
  return (
    !TOPIC_CHANGE_RE.test(text) &&
    !EXPLICIT_NON_WEATHER_RE.test(text) &&
    !(NON_WEATHER_TOPIC_RE.test(text) && !WEATHER_INTENT_RE.test(text)) &&
    WEATHER_INTENT_RE.test(text) &&
    !NON_WEATHER_RE.test(text)
  );
}

function isLikelyWeatherLocationReply(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 120) return false;
  if (TOPIC_CHANGE_RE.test(normalized) || EXPLICIT_NON_WEATHER_RE.test(normalized)) return false;
  if (NON_WEATHER_TOPIC_RE.test(normalized)) return false;
  if (
    /[?]/.test(normalized) ||
    /\b(?:qual|quanto|por que|porque|me diga|explique)\b/i.test(normalized)
  ) {
    return false;
  }

  return Boolean(
    /^(?:em|no|na|nos|nas|para)\s+.{2,100}$/i.test(normalized) ||
    /^[\p{L}\d][\p{L}\d\s.'/-]{1,100}$/u.test(normalized),
  );
}

function cleanLocationCandidate(value: string): string | null {
  const candidate = value
    .replace(TEMPORAL_TAIL_RE, "")
    .replace(DETAIL_TAIL_RE, "")
    .replace(/^(?:a\s+|o\s+)?(?:cidade|munic[ií]pio|regi[aã]o)\s+(?:de\s+)?/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "")
    .trim()
    .slice(0, 120);

  if (!candidate || candidate.length < 2 || GENERIC_LOCATION_RE.test(candidate)) return null;
  if (!/[\p{L}]/u.test(candidate)) return null;
  const meaningfulTokens = candidate
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (token) =>
        !new Set(["qual", "como", "e", "a", "o", "as", "os", "para", "em", "de", "da", "do"]).has(
          token,
        ),
    );
  if (meaningfulTokens.length === 0) return null;
  if (/^(?:e|a|o|e\s+a|e\s+o|para|em)$/i.test(candidate)) return null;
  if (/^(?:hoje|amanh[aã]|agora|semana|fim\s+de\s+semana)$/i.test(candidate)) return null;
  if (/^(?:o\s+)?(?:gado|rebanho|pasto|pasto do gado|campo)$/i.test(candidate)) return null;
  return candidate;
}

/**
 * Extrai cidade/região sem tentar geocodificar. A pesquisa externa confirma
 * homônimos, UF e país; aqui apenas impedimos que termos temporais virem local.
 */
export function extractWeatherLocation(text: string, allowBareLocation = false): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const marked = normalized.matchAll(
    /(?=\b(?:na\s+cidade\s+de|no\s+munic[ií]pio\s+de|na\s+regi[aã]o\s+de|regi[aã]o\s+de|em|para)\s+([^?!;]{2,120}))/giu,
  );

  for (const match of [...marked].reverse()) {
    const candidate = cleanLocationCandidate(match[1]);
    if (candidate) return candidate;
  }

  if (isWeatherRequest(normalized)) {
    const withoutWeather = normalized
      .replace(WEATHER_INTENT_RE, " ")
      .replace(TEMPORAL_TAIL_RE, " ")
      .replace(/\b(?:qual|como|est[aá]|ser[aá]|fica|ficar[aá]|me\s+diga|quero\s+saber)\b/gi, " ")
      .replace(/[?!]/g, " ");
    const candidate = cleanLocationCandidate(withoutWeather);
    if (candidate) return candidate;
  }

  return allowBareLocation ? cleanLocationCandidate(normalized.replace(/[?!]/g, "")) : null;
}

function rememberedLocation(state: ConversationState): string | null {
  const value = state.confirmed_data.weather_location;
  return typeof value === "string" ? cleanLocationCandidate(value) : null;
}

export function isWeatherLocationPrompt(text: string | null | undefined): boolean {
  return Boolean(text && WEATHER_LOCATION_PROMPT_RE.test(text));
}

export function resolveWeatherTurn(
  text: string,
  state: ConversationState,
  lastAssistantText?: string | null,
): WeatherTurnResolution {
  const direct = isWeatherRequest(text);
  const weatherPending =
    WEATHER_PENDING_RE.test(state.pending_action ?? "") ||
    isWeatherLocationPrompt(state.pending_question) ||
    isWeatherLocationPrompt(lastAssistantText);
  const topic = WEATHER_TOPIC_RE.test(state.current_topic ?? "");
  const contextualFollowUp = topic && WEATHER_FOLLOW_UP_RE.test(text.trim());
  const pending =
    weatherPending &&
    (isLikelyWeatherLocationReply(text) || WEATHER_FOLLOW_UP_RE.test(text.trim()));
  const isWeatherTurn = direct || pending || contextualFollowUp;

  if (!isWeatherTurn) {
    return { isWeatherTurn: false, location: null, usedRememberedLocation: false };
  }

  const explicit = extractWeatherLocation(text, pending || contextualFollowUp);
  if (explicit) {
    return { isWeatherTurn: true, location: explicit, usedRememberedLocation: false };
  }

  const remembered = rememberedLocation(state);
  return {
    isWeatherTurn: true,
    location: remembered,
    usedRememberedLocation: Boolean(remembered),
  };
}

export function buildWeatherResearchQuery(userText: string, location: string): string {
  return [
    `Previsão meteorológica aprofundada para ${location}, Brasil.`,
    `Pedido do usuário: ${userText}`,
    "Confirme que os dados pertencem ao município/região e à UF corretos; não misture localidades homônimas.",
    "Levante condição atual, próximas 24 horas e próximos 7 dias quando disponíveis: temperatura mínima/máxima, probabilidade e volume de chuva, umidade, vento/rajadas e alertas oficiais.",
    "Inclua horário e fuso de atualização, data de cada previsão, divergências entre modelos/fontes e dados úteis para decisões pecuárias.",
  ].join("\n");
}

export function weatherSourceDirective(location: string): string {
  return `POLÍTICA DE FONTES DESTE TURNO — PREVISÃO DO TEMPO: a localização confirmada é ${location}. Use somente os blocos meteorológicos recuperados neste turno. Quando houver o bloco oficial estruturado IBGE + INMET, trate a previsão municipal do INMET como fonte primária; use a pesquisa web para cruzar observações, alertas oficiais e divergências de modelos/fontes, sem substituir silenciosamente o INMET por uma fonte secundária. Confirme município/região e UF; não misture homônimos. Priorize INMET, CPTEC/INPE, Defesa Civil/CEMADEN, ANA e institutos meteorológicos estaduais ou regionais; complemente com modelos e serviços meteorológicos reconhecidos apenas quando necessário. Cruze pelo menos duas fontes atuais quando possível. Informe local, data e hora/fuso da atualização quando disponíveis, período previsto e fonte. Diferencie observação, previsão, alerta oficial e incerteza. Se uma das camadas de pesquisa estiver indisponível, responda com a camada válida restante e deixe a limitação explícita, sem inventar dados. Não invente precisão de bairro ou fazenda. Depois dos dados, traduza apenas os impactos sustentados pela previsão para a pecuária: conforto térmico, sombra e água, horário de manejo/transporte, pastagem, lama/alagamento, conservação de alimento, recém-nascidos, geada, raios, vendaval ou fogo. Não transforme climatologia histórica em previsão atual.

FORMATO DA RESPOSTA METEOROLÓGICA — prioridade alta para legibilidade:
- NÃO se apresente espontaneamente e NÃO escreva "Sou a TPEC-IA, a IA da pecuária" nesta resposta. A identidade só deve ser dita quando o usuário perguntar quem é a IA.
- Comece diretamente pela previsão para ${location}. Não use aberturas como "Confirmando:", "Resumo rápido:", "Segue a análise:" ou texto institucional.
- Escreva para leitura rápida em celular/WhatsApp: parágrafos curtos, espaços entre blocos e no máximo 3 a 5 bullets quando uma lista realmente ajudar.
- Para uma previsão geral de vários dias, destaque primeiro hoje/amanhã e depois AGRUPE dias consecutivos com comportamento parecido. Evite um bullet longo para cada dia quando o padrão for semelhante.
- Priorize temperatura e chuva. Umidade, vento/rajadas e alertas entram quando forem relevantes, anormais, pedidos pelo usuário ou importantes para a decisão. Não despeje todas as variáveis de todos os dias só porque elas existem.
- Não transforme consenso de modelos em relatório técnico. Cite ECMWF/GFS/ICON apenas quando a divergência ou o consenso mudar a interpretação; nesse caso explique em uma frase simples, com faixa e confiança.
- Preserve data explícita com ano, horário/fuso e fontes, mas compacte esses metadados em uma única linha curta no final da resposta sempre que não forem o foco.
- Se houver alerta oficial relevante, ele vem primeiro. Se não houver alerta relevante, não crie uma seção só para dizer isso, a menos que o usuário tenha perguntado por alertas.
- Impacto para pecuária deve aparecer em 1 ou 2 frases práticas quando realmente houver algo acionável; não acrescente uma seção genérica de manejo em toda previsão.
- A resposta final deve soar como alguém explicando a previsão para uma pessoa, não como um dump de banco de dados, laudo meteorológico ou relatório automático.`;
}
