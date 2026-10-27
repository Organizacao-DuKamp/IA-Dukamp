import { userStatement } from "../whatsapp/learned-notes.ts";

export const foldHerd = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const units: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};
/** Accept a grammatical cardinal, rather than adding arbitrary adjacent number words. */
export function cardinal(text: string): number | null {
  const t = foldHerd(text).replace(/\s+/g, " ");
  if (/^\d{1,6}$/.test(t)) return Number(t);
  if (units[t] !== undefined) return units[t];
  const pieces = t.split(" e ");
  if (pieces.length < 2 || pieces.length > 3 || pieces.some((p) => units[p] === undefined))
    return null;
  const values = pieces.map((p) => units[p]);
  if (pieces[0] === "cem") return null;
  if (
    values.length === 3 &&
    !(values[0] >= 100 && values[1] >= 20 && values[1] <= 90 && values[2] < 10)
  )
    return null;
  if (
    values.length === 2 &&
    !(values[0] >= 100 ? values[1] < 100 : values[0] >= 20 && values[0] <= 90 && values[1] < 10)
  )
    return null;
  return values.reduce((n, v) => n + v, 0);
}

/** Only remove conversational wrappers around an asserted past event.
 * Questions ("será que nasceram...?") and third-party/uncertain claims remain intact.
 */
export function herdStatement(text: string, mediaType?: string): string {
  let result = userStatement(text, mediaType)
    .replace(/^(?:tpec(?:[ -]?ia)?|pepec|pepeque)[,!: ]+/i, "")
    .replace(
      /^(?:registre|registra|registrar|anote|anota|anotar)\s*[:,]?\s+(?:a[ií]\s+)?(?:tamb[eé]m\s+)?(?:que\s+)?/i,
      "",
    )
    .replace(
      /(?:[,.!?]\s*)?(?:se voc[eê] puder|voc[eê] pode|pode|por favor[, ]*)\s*(?:registrar|anotar|registre|anote)\s+(?:isso|esse nascimento|essa compra)(?:\s+(?:pra|para) mim)?[.!?…\s]*$/i,
      "",
    )
    .replace(/(?:,\s*)?(?:t[aá]|ok|beleza|viu)[?!.…\s]*$/i, "")
    .replace(/\b(?:acabou|acabaram)\s+de\s+nascer\b/gi, "nasceram")
    .trim();
  result = result.replace(
    /\b(nasceram|nasceu|morreram|morreu|comprei|compramos|vendi|vendemos)\s+(?:mais\s+|outros?\s+|outras?\s+)?([\p{L}\d]+(?:\s+e\s+[\p{L}]+){0,2})(?=\s+(?:bezerros?|bezerras?|vacas?|bois|boi|gados?|bovinos?|animais|animal|novilhas?|cabe[cç]as?)\b)/giu,
    (whole, verb: string, number: string) => {
      const parsed = cardinal(number);
      return parsed === null ? whole : `${verb} ${parsed}`;
    },
  );
  const words = Object.keys(units)
    .sort((a, b) => b.length - a.length)
    .join("|");
  result = result.replace(
    new RegExp(
      `\\b((?:${words})(?:\\s+e\\s+(?:${words})){0,2})(?=\\s+(?:(?:novos?|novas?)\\s+)?(?:bezerros?|bezerras?|vacas?|bois|boi|gados?|bovinos?|animais|animal|novilhas?|novilhos?|touros?|cabe[cç]as?)\\b)`,
      "giu",
    ),
    (whole, value: string) => {
      const parsed = cardinal(value);
      return parsed === null ? whole : String(parsed);
    },
  );
  result = result.replace(
    /\b(\d{1,3}(?:\.\d{3})+)(?=\s+(?:bezerros?|bezerras?|vacas?|bois|boi|gados?|bovinos?|animais|animal|novilhas?|novilhos?|touros?|cabe[cç]as?)\b)/giu,
    (value) => value.replace(/\./g, ""),
  );
  // An initial discourse marker does not change the original event date.
  return result.replace(/^(?:(?:agora|ent[aã]o|aqui)[, ]+)+/i, "");
}

export function herdTopic(text: string): boolean {
  return /\b(?:rebanho|gados?|bovinos?|bezerros?|bezerras?|bois|boi|vacas?|novilhas?|animais|animal|pesagem)\b/.test(
    foldHerd(userStatement(text)),
  );
}
export function herdRegistrationIntent(text: string): boolean {
  const t = foldHerd(userStatement(text));
  return (
    herdTopic(t) &&
    (/\b(?:nasceu|nasceram|acabaram de nascer|acabou de nascer|comprei|compramos|morreu|morreram|vendi|vendemos)\b/.test(
      t,
    ) ||
      /\b(?:registrar|registre|anotar|anote|adicionar|adicione|cadastre|cadastrar)\b/.test(t))
  );
}
export const HERD_IDENTITY_QUESTION =
  "Os animais citados têm código/brinco e RGN para vincular às fichas? Se tiverem, envie o código e o RGN de cada um; se não tiverem, pode informar isso.";
export function withHerdQuestion(reply: string, question?: string): string {
  return question && !reply.includes(question) ? `${reply}\n\n${question}` : reply;
}
