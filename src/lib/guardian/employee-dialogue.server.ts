import { createHash } from "node:crypto";
import { fold, applyFarmAction } from "./book.ts";
import type { GuardianInput } from "./handler.server.ts";
import type { GuardianSnapshot, GuardianAction } from "./schema.ts";
import type { GuardianStore } from "./store.server.ts";
export async function handleEmployeeDialogue(
  input: GuardianInput,
  snapshot: GuardianSnapshot,
  store: GuardianStore,
  now: Date,
) {
  if (/^(?:convidar|revogar acesso)\s+\d/.test(fold(input.text))) return null;
  const text = fold(input.text),
    prior =
      snapshot.pending?.kind === "semantic_draft" &&
      snapshot.pending.propertyId === snapshot.active?.id &&
      Date.parse(snapshot.pending.expiresAt) > now.getTime()
        ? snapshot.pending.employeeDraft
        : undefined;
  if (
    prior?.name &&
    !/funcionario|capataz|gerente|administrador|financeiro|telefone|numero|acesso|convid|revog|desativ|ativar|remov|exclu|\bele\b|\bela\b/.test(
      text,
    ) &&
    !/\d[\d ()-]{9,}/.test(input.text)
  )
    return null;
  if (
    !prior &&
    !/funcionario|capataz|gerente|administrador|cuidar do financeiro|acesso d[oa]/.test(text)
  )
    return null;
  if (!snapshot.active)
    return {
      reply: "Selecione a fazenda onde essa pessoa trabalha.",
      activeProperty: false,
      persisted: false,
    };
  if (!["owner", "manager"].includes(snapshot.active.role))
    return {
      reply: "Só o proprietário ou gerente pode alterar a equipe.",
      activeProperty: true,
      persisted: false,
    };
  if (/\b(?:listar|consultar|quem|ver|mostrar|mostra)\b/.test(text))
    return {
      reply:
        (snapshot.active.book.employees ?? [])
          .map((e) => `${e.name} — ${e.job}, ${e.active ? "ativo" : "inativo"}`)
          .join("\n") || "Ainda não há funcionários cadastrados.",
      activeProperty: true,
      persisted: false,
    };
  const people = snapshot.active.book.employees ?? [];
  const existing = people.filter(
    (e) =>
      text.includes(fold(e.name)) || text.split(/[^a-z0-9]+/).includes(fold(e.name).split(" ")[0]),
  );
  if (existing.length > 1)
    return {
      reply: "Encontrei mais de uma pessoa com esse nome. Qual é o nome completo?",
      activeProperty: true,
      persisted: false,
    };
  const named =
    input.text.match(/chamad[oa]\s+([\p{L} '’-]+?)(?:[.!?]|$)/iu) ??
    input.text.match(
      /(?:chamad[oa]|(?:adiciona|adicionar|cadastr[ae]\w*|coloca)\s+(?:o|a)|(?:funcion[aá]rio|gerente)\s+(?:chamad[oa]\s+)?)([\p{L} '’-]+?)(?=\s+(?:como|pra|para|[ée] (?:o |a )?(?:gerente|funcion|administr)|na fazenda)|[.!?]|$)/iu,
    );
  const isName = input.text.match(
    /^([\p{L} '’-]+?)\s+[ée]\s+(?:o |a )?(?:gerente|funcion[aá]ri[oa]|administrador)/iu,
  );
  const name =
    existing[0]?.name ??
    named?.[1]?.trim() ??
    (isName && !/^(?:ele|ela|meu capataz|minha funcionaria)$/i.test(fold(isName[1]))
      ? isName[1].trim().replace(/^(?:o|a)\s+/i, "")
      : undefined) ??
    (prior && !prior.name ? input.text.trim() : prior?.name);
  if (!name) {
    const reply = "Qual é o nome da pessoa? Posso cadastrar mesmo sem telefone.";
    const result = await store.commit({
      phone: input.phone,
      messageId: input.messageId,
      accountVersion: snapshot.accountVersion,
      propertyId: snapshot.active.id,
      propertyVersion: snapshot.active.version,
      operation: "pending",
      pending: {
        kind: "semantic_draft",
        employeeDraft: { name: "", job: /capataz/.test(text) ? "Capataz" : "Funcionário" },
        propertyId: snapshot.active.id,
        sourceMessageId: input.messageId,
        sourceAt: now.toISOString(),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 1800000).toISOString(),
        question: reply,
        messages: [],
      },
      reply,
    });
    if (result === "conflict") return "conflict" as const;
    return { reply, activeProperty: true, persisted: true };
  }
  const job = /financeiro/.test(text)
    ? "Financeiro"
    : /gerente|administrador/.test(text)
      ? "Gerente"
      : /capataz/.test(text)
        ? "Capataz"
        : (prior?.job ?? existing[0]?.job ?? "Funcionário");
  let phone = input.text.match(/\+?\d[\d ()-]{9,20}\d/)?.[0].replace(/\D/g, "");
  if (phone && [10, 11].includes(phone.length)) phone = "55" + phone;
  if (
    (/\b(?:convid|acesso|tira|revog)/.test(text) ||
      (!!existing[0]?.phone && /agora.*(?:administrador|gerente|funcionario)/.test(text))) &&
    !/nao (?:tenho|possuo).*numero|sem (?:telefone|numero)/.test(text)
  ) {
    const number = phone ?? existing[0]?.phone;
    if (!number)
      return {
        reply: `O cadastro de ${name} pode ser feito sem telefone. Para liberar ou revogar acesso, preciso do WhatsApp da pessoa.`,
        activeProperty: true,
        persisted: false,
      };
    // Only the existing invitation/revocation flow can change authentication rights.
    return {
      accessAction: /tira|revog/.test(text)
        ? { kind: "revoke", phone: number }
        : { kind: "invite", phone: number, role: job === "Gerente" ? "manager" : "worker" },
    } as { accessAction: GuardianAction };
  }
  const action: GuardianAction = {
    kind: "employee_save",
    id:
      existing[0]?.id ??
      createHash("sha256")
        .update(snapshot.active.id + ":" + fold(name))
        .digest("hex")
        .slice(0, 20),
    name,
    job,
    active: !/desativ|remov|exclu/.test(text),
    ...(phone ? { phone } : { ...(existing[0]?.phone ? { phone: existing[0].phone } : {}) }),
  };
  const applied = applyFarmAction(
    snapshot.active.book,
    action,
    snapshot.active.role,
    { actor: input.phone, messageId: input.messageId, at: now.toISOString(), confirmed: true },
    action.id,
  );
  const result = await store.commit({
    phone: input.phone,
    messageId: input.messageId,
    accountVersion: snapshot.accountVersion,
    propertyId: snapshot.active.id,
    propertyVersion: snapshot.active.version,
    operation: "update",
    book: applied.book,
    pending: {
      kind: "semantic_draft",
      employeeDraft: { name, job },
      propertyId: snapshot.active.id,
      sourceMessageId: input.messageId,
      sourceAt: now.toISOString(),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      question: "Cadastro de funcionário salvo, sem concessão de acesso.",
      messages: [],
    },
    details: { kind: "property_update", employeeId: action.id },
    reply: applied.result,
  });
  if (result === "conflict") return "conflict" as const;
  if (result !== "committed" && !result.startsWith("replay:"))
    throw Error("guardian_commit_unconfirmed");
  return {
    reply: result.startsWith("replay:") ? result.slice(7) : applied.result,
    activeProperty: true,
    persisted: true,
  };
}
