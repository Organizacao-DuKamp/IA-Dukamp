const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60_000;

export type FollowupPreference = "enable" | "disable" | null;

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function localParts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDateTimeToUtc(localDate: string, minutes: number, timeZone: string): Date {
  const match = localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("invalid_local_date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const desiredUtcShape = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = desiredUtcShape;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localParts(new Date(candidate), timeZone);
    const representedUtcShape = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const delta = desiredUtcShape - representedUtcShape;
    candidate += delta;
    if (delta === 0) break;
  }

  return new Date(candidate);
}

function seededMinute(seed: string, startMinute: number, endMinute: number): number {
  const width = Math.max(1, endMinute - startMinute + 1);
  return startMinute + (hash32(seed) % width);
}

export function localDateForTimeZone(
  date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const parts = localParts(date, timeZone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export interface DailyFollowupSlot {
  slot: 1 | 2;
  scheduledFor: string;
}

export function buildDailyFollowupSchedule(
  phone: string,
  localDate: string,
  timeZone = DEFAULT_TIME_ZONE,
): DailyFollowupSlot[] {
  const normalizedPhone = phone.replace(/\D/g, "");
  const morning = seededMinute(
    normalizedPhone + ":" + localDate + ":morning",
    8 * 60 + 15,
    12 * 60 + 15,
  );
  const evening = seededMinute(
    normalizedPhone + ":" + localDate + ":evening",
    15 * 60,
    20 * 60 + 15,
  );

  return [
    { slot: 1, scheduledFor: localDateTimeToUtc(localDate, morning, timeZone).toISOString() },
    { slot: 2, scheduledFor: localDateTimeToUtc(localDate, evening, timeZone).toISOString() },
  ];
}

export function parseFollowupPreference(text: string): FollowupPreference {
  const normalized = text
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");

  const disable =
    /\b(parar|pare|pausar|pause|desativar|desative|cancelar|cancele)\b.{0,55}\b(acompanhamento|mensagens?|lembretes?|avisos?)\b/i.test(
      normalized,
    ) ||
    /\b(n[aã]o|nao)\s+(?:quero\s+mais|me\s+mande|me\s+envie|mande|envie)\b.{0,45}\b(mensagens?|lembretes?|avisos?|acompanhamento)\b/i.test(
      normalized,
    );

  if (disable) return "disable";

  const enable =
    /\b(ativar|ative|reativar|reative|retomar|retome|voltar|volte)\b.{0,55}\b(acompanhamento|mensagens?|lembretes?|avisos?)\b/i.test(
      normalized,
    ) ||
    /\bpode\s+(?:voltar\s+a\s+)?(?:me\s+)?(?:mandar|enviar)\b.{0,35}\b(mensagens?|lembretes?|avisos?)\b/i.test(
      normalized,
    );

  return enable ? "enable" : null;
}

export function withinCustomerServiceWindow(
  lastInboundAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  const inbound = Date.parse(lastInboundAt);
  if (!Number.isFinite(inbound)) return false;
  const delta = now.getTime() - inbound;
  return delta >= 0 && delta <= CUSTOMER_SERVICE_WINDOW_MS;
}

export function sanitizeMemoryFactKey(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || "fact";
}
