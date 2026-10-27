import { cardinal, foldHerd } from "./herd-language.ts";
import type { GuardianAction, HerdIdentification } from "./schema.ts";

export function possibleRepeatedEntry(
  actions: GuardianAction[],
  pending: HerdIdentification | null,
  text: string,
  propertyId: string,
  now: Date,
) {
  if (
    !pending ||
    pending.propertyId !== propertyId ||
    Date.parse(pending.expiresAt) <= now.getTime() ||
    actions.length !== 1 ||
    /\+\s*\d|\b(?:mais|outros|outras|adicionais|outro nascimento|nova compra)\b/i.test(text)
  )
    return null;
  const a = actions[0];
  if (a.kind !== "herd_event") return null;
  return (
    pending.entries.find(
      (e) => e.type === a.type && e.count === a.count && e.date === a.date && e.lot === a.lot,
    ) ?? null
  );
}
export function repeatQuestion(p: HerdIdentification) {
  const e = p.entries.find((e) => e.eventId === p.repeatCheck?.entryId)!;
  return `Já registrei ${e.count} ${e.type === "birth" ? "nascimentos" : "animais comprados"} em ${e.date}. Você está falando dos mesmos animais ou de mais ${e.count}? Responda “são os mesmos” ou “são mais ${e.count}”. Ainda não somei esta mensagem novamente.`;
}
export function repeatAnswer(text: string, pending: HerdIdentification) {
  if (!pending.repeatCheck) return null;
  const t = foldHerd(text)
    .replace(/[.!?]+$/g, "")
    .trim();
  if (
    /^(?:sao (?:os )?mesmos(?: animais)?|os mesmos|mesmos|e o mesmo|mesmo acontecimento|ja foi registrado)$/.test(
      t,
    )
  )
    return { kind: "same" as const };
  const extra = t.match(/^(?:(?:sao|e|sim[, ]*)\s+)?mais\s+(.+)$/);
  const e = pending.entries.find((e) => e.eventId === pending.repeatCheck!.entryId);
  if (
    extra &&
    e &&
    cardinal(extra[1].replace(/\s+(?:animais|bezerros|vacas|bois)$/, "")) === e.count
  ) {
    const action: GuardianAction = {
      kind: "herd_event",
      type: e.type,
      count: e.count,
      date: e.date,
      description: "Outra entrada declarada e confirmada pelo produtor",
      ...(e.lot ? { lot: e.lot } : {}),
    };
    return { kind: "additional" as const, action, ...pending.repeatCheck };
  }
  if (/^(?:sim|nao|confirmar|confirmo|mais\b|sao\b)/.test(t)) return { kind: "ask" as const };
  return null;
}
