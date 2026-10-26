import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { guardianDb, guardianStore } from "./store.server.ts";
import {
  ActionSchema,
  FarmBookSchema,
  canEdit,
  farmName,
  type FarmBook,
  type GuardianRole,
} from "./schema.ts";
import { applyFarmAction, fold } from "./book.ts";
import { farmIndicators } from "./operations.ts";

export const PANEL_COOKIE = "tpec_farm_session";
export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizeCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makePanelCode() {
  const bytes = randomBytes(16);
  return Array.from(bytes, (n) => codeAlphabet[n % codeAlphabet.length]).join("");
}
import type { GuardianDetail } from "../guardian.functions.ts";

export interface PanelIdentity {
  events?: GuardianDetail["events"];
  audit?: GuardianDetail["audit"];
  phone: string;
  propertyId: string;
  version: number;
  role: GuardianRole;
  book: FarmBook;
  expiresAt: string;
}
export interface PanelStore {
  attempt(key: string): Promise<boolean>;
  exchange(codeHash: string, sessionHash: string): Promise<boolean>;
  authorize(hash: string): Promise<PanelIdentity | null>;
  revoke(hash: string): Promise<void>;
  replay(hash: string, requestId: string, digest: string): Promise<string | null>;
  commit(
    hash: string,
    version: number,
    requestId: string,
    digest: string,
    action: z.infer<typeof ActionSchema>,
    book: FarmBook,
    events: unknown[],
  ): Promise<string>;
}
export const panelStore: PanelStore = {
  async attempt(key) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_panel_attempt", { p_key: key })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("panel_unavailable");
    return data === true;
  },
  async exchange(codeHash, sessionHash) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_panel_exchange", { p_code_hash: codeHash, p_session_hash: sessionHash })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("panel_unavailable");
    return data === true;
  },
  async authorize(hash) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_panel_authorize", { p_hash: hash })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("panel_unavailable");
    if (!data) return null;
    return { ...data, book: FarmBookSchema.parse(data.book) } as PanelIdentity;
  },
  async replay(hash, requestId, digest) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_panel_replay", { p_hash: hash, p_request: requestId, p_digest: digest })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("panel_unavailable");
    return data;
  },
  async revoke(hash) {
    const db = await guardianDb();
    const { error } = await db
      .from("guardian_panel_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hash);
    if (error) throw new Error("panel_unavailable");
  },
  async commit(hash, version, requestId, digest, action, book, events) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_panel_commit", {
        p_hash: hash,
        p_version: version,
        p_request: requestId,
        p_digest: digest,
        p_kind: action.kind,
        p_book: book,
        p_events: events,
      })
      .abortSignal(AbortSignal.timeout(8000));
    if (error) throw new Error("panel_commit_failed");
    return data;
  },
};

/** Called only after the WhatsApp webhook authenticated the sender. */
export async function handlePanelCodeRequest(
  input: { phone: string; messageId: string; text: string; mediaType?: string },
  deps: {
    load?: typeof guardianStore.load;
    issue?: (phone: string, property: string, message: string, hash: string) => Promise<boolean>;
    code?: () => string;
  } = {},
): Promise<string | null> {
  if (input.mediaType && input.mediaType !== "audio") return null;
  const original = fold(input.text);
  const farmAlias = original.match(
    /^(?:(?:quero|preciso|pode)\s+)?(?:(?:gerar|gere|criar|crie)\s+)?(?:um\s+)?codigo(?:\s+de acesso)?\s+(?:para|pra|da)\s+(?:(?:a|minha|nossa)\s+)?fazenda(?:\s+(.+?))?[.! ]*$/,
  );
  const text = farmAlias
    ? "gerar codigo do painel" + (farmAlias[1] ? " para " + farmAlias[1] : "")
    : original;
  const match = text.match(
    /^(?:(?:quero|preciso|pode|me|por favor)\s+)*(?:(?:gerar|gere|criar|crie|obter|abrir|acessar|acesso|ver|entrar)(?:\s+(?:um|o|meu|no|ao))?\s+)?(?:codigo\s+(?:do|para o|de acesso ao|para acessar o)\s+)?painel(?:\s+(?:da|de)\s+fazenda)?(?:\s+(?:para|da|de)\s+(.+?))?[.! ]*$/,
  );
  if (!match) return null;
  if (!/^\d{6,20}$/.test(input.phone) || !input.messageId || input.messageId.length > 128)
    throw new Error("invalid_guardian_sender");
  try {
    const snapshot = await (deps.load ?? guardianStore.load)(input.phone);
    const properties = snapshot.properties;
    if (!properties.length)
      return "Ainda não encontrei uma fazenda sua. Conte o nome, onde ela fica e o rebanho, ou diga “cadastrar fazenda Boa Vista em Tanabi/SP”. Depois, peça “gerar código do painel”.";
    const choice = match[1];
    const candidates = choice
      ? properties.filter(
          (p, i) => p.id === choice || fold(p.name) === choice || String(i + 1) === choice,
        )
      : properties;
    if (candidates.length !== 1)
      return (
        "Escolha a fazenda para abrir no painel:\n" +
        properties.map((p, i) => `${i + 1}. ${p.name}`).join("\n") +
        "\nResponda “gerar código do painel para 1” ou use o nome da fazenda."
      );
    const property = candidates[0];
    const code = normalizeCode((deps.code ?? makePanelCode)());
    const issue =
      deps.issue ??
      (async (phone, propertyId, message, hash) => {
        const db = await guardianDb();
        const { data, error } = await db
          .rpc("guardian_panel_issue", {
            p_phone: phone,
            p_property: propertyId,
            p_message: message,
            p_hash: hash,
          })
          .abortSignal(AbortSignal.timeout(5000));
        if (error)
          throw new Error(
            error.message.includes("guardian_code_rate_limited") ? "rate" : "unavailable",
          );
        return data === true;
      });
    if (!(await issue(input.phone, property.id, input.messageId, hashToken(code))))
      return "Um código já foi enviado para esta solicitação. Use a mensagem anterior ou peça um novo código.";
    return `Seu código para ${property.name}:\n${code.match(/.{4}/g)!.join("-")}\n\nAbra /painelfazenda no site da TPEC-IA e digite o código. Ele vale por 10 minutos e pode ser usado uma única vez. Não compartilhe: ele dá acesso à gestão desta fazenda com suas permissões. Use “sair” no painel ao terminar.`;
  } catch (error) {
    return error instanceof Error && error.message === "rate"
      ? "Você já pediu vários códigos. Aguarde dez minutos antes de solicitar outro."
      : "Não consegui gerar o código agora. Tente novamente em instantes; nenhum acesso foi liberado.";
  }
}

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exchange"), code: z.string().min(1).max(40) }).strict(),
  z
    .object({
      kind: z.literal("action"),
      requestId: z.uuid(),
      version: z.number().int().min(0),
      action: ActionSchema,
    })
    .strict(),
]);
function cookieToken(request: Request): string | null {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(PANEL_COOKIE + "="))
    ?.slice(PANEL_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function response(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, private",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    vary: "Cookie",
  });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
function sessionCookie(request: Request, token: string, age: number) {
  return `${PANEL_COOKIE}=${token}; Path=/api/public/farm-panel; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function publicIdentity(identity: PanelIdentity) {
  // Phone numbers, member lists, and provenance actor IDs never go to this browser.
  const book = JSON.parse(
    JSON.stringify(identity.book, (key, value) =>
      ["actor", "responsiblePhone"].includes(key) ? undefined : value,
    ),
  ) as FarmBook;
  const end = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  return {
    propertyId: identity.propertyId,
    version: identity.version,
    role: identity.role,
    expiresAt: identity.expiresAt,
    name: farmName(identity.book),
    book,
    events: identity.events ?? [],
    audit: identity.audit ?? [],
    indicators: farmIndicators(book, end.slice(0, 7) + "-01", end),
  };
}
export async function handleFarmPanel(
  request: Request,
  deps: { store?: PanelStore; enabled?: boolean } = {},
) {
  if (!(deps.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true"))
    return response({ error: "O painel da fazenda está aguardando ativação." }, 503);
  const store = deps.store ?? panelStore;
  const token = cookieToken(request),
    hash = token ? hashToken(token) : null;
  const method = request.method;
  if (!["GET", "POST", "DELETE"].includes(method))
    return response({ error: "Método não permitido." }, 405);
  // A custom header plus exact Origin blocks cross-site form submissions and CSRF.
  if (
    method !== "GET" &&
    (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("x-tpec-panel") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return response({ error: "Solicitação não autorizada." }, 403);
  try {
    if (method === "DELETE") {
      if (hash) await store.revoke(hash);
      return response({ ok: true }, 200, sessionCookie(request, "", 0));
    }
    if (method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return response({ error: "Envie dados JSON." }, 415);
      if (Number(request.headers.get("content-length")) > 16384)
        return response({ error: "Solicitação muito grande." }, 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 16384)
        return response({ error: "Solicitação muito grande." }, 413);
      let input: z.infer<typeof Body>;
      try {
        input = Body.parse(JSON.parse(raw));
      } catch {
        return response({ error: "Confira o código ou os dados enviados." }, 400);
      }
      if (input.kind === "exchange") {
        // The platform sets this client-IP header; the code remains 80-bit entropy even if absent.
        const client = request.headers.get("x-nf-client-connection-ip") ?? "local-or-unavailable";
        if (!(await store.attempt(hashToken("farm-panel:" + client))))
          return response({ error: "Muitas tentativas. Aguarde um minuto." }, 429);
        const code = normalizeCode(input.code);
        if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code))
          return response(
            { error: "Código inválido, vencido ou já utilizado. Peça outro pelo WhatsApp." },
            401,
          );
        const session = randomBytes(32).toString("hex");
        if (!(await store.exchange(hashToken(code), hashToken(session))))
          return response(
            { error: "Código inválido, vencido ou já utilizado. Peça outro pelo WhatsApp." },
            401,
          );
        return response({ ok: true }, 200, sessionCookie(request, session, 12 * 3600));
      }
      const identity = hash ? await store.authorize(hash) : null;
      if (!identity)
        return response({ error: "Acesso expirado. Peça um novo código pelo WhatsApp." }, 401);
      if (
        ["property_create", "property_delete", "property_transfer", "invite", "revoke"].includes(
          input.action.kind,
        ) ||
        !canEdit(identity.role, input.action)
      )
        return response({ error: "Seu perfil não permite esta alteração." }, 403);
      const digest = hashToken(JSON.stringify(input.action));
      const replay = await store.replay(hash!, input.requestId, digest);
      if (replay === "replay")
        return response({ ok: true, message: "Essa alteração já havia sido salva." });
      if (replay === "mismatch")
        return response({ error: "A solicitação já foi usada para outra alteração." }, 409);
      const source = {
        actor: identity.phone,
        messageId: "panel:" + input.requestId,
        at: new Date().toISOString(),
        confirmed: true as const,
      };
      let applied: ReturnType<typeof applyFarmAction>;
      try {
        applied = applyFarmAction(
          identity.book,
          input.action,
          identity.role,
          source,
          input.requestId,
        );
        FarmBookSchema.parse(applied.book);
      } catch (error) {
        return response(
          {
            error:
              error instanceof z.ZodError
                ? "Confira os dados informados."
                : error instanceof Error
                  ? error.message
                  : "Não foi possível validar a alteração.",
          },
          422,
        );
      }
      const result = await store.commit(
        hash!,
        input.version,
        input.requestId,
        digest,
        input.action,
        applied.book,
        applied.events,
      );
      if (result === "conflict")
        return response(
          {
            error:
              "A fazenda foi atualizada em outra sessão ou no WhatsApp. Atualize os dados e revise a alteração.",
          },
          409,
        );
      if (!["committed", "replay"].includes(result)) throw new Error("panel_commit_failed");
      return response({
        ok: true,
        message: result === "replay" ? "Essa alteração já havia sido salva." : applied.result,
      });
    }
    const identity = hash ? await store.authorize(hash) : null;
    if (!identity)
      return response({ error: "Acesso expirado. Peça um novo código pelo WhatsApp." }, 401);
    return response(publicIdentity(identity));
  } catch {
    return response(
      {
        error:
          "Não foi possível acessar a fazenda agora. Nenhuma nova operação está confirmada. Tente novamente.",
      },
      503,
    );
  }
}
