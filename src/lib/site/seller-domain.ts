export interface PublicSeller {
  id?: string;
  name: string;
  role: string | null;
  region: string | null;
  phone: string | null;
  whatsapp: string | null;
}

export type SellerMatchKind = "name" | "region" | "all";

export interface SellerMatch {
  kind: SellerMatchKind;
  sellers: PublicSeller[];
  label: string | null;
}

const REGION_ALIASES: Record<string, string[]> = {
  "sao jose do rio preto": ["rio preto", "sjrp", "s j rio preto"],
  "monte aprazivel": ["monte apraz", "mte aprazivel"],
};

const GENERIC_WORDS = new Set([
  "algum", "alguma", "contato", "comercial", "dukamp", "equipe", "falar",
  "gostaria", "lista", "nome", "nomes", "passe", "quero", "representante",
  "vendedor", "vendedora", "vendedores",
]);

export function normalizeSellerText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return (` ${text} `).includes(` ${phrase} `);
}

/** Resolve nome/região sobre o cadastro já carregado; sem I/O e testável. */
export function matchSellerRequest(query: string, sellers: PublicSeller[]): SellerMatch {
  const normalized = normalizeSellerText(query);

  const byName = sellers.filter((seller) => {
    const fullName = normalizeSellerText(seller.name);
    if (fullName.length < 3) return false;
    const firstName = fullName.split(" ")[0];
    return containsPhrase(normalized, fullName) ||
      (firstName.length >= 3 && !GENERIC_WORDS.has(firstName) && containsPhrase(normalized, firstName));
  });
  if (byName.length > 0) return { kind: "name", sellers: byName, label: null };

  const byRegion = sellers.filter((seller) => {
    if (!seller.region) return false;
    const region = normalizeSellerText(seller.region);
    const aliases = REGION_ALIASES[region] ?? [];
    return containsPhrase(normalized, region) || aliases.some((alias) => containsPhrase(normalized, alias));
  });
  if (byRegion.length > 0) {
    return { kind: "region", sellers: byRegion, label: byRegion[0].region };
  }

  return { kind: "all", sellers, label: null };
}

/** Descarta placeholders ("indefinido", "-", "n/a") e devolve só contato real. */
export function cleanContact(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^(indefinid[oa]|nao\s*informad[oa]|n[aã]o\s*informad[oa]|sem|s\/?n|n\/?a|null|undefined|-+)$/i.test(raw)) {
    return null;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return formatPhone(digits);
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export function sellerContactLine(seller: PublicSeller): string {
  const wpp = cleanContact(seller.whatsapp);
  if (wpp) return ` — WhatsApp: ${wpp}`;
  const tel = cleanContact(seller.phone);
  if (tel) return ` — Telefone: ${tel}`;
  return "";
}

export function formatSellerList(match: SellerMatch): string {
  const bullets = match.sellers.map((seller) => {
    const details = [`**${seller.name}**`];
    if (seller.role) details.push(seller.role);
    if (seller.region && match.kind !== "region") details.push(seller.region);
    return `- ${details.join(" — ")}${sellerContactLine(seller)}`;
  });
  const title = match.kind === "region"
    ? `Vendedores DuKamp para ${match.label ?? "essa região"}`
    : match.kind === "name" ? "Contato comercial encontrado" : "Vendedores ativos da DuKamp";
  return `${title} (${match.sellers.length}):\n\n${bullets.join("\n")}`;
}

