/** Tokens stay in the fragment, outside HTTP URLs/referrers. Never persist them in localStorage. */
export function readAccessFragment(
  fragment: string,
): { kind: "login" | "invite"; token: string } | null {
  const match = fragment.match(/^#(login|invite)=([a-f0-9]{64})$/);
  return match ? { kind: match[1] as "login" | "invite", token: match[2] } : null;
}
export function invitationWhatsApp(token: string) {
  return "https://wa.me/5516992256069?text=" + encodeURIComponent("aceitar convite " + token);
}
