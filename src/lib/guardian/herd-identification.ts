import {
  ActionSchema,
  type FarmBook,
  type GuardianAction,
  type GuardianPending,
  type HerdIdentification,
  type PendingAction,
} from "./schema.ts";
import { foldHerd, herdStatement, herdRegistrationIntent } from "./herd-language.ts";
import {
  bareAnimalCode,
  explicitRegistryLookup,
  identityEnvelope,
  identityLines,
  isIdentityHelp,
  normalizedRegistry,
} from "./identification-language.ts";

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
  if (p.proposedIdentities)
    return `Você está informando ${p.proposedIdentities.map((a) => `código ${a.code}, RGN ${a.rgn}`).join("; ")}? Pode responder “sim” ou corrigir os dados.`;
  if (p.awaitingRgn) return `O código ${p.awaitingRgn.code} também é o RGN desse animal?`;
  if (p.registryOnly)
    return `Qual é o código/brinco do animal com RGN ${p.registryOnly.rgn}? Se o código for o mesmo, pode responder “é o mesmo”.`;
  const remaining = p.entries.reduce(
    (n, e) => n + (e.identifyCount ?? e.count) - e.codes.length,
    0,
  );
  const scope = p.entries
    .map(
      (e) =>
        `${e.type === "birth" ? "nascimento" : "compra"} de ${e.count} em ${e.date}${e.lot ? `, lote ${e.lot}` : ""}`,
    )
    .join("; ");
  return `Sobre ${scope}: esses animais têm código/brinco e RGN? Faltam identificar ${remaining} ${remaining === 1 ? "animal" : "animais"}. Pode enviar as identificações como preferir, ou dizer quantos deles têm. O RGN é opcional e as fichas não somam animais novamente.`;
}
export function restoreProposal(p: HerdIdentification, now: Date): GuardianPending | null {
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
  const previous =
    pending?.kind === "herd_registration" || pending?.kind === "record_draft"
      ? pending.previousPending
      : pending;
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
  | { kind: "ask"; reply: string; pending?: HerdIdentification }
  | {
      kind: "animals";
      actions: AnimalAction[];
      pending: HerdIdentification | null;
      reply?: string;
    };
export function identificationAnswer(
  text: string,
  pending: HerdIdentification,
  book: FarmBook,
): IdentificationAnswer {
  const assertion = herdStatement(text),
    t = foldHerd(assertion)
      .replace(/[.!?]+$/g, "")
      .trim();
  if (explicitRegistryLookup(assertion)) return { kind: "none" };
  if (isIdentityHelp(assertion))
    return {
      kind: "ask",
      reply:
        "Código ou brinco é a identificação usada na fazenda. RGN é o registro genealógico de nascimento. O RGN é opcional: posso salvar só o código que você informar.",
    };
  if (herdRegistrationIntent(assertion)) return { kind: "none" };
  if (pending.proposedIdentities && /^(?:nao|nao e isso|nao sao esses)[.! ]*$/.test(t)) {
    const next = structuredClone(pending);
    delete next.proposedIdentities;
    return {
      kind: "ask",
      pending: next,
      reply:
        "Certo. Quais são as identificações corretas desses animais? Pode enviar só os códigos, ou dizer o código e o RGN de cada um.",
    };
  }
  if (
    pending.proposedIdentities &&
    /^(?:sim|isso|exatamente|confirmar|confirmo|correto)[.! ]*$/.test(t)
  ) {
    const next = structuredClone(pending),
      proposed = next.proposedIdentities!;
    delete next.proposedIdentities;
    return identificationAnswer(
      proposed.map((a) => `código ${a.code}, RGN ${a.rgn}`).join("\n"),
      next,
      book,
    );
  }
  const done = (p: HerdIdentification) =>
    p.entries.every((e) => e.codes.length >= (e.identifyCount ?? e.count));
  if (
    pending.registryOnly &&
    /^(?:sim|e o mesmo|o mesmo|sao iguais|pode usar o mesmo)[.! ]*$/.test(t)
  ) {
    const next = structuredClone(pending);
    const rgn = next.registryOnly!.rgn;
    delete next.registryOnly;
    return identificationAnswer(`código e RGN: ${rgn}`, next, book);
  }
  if (pending.awaitingRgn) {
    const { code } = pending.awaitingRgn;
    const bound =
      pending.entries.some(
        (e) => e.eventId === pending.awaitingRgn!.entryId && e.codes.includes(code),
      ) && book.animals.some((a) => a.code === code);
    const same =
      /^(?:sim|sim[, ]+e o mesmo|e o mesmo|o mesmo|tambem|tambem e o rgn|esse tambem e o rgn|(?:o )?rgn (?:e )?(?:o )?mesmo)[.! ]*$/.test(
        t,
      );
    const declared = assertion.match(
      /^(?:o\s+)?rgn\s*(?:[eé]|:)\s*([\p{L}\d_-]+(?:\s+\d+)?)[.! ]*$/iu,
    );
    const no = /^(?:nao|nao tem|sem rgn|nao tem rgn)[.! ]*$/.test(t);
    if (bound && (same || declared || no)) {
      const next = structuredClone(pending);
      delete next.awaitingRgn;
      if (no)
        return done(next)
          ? {
              kind: "close",
              reply: `Mantive ${code} como código, sem RGN. O rebanho permanece igual.`,
            }
          : {
              kind: "ask",
              pending: next,
              reply: `Mantive ${code} sem RGN.\n${identificationQuestion(next)}`,
            };
      const rgn = same ? code : declared![1].trim();
      if (
        book.animals.some(
          (a) => a.code !== code && a.rgn && normalizedRegistry(a.rgn) === normalizedRegistry(rgn),
        )
      )
        return {
          kind: "ask",
          reply: "Esse RGN já pertence a outra ficha. Confira o registro; não alterei os dados.",
        };
      const parsed = ActionSchema.safeParse({ kind: "animal", code, rgn });
      if (!parsed.success)
        return { kind: "ask", reply: "Confira o RGN desse animal; não alterei a ficha." };
      return {
        kind: "animals",
        actions: [parsed.data as AnimalAction],
        pending: done(next) ? null : next,
        reply:
          `RGN ${rgn} salvo na ficha ${code}. O rebanho permanece igual.` +
          (done(next) ? "" : `\n${identificationQuestion(next)}`),
      };
    }
  }
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
  const envelope = identityEnvelope(assertion);
  if (envelope.noneOthers && !envelope.body)
    return {
      kind: "close",
      reply:
        "Entendido. Os demais ficam sem identificação por enquanto; o rebanho não foi alterado.",
    };
  const relevant =
    /\b(?:c[oó]digo|brinco|rgn)\b/i.test(assertion) ||
    envelope.count !== undefined ||
    identityLines(envelope.body).some((line) => bareAnimalCode(line));
  if (!relevant) return { kind: "none" };
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
  const available = pending.entries.filter((e) => e.codes.length < (e.identifyCount ?? e.count));
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
  const next = structuredClone(pending);
  const selected = next.entries.find((e) => e.eventId === chosen.eventId)!;
  if (envelope.count !== undefined && envelope.count > chosen.count - chosen.codes.length)
    return {
      kind: "ask",
      reply:
        "A quantidade informada supera os animais ainda sem identificação desta entrada. Confira quantos têm código.",
    };
  if (envelope.only && envelope.count !== undefined)
    selected.identifyCount = chosen.codes.length + envelope.count;
  if (envelope.count === 0)
    return {
      kind: "close",
      reply:
        "Entendido: nenhum desses animais tem identificação por enquanto. A quantidade já registrada no rebanho permanece igual.",
    };
  if (envelope.count !== undefined && !envelope.body)
    return {
      kind: "ask",
      pending: next,
      reply: `Entendi: ${envelope.count} ${envelope.count === 1 ? "animal tem identificação" : "animais têm identificação"}. Qual é ${envelope.count === 1 ? "a identificação dele" : "a identificação de cada um"}?`,
    };
  const body = envelope.body
    .replace(new RegExp(`^evento ${chosen.eventId}\\s*[:;]?\\s*`, "i"), "")
    .replace(/^sim[, ]+/i, "");
  const registry = body.match(/^(?:o\s+)?rgn\s*(?:[eé]|:)?\s*([\p{L}\d_-]+(?:\s+\d+)?)[.! ]*$/iu);
  if (registry) {
    next.registryOnly = { entryId: chosen.eventId, rgn: registry[1].trim() };
    return { kind: "ask", pending: next, reply: identificationQuestion(next) };
  }
  const lines = identityLines(body);
  const informalPairs = lines.map((line) =>
    line.match(/^(?:c[oó]digo|brinco)\s*:?\s*([\p{L}\d_-]+)\s*,\s*([\p{L}\d_-]+\s+\d+)[.! ]*$/iu),
  );
  if (informalPairs.length && informalPairs.every(Boolean)) {
    next.proposedIdentities = informalPairs.map((m) => ({ code: m![1], rgn: m![2] }));
    return { kind: "ask", pending: next, reply: identificationQuestion(next) };
  }
  const actions: AnimalAction[] = [];
  let untyped = false;
  for (const line of lines) {
    let identity = labeledAnimal(line);
    const bare = bareAnimalCode(line);
    if (!identity && bare) {
      identity = { kind: "animal", code: bare };
      untyped = !pending.registryOnly;
    }
    if (!identity)
      return {
        kind: "ask",
        reply:
          "Preciso do código/brinco de cada animal; RGN é opcional. Exemplo: “código B01, RGN KBU 491”. Não salvei fichas incompletas.",
      };
    const { code } = identity;
    const rgn =
      identity.rgn ??
      (next.registryOnly?.entryId === chosen.eventId && lines.length === 1
        ? next.registryOnly.rgn
        : undefined);
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
  if (
    actions.length > (selected.identifyCount ?? selected.count) - chosen.codes.length ||
    (envelope.count !== undefined && actions.length > envelope.count)
  )
    return {
      kind: "ask",
      reply: `Recebi mais códigos que os ${chosen.count - chosen.codes.length} animais ainda sem identificação desta entrada. Confira a lista; nenhuma ficha foi salva.`,
    };
  selected.codes.push(...actions.map((a) => a.code));
  if (envelope.noneOthers) selected.identifyCount = selected.codes.length;
  delete next.registryOnly;
  delete next.proposedIdentities;
  delete next.awaitingRgn;
  if (untyped && actions.length === 1)
    next.awaitingRgn = { entryId: chosen.eventId, code: actions[0].code };
  const without = next.entries.reduce((n, e) => n + e.count - (e.identifyCount ?? e.count), 0);
  return {
    kind: "animals",
    actions,
    pending: done(next) && !next.awaitingRgn ? null : next,
    ...(untyped || envelope.only || envelope.noneOthers
      ? {
          reply:
            `Salvei ${actions.map((a) => a.code).join(", ")} ${actions.length === 1 ? "como identificação de um animal" : "como identificações dos animais"} desta entrada.${without ? ` Os outros ${without} ficam sem identificação por enquanto.` : ""} O rebanho não foi somado novamente.` +
            (next.awaitingRgn
              ? `\n${identificationQuestion(next)}`
              : done(next)
                ? ""
                : `\n${identificationQuestion(next)}`),
        }
      : {}),
  };
}
