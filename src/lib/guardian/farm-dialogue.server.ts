import { randomUUID } from "node:crypto";
import { fold } from "./book.ts";
import { creatingFarm, cleanFarmName, naturalConfirmation } from "./farm-dialogue.ts";
import { panelAccessRequest, panelFarmKey } from "./panel-access.ts";
import { emptyFarm, type GuardianSnapshot, type SemanticDraft } from "./schema.ts";
import type { GuardianCommit, GuardianStore } from "./store.server.ts";
import type { GuardianInput } from "./handler.server.ts";
import { collectRegistration, fieldQuestion, loadMunicipalities, municipalityMatches, nextField, privateRegistration, producerSize, registrationComplete, sizeLabel, stateCode, type RegistrationSlots, type RegistrationField } from "./farm-registration.ts";

export async function handleFarmDialogue(
  input: GuardianInput, snapshot: GuardianSnapshot, store: GuardianStore, now: Date,
  makeId: () => string = randomUUID, municipalities = loadMunicipalities,
) {
  const pending = snapshot.pending && "farmDraft" in snapshot.pending && snapshot.pending.farmDraft
    ? snapshot.pending : null;
  const access = panelAccessRequest(input.text, input.history?.at(-1)?.content.startsWith("Escolha a fazenda para abrir no painel:"));
  const reference = access?.reference;
  const candidates = reference
    ? snapshot.properties.filter((p, i) => p.id === reference || String(i+1) === reference || panelFarmKey(p.name) === panelFarmKey(reference))
    : snapshot.properties;
  const target = access && candidates.length === 1 && candidates[0].registrationRequired ? candidates[0] : undefined;
  if (!pending && !creatingFarm(input.text) && !(access && (!snapshot.properties.length || target))) return null;
  const previous = await store.receipt(input.phone, input.messageId);
  if (previous) return { reply: previous, persisted: true, activeProperty: !!snapshot.active, registration: true };
  if (target && target.role !== "owner") return { reply: "O produtor responsável precisa concluir o cadastro da propriedade antes de liberar o painel.", activeProperty: !!snapshot.active, persisted: false, registration: true };
  const base: GuardianCommit = {
    phone: input.phone, messageId: input.messageId, accountVersion: snapshot.accountVersion,
    propertyId: snapshot.active?.id ?? null, propertyVersion: snapshot.active?.version ?? null,
    operation: "pending", pending: null, reply: "",
  };
  const raw = input.text;
  if (/^(?:cancelar|cancela|cancelar cadastro|desistir|nao)[.! ]*$/.test(fold(raw))) {
    base.operation = "clear";
    base.reply = "Tudo bem, cancelei o cadastro. Nenhuma nova fazenda foi cadastrada.";
  } else {
    let prior: RegistrationSlots = pending?.farmDraft ?? {};
    if (!pending && target) {
      const book = target.id === snapshot.active?.id ? snapshot.active : await store.loadProperty?.(input.phone, target.id);
      prior = { targetPropertyId: target.id, name: book?.book.name ?? undefined, city: book?.book.city ?? undefined };
    }
    const confirmation = naturalConfirmation(raw) || /^(?:pode|tudo certo|t[aá] tudo certo|est[aá] tudo certo|pode concluir|pode finalizar|isso a[ií]|pode prosseguir)[.! ]*$/i.test(raw.trim());
    const expectingState = prior.askedField === "uf";
    const expected = pending ? prior.askedField === "retry" ? undefined : prior.askedField ?? nextField(prior) : undefined;
    const slots = confirmation || access
      ? { ...prior }
      : collectRegistration(raw, prior, expected);
    // A familiar initial request may include the farm name and municipality.
    if (!pending && creatingFarm(raw)) {
      const m = raw.match(/\b(?:cadastrar|cadastre|criar|crie)\s+(?:(?:uma|minha|a|nova)\s+)*(?:fazenda|propriedade)\s+(.+?)(?:\s+em\s+([^;\n]+)|$)/i);
      if (m && !/[:;\n]/.test(m[1]) && !/^(?:por favor|pra mim|para mim)$/i.test(m[1])) {
        slots.name ??= cleanFarmName(m[1]);
        if (m[2] && !slots.city) {
          Object.assign(slots, collectRegistration("Município: " + m[2], slots));
        }
      }
      if (/\b(?:outra|nova)\s+(?:fazenda|propriedade)\b/i.test(raw)) slots.distinct = true;
    }
    if (expectingState && !confirmation && stateCode(raw)) {
      slots.uf = stateCode(raw);
      slots.municipalityId = undefined;
    }
    let municipalityQuestion: string | undefined;
    let askedField: RegistrationField | "uf" | "retry" | undefined;
    if (slots.city && !slots.municipalityId) {
      try {
        const rows = await municipalities();
        const matches = municipalityMatches(slots.city, rows, slots.uf);
        if (matches.length === 1) {
          slots.city = matches[0].name; slots.uf = matches[0].uf; slots.municipalityId = matches[0].id;
        } else if (matches.length > 1) {
          askedField = "uf";
          municipalityQuestion = "Encontrei mais de um município chamado " + slots.city + ": " + matches.map(m => m.uf).join(", ") + ". Qual deles? Informe apenas o estado para diferenciar.";
        } else {
          slots.city = undefined; slots.uf = undefined; slots.municipalityId = undefined;
          askedField = "city";
          municipalityQuestion = "Não encontrei esse município na base do IBGE. Pode conferir o nome?";
        }
      } catch {
        askedField = "retry";
        municipalityQuestion = "Não consegui consultar a base de municípios agora. Seus dados anteriores continuam no cadastro. Responda “confirmar” para tentar novamente.";
      }
    }
    const missing = nextField(slots);
    const complete = registrationComplete(slots);
    const expired = pending && Date.parse(pending.expiresAt) <= now.getTime();
    const previousComplete = pending && registrationComplete(prior);
    if (complete && confirmation && previousComplete && !expired) {
      const data = privateRegistration(slots);
      const same = slots.distinct ? [] : snapshot.properties.filter(p => panelFarmKey(p.name) === panelFarmKey(data.name));
      let existing = slots.targetPropertyId ? snapshot.properties.find(p => p.id === slots.targetPropertyId) : undefined;
      if (slots.targetPropertyId && (!existing || existing.role !== "owner")) {
        return { reply: "O acesso à propriedade mudou. Nenhum cadastro foi confirmado.", activeProperty: !!snapshot.active, persisted: false, registration: true };
      }
      if (!existing && same.length === 1) {
        const item = same[0];
        const book = item.id === snapshot.active?.id ? snapshot.active : await store.loadProperty?.(input.phone, item.id);
        if (!book || (!book.book.city && item.registrationRequired) || (fold(book.book.city ?? "") === fold(data.city) && (!book.book.uf || book.book.uf === data.uf))) existing = item;
      } else if (!existing && same.length > 1) {
        return { reply: "Há mais de uma propriedade com esse nome. Cancele e escolha a propriedade correta pelo painel, para não duplicar cadastros.", activeProperty: !!snapshot.active, persisted: false, registration: true };
      }
      if (existing) {
        base.operation = "select"; base.propertyId = existing.id; base.propertyVersion = null;
        if (existing.registrationRequired) {
          if (existing.role !== "owner") return { reply: "Somente o produtor responsável pode completar esse cadastro.", activeProperty: !!snapshot.active, persisted: false, registration: true };
          base.details = { registration: data };
          base.reply = "Cadastro de " + data.name + " concluído! Classificação: " + sizeLabel[producerSize(data.annualRevenueCents)] + ". Seus registros anteriores foram preservados. Peça “gerar link do painel” para acessar.";
        } else {
          base.reply = "A fazenda " + existing.name + " já está cadastrada e foi selecionada. Não criei uma duplicata. Peça “gerar link do painel” para acessar.";
        }
      } else {
        base.operation = "create"; base.propertyId = makeId(); base.propertyVersion = null;
        base.book = emptyFarm(data.name, data.city, data.uf);
        base.details = { registration: data };
        base.reply = "Cadastro de " + data.name + " concluído em " + data.city + "/" + data.uf + "! Classificação: " + sizeLabel[producerSize(data.annualRevenueCents)] + ". Peça “gerar link do painel” para acessar.";
      }
    } else {
      const mask = (v: string) => "••••" + v.slice(-4);
      const format = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
      let question = municipalityQuestion ?? (missing ? fieldQuestion(missing) : "Preciso identificar o município antes de salvar.");
      if (complete) {
        question = "Confira seu cadastro:\n" +
          "Produtor: " + slots.producer + "\nPropriedade: " + slots.name +
          "\nCPF/CNPJ: " + mask(slots.document) + "\nInscrição estadual: " + mask(slots.stateRegistration) +
          "\nMunicípio: " + slots.city + "/" + slots.uf + "\nE-mail: " + slots.email.replace(/^(.{1,2})[^@]*@/, "$1•••@") +
          "\nFaturamento anual estimado: " + format(slots.annualRevenueCents) +
          "\nClassificação: " + sizeLabel[producerSize(slots.annualRevenueCents)] +
          "\nEstá tudo certo? Responda “confirmar” para concluir ou informe o campo que deseja corrigir.";
      } else if (!pending) {
        question = "Vamos cadastrar sua propriedade. Preciso do nome do produtor, nome da propriedade, CPF/CNPJ, inscrição estadual, município, e-mail e faturamento anual estimado. Você pode enviar tudo de uma vez ou responder aos poucos. " + question;
      }
      slots.askedField = complete ? undefined : askedField ?? missing;
      base.pending = {
        kind: "semantic_draft", farmDraft: slots, propertyId: null, createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60000).toISOString(),
        sourceAt: input.sentAt ?? now.toISOString(), sourceMessageId: input.messageId, question, messages: [],
      } satisfies SemanticDraft;
      base.reply = question;
    }
  }
  const committed = await store.commit(base);
  if (committed === "conflict") return "conflict" as const;
  if (committed !== "committed" && !committed.startsWith("replay:")) throw Error("guardian_commit_unconfirmed");
  return { reply: committed.startsWith("replay:") ? committed.slice(7) : base.reply,
    activeProperty: !!snapshot.active || base.operation === "create" || base.operation === "select", persisted: true, registration: true };
}

/** Run before general memory/AI; use the existing CAS and receipts. */
export async function handleRegistrationInbound(input: GuardianInput, store: GuardianStore, now = new Date(), makeId?: () => string, municipalities = loadMunicipalities) {
  if (input.mediaType && input.mediaType !== "audio") return null;
  if (input.mediaType === "audio") input = {
    ...input,
    text: input.text.replace(/^\[Mensagem recebida por áudio[^\]]*\]\s*Pedido do usuário:[\s\S]*?Transcrição do áudio:\s*/i, "").trim(),
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const snapshot = await store.load(input.phone);
    const result = await handleFarmDialogue(input, snapshot, store, now, makeId, municipalities);
    if (result !== "conflict") return result;
  }
  throw Error("guardian_registration_conflict");
}
