/** Pure package contract shared by the administrative importer and its offline validator.
 * Text in a package is source data. It never grants approval or configures the application.
 */
export const DUKAMP_CATEGORY = "dukamp_controlado";
export const DUKAMP_SCHEMA = "dukamp:1";

export interface EvidenceReference {
  evidence_id: string;
  source_id: string;
  arquivo_original: string;
  secao_semantica: string;
  secao_numero_original: number | null;
  pagina_pdf_inicio: number | null;
}
export interface SourceVersion {
  source_id: string;
  versao_papel: string;
  arquivo_original: string;
  arquivo_no_pacote: string;
  sha256: string;
}
export interface ProductIssue {
  tipo: string;
  descricao: string;
  source_id: string;
  referencias: EvidenceReference[];
}
export interface ControlledProduct {
  produto_id: string;
  nome_comercial_documental: string;
  aliases: string[];
  classificacao_documental: string;
  descricao_documental: string;
  composicao_documental: string;
  modo_de_usar_documental: string;
  restricoes_documentais: string;
  status_vigencia: string;
  principal_documental_source_id: string;
  fontes: SourceVersion[];
  bloqueios: ProductIssue[];
  recomendacao_operacional_liberada: false;
  [key: string]: unknown;
}
export interface ControlledSection {
  chunk_id: string;
  produto_id: string;
  source_id: string;
  versao_papel: string;
  titulo: string;
  texto: string;
  referencias: EvidenceReference[];
  restricoes_da_versao: string;
  sha256_fonte: string;
  status_vigencia: string;
  perguntas_relacionadas: string[];
  recomendacao_operacional_liberada: false;
}
export interface ControlledQuestion {
  qa_id: string;
  produto_id: string;
  source_id: string;
  pergunta: string;
  resposta: string;
  tipo_resposta: string;
  referencias: EvidenceReference[];
  observacao: string | null;
}
export interface TechnicalReview {
  source_id_aprovado: string;
  source_sha256: string;
  product_fingerprint: string;
  evidencia_rotulo_atual: string;
  revisor_responsavel: string;
  user_id: string;
  data_revisao: string;
  status_vigencia: "vigente_confirmado" | "nao_verificada";
  recomendacao_operacional_liberada: boolean;
  campos_validados: Record<string, string>;
  resolucoes: Record<string, string>;
  especies_autorizadas: string[];
  disponibilidade_confirmada: boolean;
  bloqueios_resolvidos?: string[];
  campos_corrigidos_com_evidencia?: Record<string, string>;
  observacoes?: string | null;
}
export interface CatalogEnvelope {
  schema: typeof DUKAMP_SCHEMA;
  kind: "catalog";
  fingerprint: string;
  product: ControlledProduct;
  review: TechnicalReview | null;
  review_history: TechnicalReview[];
}
export interface SectionEnvelope {
  schema: typeof DUKAMP_SCHEMA;
  kind: "section";
  fingerprint: string;
  section: ControlledSection;
}
export interface QuestionsEnvelope {
  schema: typeof DUKAMP_SCHEMA;
  kind: "questions";
  produto_id: string;
  questions: ControlledQuestion[];
}
export type PackageEnvelope =
  | CatalogEnvelope
  | SectionEnvelope
  | QuestionsEnvelope
  | {
      schema: typeof DUKAMP_SCHEMA;
      kind: "manifest";
      sources: unknown[];
      counts: PackageCounts;
    };
export interface PackageCounts {
  products: number;
  sourceVersions: number;
  originalFiles: number;
  questions: number;
  sections: number;
  evaluationCases: number;
}
export interface ImportDocument {
  id: string;
  source_path: string;
  title: string;
  filename: string;
  category: typeof DUKAMP_CATEGORY;
  subcategory: string;
  content: string;
  content_hash: string;
  file_type: string;
  requires_review: boolean;
  chunk_count: number;
  status: "aguardando" | "concluido";
  version?: number;
}
export interface OriginalSource {
  source_id: string;
  sha256: string;
  package_path: string;
  storage_path: string;
  bytes: number;
}
export interface DuKampImportPlan {
  counts: PackageCounts;
  documents: ImportDocument[];
  originals: OriginalSource[];
  evaluations: unknown[];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: objeto inválido.`);
  }
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, max = 100_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${label}: texto ausente ou acima do limite.`);
  }
  return value;
}
function array(value: unknown, label: string, max = 20_000): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label}: lista inválida.`);
  return value;
}
export function packagePath(input: string): string {
  const path = input.replaceAll("\\", "/");
  if (/^(?:\/|[a-z]:)/i.test(path) || path.split("/").some((p) => p === ".." || p === "." || !p)) {
    throw new Error("Caminho de arquivo inválido no pacote.");
  }
  return path;
}
export function normalized(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/horsepower/g, "horse power")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((k) => record[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson(record[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
export async function sha256(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}
export async function documentId(path: string): Promise<string> {
  // RFC 4122 UUIDv5 using a fixed application namespace and the canonical source path.
  const namespace = Uint8Array.from("d4687e14c2115e93afbbd15c1c9e1341".match(/../g)!, (s) =>
    parseInt(s, 16),
  );
  const name = new TextEncoder().encode(path);
  const input = new Uint8Array(namespace.length + name.length);
  input.set(namespace);
  input.set(name, namespace.length);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), (n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function parseJsonLines(input: string, name: string): unknown[] {
  const result: unknown[] = [];
  for (const [index, line] of input.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      result.push(JSON.parse(line));
    } catch {
      throw new Error(`${name}: JSON inválido na linha ${index + 1}.`);
    }
  }
  return result;
}
export function speciesFromIndication(product: ControlledProduct): string[] {
  // Do not use imported keyword filters as eligibility. "ovino" is a substring of "bovino".
  const text = normalized(`${product.classificacao_documental} ${product.descricao_documental}`);
  return [
    ["bovinos", /\b(?:bovino\w*|bezerro\w*|vaca\w*|novilha\w*|touro\w*)\b/],
    ["equinos", /\b(?:equino\w*|equideo\w*|egua\w*|potro\w*)\b/],
    ["ovinos", /\bovino\w*\b/],
    ["caprinos", /\bcaprino\w*\b/],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(text))
    .map(([name]) => name as string);
}
export function issueKey(issue: ProductIssue, index: number): string {
  return `${issue.source_id}:${issue.tipo}:${index}`;
}
export const REVIEW_FIELDS = [
  "classificacao",
  "indicacao",
  "composicao",
  "garantias",
  "modo_de_usar",
  "restricoes",
  "unidades_e_bases",
] as const;
export function reviewIsOperational(envelope: CatalogEnvelope): boolean {
  const review = envelope.review;
  if (
    !review ||
    !review.recomendacao_operacional_liberada ||
    !review.disponibilidade_confirmada ||
    review.product_fingerprint !== envelope.fingerprint ||
    review.status_vigencia !== "vigente_confirmado"
  )
    return false;
  const version = envelope.product.fontes.find((s) => s.source_id === review.source_id_aprovado);
  if (
    !version ||
    version.sha256 !== review.source_sha256 ||
    version.versao_papel === "historico_obsoleto" ||
    /obsoletos|n[aã]o lan[cç]ado/i.test(version.arquivo_original) ||
    ["historico_obsoleto", "nao_lancado"].includes(envelope.product.status_vigencia)
  )
    return false;
  return (
    REVIEW_FIELDS.every((k) => Boolean(review.campos_validados[k]?.trim())) &&
    envelope.product.bloqueios.every((issue, index) =>
      Boolean(review.resolucoes[issueKey(issue, index)]?.trim()),
    ) &&
    Boolean(
      review.evidencia_rotulo_atual &&
      review.revisor_responsavel &&
      review.user_id &&
      review.data_revisao,
    ) &&
    review.especies_autorizadas.length > 0
  );
}
export function parseEnvelope(content: string | null | undefined): PackageEnvelope | null {
  if (!content || content[0] !== "{") return null;
  try {
    const value = JSON.parse(content);
    if (
      value?.schema !== DUKAMP_SCHEMA ||
      !["catalog", "section", "questions", "manifest"].includes(value.kind)
    )
      return null;
    return value as PackageEnvelope;
  } catch {
    return null;
  }
}
function reference(value: unknown, label: string): EvidenceReference {
  const r = object(value, label);
  const evidence = string(r.evidence_id, label, 40),
    source = string(r.source_id, label, 20);
  if (!new RegExp(`^${source}-S\\d{2}$`).test(evidence))
    throw new Error(`${label}: referência incompatível.`);
  return {
    evidence_id: evidence,
    source_id: source,
    arquivo_original: string(r.arquivo_original, label, 600),
    secao_semantica: string(r.secao_semantica, label, 150),
    secao_numero_original:
      typeof r.secao_numero_original === "number" ? r.secao_numero_original : null,
    pagina_pdf_inicio: typeof r.pagina_pdf_inicio === "number" ? r.pagina_pdf_inicio : null,
  };
}
export function checkedProduct(value: unknown): ControlledProduct {
  const p = object(value, "Produto");
  const id = string(p.produto_id, "Produto", 20);
  if (!/^P\d{3}$/.test(id)) throw new Error("Identidade de produto inválida.");
  for (const field of [
    "nome_comercial_documental",
    "classificacao_documental",
    "descricao_documental",
    "composicao_documental",
    "modo_de_usar_documental",
    "restricoes_documentais",
  ])
    string(p[field], `${id}/${field}`);
  const sources = array(p.fontes, `${id}/fontes`, 100).map((value) => {
    const s = object(value, "Fonte");
    if (!/^[a-f0-9]{64}$/i.test(String(s.sha256)))
      throw new Error(`${id}: hash de fonte inválido.`);
    if (!/^D\d{3}$/.test(String(s.source_id)))
      throw new Error(`${id}: identidade de fonte inválida.`);
    return {
      source_id: string(s.source_id, "Fonte", 20),
      versao_papel: string(s.versao_papel, "Fonte", 60),
      arquivo_original: string(s.arquivo_original, "Fonte", 600),
      arquivo_no_pacote: packagePath(string(s.arquivo_no_pacote, "Fonte", 600)),
      sha256: String(s.sha256).toLowerCase(),
    };
  });
  const principal = string(p.principal_documental_source_id, "Versão principal", 20);
  if (!sources.some((s) => s.source_id === principal))
    throw new Error(`${id}: versão principal não registrada.`);
  const issues = array(p.bloqueios, `${id}/pendências`, 500).map((value) => {
    const issue = object(value, "Pendência");
    return {
      tipo: string(issue.tipo, "Pendência", 100),
      descricao: string(issue.descricao, "Pendência", 8000),
      source_id: string(issue.source_id, "Pendência", 20),
      referencias: array(issue.referencias, "Pendência", 50).map((r) => reference(r, "Pendência")),
    };
  });
  const status = String(p.status_vigencia);
  if (!["nao_verificada", "historico_obsoleto", "nao_lancado"].includes(status))
    throw new Error(`${id}: vigência não suportada no pacote.`);
  return {
    ...p,
    produto_id: id,
    fontes: sources,
    bloqueios: issues,
    aliases: array(p.aliases, "Aliases", 100).map((a) => string(a, "Alias", 600)),
    recomendacao_operacional_liberada: false,
  } as ControlledProduct;
}
export async function makeDocument(
  envelope: PackageEnvelope,
  key: string,
  title: string,
): Promise<ImportDocument> {
  const path = `dukamp-controlled/${key}.json`;
  const content = stableJson(envelope);
  const indexed = envelope.kind === "section";
  return {
    id: await documentId(path),
    source_path: path,
    title,
    filename: `dukamp_${key.replaceAll("/", "_")}.json`,
    category: DUKAMP_CATEGORY,
    subcategory: envelope.kind,
    content,
    content_hash: envelope.kind === "catalog" ? envelope.fingerprint : await sha256(content),
    file_type: `dukamp_${envelope.kind}`,
    requires_review: !indexed,
    status: indexed ? "aguardando" : "concluido",
    chunk_count: indexed ? 1 : 0,
  };
}
export async function planDuKampImport(input: {
  catalog: unknown;
  sections: unknown[];
  questions: unknown[];
  sources: unknown;
  evaluations?: unknown[];
}): Promise<DuKampImportPlan> {
  const products = array(input.catalog, "Catálogo", 2000).map(checkedProduct);
  const byId = new Map(products.map((p) => [p.produto_id, p]));
  if (byId.size !== products.length) throw new Error("Produto duplicado no catálogo.");
  const evidenceIds = new Set<string>(),
    sectionIds = new Set<string>();
  const sections = input.sections.map((value) => {
    const s = object(value, "Seção");
    const product = byId.get(String(s.produto_id));
    if (!product) throw new Error("Seção de produto não registrado.");
    const source = product.fontes.find((v) => v.source_id === s.source_id);
    if (!source || source.sha256 !== s.sha256_fonte)
      throw new Error("Versão/hash da seção não confere com a fonte.");
    const id = string(s.chunk_id, "Seção", 80);
    if (!new RegExp(`^${product.produto_id}-${source.source_id}-S\\d{2}$`).test(id))
      throw new Error("Identidade da seção incompatível com produto/versão.");
    if (sectionIds.has(id)) throw new Error("Seção canônica duplicada.");
    sectionIds.add(id);
    const refs = array(s.referencias, "Referências", 30).map((r) => reference(r, "Seção"));
    for (const ref of refs) {
      if (ref.source_id !== source.source_id || ref.arquivo_original !== source.arquivo_original)
        throw new Error("Uma seção mistura fontes/versões.");
      evidenceIds.add(ref.evidence_id);
    }
    return {
      chunk_id: id,
      produto_id: product.produto_id,
      source_id: source.source_id,
      versao_papel: source.versao_papel,
      titulo: string(s.titulo, "Título", 300),
      texto: string(s.texto, "Seção", 24_000),
      referencias: refs,
      restricoes_da_versao: string(s.restricoes_da_versao, "Restrições", 20_000),
      sha256_fonte: source.sha256,
      status_vigencia: product.status_vigencia,
      perguntas_relacionadas: [] as string[],
      recomendacao_operacional_liberada: false as const,
    };
  });
  const questionIds = new Set<string>();
  const questions = input.questions.map((value) => {
    const q = object(value, "Pergunta"),
      pid = string(q.produto_id, "Pergunta", 20);
    const product = byId.get(pid);
    if (!product || !product.fontes.some((s) => s.source_id === q.source_id))
      throw new Error("Pergunta de produto/versão desconhecidos.");
    const id = string(q.qa_id, "Pergunta", 60);
    if (questionIds.has(id) || !new RegExp(`^${pid}-Q\\d{3}$`).test(id))
      throw new Error("Identidade de pergunta inválida/duplicada.");
    questionIds.add(id);
    const refs = array(q.referencias, "Pergunta", 30).map((r) => reference(r, "Pergunta"));
    if (
      refs.some(
        (r) =>
          !evidenceIds.has(r.evidence_id) ||
          !product.fontes.some((s) => s.source_id === r.source_id),
      )
    )
      throw new Error(`${id}: referência não encontrada.`);
    return {
      qa_id: id,
      produto_id: pid,
      source_id: String(q.source_id),
      pergunta: string(q.pergunta, "Pergunta", 3000),
      resposta: string(q.resposta, "Resposta", 30_000),
      tipo_resposta: string(q.tipo_resposta, "Tipo", 100),
      referencias: refs,
      observacao: typeof q.observacao === "string" ? q.observacao : null,
    };
  });
  const aliases = new Map<string, Set<string>>();
  for (const q of questions)
    for (const ref of q.referencias) {
      const key = `${q.produto_id}:${ref.evidence_id}`;
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key)!.add(q.pergunta);
    }
  for (const section of sections) {
    // Questions provide search vocabulary, never a second independently indexed answer.
    const names = new Set(
      section.referencias.flatMap((r) => [
        ...(aliases.get(`${section.produto_id}:${r.evidence_id}`) ?? []),
      ]),
    );
    section.perguntas_relacionadas = [...names];
  }
  const inventory = array(input.sources, "Inventário", 20_000),
    originals = new Map<string, OriginalSource>();
  for (const item of inventory) {
    const source = object(item, "Inventário");
    if (source.tratamento === "ignorado_arquivo_temporario_word" || source.duplicata_de) continue;
    const hash = string(source.sha256, "Hash", 64);
    if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("Hash inválido no inventário.");
    const path = packagePath(string(source.arquivo_canonico_no_pacote, "Original", 600));
    const extension = path.split(".").pop();
    if (!["doc", "pdf", "xls", "xlsx", "docx", "txt"].includes(extension!))
      throw new Error("Tipo de original não suportado.");
    originals.set(hash, {
      source_id: string(source.source_id, "Fonte", 20),
      sha256: hash,
      package_path: path,
      storage_path: `dukamp/originals/${hash}.${extension}`,
      bytes: Number(source.bytes),
    });
  }
  for (const product of products)
    for (const source of product.fontes) {
      const original = originals.get(source.sha256);
      if (!original || original.package_path !== source.arquivo_no_pacote)
        throw new Error("Original da versão não está no inventário.");
    }
  const counts = {
    products: products.length,
    sourceVersions: new Set(products.flatMap((p) => p.fontes.map((s) => s.source_id))).size,
    originalFiles: originals.size,
    questions: questions.length,
    sections: sections.length,
    evaluationCases: input.evaluations?.length ?? 0,
  };
  const documents: ImportDocument[] = [];
  for (const product of products) {
    const fingerprint = await sha256(stableJson(product));
    documents.push(
      await makeDocument(
        {
          schema: DUKAMP_SCHEMA,
          kind: "catalog",
          fingerprint,
          product,
          review: null,
          review_history: [],
        },
        `catalog/${product.produto_id}`,
        product.nome_comercial_documental,
      ),
    );
    documents.push(
      await makeDocument(
        {
          schema: DUKAMP_SCHEMA,
          kind: "questions",
          produto_id: product.produto_id,
          questions: questions.filter((q) => q.produto_id === product.produto_id),
        },
        `questions/${product.produto_id}`,
        `Perguntas - ${product.nome_comercial_documental}`,
      ),
    );
  }
  for (const section of sections) {
    const fingerprint = await sha256(stableJson(section));
    documents.push(
      await makeDocument(
        { schema: DUKAMP_SCHEMA, kind: "section", fingerprint, section },
        `section/${section.chunk_id}`,
        `${byId.get(section.produto_id)!.nome_comercial_documental} - ${section.titulo}`,
      ),
    );
  }
  documents.push(
    await makeDocument(
      { schema: DUKAMP_SCHEMA, kind: "manifest", sources: inventory, counts },
      "manifest/sources",
      "Fontes e cobertura da base Dukamp",
    ),
  );
  return {
    counts,
    documents,
    originals: [...originals.values()],
    evaluations: input.evaluations ?? [],
  };
}
