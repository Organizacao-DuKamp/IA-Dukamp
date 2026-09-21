/* eslint-disable @typescript-eslint/no-explicit-any */
import { askOpenAI } from "../chat/openai.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import { supabaseAdmin } from "../../integrations/supabase/client.server.ts";
import type { WhatsAppChatInput } from "./types.ts";
import { syncWhatsAppProactiveHistory } from "./store.server.ts";
import {
  buildDailyFollowupSchedule,
  localDateForTimeZone,
  parseFollowupPreference,
  sanitizeMemoryFactKey,
  withinCustomerServiceWindow,
} from "./proactive.ts";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const MAX_FACTS_FOR_PROMPT = 20;
const MAX_RECENT_MESSAGES = 8;
const MAX_GENERATED_MESSAGE = 900;

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

interface QueueClaim {
  id: string;
  phoneNumber: string;
  localDate: string;
  slotNo: number | null;
  source: "scheduled" | "manual";
  scheduledFor: string;
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
    followupsEnabled: row.followups_enabled !== false,
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
      followups_enabled: true,
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
        : { followups_enabled: true, opted_out_at: null, updated_at: now };
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

  const inbox = await db().from("whatsapp_memory_inbox").upsert(
    {
      message_id: input.messageId,
      phone_number: phone,
      user_text: userText,
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
            resolution: action.resolution ?? "Situação informada como resolvida pelo usuário.",
          },
          updated_at: now,
        })
        .eq("phone_number", item.phoneNumber)
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
      .select("id")
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

export async function seedDailyWhatsAppFollowups(now = new Date()): Promise<number> {
  if (!hasDurableStore()) return 0;
  const profiles = await db()
    .from("whatsapp_followup_profiles")
    .select("phone_number,timezone,memory_count")
    .eq("followups_enabled", true)
    .gt("memory_count", 0)
    .limit(2000);
  if (profiles.error) {
    throw new Error("whatsapp_followup_seed_profiles_failed:" + (profiles.error.code ?? "unknown"));
  }

  const rows: Record<string, unknown>[] = [];
  for (const profile of profiles.data ?? []) {
    const phone = String(profile.phone_number);
    const timeZone =
      typeof profile.timezone === "string" && profile.timezone
        ? profile.timezone
        : DEFAULT_TIME_ZONE;
    const localDate = localDateForTimeZone(now, timeZone);
    for (const slot of buildDailyFollowupSchedule(phone, localDate, timeZone)) {
      if (Date.parse(slot.scheduledFor) < now.getTime() - 5 * 60_000) continue;
      rows.push({
        phone_number: phone,
        local_date: localDate,
        slot_no: slot.slot,
        source: "scheduled",
        scheduled_for: slot.scheduledFor,
        status: "pending",
        attempts: 0,
        updated_at: now.toISOString(),
      });
    }
  }

  if (rows.length === 0) return 0;
  const insert = await db().from("whatsapp_proactive_queue").upsert(rows, {
    onConflict: "phone_number,local_date,slot_no",
    ignoreDuplicates: true,
  });
  if (insert.error) {
    throw new Error("whatsapp_followup_seed_failed:" + (insert.error.code ?? "unknown"));
  }
  return rows.length;
}

function recentMessageText(rows: any[]): string[] {
  return rows
    .map((row) => (typeof row.message_text === "string" ? row.message_text.trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_RECENT_MESSAGES);
}

async function generateProactiveMessage(
  facts: WhatsAppMemoryFact[],
  recentMessages: string[],
  source: "scheduled" | "manual",
  slotNo: number | null,
): Promise<string> {
  const location = facts.find(
    (fact) =>
      /location|localiza|propriedade/i.test(fact.category) ||
      /location|localiza/i.test(fact.factKey),
  );
  const factsPayload = facts.map((fact) => ({
    category: fact.category,
    subject: fact.subject,
    value: fact.valueText,
    importance: fact.importance,
  }));

  const prompt =
    "Escreva UMA mensagem proativa curta da TPEC-IA para o produtor no WhatsApp.\n" +
    "Use apenas os fatos abaixo. Escolha um ou dois que façam sentido acompanhar agora.\n" +
    "Se houver um caso de saúde animal ativo, pergunte de forma natural se houve melhora.\n" +
    "Se houver localização da propriedade, você pode consultar a situação meteorológica atual somente se isso trouxer um alerta ou dica realmente útil para hoje.\n" +
    "Não diga que existe memória, banco, ficha, automação ou agendamento.\n" +
    "Não invente fatos, diagnóstico, tratamento, clima, preço ou urgência.\n" +
    "Evite repetir o mesmo assunto das mensagens recentes.\n" +
    "Tom brasileiro, humano e profissional. Prefira 1 a 3 frases, sem cabeçalho e sem links.\n\n" +
    "Fatos ativos:\n" +
    JSON.stringify(factsPayload) +
    "\n\nMensagens proativas recentes:\n" +
    JSON.stringify(recentMessages) +
    "\n\nOrigem: " +
    source +
    "; slot: " +
    String(slotNo ?? "manual") +
    ". Retorne somente a mensagem final.";

  let message = await askOpenAI([{ role: "user", content: prompt }], {
    model: "luna",
    channel: "whatsapp",
    researchDepth: location ? "medium" : "none",
    maxToolCalls: location ? 1 : undefined,
    reasoningEffort: "low",
    timeoutMs: location ? 30_000 : 20_000,
    sourcePolicy: location
      ? "CONTATO PROATIVO: use Web Search somente se necessário para checar clima atual relacionado ao local salvo: " +
        location.valueText +
        ". Não inclua URL na mensagem e não invente dado temporal."
      : "CONTATO PROATIVO: não pesquise na web. Use somente os fatos fornecidos.",
    stage: "whatsapp_proactive_message",
  });

  message = stripCodeFence(message);
  if (!message) throw new Error("empty_proactive_message");
  message = Array.from(message).slice(0, MAX_GENERATED_MESSAGE).join("").trim();

  if (
    source === "scheduled" &&
    slotNo === 1 &&
    !message.toLocaleLowerCase("pt-BR").includes("parar acompanhamento")
  ) {
    message += "\n\nSe quiser pausar esse acompanhamento, responda “parar acompanhamento”.";
  }
  return message;
}

function fallbackMessage(
  facts: WhatsAppMemoryFact[],
  source: "scheduled" | "manual",
  slotNo: number | null,
) {
  const fact = facts[0];
  let message = "Oi! Passando para acompanhar como estão as coisas na propriedade.";
  if (fact?.category.match(/health|saude|sanidade/i)) {
    message =
      "Oi! Queria acompanhar " +
      fact.subject +
      ": " +
      fact.valueText +
      " Como ele está agora, melhorou?";
  } else if (fact?.category.match(/herd|rebanho/i)) {
    message =
      "Oi! Como está o manejo do seu rebanho? Você comentou que " +
      fact.valueText.toLocaleLowerCase("pt-BR") +
      " Teve alguma mudança importante?";
  } else if (fact) {
    message =
      "Oi! Queria acompanhar uma coisa que você comentou: " +
      fact.valueText +
      " Como está isso hoje?";
  }
  if (source === "scheduled" && slotNo === 1) {
    message += "\n\nSe quiser pausar esse acompanhamento, responda “parar acompanhamento”.";
  }
  return Array.from(message).slice(0, MAX_GENERATED_MESSAGE).join("");
}

async function graphSend(
  phone: string,
  message: string,
  mode: "text" | "template",
): Promise<{ status: "sent" | "failed" | "uncertain"; error: string | null }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = (process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v25.0").replace(
    /^\/+|\/+$/g,
    "",
  );
  if (!token || !phoneNumberId) {
    return { status: "failed", error: "whatsapp_credentials_missing" };
  }
  if (!/^v\d+\.\d+$/.test(version)) {
    return { status: "failed", error: "invalid_whatsapp_graph_api_version" };
  }

  let payload: Record<string, unknown>;
  if (mode === "template") {
    const name = process.env.WHATSAPP_PROACTIVE_TEMPLATE_NAME?.trim();
    const language = process.env.WHATSAPP_PROACTIVE_TEMPLATE_LANGUAGE?.trim() || "pt_BR";
    if (!name) return { status: "failed", error: "approved_template_not_configured" };
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name,
        language: { code: language },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: message }],
          },
        ],
      },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { preview_url: false, body: message },
    };
  }

  try {
    const response = await fetch(
      "https://graph.facebook.com/" +
        version +
        "/" +
        encodeURIComponent(phoneNumberId) +
        "/messages",
      {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.ok) return { status: "sent", error: null };
    const raw = await response.text().catch(() => "");
    const detail = "whatsapp_proactive_send_failed:" + response.status + ":" + raw.slice(0, 300);
    if (response.status >= 500) return { status: "uncertain", error: detail };
    return { status: "failed", error: detail };
  } catch (error) {
    return { status: "uncertain", error: errorMessage(error) };
  }
}

async function processQueueItem(item: QueueClaim): Promise<ManualFollowupResult> {
  const phone = normalizedPhone(item.phoneNumber);
  const profileResult = await db()
    .from("whatsapp_followup_profiles")
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();
  if (profileResult.error) {
    throw new Error(
      "whatsapp_followup_profile_load_failed:" + (profileResult.error.code ?? "unknown"),
    );
  }

  const profile = profileResult.data ? mapProfile(profileResult.data) : await ensureProfile(phone);
  if (!profile.followupsEnabled) {
    await db()
      .from("whatsapp_proactive_queue")
      .update({
        status: "skipped",
        last_error: "followups_disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return {
      status: "skipped",
      message: null,
      deliveryMode: null,
      reason: "followups_disabled",
    };
  }

  const facts = await activeFacts(phone);
  if (facts.length === 0) {
    await db()
      .from("whatsapp_followup_profiles")
      .update({ memory_count: 0, updated_at: new Date().toISOString() })
      .eq("phone_number", phone);
    await db()
      .from("whatsapp_proactive_queue")
      .update({
        status: "skipped",
        last_error: "no_active_memory",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return {
      status: "skipped",
      message: null,
      deliveryMode: null,
      reason: "no_active_memory",
    };
  }

  const recent = await db()
    .from("whatsapp_proactive_queue")
    .select("message_text")
    .eq("phone_number", phone)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(MAX_RECENT_MESSAGES);
  if (recent.error) {
    throw new Error("whatsapp_followup_recent_failed:" + (recent.error.code ?? "unknown"));
  }

  let message: string;
  try {
    message = await generateProactiveMessage(
      facts,
      recentMessageText(recent.data ?? []),
      item.source,
      item.slotNo,
    );
  } catch (error) {
    console.error("[whatsapp-followup] generation failed " + errorMessage(error));
    message = fallbackMessage(facts, item.source, item.slotNo);
  }

  const mode = withinCustomerServiceWindow(profile.lastInboundAt) ? "text" : "template";
  if (mode === "template" && !process.env.WHATSAPP_PROACTIVE_TEMPLATE_NAME?.trim()) {
    await db()
      .from("whatsapp_proactive_queue")
      .update({
        status: "skipped",
        message_text: message,
        delivery_mode: mode,
        last_error: "approved_template_not_configured",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return {
      status: "skipped",
      message,
      deliveryMode: mode,
      reason: "approved_template_not_configured",
    };
  }

  const delivery = await graphSend(phone, message, mode);
  const now = new Date().toISOString();
  const queueStatus =
    delivery.status === "sent" ? "sent" : delivery.status === "uncertain" ? "uncertain" : "failed";
  const update = await db()
    .from("whatsapp_proactive_queue")
    .update({
      status: queueStatus,
      message_text: message,
      delivery_mode: mode,
      last_error: delivery.error,
      sent_at: delivery.status === "sent" ? now : null,
      updated_at: now,
    })
    .eq("id", item.id);
  if (update.error) {
    throw new Error("whatsapp_followup_result_save_failed:" + (update.error.code ?? "unknown"));
  }

  if (delivery.status === "sent") {
    try {
      await syncWhatsAppProactiveHistory(item.id);
    } catch (error) {
      // O envio já foi aceito pela Meta. Não reenvie por falha de persistência:
      // a próxima entrada do usuário fará a reconciliação antes do chat.
      console.error("[whatsapp-followup] history sync failed " + errorMessage(error));
    }

    const profileUpdate = await db()
      .from("whatsapp_followup_profiles")
      .update({ last_proactive_at: now, updated_at: now })
      .eq("phone_number", phone);
    if (profileUpdate.error) {
      console.error(
        "[whatsapp-followup] profile timestamp failed " + (profileUpdate.error.code ?? "unknown"),
      );
    }
  }

  return {
    status: delivery.status,
    message,
    deliveryMode: mode,
    reason: delivery.error,
  };
}

export async function processDueWhatsAppFollowups(limit = 10) {
  if (!hasDurableStore()) {
    return { claimed: 0, sent: 0, skipped: 0, failed: 0, uncertain: 0 };
  }
  const claimed = await db().rpc("claim_due_whatsapp_proactive", {
    p_limit: Math.max(1, Math.min(50, Math.trunc(limit))),
  });
  if (claimed.error) {
    throw new Error("whatsapp_followup_claim_failed:" + (claimed.error.code ?? "unknown"));
  }

  const rows: QueueClaim[] = (claimed.data ?? []).map((row: any) => ({
    id: String(row.id),
    phoneNumber: String(row.phone_number),
    localDate: String(row.local_date),
    slotNo: row.slot_no === null || row.slot_no === undefined ? null : Number(row.slot_no),
    source: row.source === "manual" ? "manual" : "scheduled",
    scheduledFor: String(row.scheduled_for),
    attempts: Number(row.attempts ?? 0),
  }));
  const summary = { claimed: rows.length, sent: 0, skipped: 0, failed: 0, uncertain: 0 };

  for (const item of rows) {
    try {
      const result = await processQueueItem(item);
      summary[result.status] += 1;
    } catch (error) {
      summary.failed += 1;
      await db()
        .from("whatsapp_proactive_queue")
        .update({
          status: item.attempts >= 3 ? "dead" : "failed",
          last_error: errorMessage(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }
  return summary;
}

export async function runWhatsAppFollowupMaintenance() {
  if (process.env.WHATSAPP_PROACTIVE_ENABLED?.trim().toLowerCase() !== "true") {
    return { enabled: false };
  }
  const memory = await processPendingWhatsAppMemories(16);
  const seeded = await seedDailyWhatsAppFollowups();
  const proactive = await processDueWhatsAppFollowups(12);
  return { enabled: true, memory, seeded, proactive };
}

export async function forceWhatsAppFollowup(phoneValue: string): Promise<ManualFollowupResult> {
  if (!hasDurableStore()) {
    return {
      status: "failed",
      message: null,
      deliveryMode: null,
      reason: "durable_store_not_configured",
    };
  }
  const phone = normalizedPhone(phoneValue);
  const profile = await ensureProfile(phone);
  if (!profile.followupsEnabled) {
    return {
      status: "skipped",
      message: null,
      deliveryMode: null,
      reason: "followups_disabled",
    };
  }

  const now = new Date();
  const inserted = await db()
    .from("whatsapp_proactive_queue")
    .insert({
      phone_number: phone,
      local_date: localDateForTimeZone(now, profile.timeZone),
      slot_no: null,
      source: "manual",
      scheduled_for: now.toISOString(),
      status: "processing",
      attempts: 1,
      claimed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("id,phone_number,local_date,slot_no,source,scheduled_for,attempts")
    .single();
  if (inserted.error) {
    throw new Error("whatsapp_manual_followup_create_failed:" + (inserted.error.code ?? "unknown"));
  }

  return processQueueItem({
    id: String(inserted.data.id),
    phoneNumber: String(inserted.data.phone_number),
    localDate: String(inserted.data.local_date),
    slotNo: null,
    source: "manual",
    scheduledFor: String(inserted.data.scheduled_for),
    attempts: Number(inserted.data.attempts ?? 1),
  });
}

export async function setWhatsAppFollowupsEnabled(
  phoneValue: string,
  enabled: boolean,
): Promise<WhatsAppFollowupProfile> {
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
    profile: profile.data ? mapProfile(profile.data) : null,
    facts: (facts.data ?? []).map(mapFact),
    queue: (queue.data ?? []).map(mapQueue),
  };
}
