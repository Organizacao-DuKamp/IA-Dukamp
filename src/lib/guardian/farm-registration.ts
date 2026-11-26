/** Registration data is supplied by the producer, never inferred by an LLM. */
export type ProducerSize = "small" | "medium" | "large";
export type Municipality = { id: number; name: string; uf: string };
export interface RegistrationSlots {
  producer?: string;
  name?: string;
  document?: string;
  stateRegistration?: string;
  city?: string;
  uf?: string;
  municipalityId?: number;
  email?: string;
  annualRevenueCents?: number;
  targetPropertyId?: string;
  distinct?: boolean;
}
export type RegistrationField = "producer" | "name" | "document" | "stateRegistration" | "city" | "email" | "annualRevenueCents";
export const registrationFields: RegistrationField[] = [
  "producer", "name", "document", "stateRegistration", "city", "email", "annualRevenueCents",
];
export const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
export function producerSize(cents: number): ProducerSize {
  return cents <= 50_000_000 ? "small" : cents <= 350_000_000 ? "medium" : "large";
}
export const sizeLabel = { small: "pequeno produtor", medium: "médio produtor", large: "grande produtor" } as const;
export function taxDocument(value: string): string | undefined {
  const d = value.toUpperCase().replace(/[.\-\/\s]/g, "");
  if (/^(\d)\1+$/.test(d)) return;
  if (/^\d{11}$/.test(d)) {
    for (const n of [9, 10]) {
      const sum = [...d.slice(0, n)].reduce((acc, digit, i) => acc + Number(digit) * (n + 1 - i), 0);
      const check = (sum * 10) % 11;
      if (Number(d[n]) !== (check === 10 ? 0 : check)) return;
    }
    return d;
  }
  // Also accepts the alphanumeric CNPJ format (final two positions remain numeric).
  if (/^[A-Z0-9]{12}\d{2}$/.test(d)) {
    for (const n of [12, 13]) {
      const weights = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
      const sum = [...d.slice(0, n)].reduce((acc, digit, i) => acc + (digit.charCodeAt(0) - 48) * weights[i], 0);
      const rem = sum % 11;
      if (Number(d[n]) !== (rem < 2 ? 0 : 11 - rem)) return;
    }
    return d;
  }
}
export function revenueCents(value: string): number | undefined {
  const s = normalize(value).replace(/\b(?:cerca de|em torno de|aproximadamente|mais ou menos|por ano|anual(?:mente)?|reais|r\$)\b/g, "").replace(/r\$/g, "").trim();
  const m = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(milhao|milhoes|mil|k|mi)?$/);
  if (!m) return;
  const amount = Number(m[1].replace(/\./g, "") + "." + (m[2] ?? "0"));
  const multiplier = m[3] === "mil" || m[3] === "k" ? 1000 : m[3] ? 1_000_000 : 1;
  const cents = Math.round(amount * multiplier * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 1e14 ? cents : undefined;
}
const states: Record<string, string> = {
  "11":"RO","12":"AC","13":"AM","14":"RR","15":"PA","16":"AP","17":"TO",
  "21":"MA","22":"PI","23":"CE","24":"RN","25":"PB","26":"PE","27":"AL","28":"SE","29":"BA",
  "31":"MG","32":"ES","33":"RJ","35":"SP","41":"PR","42":"SC","43":"RS",
  "50":"MS","51":"MT","52":"GO","53":"DF",
};
const stateNames: Record<string,string> = {
  acre:"AC", alagoas:"AL", amapa:"AP", amazonas:"AM", bahia:"BA", ceara:"CE",
  "distrito federal":"DF", "espirito santo":"ES", goias:"GO", maranhao:"MA",
  "mato grosso":"MT", "mato grosso do sul":"MS", "minas gerais":"MG", para:"PA",
  paraiba:"PB", parana:"PR", pernambuco:"PE", piaui:"PI", "rio de janeiro":"RJ",
  "rio grande do norte":"RN", "rio grande do sul":"RS", rondonia:"RO", roraima:"RR",
  "santa catarina":"SC", "sao paulo":"SP", sergipe:"SE", tocantins:"TO",
};
export function stateCode(value: string): string | undefined {
  const s = normalize(value).replace(/^(?:no estado de |em |no |na )/, "");
  return stateNames[s] ?? (Object.values(states).includes(s.toUpperCase()) ? s.toUpperCase() : undefined);
}
export function municipalityRows(data: unknown): Municipality[] {
  if (!Array.isArray(data)) throw new Error("municipalities_unavailable");
  return data.flatMap((row: { id?: unknown; nome?: unknown }) => {
    const id = Number(row?.id);
    const uf = states[String(id).slice(0, 2)];
    return Number.isInteger(id) && String(id).length === 7 && typeof row.nome === "string" && uf
      ? [{ id, name: row.nome, uf }] : [];
  });
}
export function municipalityMatches(city: string, rows: Municipality[], uf?: string) {
  return rows.filter((r) => normalize(r.name) === normalize(city) && (!uf || r.uf === uf));
}
let cache: { rows: Municipality[]; expires: number } | undefined;
export async function loadMunicipalities(): Promise<Municipality[]> {
  if (cache && cache.expires > Date.now()) return cache.rows;
  const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios", {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("municipalities_unavailable");
  const rows = municipalityRows(await response.json());
  if (rows.length < 5000) throw new Error("municipalities_incomplete");
  cache = { rows, expires: Date.now() + 24 * 60 * 60 * 1000 };
  return rows;
}
const questions: Record<RegistrationField,string> = {
  producer: "Qual é o nome completo do produtor responsável?",
  name: "Como se chama a propriedade?",
  document: "Qual é o CPF ou CNPJ do produtor? Envie o documento completo.",
  stateRegistration: "Qual é o número da inscrição estadual?",
  city: "Em qual município fica a propriedade? Não precisa informar o estado.",
  email: "Qual é o e-mail de contato do produtor?",
  annualRevenueCents: "Qual é o faturamento anual estimado da propriedade? Pode informar, por exemplo, 500 mil ou 3,5 milhões.",
};
export function nextField(s: RegistrationSlots): RegistrationField | undefined {
  return registrationFields.find(f => s[f] === undefined || s[f] === "");
}
export const fieldQuestion = (field: RegistrationField) => questions[field];
const labelPattern = /\b(nome\s+(?:completo\s+)?(?:do\s+)?produtor|produtor|meu\s+nome|eu\s+me\s+chamo|nome\s+(?:da\s+)?(?:propriedade|fazenda)|(?:a\s+)?(?:minha\s+)?(?:fazenda|propriedade)\s+(?:se\s+chama|chama-se)|cpf\s*\/\s*cnpj|cpf|cnpj|inscri[cç][aã]o\s+estadual|i\.?e\.?|munic[ií]pio|cidade|(?:a\s+)?(?:fazenda\s+)?fica\s+em|estado|uf|e[\s-]?mail|faturamento(?:\s+estimado)?(?:\s+anual)?|faturamos|fatura)\s*(?::|=|\s+[ée]\s+|\s+de\s+|\s+)?/giu;
function labelField(raw: string): RegistrationField | "uf" {
  const t = normalize(raw);
  if (/produtor|meu nome|me chamo/.test(t)) return "producer";
  if (/cpf|cnpj/.test(t)) return "document";
  if (/inscricao|^i\.?e\.?$/.test(t)) return "stateRegistration";
  if (/municipio|cidade|fica em/.test(t)) return "city";
  if (/estado|^uf$/.test(t)) return "uf";
  if (/mail/.test(t)) return "email";
  if (/fatur/.test(t)) return "annualRevenueCents";
  return "name";
}
function clean(value: string) {
  return value.trim().replace(/^[\s:=-]+|[\s,;.!]+$/g, "").replace(/\s+e$/i, "").trim();
}
export function collectRegistration(text: string, prior: RegistrationSlots = {}, expected?: RegistrationField | "uf"): RegistrationSlots {
  const s = { ...prior };
  const raw = text.replace(/\*/g, "").replace(/^\[?Áudio(?: do WhatsApp)?\]?\s*:?\s*/i, "").trim();
  const set = (field: RegistrationField | "uf", value: string) => {
    const v = clean(value);
    if (!v || /^(?:nao sei|não sei|nao tenho|não tenho|depois|pular|sim|ok|confirmar|cancelar)$/i.test(v)) return;
    if (field === "document") { s.document = taxDocument(v); return; }
    if (field === "email") { s.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? v.toLowerCase() : undefined; return; }
    if (field === "stateRegistration") {
      const ie = v.toUpperCase().replace(/[.\-\/\s]/g, "");
      s.stateRegistration = /^[A-Z0-9]{2,20}$/.test(ie) && /\d/.test(ie) ? ie : undefined;
      return;
    }
    if (field === "annualRevenueCents") { s.annualRevenueCents = revenueCents(v); return; }
    if (field === "uf") { s.uf = stateCode(v); s.municipalityId = undefined; return; }
    if (field === "city") {
      const withState = v.match(/^(.*?)\s*[/,-]\s*(.+)$/);
      const uf = withState ? stateCode(withState[2]) : undefined;
      s.city = uf ? clean(withState![1]) : v;
      s.uf = uf;
      s.municipalityId = undefined;
      return;
    }
    if (v.length >= 2 && v.length <= 160 && /\p{L}/u.test(v) && !/[\n?@]/.test(v)) s[field] = v;
  };
  const matches = [...raw.matchAll(labelPattern)].filter(m => {
    // Do not interpret a field word embedded in an answer (e.g. Fazenda Produtor Rural).
    const i = m.index ?? 0;
    const before = raw.slice(0, i);
    return i === 0 || /[\n;,]\s*$/.test(before) || /\be\s+$/i.test(before) || /[:=]\s*$/.test(m[0]) || /meu nome|me chamo|fica em|se chama|faturamos|fatura/i.test(m[0]);
  });
  if (matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const start = (match.index ?? 0) + match[0].length;
      set(labelField(match[1]), raw.slice(start, matches[i + 1]?.index ?? raw.length));
    }
  } else if (expected) {
    set(expected, raw.replace(/^(?:é |e |sou |me chamo |meu nome é |fica em |o meu é |o número é |cerca de )/i, ""));
  }
  const email = raw.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  if (email) s.email = email.toLowerCase();
  const doc = raw.match(/\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g)?.find(v => taxDocument(v));
  if (doc && (expected === "document" || /\b(?:cpf|cnpj)\b/i.test(raw))) s.document = taxDocument(doc);
  return s;
}
export function registrationComplete(s: RegistrationSlots): s is RegistrationSlots & Required<Pick<RegistrationSlots, "producer"|"name"|"document"|"stateRegistration"|"city"|"uf"|"municipalityId"|"email"|"annualRevenueCents">> {
  return !nextField(s) && !!s.uf && Number.isInteger(s.municipalityId);
}
export function privateRegistration(s: RegistrationSlots) {
  if (!registrationComplete(s)) throw new Error("registration_incomplete");
  return { producer: s.producer, name: s.name, document: s.document, stateRegistration: s.stateRegistration,
    city: s.city, uf: s.uf, municipalityId: s.municipalityId, email: s.email, annualRevenueCents: s.annualRevenueCents };
}
