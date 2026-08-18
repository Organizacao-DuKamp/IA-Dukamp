export interface WhatsAppProgressMessage {
  delayMs: number;
  text: string;
}

const SMALL_TALK =
  /^(oi+|ol[aá]+|opa|e a[ií]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|vlw|blz|beleza|ok|okay|show|tmj|tamo junto|tchau|at[eé] mais)[!.?\s…]*$/i;

const CURRENT_INFO =
  /\b(hoje|agora|atual|atualmente|mercado|cota[cç][aã]o|pre[cç]o|valor|not[ií]cia|clima|previs[aã]o|exporta[cç][aã]o|arroba|boi china|boi gordo|soja|milho|leite|carne)\b/i;

const COMMERCIAL =
  /\b(produto|dukamp|estoque|vendedor|representante|consultor|comprar|compra|pedido)\b/i;

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash % length;
}

function pick(seed: string, values: readonly string[]): string {
  return values[stableIndex(seed, values.length)];
}

export function isWhatsAppSmallTalk(text: string): boolean {
  return SMALL_TALK.test(text.trim());
}

/**
 * No máximo duas mensagens de presença por pergunta. Os tempos são absolutos
 * desde o início do processamento e nunca são executados por timers soltos.
 */
export function buildWhatsAppProgressPlan(
  text: string,
  seed = text,
): WhatsAppProgressMessage[] {
  const normalized = text.trim();
  if (!normalized || isWhatsAppSmallTalk(normalized)) return [];

  const current = CURRENT_INFO.test(normalized);
  const commercial = COMMERCIAL.test(normalized);
  const first = current
    ? pick(`${seed}:current:first`, [
        "Deixa eu conferir as informações mais recentes pra não te passar algo desatualizado.",
        "Vou checar os dados mais atuais antes de te responder. Já volto com isso.",
        "Boa, vou conferir isso nas informações mais recentes pra te responder direito.",
      ])
    : commercial
      ? pick(`${seed}:commercial:first`, [
          "Beleza, vou conferir isso certinho na DuKamp antes de te responder.",
          "Certo, deixa eu verificar essa informação direitinho pra você.",
          "Entendi. Vou conferir os dados certos antes de te responder.",
        ])
      : pick(`${seed}:general:first`, [
          "Boa pergunta. Vou conferir isso com cuidado e já te respondo.",
          "Entendi. Deixa eu verificar isso direitinho antes de fechar a resposta.",
          "Certo, vou analisar isso com cuidado pra te responder direito.",
        ]);

  const second = current
    ? pick(`${seed}:current:second`, [
        "Ainda tô conferindo. Essa busca levou um pouco mais, mas prefiro fechar com uma fonte confiável.",
        "Essa consulta tá levando um pouco mais que o normal. Continuo checando pra não te passar um dado no chute.",
        "Ainda verificando por aqui — estou cruzando as referências antes de fechar a resposta.",
      ])
    : pick(`${seed}:general:second`, [
        "Ainda tô por aqui. Essa resposta exigiu uma checagem a mais antes de eu fechar.",
        "Só está levando um pouco mais que o normal; continuo conferindo os detalhes.",
        "Ainda verificando. Prefiro demorar um pouco mais do que te responder pela metade.",
      ]);

  return [
    { delayMs: 900, text: first },
    { delayMs: 10_000, text: second },
  ];
}

export function friendlyWhatsAppError(error: unknown): string {
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const status = typeof candidate?.status === "number" ? candidate.status : 0;
  const searchable = `${message} ${code}`;

  if (status === 504 || /timeout|tempo limite|demorou/i.test(searchable)) {
    return "Essa consulta demorou mais do que deveria e eu não consegui fechar uma resposta confiável agora. Não vou inventar um resultado — tenta me mandar a pergunta novamente daqui a pouco.";
  }
  if (/perplexity|pesquisa atual|current_research|research/i.test(searchable)) {
    return "Tive um problema ao consultar as informações mais recentes e não consegui confirmar a resposta agora. Prefiro te avisar do que te passar algo duvidoso. Tenta novamente em instantes.";
  }
  if (status === 429 || /rate.?limit|muitas (mensagens|requisi[cç][oõ]es)/i.test(searchable)) {
    return "Chegaram muitas consultas ao mesmo tempo e eu não consegui processar a sua agora. Espera só um pouquinho e me manda novamente.";
  }
  if (status === 409 || /processing|in.?progress|em processamento|mensagem anterior/i.test(searchable)) {
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
