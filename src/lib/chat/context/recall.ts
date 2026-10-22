import type { ChatMessage } from "../types.ts";

export const CONTEXT_TIMEZONE = "America/Sao_Paulo";
export interface RecallPeriod {
  startDay: string;
  endDay: string;
  label: string;
}
export function localDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONTEXT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function shift(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
function validDay(year: number, month: number, day: number): string | null {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? value
    : null;
}
/** Local calendar arithmetic, independent of the server's UTC date. End is exclusive. */
export function recallPeriod(text: string, now = new Date()): RecallPeriod | null {
  const t = fold(text),
    today = localDay(now);
  const oneDay = (day: string, label: string): RecallPeriod => ({
    startDay: day,
    endDay: shift(day, 1),
    label,
  });
  const explicit = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (explicit) {
    const day = validDay(
      Number(explicit[3] ?? today.slice(0, 4)),
      Number(explicit[2]),
      Number(explicit[1]),
    );
    return day ? oneDay(day, explicit[0]) : null;
  }
  if (/\banteontem\b/.test(t)) return oneDay(shift(today, -2), "anteontem");
  if (/\bontem\b/.test(t)) return oneDay(shift(today, -1), "ontem");
  if (/\bhoje\b/.test(t)) return oneDay(today, "hoje");
  const ago = t.match(/\bha (\d{1,3}) dias?\b/);
  if (ago) return oneDay(shift(today, -Number(ago[1])), ago[0]);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = shift(today, -((weekday + 6) % 7));
  if (/\bsemana passada\b/.test(t))
    return { startDay: shift(monday, -7), endDay: monday, label: "semana passada" };
  if (/\b(?:nesta|essa|esta) semana\b/.test(t))
    return { startDay: monday, endDay: shift(today, 1), label: "esta semana" };
  if (/\bmes passado\b/.test(t)) {
    const first = `${today.slice(0, 7)}-01`;
    return { startDay: `${shift(first, -1).slice(0, 7)}-01`, endDay: first, label: "mês passado" };
  }
  const weekdays = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const named = weekdays.findIndex((day) =>
    new RegExp(`\\b${day}(?:-feira)?(?: passada| passado| ultima| ultimo)?\\b`).test(t),
  );
  if (
    named >= 0 &&
    /\b(passad[ao]|ultim[ao]|convers|falamos|anot|registr|marcad|pesad)\w*/.test(t)
  ) {
    const delta = (weekday - named + 7) % 7 || 7;
    return oneDay(shift(today, -delta), weekdays[named]);
  }
  return null;
}
export function referencesPriorContext(text: string): boolean {
  return /\b(ontem|anteontem|anterior\w*|passad[ao]|lembra\w*|conversamos|falamos|combinamos|continu\w*|retom\w*|aquele|aquela|aquilo|mesm[ao]s?|desse|dessa|disso|esses|essas|isso|deles|delas|ja (?:te )?(?:passei|enviei|falei|disse)|que (?:te )?(?:passei|enviei|falei))\b/.test(
    fold(text),
  );
}
const STOP = new Set(
  "a o as os de do da dos das em no na nos nas um uma uns umas e ou pra para por com sem eu voce voces ele ela eles elas quero queria preciso pode poderia faca fazer faz monte montar todo toda todos todas algo me mim te se que qual quais como quanto quantos ontem hoje anteontem sim nao isso essa esse esta este aquele aquela planilha pdf tabela relatorio resumo conversa conversamos falamos lembra lembrar envie enviar agora favor bom dia boa tarde noite".split(
    " ",
  ),
);
/** Search content words, not the literal wording of a request to recall them. */
export function recallQuery(text: string, history: ChatMessage[] = []): string {
  const seed =
    referencesPriorContext(text) ||
    /^(?:sim|nao|ok|pode|continua|e agora)[.!? ]*$/i.test(fold(text))
      ? [
          text,
          ...history
            .filter((m) => m.role === "user")
            .slice(-3)
            .map((m) => m.content.slice(0, 500)),
        ].join(" ")
      : text;
  const words = fold(seed).match(/[a-z0-9]{2,40}/g) ?? [];
  const terms = [...new Set(words.filter((word) => !STOP.has(word)))].slice(0, 20);
  // Domain equivalents improve recall without making identifiers fuzzy.
  if (terms.some((w) => /^(gado|rebanho|bovin|animal|animais|pesad|pesag|marcad)/.test(w)))
    terms.push("gado", "pesagem", "lote", "brinco");
  return [...new Set(terms)].join(" OR ");
}
