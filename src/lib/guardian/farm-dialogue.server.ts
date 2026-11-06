import { creatingFarm, farmSlots, cleanFarmName, naturalConfirmation } from "./farm-dialogue.ts";
const key = (s: string) => fold(cleanFarmName(s)).replace(/^(?:fazenda|estancia|sitio)\s+/, "");
import { randomUUID } from "node:crypto";
import { fold } from "./book.ts";
import { emptyFarm, type GuardianSnapshot, type SemanticDraft } from "./schema.ts";
import type { GuardianCommit, GuardianStore } from "./store.server.ts";
import type { GuardianInput } from "./handler.server.ts";

export async function handleFarmDialogue(
  input: GuardianInput,
  snapshot: GuardianSnapshot,
  store: GuardianStore,
  now: Date,
  makeId: () => string = randomUUID,
) {
  const pending =
    snapshot.pending && "farmDraft" in snapshot.pending && snapshot.pending.farmDraft
      ? snapshot.pending
      : null;
  if (!creatingFarm(input.text) && !pending) return null;
  const previous = await store.receipt(input.phone, input.messageId);
  if (previous) return { reply: previous, persisted: true, activeProperty: !!snapshot.active };
  const base: GuardianCommit = {
    phone: input.phone,
    messageId: input.messageId,
    accountVersion: snapshot.accountVersion,
    propertyId: snapshot.active?.id ?? null,
    propertyVersion: snapshot.active?.version ?? null,
    operation: "pending",
    pending: null,
    reply: "",
  };
  if (/^(?:cancelar|cancela|nao)[.! ]*$/.test(fold(input.text))) {
    base.operation = "clear";
    base.reply = "Certo, cancelei essa preparação de cadastro.";
  } else {
    const slots = farmSlots(input.text, pending?.farmDraft);
    const expiresAt = new Date(now.getTime() + 30 * 60000).toISOString();
    const question = !slots.name
      ? "Qual é o nome da sua fazenda?"
      : !slots.city
        ? `Certo, ${slots.name}. Em qual cidade ela fica?`
        : !slots.uf
          ? "Em qual estado fica essa cidade?"
          : `Criar a fazenda ${slots.name}, em ${slots.city}/${slots.uf}${slots.owner ? `, proprietário ${slots.owner}` : ""}. Posso salvar? Você pode confirmar.`;
    if (
      pending &&
      Date.parse(pending.expiresAt) <= now.getTime() &&
      naturalConfirmation(input.text)
    )
      return {
        reply: "Essa proposta venceu. Conte o nome da fazenda para revisarmos o cadastro.",
        persisted: false,
        activeProperty: !!snapshot.active,
      };
    const same = slots.distinct
      ? []
      : snapshot.properties.filter((p) => key(p.name) === key(slots.name ?? ""));
    if (slots.name && slots.city && slots.uf && naturalConfirmation(input.text) && pending) {
      if (same.length === 1) {
        const existing = await store.loadProperty?.(input.phone, same[0].id);
        if (
          !existing ||
          (fold(existing.book.city ?? "") === fold(slots.city) && existing.book.uf === slots.uf)
        ) {
          base.operation = "select";
          base.propertyId = same[0].id;
          base.propertyVersion = null;
          base.reply = `A fazenda ${cleanFarmName(same[0].name)} já estava cadastrada e foi selecionada. Não criei uma duplicata.`;
        } else {
          base.operation = "create";
          base.propertyId = makeId();
          base.propertyVersion = null;
          base.book = emptyFarm(slots.name, slots.city, slots.uf);
          base.reply = `Pronto, a fazenda ${slots.name} foi criada e selecionada em ${slots.city}/${slots.uf}.`;
        }
      } else if (same.length > 1)
        return {
          reply:
            "Encontrei mais de uma fazenda com esse nome. Confira suas fazendas antes de criar outra.",
          activeProperty: !!snapshot.active,
          persisted: false,
        };
      else {
        base.operation = "create";
        base.propertyId = makeId();
        base.propertyVersion = null;
        base.book = emptyFarm(slots.name, slots.city, slots.uf);
        base.reply = `Pronto, a fazenda ${slots.name} foi criada e selecionada em ${slots.city}/${slots.uf}.`;
      }
      if (base.book && slots.owner)
        base.book.operations = {
          counts: [],
          movements: [],
          lots: [],
          responsibleName: slots.owner,
        };
    } else {
      base.pending = {
        kind: "semantic_draft",
        farmDraft: slots,
        propertyId: null,
        createdAt: now.toISOString(),
        expiresAt,
        sourceAt: input.sentAt ?? now.toISOString(),
        sourceMessageId: input.messageId,
        question,
        messages: [...(pending?.messages ?? []), { role: "user", content: input.text }].slice(-12),
      } satisfies SemanticDraft;
      if (slots.name && slots.city && slots.uf)
        base.pending = {
          action: { kind: "property_create", name: slots.name, city: slots.city, uf: slots.uf },
          farmDraft: slots,
          propertyId: null,
          createdAt: now.toISOString(),
          expiresAt,
          sourceMessageId: input.messageId,
        };
      base.reply = question;
      if (same.length && !naturalConfirmation(input.text))
        base.reply += ` Já existe uma fazenda com nome semelhante: ${same.map((p) => cleanFarmName(p.name)).join(", ")}. Vou conferir a cidade para evitar duplicação.`;
    }
  }
  const committed = await store.commit(base);
  if (committed === "conflict") return "conflict" as const;
  if (committed !== "committed" && !committed.startsWith("replay:"))
    throw Error("guardian_commit_unconfirmed");
  return {
    reply: committed.startsWith("replay:") ? committed.slice(7) : base.reply,
    activeProperty: true,
    persisted: true,
  };
}
