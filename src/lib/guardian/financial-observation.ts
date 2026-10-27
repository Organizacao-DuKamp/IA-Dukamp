import { ActionSchema, type GuardianAction } from "./schema.ts";
import { certainStatement } from "../whatsapp/learned-notes.ts";
import { localDay, recallPeriod } from "../chat/context/recall.ts";
import type { AutomaticObservation } from "./automatic.ts";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Literal monetary assertions. A month is a total, not an invented daily transaction. */
export function financialObservation(text: string, at: Date): AutomaticObservation {
  if (!/\b(?:receitas?|despesas?)\b/i.test(text)) return { status: "none" };
  // Preserve the existing reviewed flow for a single, ordinary daily command.
  if (
    /^(?:(?:registrar?|registre|anote)\s+)?(?:receita|despesa)\b/i.test(text) &&
    (text.match(/\b(?:receitas?|despesas?)\b/gi)?.length ?? 0) === 1 &&
    !/\b(?:mil|milh[aã]o|milh[oõ]es|m[eê]s|mensal)\b/i.test(text)
  )
    return { status: "none" };
  const assertion = text
    .replace(
      /^(?:registre|registrar|anote|anotar)\s+(?:a[ií]\s+)?(?:tamb[eé]m\s+)?(?:que\s+)?/i,
      "",
    )
    .replace(
      /[,;.]?\s*(?:registre|anote|salve|registrar)\s+(?:isso|esses valores|por favor)[.! ]*$/i,
      "",
    );
  // Explicit financial instructions are allowed here, while questions and plans are not.
  const certainty = assertion.replace(
    /\b(?:em torno de|cerca de|aproximadamente|mais ou menos)\b/gi,
    "",
  );
  if (
    !certainStatement(certainty) &&
    !(/^(?:receitas?|despesas?)\b/i.test(certainty) && certainStatement("Eu informo " + certainty))
  )
    return { status: "none" };
  const t = fold(assertion),
    day = localDay(at);
  if (/\b(?:nao|tera|terao|vai|previst[ao]s?|previsao|sera|serao)\b/.test(t))
    return { status: "none" };
  const month = /\b(?:(?:nesse|neste|esse|este) mes|mes atual|mensal|mes passado)\b/.test(t);
  let periodMonth: string | undefined;
  if (month) {
    const date = new Date(day + "T12:00:00Z");
    if (/\bmes passado\b/.test(t)) date.setUTCMonth(date.getUTCMonth() - 1, 1);
    periodMonth = date.toISOString().slice(0, 7);
  }
  const pending = (): AutomaticObservation => ({
    status: "pending",
    reason: "ambiguous_date",
    reply:
      "Esses valores são totais de qual mês ou lançamentos de qual dia? Informe o período e o valor de cada receita/despesa. Ainda não salvei no financeiro.",
  });
  const period = recallPeriod(assertion, at);
  if (!month && !period) return pending();
  if (month && /\b(?:ano passado|ano que vem|semana|20\d{2})\b/.test(t)) return pending();
  if (month && /\bmes passado\b/.test(t) && /\b(?:nesse|neste|esse|este) mes\b/.test(t))
    return pending();
  // A purchase/sale for a month needs its transaction date, not a synthetic monthly total.
  if (
    month &&
    /\b(?:com|por|referente a|pela|pelo|da venda|de venda|da compra|de compra)\b/.test(t)
  )
    return pending();
  const dateMentions =
    t.match(/\b(?:hoje|ontem|anteontem)\b|\b\d{1,2}\/\d{1,2}(?:\/20\d{2})?\b/g) ?? [];
  if (new Set(dateMentions).size > 1) return pending();
  if (!month && period && Date.parse(period.endDay) - Date.parse(period.startDay) !== 86400000)
    return pending();
  const matches = [
    ...assertion.matchAll(
      /\b(receitas?|despesas?)\b([^\d\n;]{0,80}?)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?!\d|[.,]\d)(?:\s*(milh[oõ]es|milh[aã]o|mil)\b)?/gi,
    ),
  ];
  const mentions = [...assertion.matchAll(/\b(?:receitas?|despesas?)\b/gi)];
  if (!matches.length || matches.length !== mentions.length) return pending();
  const actions: GuardianAction[] = [];
  for (const [index, match] of matches.entries()) {
    const bridge = fold(match[2]).replace(/r\$/g, "").trim();
    if (
      bridge &&
      !/^(?:(?:de|do|da|minha|fazenda|propriedade|em|torno|cerca|aproximadamente|mais|ou|menos|no|valor|total|esta|estao|e|sao|foi|foram|tem|teve|tive|ficou|ficaram)\b|\s|:)+$/.test(
        bridge,
      )
    )
      return pending();
    const numeric =
      match[3].includes(",") || /\.\d{3}\b/.test(match[3])
        ? Number(match[3].replace(/\./g, "").replace(",", "."))
        : Number(match[3]);
    const multiplier = !match[4] ? 1 : fold(match[4]) === "mil" ? 1000 : 1_000_000;
    const direction = fold(match[1]).startsWith("receita") ? "income" : "expense";
    const tail = assertion.slice(
      match.index! + match[0].length,
      matches[index + 1]?.index ?? assertion.length,
    );
    if (/^\s*(?:k\b|bilh|centavos|d[oó]lares|usd\b|euros)/i.test(tail)) return pending();
    const detail = tail
      .replace(/^\s*(?:reais\b)?\s*(?:com|por|referente a|de)\s+/i, "")
      .replace(/[,.;]?\s*(?:e(?: uma?)?|nesse m[eê]s|neste m[eê]s|hoje|ontem)[\s\S]*$/i, "")
      .trim();
    const parsed = ActionSchema.safeParse({
      kind: "ledger",
      direction,
      amountCents: Math.round(numeric * multiplier * 100),
      date: periodMonth ? day : (period?.startDay ?? day),
      description: (periodMonth
        ? `Total mensal de ${direction === "income" ? "receitas" : "despesas"} informado pelo produtor`
        : detail || `${direction === "income" ? "Receita" : "Despesa"} informada pelo produtor`
      ).slice(0, 160),
      ...(periodMonth ? { periodMonth } : {}),
      ...(/\b(?:em torno|cerca de|aproximadamente|mais ou menos)\b/i.test(match[2])
        ? { estimated: true }
        : {}),
    });
    if (!parsed.success) return pending();
    actions.push(parsed.data);
  }
  // Two totals for the same scope/direction in one sentence need clarification.
  if (
    periodMonth &&
    new Set(actions.map((a) => a.kind === "ledger" && a.direction)).size !== actions.length
  )
    return pending();
  return actions.length === 1
    ? { status: "action", action: actions[0] }
    : { status: "batch", actions };
}
