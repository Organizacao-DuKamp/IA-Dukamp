import { normalizeName } from "../products/normalize.ts";

const CROSS_SPECIES_COMPATIBILITY_RE =
  /\b(posso|pode|podem|serve|servem|usar|fornecer|dar)\b.{0,120}\b(suplemento|mineral|ra[cç][aã]o|produto|ureia)\b.{0,120}\b(ovino|ovinos|ovelha|ovelhas|caprino|caprinos|cabra|cabras|equino|equinos|cavalo|cavalos)\b|\b(ovino|ovinos|ovelha|ovelhas|caprino|caprinos|cabra|cabras|equino|equinos|cavalo|cavalos)\b.{0,120}\b(posso|pode|podem|serve|servem|usar|fornecer|dar)\b.{0,120}\b(suplemento|mineral|ra[cç][aã]o|produto|ureia)\b/i;

const REGULATORY_HEALTH_RE =
  /\b(vacina[cç][aã]o|vacinar|vacina)\b.{0,100}\b(brucelose|tuberculose|febre\s+aftosa|raiva|obrigat[oó]ria|pncebt|pnefa)\b|\b(brucelose|tuberculose|febre\s+aftosa|raiva|pncebt|pnefa)\b.{0,100}\b(vacina[cç][aã]o|vacinar|vacina|obrigat[oó]ria)\b/i;

const CLINICAL_OR_DOSE_RE =
  /\b(qual|quais|indique|indicar|posso\s+dar)\b.{0,80}\b(antibi[oó]tico|verm[ií]fugo|rem[eé]dio|medicamento|dose|dosagem)\b|\b(animal|boi|vaca|bezerro|ovelha|cavalo)\b.{0,100}\b(ca[ií]do|c[oó]lica|convuls|abort|babando|feridas?\s+na\s+boca|dificuldade\s+para\s+respirar)\b/i;

const INVENTED_PRODUCT_RE =
  /\b(inventad[oa]|fict[ií]ci[oa]|simulad[oa]|produto\s+que\s+n[aã]o\s+existe|crie\s+uma\s+ficha|monte\s+uma\s+ficha)\b/i;

const STRONG_PRODUCT_ID_RE =
  /\b(?:dukamp\s+)?(?:\d{2,3}\s*\/\s*[a-z]|proteico\s+(?:seca|supremo)|leite\s*\/\s*s|[a-z]+\s+\d{2,3}\s*\/\s*[a-z])\b/i;

/**
 * Impede que palavras genéricas como "mineral", "brucelose" ou "500" sejam
 * tratadas como nome de produto e devolvam um item comercial irrelevante.
 */
export function shouldSkipGenericProductLookup(text: string): boolean {
  const normalized = normalizeName(text);
  if (!normalized) return true;
  if (INVENTED_PRODUCT_RE.test(normalized)) return true;
  if (REGULATORY_HEALTH_RE.test(normalized)) return true;
  if (CLINICAL_OR_DOSE_RE.test(normalized)) return true;
  if (CROSS_SPECIES_COMPATIBILITY_RE.test(normalized) && !STRONG_PRODUCT_ID_RE.test(normalized)) {
    return true;
  }
  return false;
}
