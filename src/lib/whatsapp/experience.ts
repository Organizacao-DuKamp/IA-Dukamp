export type WhatsAppProgressPlan = readonly [string, string, string];

const QUICK_MESSAGE_RE =
  /^(oi|ol[aá]|opa|e\s?a[ií]|bom\s+dia|boa\s+tarde|boa\s+noite|obrigad[oa]|valeu|vlw|ok|beleza|show|tchau|at[eé]\s+mais)[!.?\s…]*$/i;

const CURRENT_INFO_RE =
  /\b(hoje|agora|atual|mercado|cota[cç][aã]o|pre[cç]o|valor|not[ií]cia|clima|previs[aã]o|d[oó]lar|arroba|boi|soja|milho|leite|carne)\b/i;

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % length;
}

function pick(seed: string, values: readonly string[]): string {
  return values[stableIndex(seed, values.length)];
}

export function shouldShowWhatsAppProgress(text: string): boolean {
  const normalized = text.trim();
  return normalized.length > 0 && !QUICK_MESSAGE_RE.test(normalized);
}

export function buildWhatsAppProgressPlan(text: string, seed: string): WhatsAppProgressPlan {
  const current = CURRENT_INFO_RE.test(text);

  const first = current
    ? pick(`${seed}:first-current`, [
        "Só um instante — vou conferir os dados mais recentes pra te responder direito.",
        "Deixa eu checar isso direitinho. Vou buscar as informações mais atuais.",
        "Boa, vou conferir isso agora pra não te passar informação velha.",
      ])
    : pick(`${seed}:first-general`, [
        "Boa pergunta. Vou verificar isso direitinho e já te respondo.",
        "Certo, deixa eu conferir isso com cuidado antes de te responder.",
        "Entendi. Vou analisar isso aqui e já volto com uma resposta bem fechada.",
      ]);

  const second = current
    ? pick(`${seed}:second-current`, [
        "Ainda tô aqui 😄 Estou cruzando as informações pra te passar algo confiável.",
        "Ainda verificando por aqui. Quero te passar o dado certo, não um chute.",
        "Tô conferindo mais de uma referência pra não te entregar algo desatualizado.",
      ])
    : pick(`${seed}:second-general`, [
        "Ainda tô aqui 😄 Estou conferindo os detalhes pra não te responder pela metade.",
        "Só mais um pouquinho — estou cruzando as informações antes de fechar a resposta.",
        "Continuo verificando por aqui. Quero te responder com segurança, não no chute.",
      ]);

  const third = current
    ? pick(`${seed}:third-current`, [
        "Essa busca está levando um pouco mais que o normal. Tô procurando uma referência confiável antes de fechar.",
        "Tá demorando um pouco mais pra achar uma referência boa, mas continuo verificando por aqui.",
        "Essa consulta exigiu mais pesquisa que o normal. Ainda estou atrás de uma fonte confiável.",
      ])
    : pick(`${seed}:third-general`, [
        "Essa está levando um pouco mais que o normal pra fechar. Continuo verificando por aqui.",
        "Demorou um pouco mais do que eu esperava, mas ainda estou conferindo os detalhes.",
        "Essa resposta está exigindo uma checagem a mais. Continuo por aqui e já te retorno.",
      ]);

  return [first, second, third];
}

export function friendlyWhatsAppError(error: unknown): string {
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const details = [candidate?.message, candidate?.code, candidate?.status]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();

  if (/timeout|tempo limite|demorou|proxy_timeout|504/.test(details)) {
    return "A consulta demorou mais do que deveria e acabou não fechando. Não quero te deixar no vácuo nem inventar uma resposta: tenta me mandar a pergunta de novo em alguns instantes que eu faço uma nova busca.";
  }
  if (/perplexity|pesquisa atual|research|fonte atual/.test(details)) {
    return "Tive um problema ao consultar as informações mais recentes e não consegui confirmar isso agora. Prefiro te avisar do que te passar algo duvidoso. Tenta novamente em alguns instantes.";
  }
  if (/429|rate|muitas mensagens|muitas requisi/.test(details)) {
    return "Chegaram muitas consultas ao mesmo tempo e eu não consegui processar a sua agora. Espera só um pouquinho e manda de novo pra mim.";
  }
  if (/409|mensagem anterior|processando/.test(details)) {
    return "Ainda estou terminando sua mensagem anterior. Assim que ela fechar, pode mandar a próxima que eu continuo daqui.";
  }
  return "Opa, deu um problema aqui enquanto eu verificava isso e eu não consegui concluir a resposta. Não vou fingir que deu certo: tenta novamente em alguns instantes.";
}

export function emptyWhatsAppReply(): string {
  return "Eu consegui processar sua pergunta, mas a resposta voltou vazia por um erro daqui. Não quero te deixar sem retorno: manda a mesma pergunta de novo em alguns instantes que eu tento novamente.";
}

export type TrackedResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export async function resolveWithWhatsAppProgress<T>(
  task: Promise<T>,
  plan: WhatsAppProgressPlan,
  onProgress: (message: string) => Promise<void>,
  options: {
    sleep?: (ms: number) => Promise<void>;
    delaysMs?: readonly [number, number, number];
  } = {},
): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delays = options.delaysMs ?? [450, 6_500, 9_000];
  const tracked: Promise<TrackedResult<T>> = task.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );

  for (let index = 0; index < plan.length; index += 1) {
    const settled = await Promise.race([
      tracked,
      sleep(delays[index]).then(() => null),
    ]);
    if (settled) {
      if (settled.ok) return settled.value;
      throw settled.error;
    }
    await onProgress(plan[index]);
  }

  const settled = await tracked;
  if (settled.ok) return settled.value;
  throw settled.error;
}
