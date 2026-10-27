import { guardianDb, guardianStore } from "./store.server.ts";
import { reportEvent } from "./reports.ts";
import { deliverGuardianMessage, type DeliveryMessage, type DeliveryResult } from "./delivery.ts";
import { officialWeatherEvents } from "./weather.ts";
import type { FarmBook } from "./schema.ts";

export interface EventClaim {
  id: string;
  lock_token: string;
}
export interface EventStore {
  claim(limit: number): Promise<EventClaim[]>;
  begin(claim: EventClaim): Promise<DeliveryMessage | null>;
  finish(claim: EventClaim, result: DeliveryResult): Promise<boolean>;
}
export const eventStore: EventStore = {
  async claim(limit) {
    const { data, error } = await (
      await guardianDb()
    ).rpc("guardian_claim_events", { p_limit: limit });
    if (error) throw new Error("guardian_claim_failed");
    return data ?? [];
  },
  async begin(c) {
    const { data, error } = await (
      await guardianDb()
    ).rpc("guardian_begin_delivery", { p_id: c.id, p_lock: c.lock_token });
    if (error) throw new Error("guardian_authorization_failed");
    return data;
  },
  async finish(c, r) {
    const { data, error } = await (
      await guardianDb()
    ).rpc("guardian_finish_delivery", {
      p_id: c.id,
      p_lock: c.lock_token,
      p_status: r.status,
      p_provider_id: r.providerId ?? null,
      p_error: r.error ?? null,
    });
    if (error) throw new Error("guardian_receipt_save_failed");
    return data === true;
  },
};
export async function processGuardianEvents(
  deps: {
    store?: EventStore;
    send?: (m: DeliveryMessage) => Promise<DeliveryResult>;
    limit?: number;
  } = {},
) {
  const store = deps.store ?? eventStore;
  const summary = {
    claimed: 0,
    sent: 0,
    cancelled: 0,
    retry: 0,
    failed: 0,
    uncertain: 0,
    persistenceErrors: 0,
  };
  const claims = await store.claim(Math.max(1, Math.min(10, deps.limit ?? 5)));
  summary.claimed = claims.length;
  for (const claim of claims) {
    let started = false;
    try {
      const message = await store.begin(claim);
      if (!message) {
        summary.cancelled++;
        continue;
      }
      started = true;
      const result = await (
        deps.send ??
        ((m) =>
          deliverGuardianMessage(m, {
            token: process.env.WHATSAPP_ACCESS_TOKEN,
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
            version: process.env.WHATSAPP_GRAPH_API_VERSION,
            templateName: process.env.WHATSAPP_GUARDIAN_TEMPLATE_NAME,
            templateLanguage: process.env.WHATSAPP_GUARDIAN_TEMPLATE_LANGUAGE,
          }))
      )(message);
      if (!(await store.finish(claim, result))) throw new Error("receipt_not_saved");
      summary[result.status]++;
    } catch {
      // Never call send again after failure to save the provider receipt. A dispatching lease becomes uncertain.
      if (started) summary.uncertain++;
      else summary.failed++;
      summary.persistenceErrors++;
    }
  }
  return summary;
}
export async function seedGuardianWeather() {
  const db = await guardianDb();
  const { data: properties, error } = await db.rpc("guardian_claim_weather", { p_limit: 3 });
  if (error) throw new Error("guardian_weather_claim_failed");
  const summary = { checked: 0, events: 0, failed: 0 };
  for (const property of properties ?? []) {
    summary.checked++;
    try {
      const book = property.book as FarmBook;
      if (!book.city || !book.uf) continue;
      const { fetchWeatherIntelligence } = await import("../chat/weather-intelligence.server.ts");
      const weather = await fetchWeatherIntelligence(
        `${book.city}, ${book.uf}`,
        `Avisos meteorológicos oficiais para hoje e amanhã em ${book.city}, ${book.uf}`,
      );
      const { data: members, error: memberError } = await db
        .from("guardian_members")
        .select("phone_number")
        .eq("property_id", property.id)
        .eq("active", true);
      if (memberError) throw new Error("members_unavailable");
      for (const member of members ?? []) {
        const events = officialWeatherEvents(book, weather, member.phone_number);
        if (!events.length) continue;
        const { error: saveError } = await db.from("guardian_events").upsert(
          events.map((e) => ({
            property_id: property.id,
            recipient: e.recipient,
            type: e.type,
            topic: e.topic,
            dedupe_key: e.key,
            evidence: e.evidence,
            message: e.message,
            priority: e.priority,
            not_before: e.notBefore,
            expires_at: e.expiresAt,
          })),
          { onConflict: "property_id,recipient,dedupe_key", ignoreDuplicates: true },
        );
        if (saveError) throw new Error("weather_event_save_failed");
        summary.events += events.length;
      }
    } catch {
      summary.failed++;
    }
  }
  return summary;
}
export async function runGuardianMaintenance() {
  if (
    process.env.TPEC_GUARDIAN_ENABLED !== "true" ||
    process.env.WHATSAPP_PROACTIVE_ENABLED !== "true" ||
    (process.env.CONTEXT && process.env.CONTEXT !== "production")
  )
    return { enabled: false };
  // Source failures never stop unrelated reminders or results already in the queue.
  const sources = await Promise.allSettled([
    seedGuardianWeather(),
    seedGuardianReports(),
    seedGuardianRules(),
  ]);
  const delivery = await processGuardianEvents();
  return {
    enabled: true,
    weather: sources[0].status === "fulfilled" ? sources[0].value : { failed: true },
    reports: sources[1].status === "fulfilled" ? sources[1].value : { failed: true },
    rules: sources[2].status === "fulfilled" ? sources[2].value : { failed: true },
    delivery,
  };
}
export async function seedGuardianReports() {
  const db = await guardianDb();
  const { data, error } = await db.rpc("guardian_claim_reports", { p_limit: 3 });
  if (error) throw new Error("report_claim_failed");
  const summary = { checked: 0, queued: 0, failed: 0 };
  for (const account of data ?? []) {
    summary.checked++;
    try {
      const snapshot = await guardianStore.load(account.phone_number);
      if (!snapshot.active) continue;
      const event = reportEvent(snapshot.active.book, snapshot.preferences, account.phone_number);
      if (!event) continue;
      const { error: saveError } = await db.from("guardian_events").upsert(
        {
          property_id: snapshot.active.id,
          recipient: event.recipient,
          type: event.type,
          topic: event.topic,
          dedupe_key: event.key,
          evidence: event.evidence,
          message: event.message,
          priority: event.priority,
          not_before: event.notBefore,
          expires_at: event.expiresAt,
        },
        { onConflict: "property_id,recipient,dedupe_key", ignoreDuplicates: true },
      );
      if (saveError) throw new Error("report_save_failed");
      summary.queued++;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}

export async function seedGuardianRules() {
  const db = await guardianDb();
  const { data, error } = await db.rpc("guardian_claim_rules", { p_limit: 5 });
  if (error) throw new Error("guardian_rules_claim_failed");
  const { farmRuleEvents } = await import("./rules.ts");
  const { FarmBookSchema } = await import("./schema.ts");
  const summary = { checked: 0, queued: 0, failed: 0 };
  for (const row of data ?? []) {
    summary.checked++;
    try {
      const events = farmRuleEvents(FarmBookSchema.parse(row.book), row.version, row.phone);
      if (!events.length) continue;
      const saved = await db.rpc("guardian_queue_rule_events", {
        p_property: row.propertyId,
        p_phone: row.phone,
        p_version: row.version,
        p_events: events,
      });
      if (saved.error) throw new Error("guardian_rule_save_failed");
      summary.queued += saved.data ?? 0;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}
