import { createHash, createHmac } from "node:crypto";
import { guardianDb, guardianStore } from "./store.server.ts";
import { foldHerd } from "./herd-language.ts";
import type { GuardianInput } from "./handler.server.ts";
import { panelFarmKey } from "./panel-access.ts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const ACCESS_ORIGIN = "https://www.tpecia.com.br";
// Retries of the same authenticated WhatsApp message return the same link.
// Tokens are purpose-bound, unguessable and stored only as hashes in the database.
export function accessToken(phone: string, message: string, kind: "login" | "invite") {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error("access_secret_unavailable");
  return createHmac("sha256", secret)
    .update(JSON.stringify(["farm-access:v1", kind, phone, message]))
    .digest("hex");
}
export function accessLink(token: string, kind: "login" | "invite") {
  return `${ACCESS_ORIGIN}/painelfazenda#${kind}=${token}`;
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (await guardianDb())
    .rpc(name, args)
    .abortSignal(AbortSignal.timeout(8000));
  if (error) throw Error("farm_access_unavailable");
  return data as T;
}
export type FarmTeam = {
  members: Array<{ phone: string; role: string; active: boolean; name: string | null }>;
  invitations: Array<{ id: string; expiresAt: string }>;
};
export const accessLinks = {
  issue: (
    phone: string,
    property: string,
    message: string,
    tokenHash: string,
    kind: "login" | "invite",
  ) =>
    rpc<boolean>("guardian_access_issue", {
      p_phone: phone,
      p_property: property,
      p_message: message,
      p_hash: tokenHash,
      p_kind: kind,
    }),
  exchange: (tokenHash: string, sessionHash: string, installed: boolean) =>
    rpc<boolean>("guardian_access_exchange", {
      p_hash: tokenHash,
      p_session: sessionHash,
      p_installed: installed,
    }),
  accept: (tokenHash: string, phone: string, message: string, loginHash: string) =>
    rpc<string | null>("guardian_access_accept", {
      p_hash: tokenHash,
      p_phone: phone,
      p_message: message,
      p_login_hash: loginHash,
    }),
  matches: (linkHash: string, session: string) =>
    rpc<boolean>("guardian_access_matches", { p_link: linkHash, p_session: session }),
  team: (session: string) => rpc<FarmTeam>("guardian_access_team", { p_session: session }),
  revoke: (session: string, phone: string) =>
    rpc<boolean>("guardian_access_revoke", { p_session: session, p_phone: phone }),
  cancel: (session: string, id: string) =>
    rpc<boolean>("guardian_access_cancel", { p_session: session, p_id: id }),
};
/** Invites never trust a phone supplied in a browser: the authenticated Meta sender accepts. */
export async function handleAccessInvite(
  input: GuardianInput,
  deps: {
    links?: typeof accessLinks;
    load?: typeof guardianStore.load;
    token?: typeof accessToken;
  } = {},
): Promise<string | null> {
  if (input.mediaType && input.mediaType !== "audio") return null;
  const text = foldHerd(input.text);
  const accepting = text.match(/^aceitar convite ([a-f0-9]{64})[.!? ]*$/);
  const inviting =
    /^(?:(?:eu )?(?:quero|preciso|pode|poderia|me|voce pode|por favor)\s+)*(?:(?:gerar|gere|criar|crie|enviar|envie|manda|mande)\s+(?:um |o )?(?:link(?: de convite)?|convite)\b.*(?:convite|funcionario|equipe)|(?:convidar|convide)\b.*(?:funcionario|equipe|gerente|\d))/.test(
      text,
    ) && !/\b(?:nao|cancelar|revogar|remover|excluir)\b/.test(text);
  if (!accepting && !inviting) return null;
  if (!/^\d{6,20}$/.test(input.phone) || !input.messageId || input.messageId.length > 128)
    throw Error("invalid_guardian_sender");
  const links = deps.links ?? accessLinks,
    token = deps.token ?? accessToken;
  try {
    if (accepting) {
      const login = token(input.phone, input.messageId, "login");
      const property = await links.accept(
        hash(accepting[1]),
        input.phone,
        input.messageId,
        hash(login),
      );
      return property
        ? `Convite aceito. Seu WhatsApp foi registrado na equipe da fazenda. Abra seu painel:\n${accessLink(login, "login")}\n\nO acesso fica salvo neste dispositivo. O proprietário pode removê-lo a qualquer momento. Não compartilhe seu link pessoal; ele vale por 10 minutos e é de uso único.`
        : "Este convite venceu, foi cancelado ou já foi usado. Peça um novo link ao proprietário.";
    }
    const snapshot = await (deps.load ?? guardianStore.load)(input.phone);
    const reference = text.match(
      /(?:para|pra|da|de|na)\s+(?:a\s+)?fazenda\s+(.+?)(?:[, ]+por favor)?[.!? ]*$/,
    )?.[1];
    const candidates = reference
      ? snapshot.properties.filter((p) => panelFarmKey(p.name) === panelFarmKey(reference))
      : [];
    const property = reference
      ? candidates.length === 1
        ? candidates[0]
        : null
      : (snapshot.properties.find((p) => p.id === snapshot.active?.id) ??
        (snapshot.properties.length === 1 ? snapshot.properties[0] : null));
    if (!property)
      return "Selecione a fazenda com “usar fazenda NOME” e peça “gerar link de convite para funcionário”.";
    if (property.role !== "owner")
      return "Só o proprietário pode gerar links de convite para a equipe.";
    const invitation = token(input.phone, input.messageId, "invite");
    if (!(await links.issue(input.phone, property.id, input.messageId, hash(invitation), "invite")))
      return "Esta solicitação já foi usada. Peça um novo link de convite.";
    return `Convite para ${property.name}:\n${accessLink(invitation, "invite")}\n\nCompartilhe com um funcionário. O link vale por 7 dias e aceita uma pessoa. Ela confirma pelo próprio WhatsApp e recebe acesso à gestão da fazenda. Você pode remover o acesso pelo painel ou pedir “revogar acesso NUMERO”. Nenhuma mensagem foi enviada automaticamente.`;
  } catch {
    return "Não consegui concluir o acesso agora. Tente novamente; nenhuma nova operação está confirmada.";
  }
}
