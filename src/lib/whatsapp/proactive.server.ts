/* eslint-disable @typescript-eslint/no-explicit-any */
import { askOpenAI } from "../chat/openai.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import { supabaseAdmin } from "../../integrations/supabase/client.server.ts";
import type { WhatsAppChatInput } from "./types.ts";
import {
  USER_MEMORY_EPOCH,
  MEMORY_INBOX_PREFIX,
  currentMemoryInboxText,
} from "../chat/memory-reset.ts";
import { parseFollowupPreference, sanitizeMemoryFactKey } from "./proactive.ts";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const MAX_FACTS_FOR_PROMPT = 20;

export type MemoryFactStatus = "active" | "resolved";

export interface WhatsAppMemoryFact {
  id: string;
  phoneNumber: string;
  factKey: string;
  category: string;
  subject: string;
  valueText: string;
  status: MemoryFactStatus;
  importance: number;
  followUpRelevant: boolean;
  sourceMessageId: string | null;
  sourceExcerpt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

export interface WhatsAppFollowupProfile {
  phoneNumber: string;
  followupsEnabled: boolean;
  optedOutAt: string | null;
  timeZone: string;
  lastInboundAt: string | null;
  lastMemoryAt: string | null;
  lastProactiveAt: string | null;
  memoryCount: number;
}

export interface WhatsAppProactiveQueueItem {
  id: string;
  phoneNumber: string;
  localDate: string;
  slotNo: number | null;
  source: "scheduled" | "manual";
  scheduledFor: string;
  status: string;
  attempts: number;
  messageText: string | null;
  deliveryMode: string | null;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface WhatsAppFollowupDetail {
  profile: WhatsAppFollowupProfile | null;
  facts: WhatsAppMemoryFact[];
  queue: WhatsAppProactiveQueueItem[];
}

export interface ManualFollowupResult {
  status: "sent" | "skipped" | "failed" | "uncertain";
  message: string | null;
  deliveryMode: string | null;
  reason: string | null;
}

interface MemoryInboxItem {
  id: string;
  messageId: string;
  phoneNumber: string;
  userText: string;
  attempts: number;
}

type MemoryAction =
  | {
      op: "upsert";
      factKey: string;
      category: string;
      subject: string;
      valueText: string;
      importance: number;
      followUpRelevant: boolean;
    }
  | {
      op: "resolve";
      factId?: string;
      factKey?: string;
      resolution?: string;
    };

function db() {
  return supabaseAdmin as any;
}

function hasDurableStore(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 900);
}

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) throw new Error("invalid_whatsapp_phone");
  return digits;
}

function mapProfile(row: any): WhatsAppFollowupProfile {
  return {
    phoneNumber: String(row.phone_number),
    followupsEnabled: row.followups_enabled === true,
    optedOutAt: typeof row.opted_out_at === "string" ? row.opted_out_at : null,
    timeZone: typeof row.timezone === "string" && row.timezone ? row.timezone : DEFAULT_TIME_ZONE,
    lastInboundAt: typeof row.last_inbound_at === "string" ? row.last_inbound_at : null,
    lastMemoryAt: typeof row.last_memory_at === "string" ? row.last_memory_at : null,
    lastProactiveAt: typeof row.last_proactive_at === "string" ? row.last_proactive_at : null,
    memoryCount: Number(row.memory_count ?? 0),
  };
}

function mapFact(row: any): WhatsAppMemoryFact {
  return {
    id: String(row.id),
    phoneNumber: String(row.phone_number),
    factKey: String(row.fact_key),
    category: String(row.category ?? "other"),
    subject: String(row.subject ?? "propriedade"),
    valueText: String(row.value_text ?? ""),
    status: row.status === "resolved" ? "resolved" : "active",
    importance: Math.max(1, Math.min(5, Number(row.importance ?? 3))),
    followUpRelevant: row.follow_up_relevant !== false,
    sourceMessageId: typeof row.source_message_id === "string" ? row.source_message_id : null,
    sourceExcerpt: typeof row.source_excerpt === "string" ? row.source_excerpt : null,
    firstSeenAt: String(row.first_seen_at ?? ""),
    lastSeenAt: String(row.last_seen_at ?? ""),
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
  };
}

function mapQueue(row: any): WhatsAppProactiveQueueItem {
  return {
    id: String(row.id),
    phoneNumber: String(row.phone_number),
    localDate: String(row.local_date),
    slotNo: row.slot_no === null || row.slot_no === undefined ? null : Number(row.slot_no),
    source: row.source === "manual" ? "manual" : "scheduled",
    scheduledFor: String(row.scheduled_for),
    status: String(row.status),
    attempts: Number(row.attempts ?? 0),
    messageText: typeof row.message_text === "string" ? row.message_text : null,
    deliveryMode: typeof row.delivery_mode === "string" ? row.delivery_mode : null,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    sentAt: typeof row.sent_at === "string" ? row.sent_at : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function stripCodeFence(value: string): string {
  const fence = String.fromCharCode(96).repeat(3);
  let text = value.trim();
  if (text.startsWith(fence)) {
    text = text.slice(3).trimStart();
    if (text.toLowerCase().startsWith("json")) text = text.slice(4).trimStart();
    else if (text.toLowerCase().startsWith("text")) text = text.slice(4).trimStart();
  }
  if (text.endsWith(fence)) text = text.slice(0, -3).trimEnd();
  return text.trim();
}

async function ensureProfile(
  phoneValue: string,
  lastInboundAt?: string | null,
): Promise<WhatsAppFollowupProfile> {
  const phone = normalizedPhone(phoneValue);
  const current = await db()
    .from("whatsapp_followup_profiles")
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();
  if (current.error) {
    throw new Error("whatsapp_followup_profile_load_failed:" + (current.error.code ?? "unknown"));
  }

  if (current.data) {
    if (lastInboundAt) {
      const update = await db()
        .from("whatsapp_followup_profiles")
        .update({ last_inbound_at: lastInboundAt, updated_at: new Date().toISOString() })
        .eq("phone_number", phone);
      if (update.error) {
        throw new Error(
          "whatsapp_followup_profile_update_failed:" + (update.error.code ?? "unknown"),
        );
      }
      return { ...mapProfile(current.data), lastInboundAt };
    }
    return mapProfile(current.data);
  }

  const now = new Date().toISOString();
  const insert = await db()
    .from("whatsapp_followup_profiles")
    .insert({
      phone_number: phone,
      followups_enabled: false,
      timezone: DEFAULT_TIME_ZONE,
      last_inbound_at: lastInboundAt ?? null,
      memory_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (insert.error) {
    throw new Error("whatsapp_followup_profile_insert_failed:" + (insert.error.code ?? "unknown"));
  }
  return mapProfile(insert.data);
}

export async function observeWhatsAppInboundForMemory(
  input: WhatsAppChatInput,
  resolvedUserText = input.text,
): Promise<{ queued: boolean; preference: "enable" | "disable" | null }> {
  if (!hasDurableStore()) return { queued: false, preference: null };

  const phone = normalizedPhone(input.phone);
  const now = new Date().toISOString();
  const preference = parseFollowupPreference(resolvedUserText);
  await ensureProfile(phone, now);

  if (preference) {
    const preferenceUpdate =
      preference === "disable"
        ? { followups_enabled: false, opted_out_at: now, updated_at: now }
        : { followups_enabled: false, opted_out_at: null, updated_at: now };
    const prefResult = await db()
      .from("whatsapp_followup_profiles")
      .update(preferenceUpdate)
      .eq("phone_number", phone);
    if (prefResult.error) {
      throw new Error(
        "whatsapp_followup_preference_failed:" + (prefResult.error.code ?? "unknown"),
      );
    }
  }

  const userText = resolvedUserText.trim().slice(0, 16_000);
  if (userText.length < 2) return { queued: false, preference };

  const inbox = await db()
    .from("whatsapp_memory_inbox")
    .upsert(
      {
        message_id: input.messageId,
        phone_number: phone,
        user_text: MEMORY_INBOX_PREFIX + userText,
        status: "pending",
        last_error: null,
        updated_at: now,
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    );
  if (inbox.error) {
    throw new Error("whatsapp_memory_inbox_enqueue_failed:" + (inbox.error.code ?? "unknown"));
  }

  return { queued: true, preference };
}

async function activeFacts(phone: string): Promise<WhatsAppMemoryFact[]> {
  const result = await db()
    .from("whatsapp_user_memory_facts")
    .select("*")
    .eq("phone_number", phone)
    .eq("status", "active")
    .eq("follow_up_relevant", true)
    .contains("metadata", { memory_epoch: USER_MEMORY_EPOCH })
    .order("importance", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(MAX_FACTS_FOR_PROMPT);
  if (result.error) {
    throw new Error("whatsapp_memory_facts_load_failed:" + (result.error.code ?? "unknown"));
  }
  return (result.data ?? []).map(mapFact);
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const stripped = stripCodeFence(text);
  try {
    const parsed = JSON.parse(stripped);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    try {
      const parsed = JSON.parse(stripped.slice(first, last + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function normalizeMemoryActions(value: unknown): MemoryAction[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as Record<string, unknown>).actions;
  if (!Array.isArray(raw)) return [];
  const actions: MemoryAction[] = [];

  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.op === "resolve") {
      const factId = typeof row.fact_id === "string" ? row.fact_id.slice(0, 80) : undefined;
      const factKey =
        typeof row.fact_key === "string" ? sanitizeMemoryFactKey(row.fact_key) : undefined;
      if (!factId && !factKey) continue;
      actions.push({
        op: "resolve",
        ...(factId ? { factId } : {}),
        ...(factKey ? { factKey } : {}),
        ...(typeof row.resolution === "string"
          ? { resolution: row.resolution.trim().slice(0, 500) }
          : {}),
      });
      continue;
    }
    if (row.op !== "upsert") continue;
    const valueText = typeof row.value_text === "string" ? row.value_text.trim() : "";
    if (!valueText) continue;
    actions.push({
      op: "upsert",
      factKey: sanitizeMemoryFactKey(
        typeof row.fact_key === "string" ? row.fact_key : valueText.slice(0, 80),
      ),
      category:
        typeof row.category === "string" ? row.category.trim().toLowerCase().slice(0, 40) : "other",
      subject:
        typeof row.subject === "string" && row.subject.trim()
          ? row.subject.trim().slice(0, 160)
          : "propriedade",
      valueText: valueText.slice(0, 700),
      importance: Math.max(1, Math.min(5, Math.trunc(Number(row.importance ?? 3)) || 3)),
      followUpRelevant: row.follow_up_relevant !== false,
    });
  }
  return actions;
}

function heuristicActions(
  messageId: string,
  userText: string,
  existing: WhatsAppMemoryFact[],
): MemoryAction[] {
  const actions: MemoryAction[] = [];
  const resolution =
    /\b(melhorou|sarou|se recuperou|recuperou|ficou bem|est[aá]\s+bem|j[aá]\s+est[aá]\s+bom|j[aá]\s+t[aá]\s+bom|curou)\b/i.test(
      userText,
    );
  const healthFacts = existing.filter((fact) => /health|saude|sanidade/i.test(fact.category));

  if (resolution && healthFacts.length > 0) {
    actions.push({
      op: "resolve",
      factId: healthFacts[0].id,
      resolution: userText.slice(0, 500),
    });
  }

  const herdMatch = userText.match(
    /\b(\d{1,3}(?:[.\s]\d{3})+|\d{1,7})\s*(?:cabe[çc]as?|gados?|bois?|vacas?|animais)\b/i,
  );
  if (herdMatch) {
    const quantity = Number(herdMatch[1].replace(/[.\s]/g, ""));
    if (Number.isFinite(quantity) && quantity > 0) {
      actions.push({
        op: "upsert",
        factKey: "herd:size",
        category: "herd",
        subject: "rebanho",
        valueText: "O usuário informou um rebanho de aproximadamente " + quantity + " animais.",
        importance: 4,
        followUpRelevant: true,
      });
    }
  }

  const healthSignal =
    /\b(boi|vaca|bezerro|bezerra|novilha|touro|animal)\b[\s\S]{0,140}\b(doente|febre|diarreia|mancando|manco|sem comer|n[aã]o come|machucado|ferida|tosse|abatido|fraco)\b/i.test(
      userText,
    ) ||
    /\b(doente|febre|diarreia|mancando|sem comer|machucado|ferida|tosse|abatido|fraco)\b[\s\S]{0,140}\b(boi|vaca|bezerro|bezerra|novilha|touro|animal)\b/i.test(
      userText,
    );

  if (healthSignal && !resolution) {
    const animal =
      userText.match(/\b(boi|vaca|bezerro|bezerra|novilha|touro|animal)\b/i)?.[1] ?? "animal";
    actions.push({
      op: "upsert",
      factKey:
        "health:" +
        sanitizeMemoryFactKey(animal) +
        ":" +
        sanitizeMemoryFactKey(messageId).slice(-36),
      category: "health",
      subject: animal,
      valueText: userText.slice(0, 700),
      importance: 5,
      followUpRelevant: true,
    });
  }

  return actions.slice(0, 8);
}

async function extractActionsWithAI(
  messageId: string,
  userText: string,
  existing: WhatsAppMemoryFact[],
): Promise<MemoryAction[]> {
  const existingPayload = existing.map((fact) => ({
    id: fact.id,
    fact_key: fact.factKey,
    category: fact.category,
    subject: fact.subject,
    value_text: fact.valueText,
    status: fact.status,
  }));

  const prompt =
    "TAREFA INTERNA DE MEMÓRIA DA TPEC-IA.\n" +
    "Analise a mensagem recebida no WhatsApp e decida se ela contém fatos úteis e duradouros para acompanhar o produtor em conversas futuras.\n\n" +
    "Guarde somente fatos relevantes à rotina agropecuária, como tamanho/composição do rebanho, localização da propriedade, animais em tratamento ou observação, objetivos produtivos, nutrição/manejo recorrente, infraestrutura e acontecimentos que mereçam acompanhamento.\n" +
    "Não guarde conversa casual, cumprimentos, números bancários, documentos, senhas, credenciais, dados financeiros pessoais ou informação sem utilidade futura.\n" +
    "Quando a mensagem atualizar um fato já salvo, atualize a mesma fact_key. Quando indicar que uma situação acabou, resolva o fato ativo correspondente em vez de criar outro. Não invente nada.\n\n" +
    "Fatos ativos existentes:\n" +
    JSON.stringify(existingPayload) +
    "\n\nMensagem atual (id " +
    messageId +
    "):\n" +
    userText.slice(0, 12_000) +
    "\n\nRetorne SOMENTE JSON válido neste formato:\n" +
    '{"actions":[{"op":"upsert","fact_key":"chave-estavel","category":"herd|health|location|nutrition|goal|infrastructure|management|other","subject":"assunto curto","value_text":"fato objetivo","importance":1,"follow_up_relevant":true},{"op":"resolve","fact_id":"uuid-existente","resolution":"o que mudou"}]}\n' +
    'Se não houver nada que valha guardar, retorne {"actions":[]}.';

  const history: ChatMessage[] = [{ role: "user", content: prompt }];
  const response = await askOpenAI(history, {
    model: "luna",
    researchDepth: "none",
    reasoningEffort: "low",
    timeoutMs: 20_000,
    sourcePolicy:
      "EXTRAÇÃO ESTRUTURADA INTERNA: não responda ao usuário, não pesquise na web e não acrescente texto fora do JSON solicitado.",
    stage: "whatsapp_memory_extraction",
  });
  return normalizeMemoryActions(extractJsonObject(response));
}

async function applyMemoryActions(item: MemoryInboxItem, actions: MemoryAction[]): Promise<void> {
  const now = new Date().toISOString();

  for (const action of actions) {
    if (action.op === "resolve") {
      let query = db()
        .from("whatsapp_user_memory_facts")
        .update({
          status: "resolved",
          resolved_at: now,
          last_seen_at: now,
          metadata: {
            memory_epoch: USER_MEMORY_EPOCH,
            resolution: action.resolution ?? "Situação informada como resolvida pelo usuário.",
          },
          updated_at: now,
        })
        .eq("phone_number", item.phoneNumber)
        .contains("metadata", { memory_epoch: USER_MEMORY_EPOCH })
        .eq("status", "active");
      if (action.factId) query = query.eq("id", action.factId);
      else if (action.factKey) query = query.eq("fact_key", action.factKey);
      const result = await query;
      if (result.error) {
        throw new Error("whatsapp_memory_resolve_failed:" + (result.error.code ?? "unknown"));
      }
      continue;
    }

    const existing = await db()
      .from("whatsapp_user_memory_facts")
      .select("id,metadata")
      .eq("phone_number", item.phoneNumber)
      .eq("fact_key", action.factKey)
      .maybeSingle();
    if (existing.error) {
      throw new Error("whatsapp_memory_fact_lookup_failed:" + (existing.error.code ?? "unknown"));
    }

    const payload = {
      category: action.category,
      subject: action.subject,
      value_text: action.valueText,
      status: "active",
      importance: action.importance,
      follow_up_relevant: action.followUpRelevant,
      source_message_id: item.messageId,
      source_excerpt: item.userText.slice(0, 700),
      last_seen_at: now,
      resolved_at: null,
      updated_at: now,
      metadata: { memory_epoch: USER_MEMORY_EPOCH },
      ...(existing.data?.metadata?.memory_epoch === USER_MEMORY_EPOCH
        ? {}
        : { first_seen_at: now }),
    };

    const result = existing.data?.id
      ? await db()
          .from("whatsapp_user_memory_facts")
          .update(payload)
          .eq("id", existing.data.id)
          .eq("phone_number", item.phoneNumber)
      : await db()
          .from("whatsapp_user_memory_facts")
          .insert({
            phone_number: item.phoneNumber,
            fact_key: action.factKey,
            ...payload,
            first_seen_at: now,
            created_at: now,
          });
    if (result.error) {
      throw new Error("whatsapp_memory_fact_save_failed:" + (result.error.code ?? "unknown"));
    }
  }

  const count = await db()
    .from("whatsapp_user_memory_facts")
    .select("id", { count: "exact", head: true })
    .eq("phone_number", item.phoneNumber)
    .eq("status", "active")
    .contains("metadata", { memory_epoch: USER_MEMORY_EPOCH })
    .eq("follow_up_relevant", true);
  if (count.error) {
    throw new Error("whatsapp_memory_count_failed:" + (count.error.code ?? "unknown"));
  }

  const profile = await db()
    .from("whatsapp_followup_profiles")
    .update({
      memory_count: Number(count.count ?? 0),
      last_memory_at: now,
      updated_at: now,
    })
    .eq("phone_number", item.phoneNumber);
  if (profile.error) {
    throw new Error("whatsapp_memory_profile_count_failed:" + (profile.error.code ?? "unknown"));
  }
}

async function processMemoryItem(item: MemoryInboxItem): Promise<void> {
  const currentText = currentMemoryInboxText(item.userText);
  if (currentText === null) return;
  item = { ...item, userText: currentText };
  const existing = await activeFacts(item.phoneNumber);
  let actions: MemoryAction[] = [];
  try {
    actions = await extractActionsWithAI(item.messageId, item.userText, existing);
  } catch (error) {
    console.error("[whatsapp-memory] ai extraction failed " + errorMessage(error));
  }
  if (actions.length === 0) {
    actions = heuristicActions(item.messageId, item.userText, existing);
  }
  await applyMemoryActions(item, actions);
}

export async function processPendingWhatsAppMemories(limit = 12) {
  if (!hasDurableStore()) return { claimed: 0, completed: 0, failed: 0 };
  const claimed = await db().rpc("claim_whatsapp_memory_inbox", {
    p_limit: Math.max(1, Math.min(50, Math.trunc(limit))),
  });
  if (claimed.error) {
    throw new Error("whatsapp_memory_claim_failed:" + (claimed.error.code ?? "unknown"));
  }

  const rows: MemoryInboxItem[] = (claimed.data ?? []).map((row: any) => ({
    id: String(row.id),
    messageId: String(row.message_id),
    phoneNumber: String(row.phone_number),
    userText: String(row.user_text ?? ""),
    attempts: Number(row.attempts ?? 0),
  }));
  let completed = 0;
  let failed = 0;

  for (const item of rows) {
    try {
      await processMemoryItem(item);
      const done = await db()
        .from("whatsapp_memory_inbox")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("status", "processing");
      if (done.error) {
        throw new Error("memory_inbox_complete_failed:" + (done.error.code ?? "unknown"));
      }
      completed += 1;
    } catch (error) {
      failed += 1;
      const retryable = item.attempts < 4;
      await db()
        .from("whatsapp_memory_inbox")
        .update({
          status: retryable ? "error" : "dead",
          last_error: errorMessage(error),
          processed_at: retryable ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }

  return { claimed: rows.length, completed, failed };
}

/** Legacy slots are retained only for history compatibility. New notifications require events. */
export async function seedDailyWhatsAppFollowups(_now = new Date()): Promise<number> {
  return 0;
}

/** No legacy automatic or ad-hoc generation is dispatched. */
export async function processDueWhatsAppFollowups(_limit = 10) {
  return { claimed: 0, sent: 0, skipped: 0, failed: 0, uncertain: 0 };
}

export async function runWhatsAppFollowupMaintenance() {
  if (process.env.WHATSAPP_PROACTIVE_ENABLED?.trim().toLowerCase() !== "true") {
    return { enabled: false };
  }
  const { runGuardianMaintenance } = await import("../guardian/maintenance.server.ts");
  const [memory, guardian] = await Promise.allSettled([
    processPendingWhatsAppMemories(16),
    runGuardianMaintenance(),
  ]);
  return {
    enabled: true,
    memory: memory.status === "fulfilled" ? memory.value : { failed: true },
    guardian: guardian.status === "fulfilled" ? guardian.value : { failed: true },
  };
}

/** Administrators cannot substitute for the recipient's consent or a verifiable event. */
export async function forceWhatsAppFollowup(_phoneValue: string): Promise<ManualFollowupResult> {
  return {
    status: "skipped",
    message: null,
    deliveryMode: null,
    reason: "use_guardian_verified_events",
  };
}

export async function setWhatsAppFollowupsEnabled(
  phoneValue: string,
  enabled: boolean,
): Promise<WhatsAppFollowupProfile> {
  if (enabled)
    throw new Error(
      "A ativação de avisos exige consentimento do produtor pelo WhatsApp da Guardiã.",
    );
  const phone = normalizedPhone(phoneValue);
  await ensureProfile(phone);
  const now = new Date().toISOString();
  const result = await db()
    .from("whatsapp_followup_profiles")
    .update({
      followups_enabled: enabled,
      opted_out_at: enabled ? null : now,
      updated_at: now,
    })
    .eq("phone_number", phone)
    .select("*")
    .single();
  if (result.error) {
    throw new Error("whatsapp_followup_toggle_failed:" + (result.error.code ?? "unknown"));
  }
  return mapProfile(result.data);
}

export async function getWhatsAppFollowupDetail(
  phoneValue: string,
): Promise<WhatsAppFollowupDetail> {
  const phone = normalizedPhone(phoneValue);
  if (!hasDurableStore()) return { profile: null, facts: [], queue: [] };

  const [profile, facts, queue] = await Promise.all([
    db().from("whatsapp_followup_profiles").select("*").eq("phone_number", phone).maybeSingle(),
    db()
      .from("whatsapp_user_memory_facts")
      .select("*")
      .eq("phone_number", phone)
      .contains("metadata", { memory_epoch: USER_MEMORY_EPOCH })
      .order("status", { ascending: true })
      .order("last_seen_at", { ascending: false })
      .limit(50),
    db()
      .from("whatsapp_proactive_queue")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (profile.error) {
    throw new Error("whatsapp_followup_detail_profile_failed:" + (profile.error.code ?? "unknown"));
  }
  if (facts.error) {
    throw new Error("whatsapp_followup_detail_facts_failed:" + (facts.error.code ?? "unknown"));
  }
  if (queue.error) {
    throw new Error("whatsapp_followup_detail_queue_failed:" + (queue.error.code ?? "unknown"));
  }

  return {
    profile: profile.data
      ? {
          ...mapProfile(profile.data),
          memoryCount: (facts.data ?? []).filter((f: any) => f.status === "active").length,
          lastMemoryAt: (facts.data ?? []).length ? mapProfile(profile.data).lastMemoryAt : null,
        }
      : null,
    facts: (facts.data ?? []).map(mapFact),
    queue: (queue.data ?? []).map(mapQueue),
  };
}
