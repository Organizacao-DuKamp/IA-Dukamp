import { z } from "zod";
import { AnimalProfileSchema, sameAnimalRegistry, type AnimalProfile } from "./animal-profile.ts";
import type { FarmBook } from "./schema.ts";
import { fold } from "./book.ts";
export const ImportProfileSchema = AnimalProfileSchema.partial();
export type ImportProfile = z.infer<typeof ImportProfileSchema>;
export interface ImportRow {
  id: string;
  batch_id: string;
  source_id: string;
  page: number;
  ordinal: number;
  profile: ImportProfile;
  issues: string[];
  status: string;
  update_fields: Array<keyof AnimalProfile>;
  result?: string;
}
export interface ImportSource {
  id: string;
  batch_id: string;
  message_id: string;
  digest: string;
  filename: string;
  mime: string;
  data_base64?: string;
  status: string;
  pages: number | null;
  completed_pages: number;
  error: string | null;
  attempts: number;
}
export interface ImportBatch {
  id: string;
  phone_number: string;
  property_id: string;
  revision: number;
  status: string;
  instruction: string;
  view_state: ImportView;
  report: Record<string, number>;
  lease_token: string;
  final_revision: number;
}
export interface ImportView {
  query?: string;
  sex?: "male" | "female";
  year?: string;
  sort?: "code" | "rgn" | "name";
  page?: number;
  duplicates?: boolean;
  unidentified?: boolean;
}
export function identityKey(p: ImportProfile) {
  return fold(p.code ?? "").replace(/[^a-z0-9]/g, "");
}
export function importIssues(p: ImportProfile, book?: FarmBook) {
  const issues: string[] = [];
  const parsed = ImportProfileSchema.safeParse(p);
  if (!parsed.success)
    return [
      "Campos inválidos: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", ") +
        ". Confira os valores antes de aprovar.",
    ];
  if (!p.code?.trim()) issues.push("Sem identificação confiável; informe código ou registro.");
  if (!ImportProfileSchema.safeParse(p).success)
    issues.push("Confira os campos e as datas deste registro.");
  if (p.birthDate && p.birthDate > new Date().toISOString().slice(0, 10))
    issues.push("Nascimento no futuro.");
  if (
    p.pedigree?.some(
      (n) =>
        (n.relation === "sire" && p.sire && n.code !== p.sire) ||
        (n.relation === "dam" && p.dam && n.code !== p.dam),
    )
  )
    issues.push("Genealogia diverge dos pais informados.");
  if (book && p.code) {
    const matches = matchingAnimals(p, book);
    if (matches.length > 1) issues.push("Identificação corresponde a mais de uma ficha existente.");
  }
  return issues;
}
export function matchingAnimals(p: ImportProfile, book: FarmBook) {
  return book.animals.filter((a) => identityKey(a) === identityKey(p) || sameAnimalRegistry(a, p));
}
export function prepareImportRow(row: ImportRow, book: FarmBook) {
  const issues = importIssues(row.profile, book);
  if (issues.length) return { status: "error", result: issues.join(" ") };
  const p = AnimalProfileSchema.parse(row.profile),
    matches = matchingAnimals(p, book),
    existing = matches[0];
  if (matches.length > 1)
    return { status: "error", result: "Identificação ambígua; revise no painel." };
  if (existing) {
    // A shared local code never permits replacing a contradictory official registry.
    if (
      (p.rgn && existing.rgn && !sameAnimalRegistry(existing, p)) ||
      (p.registry &&
        existing.registry &&
        identityKey({ code: p.registry }) !== identityKey({ code: existing.registry }))
    )
      return { status: "error", result: "Código local coincide, mas o registro oficial diverge." };
    const fields = Object.keys(p).filter(
      (k) =>
        k !== "code" &&
        JSON.stringify(p[k as keyof AnimalProfile]) !==
          JSON.stringify(existing[k as keyof AnimalProfile]),
    ) as Array<keyof AnimalProfile>;
    const updates = row.update_fields;
    if (!updates.length)
      return {
        status: "duplicate",
        result: fields.length
          ? "Já cadastrado; dados preservados. Escolha os campos para atualizar na revisão."
          : "Já cadastrado com estes dados.",
      };
    const selected = Object.fromEntries(
      updates.filter((k) => k !== "code" && p[k] !== undefined).map((k) => [k, p[k]]),
    );
    if (!Object.keys(selected).length)
      return {
        status: "duplicate",
        result: "Nenhum campo disponível selecionado para atualização.",
      };
    if (
      selected.pedigree &&
      (!updates.includes("sire") || !updates.includes("dam")) &&
      (p.sire !== existing.sire || p.dam !== existing.dam)
    )
      return { status: "error", result: "Selecione pai e mãe junto da genealogia divergente." };
    return {
      status: "updated",
      result: "Campos selecionados atualizados.",
      action: { kind: "animal" as const, ...selected, code: existing.code },
    };
  }
  return {
    status: "created",
    result: "Animal cadastrado.",
    action: { kind: "animal" as const, ...p },
  };
}
export function filterImportRows(rows: ImportRow[], view: ImportView) {
  const filtered = rows.filter(
    (r) =>
      (!view.query || fold(JSON.stringify(r.profile)).includes(fold(view.query))) &&
      (!view.sex || r.profile.sex === view.sex) &&
      (!view.year || r.profile.birthDate?.startsWith(view.year)) &&
      (!view.duplicates || r.status === "duplicate" || r.result?.startsWith("Já cadastrado")) &&
      (!view.unidentified || !r.profile.code),
  );
  return filtered.sort((a, b) =>
    String(a.profile[view.sort ?? "code"] ?? "").localeCompare(
      String(b.profile[view.sort ?? "code"] ?? ""),
      "pt-BR",
      { numeric: true },
    ),
  );
}
export function importTotals(rows: ImportRow[]) {
  return {
    identified: rows.length,
    validated: rows.filter((r) => !r.issues.length).length,
    created: rows.filter((r) => r.status === "created").length,
    updated: rows.filter((r) => r.status === "updated").length,
    duplicates: rows.filter(
      (r) => r.status === "duplicate" || r.result?.startsWith("Já cadastrado"),
    ).length,
    pending: rows.filter((r) => ["review", "error"].includes(r.status)).length,
    excluded: rows.filter((r) => r.status === "excluded").length,
  };
}
export function importCsv(rows: ImportRow[]) {
  const fields = [
    "code",
    "name",
    "registrySeries",
    "rgn",
    "rgd",
    "sex",
    "birthDate",
    "breed",
    "category",
    "sire",
    "dam",
    "notes",
  ] as const;
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      fields.map(cell).join(";"),
      ...rows.map((r) =>
        [...fields.map((k) => r.profile[k]), `página ${r.page}`, r.status].map(cell).join(";"),
      ),
    ]
      .join("\r\n")
      .replace('"notes"\r\n', '"notes";"Origem";"Situação"\r\n')
  );
}

export function preparationImportView(text: string, prior: ImportView = {}): ImportView {
  const t = fold(text),
    view = { ...prior };
  if (/femeas?/.test(t)) view.sex = "female";
  else if (/machos?/.test(t)) view.sex = "male";
  const year = t.match(/nascid\w* (?:em|no ano de) (20\d{2})/);
  if (year) view.year = year[1];
  return view;
}
