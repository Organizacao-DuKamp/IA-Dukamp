import type { HerdSourceTurn } from "./recover.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HerdBook, HerdEntry } from "./book.ts";

export interface SavedHerdBook {
  version: number;
  data: HerdBook;
}
export interface HerdStore {
  animalHistory?: (
    phone: string,
    code: string,
    throughDay: string,
  ) => Promise<Array<{ day: string; entry: HerdEntry }>>;
  sources?: (phone: string, day: string) => Promise<HerdSourceTurn[]>;
  load(phone: string, day: string): Promise<SavedHerdBook | null>;
  receipt(phone: string, messageId: string): Promise<string | null>;
  commit(input: {
    phone: string;
    day: string;
    version: number;
    messageId: string;
    book: HerdBook;
    reply: string;
    sourceText: string;
  }): Promise<"committed" | "conflict" | string>;
}
async function db() {
  const { supabaseAdmin } = await import("../../integrations/supabase/client.server.ts");
  return supabaseAdmin as unknown as SupabaseClient;
}
export const durableHerdStore: HerdStore = {
  async animalHistory(phone, code, throughDay) {
    const { data, error } = await (
      await db()
    )
      .from("whatsapp_herd_books")
      .select("record_date,data")
      .eq("phone_number", phone)
      .lte("record_date", throughDay)
      .contains("data", { entries: [{ code }] })
      .order("record_date", { ascending: false })
      .limit(1000);
    if (error) throw new Error("herd_animal_history_unavailable");
    return (data ?? []).flatMap((row) =>
      (row.data.entries as HerdEntry[])
        .filter((e) => e.code === code)
        .map((entry) => ({ day: String(row.record_date), entry })),
    );
  },
  async sources(phone, day) {
    const start = new Date(`${day}T00:00:00-03:00`),
      end = new Date(start.getTime() + 86400000);
    const rows: HerdSourceTurn[] = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await (
        await db()
      )
        .from("ai_chat_turns")
        .select("id,user_text")
        .eq("phone_number", phone)
        .eq("channel", "whatsapp")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw new Error("herd_history_unavailable");
      rows.push(...(data ?? []));
      if ((data ?? []).length < 500) return rows;
    }
    throw new Error("herd_history_limit");
  },
  async load(phone, day) {
    const { data, error } = await (await db())
      .from("whatsapp_herd_books")
      .select("version,data")
      .eq("phone_number", phone)
      .eq("record_date", day)
      .maybeSingle();
    if (error) throw new Error("herd_store_unavailable");
    if (data && (data.data?.schema !== 1 || !Array.isArray(data.data?.entries)))
      throw new Error("herd_store_invalid");
    return data as SavedHerdBook | null;
  },
  async receipt(phone, messageId) {
    const { data, error } = await (await db())
      .from("whatsapp_herd_events")
      .select("reply")
      .eq("phone_number", phone)
      .eq("message_id", messageId)
      .maybeSingle();
    if (error) throw new Error("herd_receipt_unavailable");
    return data?.reply ?? null;
  },
  async commit(input) {
    const { data, error } = await (
      await db()
    ).rpc("commit_whatsapp_herd_turn", {
      p_phone: input.phone,
      p_day: input.day,
      p_version: input.version,
      p_message_id: input.messageId,
      p_book: input.book,
      p_reply: input.reply,
      p_source_text: input.sourceText,
    });
    if (error) throw new Error("herd_commit_failed");
    if (typeof data !== "string") throw new Error("herd_commit_unconfirmed");
    return data;
  },
};
