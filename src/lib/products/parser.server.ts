// Heuristic parser: from a knowledge_documents row (path + raw content),
// extract a candidate product record. Conservative — leaves fields NULL when
// not clearly present rather than inventing.

import { normalizeName, toSlug } from "./normalize";

export interface RawDoc {
  id: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
  source_path: string;
  content: string | null;
}

export interface ProductCandidate {
  official_name: string;
  slug: string;
  description: string | null;
  category: string | null;
  species: string | null;
  animal_phase: string | null;
  package_weight: string | null;
  indication: string | null;
  consumption: string | null;
  usage_instructions: string | null;
  composition: string | null;
  guarantee_levels: string | null;
  source_document: string;
  missing_fields: string[];
  raw_kind: "rtpi" | "descritivo" | "folder" | "outro";
}

const SPECIES_MAP: Record<string, string> = {
  "01-BOVINOS": "bovinos",
  "02-EQUINOS": "equinos",
  "03-OVINOS-E-CAPRINOS": "ovinos_caprinos",
  "04-OUTROS": "outros",
};

function detectSpecies(sourcePath: string): string | null {
  for (const [k, v] of Object.entries(SPECIES_MAP)) {
    if (sourcePath.includes(k)) return v;
  }
  return null;
}

function detectKind(sourcePath: string, filename: string): ProductCandidate["raw_kind"] {
  if (/rtpi-/i.test(filename)) return "rtpi";
  if (/DESCRICOES-GERAIS/i.test(sourcePath)) return "descritivo";
  if (/02-PDFS-E-FOLDERS/i.test(sourcePath)) return "folder";
  return "outro";
}

/** Clean the RTPI/DOC header lines from converted files. */
function stripSourceHeader(text: string): string {
  return text.replace(
    /^ARQUIVO DE ORIGEM:[\s\S]*?={3,}\s*/i,
    "",
  );
}

/** Extract a labelled section like "COMPOSIÇÃO:\n..." until next ALL-CAPS label or blank block. */
function extractSection(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `(?:^|\\n)\\s*${label}\\s*[:\\-]?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ /()0-9-]{2,}\\s*[:\\-]|$)`,
      "i",
    );
    const m = re.exec(text);
    if (m && m[1]) {
      const val = m[1].trim();
      if (val.length > 2) return val;
    }
  }
  return null;
}

function extractOfficialName(doc: RawDoc, cleaned: string): string {
  // Try a "NOME COMERCIAL:" / "PRODUTO:" / "NOME DO PRODUTO:" line first.
  const explicit = extractSection(cleaned, [
    "NOME COMERCIAL",
    "NOME DO PRODUTO",
    "PRODUTO",
    "NOME",
  ]);
  if (explicit && explicit.length < 120) {
    return explicit.split("\n")[0].trim();
  }
  // Otherwise, use prettified title (already stored in doc.title).
  return doc.title.replace(/\s*\[[^\]]+\]\s*/g, "").trim() || doc.filename;
}

function extractPackage(cleaned: string): string | null {
  const s = extractSection(cleaned, ["EMBALAGEM", "APRESENTAÇÃO", "APRESENTACAO"]);
  if (s) return s.split("\n")[0].trim();
  // Fallback: capture "20Kg", "10 kg", "25 kg" near top
  const m = cleaned.match(/\b(\d{1,3})\s*[Kk]g\b/);
  return m ? `${m[1]} kg` : null;
}

export function parseCandidate(doc: RawDoc): ProductCandidate | null {
  if (!doc.content) return null;
  const kind = detectKind(doc.source_path, doc.filename);
  if (kind === "outro") return null;

  const cleaned = stripSourceHeader(doc.content);
  const official_name = extractOfficialName(doc, cleaned);
  if (!official_name) return null;

  const species = detectSpecies(doc.source_path);
  const composition = extractSection(cleaned, [
    "COMPOSIÇÃO",
    "COMPOSICAO",
    "COMPOSIÇÃO BÁSICA",
    "INGREDIENTES",
  ]);
  const guarantee_levels = extractSection(cleaned, [
    "NÍVEIS DE GARANTIA",
    "NIVEIS DE GARANTIA",
    "NÍVEIS DE GARANTIAS",
    "GARANTIAS",
  ]);
  const indication = extractSection(cleaned, [
    "INDICAÇÃO",
    "INDICACAO",
    "INDICAÇÕES",
    "INDICADO PARA",
    "PÚBLICO ALVO",
    "PUBLICO ALVO",
  ]);
  const consumption = extractSection(cleaned, [
    "CONSUMO",
    "CONSUMO MÉDIO",
    "CONSUMO MEDIO",
    "CONSUMO DIÁRIO",
  ]);
  const usage_instructions = extractSection(cleaned, [
    "MODO DE USO",
    "MODO DE USAR",
    "INSTRUÇÕES DE USO",
    "INSTRUCOES DE USO",
    "FORMA DE USO",
  ]);
  const description =
    extractSection(cleaned, ["DESCRIÇÃO", "DESCRICAO", "APRESENTAÇÃO DO PRODUTO"]) ||
    (kind === "folder" ? cleaned.trim().slice(0, 600) || null : null);
  const animal_phase = extractSection(cleaned, [
    "FASE ANIMAL",
    "CATEGORIA ANIMAL",
    "FASE",
    "CATEGORIA",
  ]);
  const package_weight = extractPackage(cleaned);

  const candidate: ProductCandidate = {
    official_name,
    slug: toSlug(official_name),
    description,
    category: doc.subcategory || doc.category || null,
    species,
    animal_phase,
    package_weight,
    indication,
    consumption,
    usage_instructions,
    composition,
    guarantee_levels,
    source_document: doc.id,
    missing_fields: [],
    raw_kind: kind,
  };

  const requiredCheck: Array<[keyof ProductCandidate, unknown]> = [
    ["composition", composition],
    ["guarantee_levels", guarantee_levels],
    ["indication", indication],
    ["package_weight", package_weight],
  ];
  candidate.missing_fields = requiredCheck.filter(([, v]) => !v).map(([k]) => String(k));

  return candidate;
}

/** Merge two candidates for the same product (same slug) coming from
 *  different documents (typically RTPI + descritivo). Returns the merged
 *  candidate and a list of divergences (same field, different non-null values). */
export function mergeCandidates(a: ProductCandidate, b: ProductCandidate): {
  merged: ProductCandidate;
  divergences: Array<{ field: string; a: string; b: string }>;
} {
  const fields: (keyof ProductCandidate)[] = [
    "description",
    "category",
    "species",
    "animal_phase",
    "package_weight",
    "indication",
    "consumption",
    "usage_instructions",
    "composition",
    "guarantee_levels",
  ];
  const merged: ProductCandidate = { ...a };
  const divergences: Array<{ field: string; a: string; b: string }> = [];
  for (const f of fields) {
    const av = a[f] as string | null;
    const bv = b[f] as string | null;
    if (!av && bv) (merged[f] as unknown) = bv;
    else if (av && bv && normalizeName(av) !== normalizeName(bv)) {
      divergences.push({ field: String(f), a: av, b: bv });
    }
  }
  merged.missing_fields = fields.filter((f) => !merged[f]).map(String);
  return { merged, divergences };
}
