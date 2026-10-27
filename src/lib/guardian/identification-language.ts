import { cardinal, foldHerd } from "./herd-language.ts";

export function explicitRegistryLookup(text: string) {
  return /\b(?:consulte|consultar|pesquise|pesquisar|busque|buscar|verifique|verificar|confira|conferir|descubra|descobrir)\b[\s\S]*\b(?:abcz|registro|rgn|rgd|genealogia|pedigree|ra[cç]a)\b|\bqual (?:[eé] )?(?:a )?(?:ra[cç]a|genealogia|filia[cç][aã]o)\b/i.test(
    text,
  );
}
export function bareAnimalCode(text: string): string | null {
  const code = text
    .trim()
    .replace(/[.!]+$/, "")
    .trim();
  return /^(?:[\p{L}]{1,12}[ _-]*)?\d{1,12}(?:[\p{L}]{1,3})?$/u.test(code) ? code : null;
}
export type IdentityEnvelope = {
  body: string;
  count?: number;
  only: boolean;
  noneOthers: boolean;
};
/** The count in "only one has it" describes availability, never a registry series. */
export function identityEnvelope(text: string): IdentityEnvelope {
  let body = text.trim();
  const noneOthers =
    /\b(?:os|as) (?:outros|outras|demais|restantes) n[aã]o (?:t[eê]m|possuem|tem)\b/i.test(body);
  body = body
    .replace(
      /[,;.\s]*(?:os|as) (?:outros|outras|demais|restantes) n[aã]o (?:t[eê]m|possuem|tem)(?: identifica[cç][aã]o| c[oó]digos?| rgn)?[.!\s]*$/i,
      "",
    )
    .trim();
  const header = body.match(
    /^(?:(apenas|s[oó]|somente)\s+)?(\d{1,5}|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s*(?:(?:gados?|animais|animal|bezerros?|bezerras?|deles|delas|desses|destes|desses animais|dos \d+|das \d+)\s*)?(?:tem|t[eê]m|possui|possuem)(?:\s+(?:c[oó]digos?(?: e rgn)?|brincos?|identifica[cç][aã]o|registro))?\s*:?\s*([\s\S]*)$/iu,
  );
  const short = body.match(
    /^(apenas|s[oó]|somente)\s+(\d{1,5}|um|uma|dois|duas|tr[eê]s|quatro|cinco)\s*:\s*([\s\S]*)$/iu,
  );
  const match = header ?? short;
  if (match)
    return {
      body: match[3].trim(),
      count: cardinal(match[2]) ?? undefined,
      only: !!match[1],
      noneOthers,
    };
  return { body, only: false, noneOthers };
}
export function identityLines(body: string) {
  const rows = body
    .replace(/^sim[, ]+/i, "")
    .split(/[;\n]+/)
    .map((line) => line.replace(/^(?:[-•]\s*|\d+[.)]\s+)/u, "").trim())
    .filter(Boolean);
  return rows.flatMap((row) =>
    /\b(?:c[oó]digo|brinco|rgn)\b/i.test(row) ? [row] : row.split(/,\s*|\s+e\s+/i),
  );
}
export function isIdentityHelp(text: string) {
  return /^(?:o que [eé]|o que significa|qual [eé] a diferen[cç]a|precisa|[eé] obrigat[oó]rio)[\s\S]*\b(?:rgn|c[oó]digo|brinco)\b/i.test(
    text.trim(),
  );
}
export const normalizedRegistry = (value: string) => foldHerd(value).replace(/\s/g, "");
