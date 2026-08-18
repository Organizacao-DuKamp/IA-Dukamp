export interface WhatsAppProgressMessage {
  delayMs: number;
  text: string;
}

const SMALL_TALK =
  /^(oi+|ol[aá]+|opa|e a[ií]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|vlw|blz|beleza|ok|okay|show|tmj|tamo junto)[!.?\s]*$/i;

const CURRENT_INFO =
  /\b(hoje|agora|atual|atualmente|mercado|cota[cç][aã]o|pre[cç]o|valor|not[ií]cia|clima|previs[aã]o|exporta[cç][aã]o|arroba|boi china|boi gordo)\b/i;

const COMMERCIAL =
  /\b(produto|dukamp|estoque|vendedor|representante|consultor|comprar|compra|pre[cç]o|valor)\b/i;

export function isWhatsAppSmallTalk(text: string): boolean {
  return SMALL_TALK.test(text.trim());
}

export function buildWhatsAppProgressPlan(text: string): WhatsAppProgressMessage[] {
  const normalized = text.trim();
  if (!normalized || isWhatsAppSmallTalk(normalized)) return [];

  const immediate = CURRENT_INFO.test(normalized)
    ? "Humm, deixa eu conferir os dados mais recentes pra não te passar informação velha. Só um minutinho."
    : COMMERCIAL.test(normalized)
      ? "Beleza, deixa eu conferir isso certinho pra você."
      : "Entendi. Vou analisar isso com cuidado e já te respondo.";

  return [
    { delayMs: 0, text: immediate },
    {
      delayMs: 8_000,
      text: "Ainda tô cruzando as informações aqui pra te passar algo confiável.",
    },
    {
      delayMs: 18_000,
      text: "Tá levando um pouco mais que o normal pra achar resultados bons, mas sigo verificando por aqui.",
    },
  ];
}

export function friendlyWhatsAppError(error: unknown): string {
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const status = typeof candidate?.status === "number" ? candidate.status : 0;
  const searchable = `${message} ${code}`;

  if (status === 504 || /timeout|tempo limite|demorou/i.test(searchable)) {
    return "Poxa, essa consulta demorou mais do que deveria e eu não consegui concluir agora. Me manda a pergunta de novo daqui a pouquinho que eu refaço a busca.";
  }
  if (/perplexity|pesquisa atual|current_research|research/i.test(searchable)) {
    return "Tive um problema ao consultar as informações mais recentes e não consegui confirmar a resposta agora. Prefiro te avisar do que inventar um resultado. Tenta de novo em instantes.";
  }
  if (status === 429 || /rate.?limit|muitas (mensagens|requisi[cç][oõ]es)/i.test(searchable)) {
    return "Recebi muitas consultas em sequência e não consegui processar essa agora. Espera só um pouquinho e me manda novamente.";
  }
  if (status === 409 || /processing|in.?progress|em processamento/i.test(searchable)) {
    return "Ainda tô terminando sua mensagem anterior. Assim que concluir, te respondo por aqui.";
  }
  return "Ops, tive um problema enquanto verificava isso e não consegui concluir a resposta. Pode tentar de novo em instantes.";
}

export function humanizeWhatsAppReply(userText: string, reply: string): string {
  const normalizedReply = reply.trim();
  if (!isWhatsAppSmallTalk(userText)) return normalizedReply;

  if (/^oi! sou a tpec-ia, assistente da dukamp\./i.test(normalizedReply)) {
    return "Oi! 👋 Tô por aqui. Pode mandar o que você quer saber.";
  }
  if (/^ol[aá]! sou a tpec-ia/i.test(normalizedReply)) {
    return "Oi! 👋 Tô por aqui. Pode mandar.";
  }
  return normalizedReply;
}
