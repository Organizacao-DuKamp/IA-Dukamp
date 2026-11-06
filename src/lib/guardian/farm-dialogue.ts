import { fold } from "./book.ts";
export const naturalConfirmation = (text: string) =>
  /^(?:sim|isso(?: mesmo)?|certo|ok|salvar|salva|confirmar|confirmo|confirma(?: ai)?|pode (?:salvar|criar|cadastrar|confirmar)|pode sim|ta certo)[.!\s]*$/.test(
    fold(text),
  );
export function creatingFarm(text: string) {
  return /\b(?:cadastr\w*|cri[ae]r?|abr[iae]\w*|coloc\w*)\s+(?:(?:um|uma|minha|meu|a|o|cadastro|de|pra|para)\s+){0,4}(?:fazenda|propriedade)\b|\b(?:minha (?:fazenda|propriedade) (?:chama|se chama))\b/.test(
    fold(text),
  );
}
export const cleanFarmName = (s: string) =>
  s
    .replace(/["“”'‘’]/g, "")
    .replace(/^fazenda\s+(?=(?:fazenda|estância|estancia|sítio|sitio)\b)/i, "")
    .trim()
    .replace(/[.!]+$/, "");
const key = (s: string) => fold(cleanFarmName(s)).replace(/^(?:fazenda|estancia|sitio)\s+/, "");
export interface FarmSlots {
  name?: string;
  city?: string;
  uf?: string;
  owner?: string;
  distinct?: boolean;
}
export function farmSlots(text: string, prior: FarmSlots = {}): FarmSlots {
  const s = { ...prior };
  if (/outra fazenda|outra propriedade|(?:sao|é|e) (?:uma )?diferente/.test(fold(text)))
    s.distinct = true;
  const raw = text.replace(/\*+/g, "").replace(/[“”]/g, '"').trim();
  const owner = raw.match(/(?:propriet[aá]rio\s*:?|propriedade de)\s*(.+?)(?:\n|$)/i);
  if (owner) s.owner = cleanFarmName(owner[1]);
  const location = raw.match(
    /(?:\bem\s+|\bfica\s+(?:em\s+)?|\blocaliza[çc][aã]o:\s*)([\p{L} .'-]+?)(?:\s*[/,-]\s*|\s+)(SP|MG|MS|MT|GO|PR|SC|RS|RJ|ES|BA|AC|AL|AM|AP|CE|DF|MA|PA|PB|PE|PI|RN|RO|RR|SE|TO|S[aã]o Paulo)\b/iu,
  );
  if (location) {
    s.city = location[1].trim();
    s.uf = /s[aã]o paulo/i.test(location[2]) ? "SP" : location[2].toUpperCase();
  } else if (/^(?:[ée] )?(?:no estado de )?(?:s[aã]o paulo|sp)[.! ]*$/i.test(raw)) s.uf = "SP";
  else if (/^[A-Z]{2}[.! ]*$/i.test(raw)) s.uf = raw.slice(0, 2).toUpperCase();
  const name = raw.match(
    /(?:\b(?:fazenda|propriedade)(?:\s+se)?\s+(?:chama(?:da)?\s+)?|\bnome(?:\s+(?:correto|certo))?\s*(?:[ée]|:)\s*)(.+?)(?=\s+(?:e fica|fica|em|propriedade de)\b|\n|$)/iu,
  );
  if (name && !/^(?:pra mim|para mim|no sistema|aqui|chama|se chama|fica)[.! ]*$/i.test(name[1]))
    s.name = cleanFarmName(name[1]);
  if (!s.name && prior && !creatingFarm(text) && !naturalConfirmation(text) && !location)
    s.name = cleanFarmName(raw);
  else if (
    s.name &&
    !s.city &&
    !creatingFarm(text) &&
    !naturalConfirmation(text) &&
    !location &&
    !name &&
    !/^(?:s[aã]o paulo|sp)$/i.test(raw)
  )
    s.city = raw.replace(/^[ée] (?:em )?/i, "").trim();
  if (!s.city) {
    const city = raw.match(/\b(?:fica|[ée]) em\s+(.+?)(?:[.!]|$)/i);
    if (city) s.city = city[1].trim();
  }
  return s;
}
