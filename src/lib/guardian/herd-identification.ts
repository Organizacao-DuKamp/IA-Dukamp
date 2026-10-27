import {
  ActionSchema,
  type FarmBook,
  type GuardianAction,
  type GuardianPending,
  type HerdIdentification,
  type PendingAction,
} from "./schema.ts";
import { foldHerd, herdStatement, herdRegistrationIntent } from "./herd-language.ts";

type AnimalAction = Extract<GuardianAction, { kind: "animal" }>;
export function labeledAnimal(line: string): AnimalAction | null {
  line = line.replace(
    /^(?:um dos bezerros|o bezerro|a bezerra|o animal|a vaca)\s+(?:j[aá]\s+)?tem\s+/i,
    "",
  );
  line = line
    .replace(/^(?:o\s+)?(c[oó]digo|brinco)\s+[eé]\s+/i, "$1 ")
    .replace(/\s+e\s+o\s+rgn\s+[eé]\s+/i, " e RGN ");
  const shared = line.match(
    /^(?:c[oó]digo(?:\/brinco)?|brinco)\s+e\s+rgn\s*:?\s*([\p{L}\d_-]+(?:\s+\d+)?)[.! ]*$/iu,
  );
  const match = line.match(
    /^(?:c[oó]digo(?:\/brinco)?|brinco)\s*:?\s*([\p{L}\d_-]+(?:\s+\d+)?)(?:\s*,?\s*(?:e\s+)?rgn\s*:?\s*([\p{L}\d_-]+(?:\s+\d+)?)|\s*,?\s*sem\s+rgn)?[.! ]*$/iu,
  );
  if (!shared && !match) return null;
  const code = (shared?.[1] ?? match![1]).trim(),
    rgn = shared?.[1] ?? match?.[2];
  const parsed = ActionSchema.safeParse({
    kind: "animal",
    code,
    ...(rgn ? { rgn: rgn.trim() } : {}),
  });
  return parsed.success ? (parsed.data as AnimalAction) : null;
}
export function identificationQuestion(p: HerdIdentification) {
  const remaining = p.entries.reduce((n, e) => n + e.count - e.codes.length, 0);
  const scope = p.entries
    .map(
      (e) =>
        `${e.type === "birth" ? "nascimento" : "compra"} de ${e.count} em ${e.date}${e.lot ? `, lote ${e.lot}` : ""}`,
    )
    .join("; ");
  return `Sobre ${scope}: esses animais têm código/brinco e RGN? Faltam identificar ${remaining} ${remaining === 1 ? "animal" : "animais"}. Envie um por linha, por exemplo: “código B01, RGN KBU 491”. Se não houver RGN, envie só o código; se não tiverem identificação, responda “não têm”. A quantidade já está no rebanho; cadastrar as fichas não soma animais novamente.`;
}
export function restoreProposal(p: HerdIdentification, now: Date): PendingAction | null {
  return p.previousProposal &&
    p.previousProposal.propertyId === p.propertyId &&
    Date.parse(p.previousProposal.expiresAt) > now.getTime()
    ? p.previousProposal
    : null;
}
export function identificationAfterEntry(
  actions: GuardianAction[],
  book: FarmBook,
  pending: GuardianPending | null,
  propertyId: string,
  messageId: string,
  at: string,
): HerdIdentification | null {
  const entries = (book.operations?.movements ?? [])
    .filter(
      (m) => m.source.messageId === messageId && (m.type === "birth" || m.type === "purchase"),
    )
    .map((m) => ({
      eventId: m.id,
      type: m.type as "birth" | "purchase",
      count: m.count,
      date: m.date,
      ...(m.lot ? { lot: m.lot } : {}),
      codes: [] as string[],
    }));
  if (!entries.length) return null;
  const animalActions = actions.filter((a): a is AnimalAction => a.kind === "animal");
  // Only bind identities automatically when the group itself is unambiguous.
  if (entries.length === 1)
    entries[0].codes = [...new Set(animalActions.map((a) => a.code))].slice(0, entries[0].count);
  if (entries.every((e) => e.codes.length >= e.count)) return null;
  const previous = pending?.kind === "herd_registration" ? pending.previousPending : pending;
  const prior = previous?.kind === "herd_identification" ? previous.previousProposal : previous;
  return {
    kind: "herd_identification",
    propertyId,
    createdAt: at,
    expiresAt: new Date(Date.parse(at) + 30 * 60000).toISOString(),
    sourceMessageId: messageId,
    entries,
    ...(prior && prior.propertyId === propertyId && Date.parse(prior.expiresAt) > Date.parse(at)
      ? { previousProposal: prior }
      : {}),
  };
}

export type IdentificationAnswer =
  | { kind: "none" }
  | { kind: "close"; reply: string }
  | { kind: "ask"; reply: string }
  | { kind: "animals"; actions: AnimalAction[]; pending: HerdIdentification | null };
export function identificationAnswer(
  text: string,
  pending: HerdIdentification,
  book: FarmBook,
): IdentificationAnswer {
  const assertion = herdStatement(text),
    t = foldHerd(assertion)
      .replace(/[.!?]+$/g, "")
      .trim();
  if (herdRegistrationIntent(assertion)) return { kind: "none" };
  if (/^(?:nao (?:tem|tenho|possuem)|sem) rgn$/.test(t))
    return {
      kind: "ask",
      reply:
        "O RGN é opcional. Se tiverem código/brinco, envie os códigos; se também não tiverem, responda “não têm”. A entrada já está contabilizada.",
    };
  if (
    /^(?:nao(?:[, ]+(?:tem|temos|possuem|possui|tenho|t[eê]m)(?: codigo| identificacao| rgn)?)?|nenhum|nenhuma|nao tem|nao possuem|sem identificacao|cancelar)(?: ainda)?$/.test(
      t,
    )
  )
    return {
      kind: "close",
      reply:
        "Tudo bem. A entrada permanece contabilizada no rebanho, sem inventar códigos ou RGN. Você pode informar as identificações depois.",
    };
  if (
    /^(?:sim(?:,? (?:tem|temos|tenho|possuem))?|(?:tem|temos|tenho|possuem)(?: sim)?|confirmar|confirmo|pode salvar)$/.test(
      t,
    )
  )
    return { kind: "ask", reply: identificationQuestion(pending) };
  if (!/\b(?:c[oó]digo|brinco|rgn)\b/i.test(assertion)) return { kind: "none" };
  if (
    /\?|\b(?:talvez|acho|vizinho|disse|encaminhad|exemplo|suponha|corrigindo|errei)\b/i.test(
      assertion,
    )
  )
    return {
      kind: "ask",
      reply:
        "Envie somente as identificações confirmadas dos animais desta entrada. " +
        identificationQuestion(pending),
    };
  const available = pending.entries.filter((e) => e.codes.length < e.count);
  const chosen =
    available.length === 1
      ? available[0]
      : available.find((e) => assertion.includes(`evento ${e.eventId}`));
  if (!chosen)
    return {
      kind: "ask",
      reply:
        "De qual entrada são esses códigos? Envie “evento CÓDIGO” e as identificações:\n" +
        available
          .map(
            (e) =>
              `${e.eventId} — ${e.type === "birth" ? "nascimento" : "compra"}, ${e.count} animais em ${e.date}${e.lot ? `, lote ${e.lot}` : ""}`,
          )
          .join("\n"),
    };
  const lines = assertion
    .replace(new RegExp(`^evento ${chosen.eventId}\\s*[:;]?\\s*`, "i"), "")
    .replace(/^sim[, ]+/i, "")
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const actions: AnimalAction[] = [];
  for (const line of lines) {
    const identity = labeledAnimal(line);
    if (!identity)
      return {
        kind: "ask",
        reply:
          "Preciso do código/brinco de cada animal; RGN é opcional. Exemplo: “código B01, RGN KBU 491”. Não salvei fichas incompletas.",
      };
    const { code, rgn } = identity;
    const key = foldHerd(code);
    if (
      actions.some((a) => foldHerd(a.code) === key) ||
      pending.entries.some((e) => e.codes.some((c) => foldHerd(c) === key))
    )
      return {
        kind: "ask",
        reply: `O código ${code} já foi informado para esta entrada. Não dupliquei a ficha. ${identificationQuestion(pending)}`,
      };
    if (book.animals.some((a) => foldHerd(a.code) === key))
      return {
        kind: "ask",
        reply: `O código ${code} já pertence a um animal cadastrado nesta fazenda. Confira o código do novo animal; não sobrescrevi a ficha existente.`,
      };
    const registryKey = rgn ? foldHerd(rgn).replace(/\s/g, "") : null;
    if (
      registryKey &&
      [...book.animals, ...actions].some(
        (a) => a.rgn && foldHerd(a.rgn).replace(/\s/g, "") === registryKey,
      )
    )
      return {
        kind: "ask",
        reply: `O RGN ${rgn} já foi informado para outro animal. Confira as identificações; nenhuma ficha deste envio foi salva.`,
      };
    const parsed = ActionSchema.safeParse({
      kind: "animal",
      code,
      ...(rgn ? { rgn: rgn.trim() } : {}),
      ...(chosen.type === "birth" ? { birthDate: chosen.date } : {}),
      ...(chosen.lot ? { lot: chosen.lot } : {}),
    });
    if (!parsed.success)
      return {
        kind: "ask",
        reply: "Confira os códigos e RGN; nenhuma ficha deste envio foi salva.",
      };
    actions.push(parsed.data as AnimalAction);
  }
  if (actions.length > chosen.count - chosen.codes.length)
    return {
      kind: "ask",
      reply: `Recebi mais códigos que os ${chosen.count - chosen.codes.length} animais ainda sem identificação desta entrada. Confira a lista; nenhuma ficha foi salva.`,
    };
  const next = structuredClone(pending);
  next.entries.find((e) => e.eventId === chosen.eventId)!.codes.push(...actions.map((a) => a.code));
  return {
    kind: "animals",
    actions,
    pending: next.entries.every((e) => e.codes.length >= e.count) ? null : next,
  };
}
