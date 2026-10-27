import {
  ActionSchema,
  type GuardianAction,
  type RecordDraft,
  type PendingAction,
} from "./schema.ts";
import { certainStatement, userStatement } from "../whatsapp/learned-notes.ts";
import { brazilNumber } from "./parse.ts";
import { cardinal, foldHerd, herdStatement } from "./herd-language.ts";
import { eventDay, hasEventVerb } from "./herd-event-language.ts";
import { localDay } from "../chat/context/recall.ts";

type Slots = Pick<RecordDraft, "section" | "entries">;
export type RecordDialogue = { kind: "none" } | { kind: "slots"; slots: Slots };
export function moneyValue(text: string): number | null {
  const t = foldHerd(text)
    .replace(/^(?:foi|foram|deu|paguei|gastei|recebi|o valor foi|o valor e|r\$)\s*/i, "")
    .replace(/\s*rea(?:l|is)[.! ]*$/, "")
    .trim();
  const match = t.match(
    /^(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?:\s*(mil|milhao|milhoes))?[.! ]*$/,
  );
  const value = match
    ? brazilNumber(match[1]) * (match[2] === "mil" ? 1000 : match[2] ? 1000000 : 1)
    : cardinal(t);
  return value !== null && Number.isFinite(value) && value > 0 && value <= 1e10
    ? Math.round(value * 100)
    : null;
}
function amountIn(text: string) {
  const literal = text.replace(/\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/20\d{2})?)\b/g, "");
  const match =
    literal.match(
      /(?:R\$\s*|(?:paguei|pagamos|gastei|gastamos|recebi|recebemos|despesa|receita|valor|foi|deu)\s*(?:de |foi |deu |e )?)(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?!\d|[.,]\d)(?:\s*(mil|milh[aã]o|milh[oõ]es))?/i,
    ) ??
    literal.match(
      /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?:\s*(mil|milh[aã]o|milh[oõ]es))?\s+reais?\b/i,
    );
  if (!match) return null;
  const tail = literal.slice(match.index! + match[0].length);
  if (
    /^\s*(?:kg|litros?|sacos?|cabe[cç]as?|animais|bois|vacas|bezerros|d[oó]lares|usd|euros)\b/i.test(
      tail,
    )
  )
    return null;
  return { amount: moneyValue(match[1] + (match[2] ? " " + match[2] : "")), token: match[0] };
}
function monthReply(text: string, at: Date) {
  const t = foldHerd(text);
  const numeric = t.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/);
  if (numeric) return `${numeric[2]}-${numeric[1]}`;
  if (!/\b(?:neste|nesse|este|esse) mes\b|\bmes (?:atual|passado)\b/.test(t)) return null;
  const date = new Date(localDay(at) + "T12:00:00Z");
  if (/mes passado/.test(t)) date.setUTCMonth(date.getUTCMonth() - 1, 1);
  return date.toISOString().slice(0, 7);
}
export function recordDialogue(text: string, at: Date, mediaType?: string): RecordDialogue {
  const raw = userStatement(text, mediaType),
    clean = herdStatement(raw),
    t = foldHerd(clean);
  if (
    /^(?:resumo|relatorio|extrato|historico|saldo|listar|mostrar|ver|consultar|quanto|qual)\b/.test(
      foldHerd(raw),
    ) ||
    /^(?:financeiro|caderno de campo)[.! ]*$/.test(foldHerd(raw))
  )
    return { kind: "none" };
  if (!raw || raw.length > 2000 || (!certainStatement(clean) && !/^(?:despesa|receita)\b/.test(t)))
    return { kind: "none" };
  if (
    /\?|\b(?:nao|talvez|amanha|vou|vizinho|disse|simule|hipotetic|corrigindo|errei)\b|["“”]/i.test(
      t,
    )
  )
    return { kind: "none" };
  const finance =
    /\b(?:paguei|pagamos|gastei|gastamos|recebi|recebemos|despesas?|receitas?|financeiro)\b/.test(
      t,
    );
  const date = eventDay(clean, at),
    month = monthReply(clean, at);
  const reported = date.ambiguous || date.invalid || month ? undefined : (date.day ?? localDay(at));
  const lot = clean.match(/\blote\s+([\p{L}\d_-]+)/iu)?.[1];
  if (finance) {
    // Leave complete canonical commands in their existing reviewed flow.
    if (
      /^(?:(?:registrar?|registre|anote)\s+)?(?:despesa|receita)\s+(?:de\s+)?(?:r\$\s*)?\d[\s\S]*\s+(?:com|por|de)\s+.+/i.test(
        raw,
      ) &&
      amountIn(clean)?.amount &&
      reported
    )
      return { kind: "none" };
    // Monthly reports with multiple directions already have a complete batch parser.
    const labels = [...clean.matchAll(/\b(receitas?|despesas?)\b/gi)];
    if (labels.length > 1 || month) return { kind: "none" };
    const amount = amountIn(clean);
    const direction = /\b(?:paguei|pagamos|gastei|gastamos|despesa)\b/.test(t)
      ? ("expense" as const)
      : /\b(?:recebi|recebemos|receita)\b/.test(t)
        ? ("income" as const)
        : undefined;
    let description = amount ? clean.replace(amount.token, " ") : clean;
    description = description
      .trim()
      .replace(
        /^(?:no financeiro[, :]*\s*)?(?:eu\s+)?(?:paguei|pagamos|gastei|gastamos|recebi|recebemos|(?:uma?\s+)?despesa|(?:uma?\s+)?receita)\b\s*(?:de\s*)?/i,
        "",
      );
    description = description
      .replace(/^\s*rea(?:l|is)\b/i, "")
      .trim()
      .replace(/^(?:r\$\s*)?(?:com|em|pela?|pelo|de|por|referente a)\s+/i, "")
      .replace(
        /\b(?:hoje|ontem|anteontem|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/20\d{2})?)\b/gi,
        "",
      )
      .replace(/\s+/g, " ")
      .replace(/^[, :.-]+|[, :.-]+$/g, "")
      .trim();
    return {
      kind: "slots",
      slots: {
        section: "finance",
        entries: [
          {
            kind: "ledger",
            direction,
            ...(amount?.amount ? { amountCents: amount.amount } : {}),
            ...(description.length >= 3 ? { description: description.slice(0, 160) } : {}),
            ...(reported ? { date: reported } : {}),
            ...(lot ? { lot } : {}),
          },
        ],
      },
    };
  }
  const field =
    /\b(?:vacinei|vacinamos|vermifuguei|vermifugamos|adubei|adubamos|limpei|limpamos|consertei|consertamos|rocamos|rocei|reparei|reparamos)\b/.test(
      t,
    ) || /\bcaderno de campo\b/.test(t);
  if (!field || hasEventVerb(clean)) return { kind: "none" };
  const description = clean
    .replace(/^(?:no |(?:o |meu )?)?caderno de campo\s*[:,]?\s*(?:que\s+)?/i, "")
    .replace(/^(?:no|para o) caderno de campo\s*(?:que\s+)?/i, "")
    .trim();
  const count = clean.match(/\b(\d{1,6})\s+(?:animais|vacas|bezerros|novilhas|bois)\b/i)?.[1];
  return {
    kind: "slots",
    slots: {
      section: "field",
      entries: [
        {
          kind: "record",
          type: /vacin|vermifug|sanidade|sintoma/i.test(clean) ? "health" : "management",
          ...(description && !/^(?:caderno de campo|no caderno de campo)$/i.test(description)
            ? { description }
            : {}),
          ...(reported ? { date: reported } : {}),
          ...(lot ? { lot } : {}),
          ...(count ? { count: Number(count) } : {}),
        },
      ],
    },
  };
}
export function monthlyFinanceDraft(text: string, at: Date): Slots | null {
  const clean = herdStatement(text),
    matches = [...clean.matchAll(/\b(receitas?|despesas?)\b/gi)];
  if (!matches.length || matches.length > 2) return null;
  if (
    new Set(matches.map((m) => (/^receita/i.test(m[1]) ? "income" : "expense"))).size !==
    matches.length
  )
    return null;
  const period = monthReply(clean, at);
  const date = eventDay(clean, at);
  const entries: RecordDraft["entries"] = matches.map((m, i) => {
    const piece = clean.slice(m.index!, matches[i + 1]?.index ?? clean.length);
    const direction = /^receita/i.test(m[1]) ? ("income" as const) : ("expense" as const);
    const amount = amountIn(
      piece
        .replace(/\b(?:esta|estao|em torno de|de|foi|foram|e|tem)\b/gi, " ")
        .replace(/\s+/g, " "),
    );
    return {
      kind: "ledger",
      direction,
      description: `${direction === "income" ? "Receita" : "Despesa"} informada pelo produtor`,
      summary: true,
      ...(/em torno|aproximad|cerca de/i.test(piece) ? { estimated: true } : {}),
      ...(amount?.amount ? { amountCents: amount.amount } : {}),
      ...(period
        ? { periodMonth: period, date: localDay(at) }
        : date.day
          ? { date: date.day }
          : {}),
    };
  });
  return { section: "finance", entries };
}
export function missingRecordSlot(slots: Slots) {
  for (const e of slots.entries) {
    if (e.kind === "ledger" && !e.direction)
      return {
        field: "direction" as const,
        entry: e,
        question: "Esse lançamento é uma receita ou uma despesa?",
      };
    if (e.kind === "ledger" && !e.amountCents)
      return {
        field: "amount" as const,
        entry: e,
        question: `Qual foi o valor ${e.direction === "income" ? "da receita" : "da despesa"} em reais? Vou manter os outros dados já informados.`,
      };
    if (!e.description)
      return {
        field: "description" as const,
        entry: e,
        question:
          slots.section === "finance"
            ? "A que se refere esse lançamento?"
            : "O que aconteceu para anotar no caderno de campo?",
      };
    if (!e.date)
      return {
        field: "date" as const,
        entry: e,
        question: e.summary
          ? "Esses valores são de qual dia ou mês? Pode responder só o período."
          : "Em qual dia aconteceu? Pode responder só a data.",
      };
  }
  return null;
}
export function recordActions(slots: Slots): GuardianAction[] | null {
  if (missingRecordSlot(slots)) return null;
  const actions = slots.entries.map(({ summary: _summary, ...e }) => ActionSchema.safeParse(e));
  return actions.every((a) => a.success) ? actions.map((a) => a.data!) : null;
}
export function recordAnswer(text: string, draft: RecordDraft, at: Date): Slots | null {
  const next = structuredClone({ section: draft.section, entries: draft.entries }),
    missing = missingRecordSlot(next);
  if (!missing) return null;
  const t = foldHerd(text)
    .replace(/[.!]+$/g, "")
    .trim();
  if (/\?|\b(?:nao sei|talvez|simule|vizinho|disse|amanha)\b/.test(t)) return null;
  const lotOnly = t.match(/^(?:(?:foi|era|e)\s+)?(?:no\s+)?lote\s+([\p{L}\d_-]+)$/iu);
  if (lotOnly) {
    for (const e of next.entries) e.lot = lotOnly[1];
    return next;
  }
  const dateOnly =
    /^(?:(?:foi|era|aconteceu|em|no dia)\s+)?(?:hoje|ontem|anteontem|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/20\d{2})?|\d{2}\/20\d{2}|(?:neste|nesse|este|esse) mes|mes passado|mes atual)$/.test(
      t,
    );
  if (dateOnly) {
    const month = monthReply(t, at),
      date = eventDay(t, at);
    if (month && next.entries.every((e) => e.summary))
      for (const e of next.entries) {
        e.periodMonth = month;
        e.date = localDay(new Date(draft.sourceAt));
        e.description = `Total mensal de ${e.direction === "income" ? "receitas" : "despesas"} informado pelo produtor`;
      }
    else {
      if (!date.day || date.ambiguous || date.invalid) return null;
      for (const e of next.entries) e.date = date.day;
    }
    return next;
  }
  const amountMissing = next.entries.find((e) => e.kind === "ledger" && !e.amountCents),
    money = moneyValue(t);
  if (
    amountMissing &&
    money &&
    !(amountMissing.direction === "expense" && /\brecebi\b/.test(t)) &&
    !(amountMissing.direction === "income" && /\b(?:paguei|gastei)\b/.test(t))
  ) {
    amountMissing.amountCents = money;
    return next;
  }
  if (/^(?:foi|era|e) com\s+/.test(t) && certainStatement(text)) {
    const description = text.replace(/^(?:foi|era|[eé]) com\s+/i, "");
    if (description.length >= 3 && description.length <= 160) {
      missing.entry.description = description;
      return next;
    }
  }
  if (missing.field !== "amount" && recordDialogue(text, at).kind === "slots") return null;
  if (
    missing.field === "amount" &&
    ((missing.entry.direction === "expense" && /\brecebi\b/.test(t)) ||
      (missing.entry.direction === "income" && /\b(?:paguei|gastei)\b/.test(t)))
  )
    return null;
  if (missing.field === "amount") {
    const value = moneyValue(t);
    if (!value) return null;
    missing.entry.amountCents = value;
  }
  if (missing.field === "direction") {
    const dir = t.replace(/^(?:foi|e|era)\s+(?:uma?\s+)?/, "");
    if (!/^(?:receita|despesa)$/.test(dir)) return null;
    missing.entry.direction = dir === "receita" ? "income" : "expense";
  }
  if (missing.field === "description") {
    if (
      !certainStatement(text) ||
      text.length < 3 ||
      text.length > (draft.section === "finance" ? 160 : 1500)
    )
      return null;
    missing.entry.description = text.replace(/^(?:foi|era)\s+(?:com\s+)?/i, "");
  }
  if (missing.field === "date") {
    const month = monthReply(t, at),
      date = eventDay(t, at);
    if (month && next.entries.every((e) => e.summary))
      for (const e of next.entries) {
        e.periodMonth = month;
        e.date = localDay(new Date(draft.sourceAt));
        e.description = `Total mensal de ${e.direction === "income" ? "receitas" : "despesas"} informado pelo produtor`;
      }
    else {
      if (!date.day || date.ambiguous || date.invalid) return null;
      for (const e of next.entries) if (!e.date) e.date = date.day;
    }
  }
  return next;
}
export function proposalCorrection(
  text: string,
  pending: PendingAction,
  at: Date,
): GuardianAction | null {
  if ((pending.action.kind !== "ledger" && pending.action.kind !== "record") || text.includes("?"))
    return null;
  const t = foldHerd(text),
    corrected = { ...pending.action };
  const date = eventDay(t, at);
  if (
    /^(?:foi |era |a data (?:e |foi )?|no dia |em )?(?:hoje|ontem|anteontem|\d{1,2}\/\d{1,2}(?:\/20\d{2})?|20\d{2}-\d{2}-\d{2})[.! ]*$/.test(
      t,
    ) &&
    date.day &&
    !date.invalid &&
    !date.ambiguous
  )
    corrected.date = date.day;
  else if (
    corrected.kind === "ledger" &&
    /^(?:na verdade[, ]*|era |foi |o valor (?:e|foi) |valor[: ]*)/.test(t)
  ) {
    const value = moneyValue(
      t.replace(/^(?:na verdade[, ]*|era |o valor (?:e|foi) |valor[: ]*)/, ""),
    );
    if (!value) return null;
    corrected.amountCents = value;
  } else if (/^(?:foi|era) com\s+/.test(t))
    corrected.description = text.replace(/^(?:foi|era) com\s+/i, "").trim();
  else if (/^(?:no|foi no|era no) lote\s+[\p{L}\d_-]+[.! ]*$/iu.test(t))
    corrected.lot = text.match(/lote\s+([\p{L}\d_-]+)/iu)![1];
  else return null;
  const parsed = ActionSchema.safeParse(corrected);
  return parsed.success ? parsed.data : null;
}
