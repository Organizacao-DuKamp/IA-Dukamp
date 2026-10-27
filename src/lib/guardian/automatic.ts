import { ActionSchema, type GuardianSnapshot, type GuardianAction } from "./schema.ts";
import { OperationsActionSchema } from "./operations.ts";
import { certainStatement, userStatement } from "../whatsapp/learned-notes.ts";
import { extractPropertyObservation } from "./observed-property.ts";
import { localDay } from "../chat/context/recall.ts";
import { financialObservation } from "./financial-observation.ts";
import { herdStatement } from "./herd-language.ts";
import { labeledAnimal } from "./herd-identification.ts";
import {
  certainHerdStatement,
  movementInClause,
  herdClauses,
  eventDay,
  farmScopeMatches,
  hasEventVerb,
} from "./herd-event-language.ts";

export type AutomaticObservation =
  | { status: "none" }
  | { status: "pending"; reason: "ambiguous_property" | "ambiguous_date"; reply?: string }
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
  const original = userStatement(input.text, input.mediaType);
  const text = herdStatement(input.text, input.mediaType);
  if (snapshot.properties.length > 1) {
    const observation = extractPropertyObservation({
      text: original,
      mediaType: input.mediaType,
      at: input.at,
    });
    if (
      !observation.name &&
      observation.facts.some((f) =>
        ["herdTotal", "cows", "oxen", "calves", "heifers"].includes(f.field),
      )
    )
      return { status: "pending", reason: "ambiguous_property" };
  }
  // Preserve the private-notebook workflow for legacy books with no operational
  // baseline/profile yet. Observed-fact projection or an explicit count initializes it.
  if (!snapshot.active && !snapshot.properties.length) return { status: "none" };
  if (
    /encaminhad[oa]|mensagem de|corrigindo|me enganei|na verdade|errei|\b(?:vizinho|vizinha|disse|falou|suponha|hipotetic|simula)\b|```|(?:^|\n)\s*>/i.test(
      original,
    )
  )
    return { status: "none" };
  const finance = financialObservation(text, input.at);
  if (finance.status === "pending") return finance;
  const candidates: GuardianAction[] =
    finance.status === "action"
      ? [finance.action]
      : finance.status === "batch"
        ? [...finance.actions]
        : [];
  const selectedJustNow =
    input.history?.at(-1)?.role === "assistant" &&
    input.history.at(-1)!.content.startsWith("Fazenda selecionada:");
  let previousHerd = false;
  let missingMovement = false;
  let previousSentence = "";
  for (const { quote, sentence } of herdClauses(text)) {
    if (sentence !== previousSentence) previousHerd = false;
    previousSentence = sentence;
    if (
      !certainHerdStatement(quote) ||
      quote.length > 1500 ||
      /\b(?:não|nao|corrigindo|corri[gj]a|na verdade|errei|de novo|novamente)\b/i.test(quote)
    )
      continue;
    const declarations = quote.match(
      /\b(?:nasceram|nasceu|morreram|morreu|vendi|vendemos|comprei|compramos|vacinei|vacinamos|passei|transferi)\s+\d/gi,
    );
    if (declarations && declarations.length > 1)
      return { status: "pending", reason: "ambiguous_date" };
    const literal = quote.replace(/^(?:(?:hoje|ontem|anteontem|tamb[eé]m|agora)[, ]+)+/i, "");
    const match = movementInClause(quote, previousHerd);
    const husbandry = literal.match(
      /^(?:(?:eu|nós|nos)\s+)?(vacinei|vacinamos|vermifuguei|vermifugamos|tratei|tratamos|desmamei|desmamamos|inseminei|inseminamos|pesei|pesamos|transferi|transferimos|passei|passamos)\b/i,
    );
    if (!match && !husbandry) {
      if (hasEventVerb(quote) && !/\b(?:sacos?|kg|litros?|ra[cç][aã]o)\b/i.test(quote))
        missingMovement = true;
      continue;
    }
    if (!snapshot.active?.book.operations) continue;
    if (!farmScopeMatches(text, snapshot, !!selectedJustNow))
      return { status: "pending", reason: "ambiguous_property" };
    const period = eventDay(quote, input.at);
    const shared = eventDay(sentence, input.at);
    if (period.invalid || (!period.day && shared.invalid))
      return {
        status: "pending",
        reason: "ambiguous_date",
        reply:
          "A data informada não existe no calendário. Qual é a data correta desse acontecimento? Ainda não alterei o rebanho.",
      };
    if (period.ambiguous || (!period.day && shared.ambiguous))
      return { status: "pending", reason: "ambiguous_date" };
    const lot = quote.match(/\b(?:no|do|para o)\s+lote\s+([\p{L}\d_-]+)\b/iu)?.[1];
    const date = period.day ?? shared.day ?? localDay(input.at);
    if (match) {
      const action = OperationsActionSchema.safeParse({
        kind: "herd_event",
        type: match.type,
        count: match.count,
        date,
        description: quote.slice(0, 160),
        ...(lot ? { lot } : {}),
      });
      if (action.success) {
        candidates.push(action.data);
        previousHerd = true;
      }
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
  if (missingMovement && candidates.some((a) => a.kind === "herd_event"))
    return {
      status: "pending",
      reason: "ambiguous_date",
      reply:
        "Faltou a quantidade de um dos acontecimentos. Envie os acontecimentos com suas quantidades na mesma mensagem. Ainda não salvei nenhum movimento deste envio, para manter os registros completos.",
    };
  if (/^(?:c[oó]digo|brinco)\b/i.test(text)) {
    const identityLines = text.split(/[;\n]+/).map((line) => labeledAnimal(line.trim()));
    if (identityLines.length && identityLines.every((a) => a !== null))
      candidates.push(...(identityLines as GuardianAction[]));
  }
  // An explicitly shared code/RGN identifies one calf, not every birth in the batch.
  const sharedIdentity = text.match(
    /\b(?:um[ao]? dos? bezerros?|o bezerro|a bezerra)\s+(?:j[aá]\s+)?tem\s+c[oó]digo\s+e\s+rgn\s*:\s*([\p{L}\d_-]+(?:\s+\d+)?)(?=[,;.!?\n]|$)/iu,
  );
  const separateIdentity = text.match(
    /\b(?:um[ao]? dos? bezerros?|o bezerro|a bezerra)\s+(?:j[aá]\s+)?tem\s+c[oó]digo\s*:?\s*([\p{L}\d_-]+(?:\s+\d+)?)\s+e\s+rgn\s*:?\s*([\p{L}\d_-]+(?:\s+\d+)?)(?=[,;.!?\n]|$)/iu,
  );
  const identity = separateIdentity ?? sharedIdentity;
  if (identity && certainStatement(identity[0]) && snapshot.active) {
    const births = candidates.filter((a) => a.kind === "herd_event" && a.type === "birth");
    candidates.push(
      ActionSchema.parse({
        kind: "animal",
        code: identity[1].trim(),
        rgn: (separateIdentity?.[2] ?? identity[1]).trim(),
        ...(births.length === 1 && births[0].kind === "herd_event"
          ? { birthDate: births[0].date }
          : {}),
        category: "bezerro",
      }),
    );
  }
  if (candidates.length) {
    if (!farmScopeMatches(text, snapshot, !!selectedJustNow))
      return { status: "pending", reason: "ambiguous_property" };
  }
  if (candidates.length > 1) return { status: "batch", actions: candidates };
  return candidates[0] ? { status: "action", action: candidates[0] } : { status: "none" };
}
