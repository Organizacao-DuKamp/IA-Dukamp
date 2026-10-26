import { ActionSchema, type GuardianSnapshot, type GuardianAction } from "./schema.ts";
import { OperationsActionSchema } from "./operations.ts";
import { certainStatement, statementParts, userStatement } from "../whatsapp/learned-notes.ts";
import { localDay, recallPeriod } from "../chat/context/recall.ts";

export type AutomaticObservation =
  | { status: "none" }
  | { status: "pending"; reason: "ambiguous_property" | "ambiguous_date" }
  | { status: "action"; action: GuardianAction }
  | { status: "batch"; actions: GuardianAction[] };
/** Conservative literal extraction: no provider call and no model-generated media facts. */
export function automaticFarmEvent(
  input: {
    text: string;
    mediaType?: string;
    at: Date;
    history?: Array<{ role: string; content: string }>;
  },
  snapshot: GuardianSnapshot,
): AutomaticObservation {
  const text = userStatement(input.text, input.mediaType);
  // Preserve the private-notebook workflow for legacy books with no operational
  // baseline/profile yet. Observed-fact projection or an explicit count initializes it.
  if (
    (!snapshot.active && !snapshot.properties.length) ||
    (snapshot.active && !snapshot.active.book.operations)
  )
    return { status: "none" };
  if (
    /encaminhad[oa]|mensagem de|corrigindo|me enganei|na verdade|errei|\b(?:vizinho|vizinha|disse|falou|suponha|hipotetic|simula)\b|```|(?:^|\n)\s*>/i.test(
      text,
    )
  )
    return { status: "none" };
  const candidates: GuardianAction[] = [];
  for (const quote of statementParts(text)) {
    if (
      !certainStatement(quote) ||
      quote.length > 1500 ||
      /\b(?:não|nao|corrigindo|corri[gj]a|na verdade|errei|de novo|novamente)\b/i.test(quote)
    )
      continue;
    const declarations = quote.match(
      /\b(?:nasceram|nasceu|morreram|morreu|vendi|vendemos|comprei|compramos|vacinei|vacinamos|passei|transferi)\s+\d/gi,
    );
    if (declarations && declarations.length > 1)
      return { status: "pending", reason: "ambiguous_date" };
    const literal = quote.replace(/^(?:hoje|ontem)[, ]+/i, "");
    const match = literal.match(
      /^(?:(?:eu|nós|nos)\s+)?(nasceram|nasceu|morreram|morreu|vendi|vendemos|comprei|compramos)\s+(\d{1,6})\s+(?:cabeças(?: de gado)?|cabecas(?: de gado)?|animais|bovinos|bois|vacas|bezerros|bezerras|novilhas)\b/i,
    );
    const husbandry = literal.match(
      /^(?:(?:eu|nós|nos)\s+)?(vacinei|vacinamos|vermifuguei|vermifugamos|tratei|tratamos|desmamei|desmamamos|inseminei|inseminamos|pesei|pesamos|transferi|transferimos|passei|passamos)\b/i,
    );
    if (!match && !husbandry) continue;
    // A different farm must be explicitly selected and unambiguous before a write.
    const farmReference = quote.match(
      /\b(?:na|no|da|do|minha|meu)\s+(?:fazenda|propriedade|sítio|sitio|chácara|chacara)\s+([^,.;]+)/iu,
    )?.[1];
    const selectedJustNow =
      input.history?.at(-1)?.role === "assistant" &&
      input.history.at(-1)!.content.startsWith("Fazenda selecionada:");
    const normalized = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();
    if (
      !snapshot.active ||
      (farmReference &&
        (!snapshot.active.book.name ||
          normalized(farmReference) !== normalized(snapshot.active.book.name))) ||
      (snapshot.properties.length !== 1 && !farmReference && !selectedJustNow)
    )
      return { status: "pending", reason: "ambiguous_property" };
    const period = recallPeriod(quote, input.at);
    if (
      (period && Date.parse(period.endDay) - Date.parse(period.startDay) !== 86400000) ||
      (!period && /\b(?:semana|mês|mes|ano|antes|passad[oa]|dia\s+\d)\b/i.test(quote))
    )
      return { status: "pending", reason: "ambiguous_date" };
    const lot = quote.match(/\b(?:no|do|para o)\s+lote\s+([\p{L}\d_-]+)\b/iu)?.[1];
    const date = period?.startDay ?? localDay(input.at);
    if (match) {
      const verb = match[1].toLowerCase();
      const action = OperationsActionSchema.safeParse({
        kind: "herd_event",
        type: verb.startsWith("nasc")
          ? "birth"
          : verb.startsWith("morr")
            ? "death"
            : verb.startsWith("vend")
              ? "sale"
              : "purchase",
        count: Number(match[2]),
        date,
        description: quote.slice(0, 160),
        ...(lot ? { lot } : {}),
      });
      if (action.success) candidates.push(action.data);
    } else if (husbandry) {
      const transfer = literal.match(
        /^(?:eu\s+)?(?:transferi|transferimos|passei|passamos)\s+(\d{1,6})\s+(?:animais|bovinos|vacas|novilhas|bezerros|bois)\s+do\s+lote\s+([\p{L}\d_-]+)\s+para\s+(?:o\s+)?lote\s+([\p{L}\d_-]+)/iu,
      );
      const weighing = literal.match(
        /^(?:eu\s+)?(?:pesei|pesamos)\s+(?:o\s+)?animal\s+([\p{L}\d_-]+)\s+(?:com\s+)?(\d{1,4}(?:[.,]\d{1,2})?)\s*kg\b/iu,
      );
      const count = quote.match(
        /\b(\d{1,6})\s+(?:animais|bovinos|vacas|novilhas|bezerros|bois)\b/i,
      );
      const parsed = ActionSchema.safeParse(
        transfer
          ? {
              kind: "lot_transfer",
              from: transfer[2],
              to: transfer[3],
              count: Number(transfer[1]),
              date,
            }
          : weighing
            ? {
                kind: "weighing",
                code: weighing[1],
                weightKg: Number(weighing[2].replace(",", ".")),
                date,
              }
            : {
                kind: "record",
                type: /^(?:vac|verm|trat)/i.test(husbandry[1])
                  ? "health"
                  : /^(?:trans|pass)/i.test(husbandry[1])
                    ? "movement"
                    : "management",
                description: quote,
                date,
                ...(count ? { count: Number(count[1]) } : {}),
                ...(lot ? { lot } : {}),
              },
      );
      if (parsed.success) candidates.push(parsed.data);
    }
  }
  if (candidates.length > 1) return { status: "batch", actions: candidates };
  return candidates[0] ? { status: "action", action: candidates[0] } : { status: "none" };
}
