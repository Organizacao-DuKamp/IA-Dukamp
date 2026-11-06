import { z } from "zod";

const text = z.string().trim().min(1).max(160);
const weight = z.number().finite().positive().max(2000);
const money = z.number().int().nonnegative().max(1e12);
export const PedigreeNodeSchema = z
  .object({
    relation: z.string().regex(/^(?:sire|dam)(?:\.(?:sire|dam)){0,3}$/),
    code: text,
    name: text.optional(),
    registrySeries: text.optional(),
    rgn: text.optional(),
    rgd: text.optional(),
    breed: text.optional(),
    birthDate: z.iso.date().optional(),
    sex: z.enum(["male", "female", "unknown"]).optional(),
  })
  .strict();
export type PedigreeNode = z.infer<typeof PedigreeNodeSchema>;

/** Optional additions preserve every existing animal and WhatsApp action. */
export const AnimalProfileShape = {
  code: text,
  name: text.optional(),
  earTag: text.optional(),
  electronicTag: text.optional(),
  registry: text.optional(),
  registrySeries: text.optional(),
  rgn: text.optional(),
  rgd: text.optional(),
  category: text.optional(),
  documentOwner: text.optional(),
  documentFarm: text.optional(),
  documentMunicipality: text.optional(),
  documentState: text.optional(),
  documentBreeder: text.optional(),
  documentSource: text.optional(),

  sire: text.optional(),
  dam: text.optional(),
  kinship: text.optional(),
  pedigree: z.array(PedigreeNodeSchema).max(30).optional(),
  status: z.enum(["active", "sold", "dead", "transferred"]).optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  breed: text.optional(),
  coat: text.optional(),
  birthDate: z.iso.date().optional(),
  lot: text.optional(),
  responsible: text.optional(),
  pasture: text.optional(),
  pen: text.optional(),
  origin: text.optional(),
  destination: text.optional(),
  entryDate: z.iso.date().optional(),
  weaningDate: z.iso.date().optional(),
  entryWeightKg: weight.optional(),
  currentWeightKg: weight.optional(),
  dailyIntakeKg: z.number().finite().nonnegative().max(1000).optional(),
  purchasePriceCents: money.optional(),
  salePriceCents: money.optional(),
  seller: text.optional(),
  carcassPercent: z.number().finite().min(0).max(100).optional(),
  notes: z.string().trim().max(1500).optional(),
};
export const AnimalProfileSchema = z.object(AnimalProfileShape).strict();
export const animalClearableFields = Object.keys(AnimalProfileShape).filter(
  (key) => !["code", "sex", "currentWeightKg"].includes(key),
) as Array<Exclude<keyof AnimalProfile, "code" | "sex" | "currentWeightKg">>;
export const AnimalActionSchema = z
  .object({
    kind: z.literal("animal"),
    ...AnimalProfileShape,
    clear: z.array(z.enum(animalClearableFields)).max(animalClearableFields.length).optional(),
  })
  .strict();
export type AnimalProfile = z.infer<typeof AnimalProfileSchema>;

export const animalFieldLabels: Record<keyof AnimalProfile, string> = {
  code: "Identificação do animal",
  name: "Nome",
  earTag: "Brinco",
  electronicTag: "Brinco eletrônico",
  registry: "Registro",
  registrySeries: "Série ABCZ",
  rgn: "RGN",
  rgd: "RGD",
  category: "Categoria",
  documentOwner: "Proprietário (documento)",
  documentFarm: "Fazenda (documento)",
  documentMunicipality: "Município (documento)",
  documentState: "UF (documento)",
  documentBreeder: "Criador (documento)",
  documentSource: "Fonte (documento)",

  sire: "Pai",
  dam: "Mãe",
  kinship: "Parentesco",
  pedigree: "Genealogia",
  status: "Status",
  sex: "Sexo",
  breed: "Raça",
  coat: "Pelagem",
  birthDate: "Nascimento",
  lot: "Lote",
  responsible: "Responsável",
  pasture: "Pasto",
  pen: "Piquete / curral",
  origin: "Origem",
  destination: "Destino",
  entryDate: "Entrada",
  weaningDate: "Desmame",
  entryWeightKg: "Peso de entrada (kg)",
  currentWeightKg: "Peso atual (kg)",
  dailyIntakeKg: "Consumo diário (kg)",
  purchasePriceCents: "Valor de compra",
  salePriceCents: "Valor de venda",
  seller: "Pessoa que vendeu",
  carcassPercent: "Carcaça (%)",
  notes: "Observações",
};
export function animalFieldValue(key: keyof AnimalProfile, value: unknown): string {
  if (value === undefined || value === null || value === "") return "Não informado";
  if (key === "pedigree") return `${(value as PedigreeNode[]).length} ascendentes informados`;
  if (key === "purchasePriceCents" || key === "salePriceCents")
    return (Number(value) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (key === "sex")
    return (
      ({ male: "Macho", female: "Fêmea", unknown: "Não informado" } as Record<string, string>)[
        String(value)
      ] ?? String(value)
    );
  if (key === "status")
    return (
      (
        { active: "Ativo", sold: "Vendido", dead: "Morto", transferred: "Transferido" } as Record<
          string,
          string
        >
      )[String(value)] ?? String(value)
    );
  if (/Date$/.test(key)) return String(value).split("-").reverse().join("/");
  return typeof value === "number"
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
    : String(value);
}
/** Familiar kinship labels; the tree's paths retain the precise ancestry links. */
export function pedigreeLabel(path: string) {
  if (!path) return "Animal";
  const parts = path.split(".");
  if (parts.length === 1) return path === "sire" ? "Pai" : "Mãe";
  const male = parts.at(-1) === "sire";
  const degree =
    {
      2: male ? "Avô" : "Avó",
      3: male ? "Bisavô" : "Bisavó",
      4: male ? "Trisavô" : "Trisavó",
    }[parts.length] ?? "Ascendente";
  const side = parts[0] === "sire" ? (male ? "paterno" : "paterna") : male ? "materno" : "materna";
  return `${degree} ${side}`;
}

const numberFields = new Set([
  "entryWeightKg",
  "currentWeightKg",
  "dailyIntakeKg",
  "carcassPercent",
]);
export function animalActionFromForm(values: Record<string, string>) {
  const profile: Record<string, unknown> = {};
  for (const key of Object.keys(AnimalProfileShape)) {
    const value = values[key]?.trim();
    if (value === undefined || value === "") continue;
    if (key === "pedigree") profile[key] = JSON.parse(value);
    else if (numberFields.has(key)) profile[key] = Number(value.replace(",", "."));
    else if (key === "purchasePriceCents" || key === "salePriceCents")
      profile[key] = Math.round(Number(value.replace(",", ".")) * 100);
    else profile[key] = value;
  }
  // Editing a parent removes that imported branch rather than retaining stale ancestry.
  if (Array.isArray(profile.pedigree)) {
    const roots = profile.pedigree as PedigreeNode[];
    profile.pedigree = roots.filter((node) => {
      const side = node.relation.split(".")[0];
      const root = roots.find((item) => item.relation === side);
      return (
        !root ||
        profile[side] === root.code ||
        profile[side] === root.name ||
        profile[side] === `${root.code} · ${root.name}`
      );
    });
  }
  const clear = animalClearableFields.filter(
    (key) => Object.prototype.hasOwnProperty.call(values, key) && !values[key]?.trim(),
  );
  return AnimalActionSchema.parse({
    kind: "animal",
    ...profile,
    ...(clear.length ? { clear } : {}),
  });
}
export function animalFormValues(profile: Partial<AnimalProfile>) {
  return Object.fromEntries(
    Object.keys(AnimalProfileShape).flatMap((key) => {
      const value = profile[key as keyof AnimalProfile];
      if (value === undefined) return [];
      return [
        [
          key,
          key === "pedigree"
            ? JSON.stringify(value)
            : /PriceCents$/.test(key)
              ? String(Number(value) / 100)
              : String(value),
        ],
      ];
    }),
  );
}

/** A series is part of the identity: DKN and DUKN must never be conflated. */
export function sameAnimalRegistry(a: Partial<AnimalProfile>, b: Partial<AnimalProfile>) {
  const identity = (p: Partial<AnimalProfile>) => {
    const combined = (p.registry || p.code || "")
      .toUpperCase()
      .match(/^([A-Z]{1,6})[ .-]+(\d+[A-Z]?)$/);
    const series = (p.registrySeries || combined?.[1] || "").trim().toUpperCase();
    const rgn = (p.rgn || combined?.[2] || "")
      .trim()
      .toUpperCase()
      .replace(/^0+(?=\d)/, "");
    return series && rgn ? `${series}:${rgn}` : null;
  };
  return !!identity(a) && identity(a) === identity(b);
}
