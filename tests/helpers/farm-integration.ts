import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  mapSnapshot,
  guardianRpcArgs,
  type GuardianStore,
} from "../../src/lib/guardian/store.server.ts";
import { extractPropertyObservation } from "../../src/lib/guardian/observed-property.ts";
import type { FarmTransferStore } from "../../src/lib/guardian/transfer.server.ts";
import type { PanelStore, PanelIdentity } from "../../src/lib/guardian/panel.server.ts";

export async function farmIntegration(
  path?: string,
  existing = false,
  beforeEvolution?: (db: PGlite) => Promise<void>,
) {
  const db = new PGlite(path);
  const rpc = async <T = unknown>(sql: string, args: unknown[] = []) =>
    (await db.query<{ data: T }>(sql, args)).rows[0]?.data;
  if (!existing) {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='00000000-0000-4000-8000-000000000001'::uuid AND $2='admin' $$;
      CREATE TABLE public.whatsapp_followup_profiles(phone_number text PRIMARY KEY, followups_enabled boolean DEFAULT false, context_reset_at timestamptz,last_inbound_at timestamptz);
      CREATE TABLE public.whatsapp_proactive_queue(status text,last_error text,updated_at timestamptz);
      CREATE FUNCTION public.whatsapp_context_boundary(text) RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT greatest('2026-10-14T00:00:00Z'::timestamptz,(SELECT context_reset_at FROM public.whatsapp_followup_profiles WHERE phone_number=$1)) $$;
      CREATE TABLE public.whatsapp_user_memory_facts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),phone_number text,source_message_id text,value_text text,last_seen_at timestamptz,first_seen_at timestamptz DEFAULT now(),status text DEFAULT 'active',metadata jsonb DEFAULT '{}');
      GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
      GRANT SELECT ON public.whatsapp_followup_profiles TO service_role;
      GRANT SELECT,UPDATE ON public.whatsapp_user_memory_facts TO service_role;`);
    for (const name of [
      "20261024230929_guardian_farm_foundation.sql",
      "20261024231010_guardian_durable_events.sql",
      "20261024231016_guardian_optional_reports.sql",
      "20261024231051_guardian_event_history_access.sql",
      "20261026121503_guardian_observed_property_profiles.sql",
      "20261026210000_guardian_farm_panel.sql",
      "20261026213000_guardian_reviews_rules.sql",
      "20261026220000_guardian_property_transfers.sql",
    ]) {
      if (name.endsWith("_guardian_farm_panel.sql") && beforeEvolution) await beforeEvolution(db);
      await db.exec(
        await readFile(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8"),
      );
    }
  }
  const guardian: GuardianStore = {
    load: async (phone) => mapSnapshot(await rpc("select guardian_snapshot($1) data", [phone])),
    receipt: async (phone, id) =>
      (
        await db.query<{ reply: string }>(
          "select reply from guardian_turn_receipts where phone_number=$1 and message_id=$2",
          [phone, id],
        )
      ).rows[0]?.reply ?? null,
    commit: async (turn) =>
      rpc<string>(
        "select guardian_commit_turn($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) data",
        Object.values(guardianRpcArgs(turn)),
      ),
  };
  const store: PanelStore = {
    attempt: (key) => rpc<boolean>("select guardian_panel_attempt($1) data", [key]),
    exchange: (code, session) =>
      rpc<boolean>("select guardian_panel_exchange($1,$2) data", [code, session]),
    authorize: (hash) =>
      rpc<PanelIdentity | null>("select guardian_panel_authorize($1) data", [hash]),
    replay: (hash, id, digest) =>
      rpc<string | null>("select guardian_panel_replay($1,$2,$3) data", [hash, id, digest]),
    revoke: async (hash) => {
      await db.query("update guardian_panel_sessions set revoked_at=now() where token_hash=$1", [
        hash,
      ]);
    },
    commit: (hash, version, id, digest, action, book, events) =>
      rpc<string>("select guardian_panel_commit($1,$2,$3,$4,$5,$6,$7) data", [
        hash,
        version,
        id,
        digest,
        action.kind,
        book,
        events,
      ]),
  };
  const observe = async (
    phone: string,
    messageId: string,
    text: string,
    at = "2026-10-25T15:00:00Z",
  ) => {
    const observation = extractPropertyObservation({ text, at: new Date(at) });
    if (!observation.facts.length) return null;
    return rpc<{ propertyId: string; status: string; added: number }>(
      "select guardian_observe_property($1,$2,$3,$4,$5,$6,$7) data",
      [phone, messageId, at, text, observation.name, observation.another, observation.facts],
    );
  };
  const issue = (phone: string, property: string, message: string, hash: string) =>
    rpc<boolean>("select guardian_panel_issue($1,$2,$3,$4) data", [phone, property, message, hash]);
  const transfer: FarmTransferStore = {
    target: (phone, id) => rpc("select guardian_transfer_target($1,$2) data", [phone, id]),
    commit: (i) =>
      rpc<string>("select guardian_transfer_commit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) data", [
        i.phone,
        i.messageId,
        i.proposalId,
        i.accountVersion,
        i.from.id,
        i.to.id,
        i.from.version,
        i.to.version,
        i.from.book,
        i.to.book,
        i.action,
        i.reply,
      ]),
  };
  return { db, rpc, guardian, store, observe, issue, transfer };
}
