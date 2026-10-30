import { foldHerd } from "./herd-language.ts";

/** Parse access intent separately from the farm name. Farm resolution still runs
 * against the sender's current memberships; text can never grant access. */
export function panelAccessRequest(raw: string, choosing = false) {
  const text = foldHerd(raw)
    .replace(/^(?:oi[,! ]+)?(?:tpec(?:[ -]?ia)?|tepec)[,:! ]+/u, "")
    .replace(/(?:[, ]+(?:por favor|pra mim|para mim|obrigad[oa]))+[.!? ]*$/u, "")
    .replace(/[.!?]+$/u, "")
    .trim();
  const clean = (value: string) => value.replace(/^(?:(?:a|minha|nossa)\s+)+/u, "").trim();
  if (choosing) {
    const numbered = text.match(/^(\d+)(?:[.)]\s*(.+))?$/u);
    if (numbered)
      return { reference: numbered[1], expectedName: numbered[2] ? clean(numbered[2]) : null };
    // A standalone farm name answers only the immediately preceding choice.
    if (!/\b(?:codigo|painel)\b/u.test(text))
      return {
        reference: clean(text.replace(/^(?:pode ser|quero|prefiro|a da)\s+/u, "")),
        expectedName: null,
        choiceOnly: true,
      };
  }
  const request = text.match(
    /^(?:(?:eu\s+)?(?:quero|preciso(?: de)?|gostaria(?: de)?|pode(?: me)?|poderia(?: me)?|voce pode(?: me)?|me|por favor)\s+)*(?:(?:gerar|gere|criar|crie|obter|abrir|abra|acessar|acesso|ver|entrar|mandar|mande|manda|enviar|envie|envia|passar|passe)(?:\s+(?:um|o|meu|no|ao))?\s+)?(?:codigo(?:\s+de acesso)?\s+(?:do|pro|para o|de acesso ao|para acessar o|pra acessar o)\s+)?painel(?:\s+(?:da|de)\s+fazenda)?(?:\s+(?:para|pra|da|de|do)\s+(.+))?$/u,
  );
  if (request) return { reference: request[1] ? clean(request[1]) : null, expectedName: null };
  const alias = text.match(
    /^(?:(?:quero|preciso|pode|me)\s+)*(?:(?:gerar|gere|criar|crie|manda|mande|envie)\s+)?(?:um|o)?\s*codigo(?:\s+de acesso)?\s+(?:para|pra|da)\s+(?:(?:a|minha|nossa)\s+)?fazenda(?:\s+(.+))?$/u,
  );
  return alias ? { reference: alias[1]?.trim() ?? null, expectedName: null } : null;
}

export function panelFarmKey(raw: string) {
  return foldHerd(raw)
    .replace(/^(?:(?:a|minha|nossa)\s+)+/u, "")
    .replace(/^(?:fazenda|propriedade|estancia|sitio|chacara)\s+/u, "")
    .trim();
}
