import { classifyDomainIntent, type IntentClassification } from "../chat/intent.ts";

export interface WhatsAppProgressMessage {
  delayMs: number;
  text: string;
}

type ProgressContext =
  | "market_overview"
  | "market_quote"
  | "product"
  | "commercial"
  | "nutrition"
  | "management"
  | "animal_health"
  | "document"
  | "current_updates"
  | "general";

interface ProgressTemplates {
  first: readonly string[];
  second: readonly string[];
}

const SMALL_TALK =
  /^(oi+|ol[aá]+|opa|e a[ií]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|vlw|blz|beleza|ok|okay|show|tmj|tamo junto|tchau|at[eé] mais|ah+h?\s*(?:que\s+)?lega[lk]|(?:que\s+)?legal|bacana|massa|top|interessante|entendi|saquei|perfeito|[oó]timo|kk+|rs+|ha(?:ha)+|que|qu[eê]\??|como assim|n[aã]o entendi|n[aã]o saquei|h[aã]+|hein)[!.?\s…]*$/i;

const MARKET_OVERVIEW =
  /\b(mercado|cen[aá]rio|setor|panorama|tend[eê]ncia|exporta[cç][aã]o|carne|carnes|bovino|bovinos|su[ií]no|su[ií]nos|frango|aves|prote[ií]na animal|soja|milho|leite|gr[aã]os)\b/i;

const PROGRESS_TEMPLATES: Record<ProgressContext, ProgressTemplates> = {
  market_overview: {
    first: [
      "Boa, vou levantar o panorama mais recente desse mercado e comparar as referências antes de te responder.",
      "Deixa eu olhar como esse mercado está se comportando agora e cruzar as fontes mais atuais.",
      "Vou montar uma visão atual desse mercado pra você, conferindo os dados recentes antes de fechar a resposta.",
    ],
    second: [
      "Tô cruzando as referências porque os indicadores não estão todos apontando na mesma direção. Já fecho o panorama.",
      "Ainda conferindo por aqui — quero separar tendência de mercado de dado isolado antes de te passar a leitura.",
      "Essa análise pediu uma checagem a mais nas fontes recentes. Continuo comparando os sinais antes de concluir.",
    ],
  },
  market_quote: {
    first: [
      "Vou conferir a cotação mais recente, com data, praça e fonte, pra não te passar valor velho.",
      "Certo, deixa eu buscar a referência de preço mais atual e validar de onde esse número veio.",
      "Vou checar essa cotação agora e comparar as publicações mais recentes antes de te dar o valor.",
    ],
    second: [
      "Ainda comparando data e praça da cotação — prefiro segurar um pouco do que misturar valores de dias diferentes.",
      "A cotação está exigindo uma conferência extra entre as fontes. Tô validando qual referência é realmente a mais recente.",
      "Continuo checando os valores porque encontrei referências de momentos diferentes. Já organizo isso certinho.",
    ],
  },
  product: {
    first: [
      "Beleza, vou conferir o cadastro oficial da DuKamp e separar o que realmente corresponde ao que você pediu.",
      "Deixa eu consultar os produtos da DuKamp certinho antes de te indicar qualquer coisa.",
      "Vou olhar essa informação direto na base da DuKamp pra te responder com produto e dado corretos.",
    ],
    second: [
      "Ainda conferindo o cadastro porque quero evitar te indicar um item parecido, mas que não seja exatamente o que você precisa.",
      "Tô revisando os detalhes do produto na base antes de fechar a resposta. Só mais um pouco.",
      "A busca no catálogo pediu uma checagem extra. Continuo validando os dados oficiais da DuKamp.",
    ],
  },
  commercial: {
    first: [
      "Certo, vou conferir essa informação comercial na DuKamp e já te retorno com o dado correto.",
      "Deixa eu verificar isso na parte comercial pra não te passar contato, pedido ou informação desatualizada.",
      "Vou checar esse ponto direto nos dados da DuKamp antes de te responder.",
    ],
    second: [
      "Ainda verificando os dados comerciais por aqui. Quero confirmar tudo antes de te direcionar.",
      "Essa consulta comercial levou um pouco mais que o normal; continuo conferindo pra não te mandar pro lugar errado.",
      "Tô fechando a conferência dos dados da DuKamp. Prefiro validar antes de te passar a informação pela metade.",
    ],
  },
  nutrition: {
    first: [
      "Boa pergunta. Vou analisar isso pelo lado nutricional e conferir os pontos importantes antes de te responder.",
      "Deixa eu organizar essa parte de alimentação e nutrição com cuidado pra te dar uma orientação coerente.",
      "Vou conferir os critérios nutricionais envolvidos nisso antes de fechar a resposta pra você.",
    ],
    second: [
      "Ainda analisando porque essa parte nutricional depende de alguns detalhes que eu não quero simplificar demais.",
      "Tô cruzando os pontos de nutrição e manejo alimentar antes de concluir. Já te respondo com isso organizado.",
      "Essa dúvida nutricional pediu uma checagem a mais. Continuo revisando pra não te dar uma resposta genérica demais.",
    ],
  },
  management: {
    first: [
      "Vou analisar esse cenário de manejo com calma e organizar uma resposta prática pra sua situação.",
      "Certo, deixa eu revisar os pontos de manejo envolvidos nisso antes de te sugerir um caminho.",
      "Vou conferir esse manejo por etapas pra te responder de um jeito que faça sentido na prática.",
    ],
    second: [
      "Ainda organizando os pontos de manejo porque tem mais de um fator envolvido. Já fecho uma orientação mais útil.",
      "Tô revisando esse cenário com um pouco mais de cuidado pra não te passar uma recomendação rasa.",
      "Essa análise de manejo levou uma checagem extra. Continuo por aqui e já concluo.",
    ],
  },
  animal_health: {
    first: [
      "Vou olhar isso com atenção porque envolve saúde animal e eu não quero responder no automático.",
      "Entendi. Deixa eu revisar os sinais e os cuidados envolvidos antes de te orientar com segurança.",
      "Vou analisar essa situação de sanidade com mais cuidado antes de te responder.",
    ],
    second: [
      "Ainda revisando porque, em saúde animal, alguns detalhes mudam bastante a orientação. Já organizo os próximos passos.",
      "Tô conferindo os pontos de segurança antes de concluir — nesse tipo de dúvida vale evitar qualquer resposta apressada.",
      "Essa situação de sanidade merece uma checagem a mais. Continuo analisando e já te retorno de forma objetiva.",
    ],
  },
  document: {
    first: [
      "Vou conferir o material que você mencionou e organizar os pontos relevantes antes de responder.",
      "Certo, deixa eu revisar esse documento ou conteúdo com atenção pra não deixar passar detalhe importante.",
      "Vou analisar o material primeiro e depois te devolvo uma resposta já organizada.",
    ],
    second: [
      "Ainda revisando o conteúdo porque tem alguns detalhes que preciso cruzar antes de concluir.",
      "Tô terminando a leitura e separando o que realmente importa pra sua pergunta. Já fecho a resposta.",
      "Esse material pediu uma revisão um pouco mais cuidadosa. Continuo por aqui e já te retorno.",
    ],
  },
  current_updates: {
    first: [
      "Vou conferir as informações mais recentes sobre isso antes de te responder, porque esse assunto pode ter mudado.",
      "Deixa eu checar o que está valendo agora e comparar as fontes atuais antes de concluir.",
      "Vou buscar a atualização mais recente desse assunto pra não me apoiar em informação antiga.",
    ],
    second: [
      "Ainda conferindo as atualizações porque encontrei informações de datas diferentes. Já separo o que está valendo agora.",
      "Tô comparando as fontes mais recentes antes de fechar a resposta. Esse assunto mudou bastante com o tempo.",
      "Essa atualização levou uma checagem extra. Continuo validando qual informação é realmente a mais atual.",
    ],
  },
  general: {
    first: [
      "Boa pergunta. Vou organizar isso direitinho antes de te responder.",
      "Entendi. Deixa eu analisar os pontos principais e já te devolvo uma resposta mais redonda.",
      "Certo, vou conferir isso com cuidado pra te responder sem atropelar os detalhes.",
    ],
    second: [
      "Ainda tô por aqui — essa resposta pediu uma análise a mais antes de eu fechar.",
      "Só está levando um pouco mais que o normal. Tô revisando os detalhes pra te responder direito.",
      "Continuo verificando. Prefiro gastar mais alguns segundos do que te devolver uma resposta pela metade.",
    ],
  },
};

export const WHATSAPP_PROGRESS_TEMPLATE_COUNT = Object.values(PROGRESS_TEMPLATES).reduce(
  (total, templates) => total + templates.first.length + templates.second.length,
  0,
);

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash % length;
}

function pick(seed: string, values: readonly string[]): string {
  return values[stableIndex(seed, values.length)];
}

function needsRealLookup(classification: IntentClassification): boolean {
  return classification.needs_web_search || classification.needs_internal_search;
}

function progressContextFor(text: string, classification: IntentClassification): ProgressContext {
  if (classification.intent === "market_quote") return "market_quote";
  if (classification.intent === "current_research") {
    return MARKET_OVERVIEW.test(text) ? "market_overview" : "current_updates";
  }
  if (
    classification.intent === "product" ||
    classification.intent === "product_recommendation" ||
    classification.intent === "internal_price"
  ) {
    return "product";
  }
  if (
    classification.intent === "seller_contact" ||
    classification.intent === "store" ||
    classification.intent === "order" ||
    classification.intent === "human_support"
  ) {
    return "commercial";
  }
  if (classification.intent === "nutrition") return "nutrition";
  if (classification.intent === "management") return "management";
  if (classification.intent === "animal_health") return "animal_health";
  if (classification.intent === "document_or_image") return "document";
  return "general";
}

export function isWhatsAppSmallTalk(text: string): boolean {
  return SMALL_TALK.test(text.trim());
}

/**
 * A presença só aparece quando o classificador prevê uma consulta real (web ou
 * base interna). O texto permanece apenas como metadado determinístico do plano:
 * o transporte usa o indicador nativo de digitação, não envia esta frase ao chat.
 * Existe exatamente um sinal para evitar ruído e repetição em consultas lentas.
 */
export function buildWhatsAppProgressPlan(text: string, seed = text): WhatsAppProgressMessage[] {
  const normalized = text.trim();
  if (!normalized || isWhatsAppSmallTalk(normalized)) return [];

  const classification = classifyDomainIntent(normalized);
  if (!needsRealLookup(classification)) return [];

  const context = progressContextFor(normalized, classification);
  const templates = PROGRESS_TEMPLATES[context];
  const first = pick(`${seed}:${context}:first`, templates.first);
  return [{ delayMs: 900, text: first }];
}

export function friendlyWhatsAppError(error: unknown): string {
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const status = typeof candidate?.status === "number" ? candidate.status : 0;
  const searchable = `${message} ${code}`;

  if (status === 413 || /media_too_large|maior que o limite/i.test(searchable)) {
    return "Esse arquivo passou do limite de 25 MB que eu consigo analisar. Envie uma versão menor ou divida o conteúdo em mais de uma mensagem.";
  }
  if (status === 415 || /unsupported_whatsapp_media|formato de mídia/i.test(searchable)) {
    return "Ainda não consigo analisar esse formato. Tente enviar imagem em JPG, PNG ou WebP; áudio/vídeo em MP4, MPEG, OGG, WAV ou WebM; ou um documento comum como PDF, Word, Excel, PowerPoint, CSV ou texto.";
  }
  if (
    /missing_(whatsapp_access_token|openai_api_key)|mídia.*não está configurad/i.test(searchable)
  ) {
    return "A leitura de arquivos ainda não está configurada corretamente por aqui. Já identifiquei o problema; por enquanto, envie sua dúvida em texto.";
  }
  if (
    /media_(metadata|download)|media_url|checksum|integridade|localizar|baixar|endere[cç]o de mídia/i.test(
      searchable,
    )
  ) {
    return "Não consegui baixar esse arquivo do WhatsApp com segurança. Tente reenviá-lo; se continuar, mande o conteúdo em outro formato ou escreva a dúvida.";
  }
  if (/media_transcription|transcrever|fala compreensível/i.test(searchable)) {
    return "Não consegui entender o áudio desse arquivo. Tente reenviar com o som mais nítido ou escreva a dúvida na mensagem.";
  }
  if (/media_analysis|interpretar a mídia|conteúdo na mídia/i.test(searchable)) {
    return "Não consegui ler o conteúdo desse arquivo com confiança. Tente reenviar com melhor qualidade ou escreva o ponto principal na mensagem.";
  }
  if (status === 504 || /timeout|tempo limite|demorou/i.test(searchable)) {
    return "Essa consulta demorou mais do que deveria e eu não consegui fechar uma resposta confiável agora. Não vou inventar um resultado — tenta me mandar a pergunta novamente daqui a pouco.";
  }
  if (/perplexity|pesquisa atual|current_research|research/i.test(searchable)) {
    return "Tive um problema ao consultar as informações mais recentes e não consegui confirmar a resposta agora. Prefiro te avisar do que te passar algo duvidoso. Tenta novamente em instantes.";
  }
  if (status === 429 || /rate.?limit|muitas (mensagens|requisi[cç][oõ]es)/i.test(searchable)) {
    return "Chegaram muitas consultas ao mesmo tempo e eu não consegui processar a sua agora. Espera só um pouquinho e me manda novamente.";
  }
  if (
    status === 409 ||
    /processing|in.?progress|em processamento|mensagem anterior/i.test(searchable)
  ) {
    return "Ainda estou terminando sua mensagem anterior. Assim que ela fechar, pode mandar a próxima que eu continuo daqui.";
  }
  return "Opa, deu um problema aqui enquanto eu verificava isso e eu não consegui concluir a resposta. Não vou fingir que deu certo: tenta novamente em alguns instantes.";
}

export function emptyWhatsAppReply(): string {
  return "Eu processei sua pergunta, mas a resposta voltou vazia por um erro daqui. Não quero te deixar sem retorno: tenta mandar a mesma pergunta novamente em instantes.";
}

export function humanizeWhatsAppReply(userText: string, reply: string): string {
  const normalizedReply = reply.trim();
  if (!isWhatsAppSmallTalk(userText)) return normalizedReply;

  if (/^oi! sou a tpec-ia, assistente da dukamp\./i.test(normalizedReply)) {
    return "Oi! 👋 Tô por aqui. Pode mandar.";
  }
  if (/^ol[aá]! sou a tpec-ia/i.test(normalizedReply)) {
    return "Oi! 👋 Tô por aqui. Pode mandar.";
  }
  return normalizedReply;
}

type Tracked<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function resolveWithWhatsAppProgress<T>(
  task: Promise<T>,
  plan: readonly WhatsAppProgressMessage[],
  onProgress: (message: string) => Promise<void>,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  const tracked: Promise<Tracked<T>> = task.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
  let previousDelay = 0;

  for (const progress of plan) {
    const waitMs = Math.max(0, progress.delayMs - previousDelay);
    const settled = await Promise.race([tracked, sleep(waitMs).then(() => null)]);
    if (settled) {
      if (settled.ok) return settled.value;
      throw settled.error;
    }
    await onProgress(progress.text);
    previousDelay = progress.delayMs;
  }

  const settled = await tracked;
  if (settled.ok) return settled.value;
  throw settled.error;
}
