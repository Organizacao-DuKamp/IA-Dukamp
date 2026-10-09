import type { ChatMessage } from "./types.ts";

export const ABCZ_PUBLIC_CONSULTATION =
  "https://www.abcz.org.br/produtos-e-servicos/consulta-publica-de-animais";

export interface AnimalRegistration {
  series: string;
  number: string;
  code: string;
}

const NON_SERIES = new Set([
  "GMD",
  "KG",
  "ML",
  "MG",
  "KM",
  "LT",
  "PDF",
  "CPF",
  "CNPJ",
  "CEP",
  "RGN",
  "RGD",
  "ABCZ",
  "IABCZ",
  "PMGZ",
  "DEP",
  "DEPS",
  "FIV",
  "TE",
  "IA",
  "PO",
  "PC",
  "RACA",
  "CODIGO",
  "BOI",
  "VACA",
  "TOURO",
  "LOTE",
  "ANO",
  "DIAS",
  "DOSE",
  "PRECO",
  "VALOR",
  "A",
  "O",
  "E",
  "AS",
  "OS",
  "UM",
  "UMA",
  "TENHO",
  "QUERO",
  "PESO",
  "PARA",
  "COM",
  "POR",
  "MAIS",
  "MENOS",
  "ANOS",
  "MESES",
  "DIA",
  "MES",
  "ATE",
  "DE",
  "DO",
  "DA",
  "EM",
  "NO",
  "NA",
  "SAO",
  "UNS",
  "UMAS",
  "CERCA",
  "MEDIA",
  "CADA",
  "TOTAL",
  "SECA",
  "AGUAS",
  "LINHA",
  "MODELO",
  "SAL",
  "MINERAL",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/** Recognize series + number, never infer breed from a breeder's series. */
export function extractAnimalRegistrations(text: string): AnimalRegistration[] {
  const normalized = normalize(text);
  const contextual =
    /\b(?:ABCZ|RGN|RGD|REGISTRO|GENEALOG\w*|SERIE|RACA|GADO|BOVIN\w*|ANIMAL|TOURO|VACA|MATRIZ|PEDIGREE)\b/.test(
      normalized,
    );
  if (
    !contextual &&
    /\b(?:DUKAMP|PRODUTO|RACAO|SUPLEMENTO|MEDICAMENTO|NOTA FISCAL|PEDIDO|CEP|CPF)\b/.test(
      normalized,
    )
  )
    return [];
  const found = new Map<string, AnimalRegistration>();
  for (const match of text.matchAll(/\b([a-z]{1,6})[\s.-]*(\d{1,5}(?:[a-z]{1,2})?)\b/gi)) {
    const series = normalize(match[1]);
    const bareCode = text.trim().replace(/[?!.,]+$/, "") === match[0];
    if (
      NON_SERIES.has(series) ||
      (!contextual && series.length < 3 && !(bareCode && match[1] === series))
    )
      continue;
    if (!contextual && !bareCode && match[1] !== series) continue;
    const number = normalize(match[2]);
    if (!/[1-9]/.test(number)) continue;
    const code = `${series} ${number}`;
    found.set(code, { series, number, code });
    if (found.size === 4) break;
  }
  return [...found.values()];
}

export function isAnimalRegistryRequest(text: string): boolean {
  return (
    extractAnimalRegistrations(text).length > 0 ||
    /\b(?:abcz|rgn|rgd|registro\s+geneal[oó]gico|pedigree|genealogia|s[eé]rie\s+(?:[uú]nica|alfab[eé]tica))\b/i.test(
      text,
    ) ||
    /\b(?:ra[cç]a|identificar|identifique)\b.{0,70}\b(?:c[oó]digo|registro|marca[cç][aã]o)\b/i.test(
      text,
    )
  );
}

/** Only explicit follow-ups inherit a code. A new product/weather topic does not. */
export function resolveAnimalRegistryTurn(
  text: string,
  history: ChatMessage[] = [],
  activeCodes?: string,
): { active: boolean; registrations: AnimalRegistration[] } {
  const direct = extractAnimalRegistrations(text);
  if (direct.length) return { active: true, registrations: direct };
  const followText = normalize(text.trim());
  const followUp =
    /^(?:E\s+)?(?:(?:QUAL|QUEM)(?:\s+E)?\s+)?(?:[OA]\s+)?(?:RACA|PAI|MAE|CRIADOR|GENEALOGIA|SEXO|NOME)(?:\s+(?:DELE|DELA|DESSE ANIMAL|DESSA VACA|DESSE TOURO))?\s*[?!.,]*$/.test(
      followText,
    ) ||
    /^(?:ME\s+)?(?:MANDE|MOSTRE|QUERO)\s+(?:A\s+)?(?:FICHA|AVALIACAO|PEDIGREE)(?:\s+(?:DELE|DELA))?\s*[?!.,]*$/.test(
      followText,
    );
  if (!followUp) return { active: isAnimalRegistryRequest(text), registrations: [] };
  const lastUser = [...history].reverse().find((message) => message.role === "user");
  const registrations = activeCodes
    ? extractAnimalRegistrations(activeCodes)
    : lastUser
      ? extractAnimalRegistrations(lastUser.content)
      : [];
  return { active: registrations.length > 0, registrations };
}

export function animalRegistryDirective(registrations: AnimalRegistration[]): string {
  if (!registrations.length)
    return "REGISTRO BOVINO INCOMPLETO: peça a identificação completa (série alfabética + número, por exemplo GTRT 2551), ou foto legível do certificado/marca. Um número isolado não identifica unicamente o animal. Se for RGD antigo, peça também raça, sexo e categoria. Não deduza a raça nem ofereça catálogo DuKamp.";
  return [
    "CONSULTA DE REGISTRO BOVINO — PESQUISA OBRIGATÓRIA NESTE TURNO.",
    ...registrations.map(
      ({ series, number, code }) =>
        `ALVO EXATO: ${code}; série alfabética=${series}; RGN=${number}. Busque as grafias "${code}", "${series}-${number}" e "${series}${number}".`,
    ),
    `Priorize a consulta pública ABCZ (${ABCZ_PUBLIC_CONSULTATION}), publicações e PDFs ABCZ/PMGZ e zebu.org.br. A série identifica o criador/rebanho; NÃO codifica a raça.`,
    "Se o portal não for pesquisável, exigir autenticação, CAPTCHA ou não divulgar o animal, use publicações da associação da raça, ficha do próprio criatório, centrais de genética e catálogos de leilões. Não diga que consultou diretamente a ABCZ quando usou outra fonte. Não contorne restrições de acesso.",
    "Confirme correspondência da série E do número na mesma ficha/linha do animal. Ocorrências em pai, mãe, avô ou outro lote não identificam o animal principal. Não use a raça de um animal próximo na página nem o afixo do nome como prova de raça.",
    "Responda primeiro com código, nome e raça encontrados; acrescente sexo/genealogia/avaliação só se a fonte os confirmar e forem pertinentes. Inclua pelo menos um link da ficha/publicação que sustenta a identificação, mesmo sem o usuário pedir fontes. Publicações históricas podem confirmar identidade/raça, mas não proprietário atual, estoque, vida ou avaliação genética atual.",
    "Se houver homônimos, conflito ou ambiguidade, explique e peça certificado/nome/foto para desambiguar. Não chute. Se não encontrar evidência exata, diga que não conseguiu confirmar o registro nas fontes públicas e peça certificado ou foto legível; ausência pública NÃO prova inexistência. Não prometa pesquisar numa mensagem futura.",
  ].join("\n");
}

/** Output guard, not independent verification of the external source content. */
export function validateAnimalRegistryReply(
  reply: string,
  registrations: AnimalRegistration[],
  verifiedUrls?: string[],
): string[] {
  const issues: string[] = [];
  const mentioned = new Set(extractAnimalRegistrations(reply).map(({ code }) => code));
  if (registrations.some(({ code }) => !mentioned.has(code)))
    issues.push("animal_registration_missing");
  const uncertain =
    /(?:n[aã]o\s+(?:consegui|foi poss[ií]vel|encontrei|localizei|posso)|n[aã]o\s+(?:est[aá]|foi)\s+confirmad|sem\s+(?:confirma[cç][aã]o|evid[eê]ncia)|amb[ií]gu|diverg[eê]ncia|conflito)/i.test(
      reply,
    );
  const assertsBreed =
    /\b(?:raca\s*(?:[eé:]|do|de|tabapua|nelore|gir|guzera|brahman|sindi|angus|holand)|e\s+(?:um|uma|da raca)|identificad[oa]\s+como)\b/i.test(
      normalize(reply),
    );
  // A refusal cannot license an affirmative breed claim elsewhere in the reply.
  if ((!uncertain || assertsBreed) && !/https?:\/\/[^\s<>)]+/i.test(reply))
    issues.push("animal_source_link_missing");
  if (
    (!uncertain || assertsBreed) &&
    verifiedUrls &&
    !verifiedUrls.some((url) => url !== ABCZ_PUBLIC_CONSULTATION && reply.includes(url))
  )
    issues.push("animal_source_not_retrieved");
  if (
    registrations.some(({ series }) =>
      new RegExp(
        `(?:prefixo|s[eé]rie|letras).{0,30}${series}.{0,80}(?:significa|indica|determina|[eé] da ra[cç]a)`,
        "i",
      ).test(reply),
    )
  )
    issues.push("breed_inferred_from_series");
  if (/\b(?:posso|quer que eu)\s+(?:te\s+)?(?:pesquisar|consultar|buscar)\b/i.test(reply))
    issues.push("animal_lookup_deferred");
  return issues;
}

export function animalRegistryUnconfirmedReply(registrations: AnimalRegistration[]): string {
  return `Não consegui confirmar com segurança a identificação de ${registrations.map(({ code }) => code).join(", ")} em fontes públicas agora. A série e o número não permitem deduzir a raça. Envie uma foto legível do certificado ou o nome completo do animal para conferir. A ausência de resultado público não significa que o registro não exista.\nConsulta pública ABCZ: ${ABCZ_PUBLIC_CONSULTATION}`;
}
