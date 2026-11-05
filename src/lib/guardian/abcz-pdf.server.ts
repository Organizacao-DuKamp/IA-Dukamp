import { getDocumentProxy } from "unpdf";
import { AnimalProfileSchema, type AnimalProfile, type PedigreeNode } from "./animal-profile.ts";
import type { RegistryLookup } from "./animal-registry.ts";

export const MAX_ABCZ_PDF = 5 * 1024 * 1024;
const unsupported = () =>
  Error(
    "PDF não reconhecido. Use o certificado digital ABCZ com texto e árvore de quatro gerações. PDFs digitalizados ou com outro layout precisam de preenchimento manual.",
  );
type PositionedText = { text: string; x: number; y: number };

/** Coordinates belong to the verified landscape ABCZ certificate, in PDF points.
 * Empty cells are preserved by position, never by the sequence of extracted names. */
export function parseAbczCertificate(
  items: PositionedText[],
  width: number,
  height: number,
): Partial<AnimalProfile> {
  if (Math.abs(width - 842) > 2 || Math.abs(height - 595) > 2 || items.length > 3000)
    throw unsupported();
  const region = (x: number, y: number, w: number, h: number) =>
    items
      .filter((i) => i.x >= x && i.x < x + w && i.y >= y && i.y < y + h)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((i) => i.text.trim())
      .filter(Boolean);
  const anchor = (label: string, x: number, y: number) =>
    items.some((i) => i.text === label && Math.abs(i.x - x) < 3 && Math.abs(i.y - y) < 3);
  if (
    !anchor("Nome", 73.5, 135.2) ||
    !anchor("Paterna", 217.5, 135.2) ||
    !anchor("Materna", 217.5, 338.2) ||
    !anchor("Observações", 73.5, 354.7) ||
    !items.some((i) => i.text === "REGISTRO GENEALÓGICO DE NASCIMENTO")
  )
    throw unsupported();
  const single = (x: number, y: number, w = 140, h = 5) => {
    const parts = region(x, y, w, h);
    if (parts.length > 1) throw unsupported();
    return parts[0];
  };
  const registryLine = single(73, 150, 140),
    match = registryLine?.match(/^Registro:\s*([A-Z]{1,6})\s+(\d+[A-Z]?)$/);
  if (!match) throw unsupported();
  const profile: Partial<AnimalProfile> = {
    code: `${match[1]} ${match[2]}`,
    registry: `${match[1]} ${match[2]}`,
    registrySeries: match[1],
    rgn: match[2],
  };
  const fields = {
    name: [73, 142, 140],
    breed: [73, 191, 140],
    category: [73, 215, 90],
    coat: [165, 215, 50],
    documentOwner: [73, 263, 140],
    documentFarm: [73, 287, 140],
    documentMunicipality: [73, 311, 90],
    documentState: [165, 311, 40],
    documentBreeder: [73, 335, 140],
  } as const;
  for (const [key, [x, y, w]] of Object.entries(fields)) {
    const value = single(x, y, w);
    if (value) (profile as Record<string, unknown>)[key] = value;
  }
  const date = single(73, 239, 90);
  if (date) {
    const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    if (!d) throw unsupported();
    profile.birthDate = `${d[3]}-${d[2]}-${d[1]}`;
  }
  const sex = single(165, 239, 40);
  if (sex && !["M", "F"].includes(sex)) throw unsupported();
  if (sex) profile.sex = sex === "M" ? "male" : "female";
  const notes = region(73, 358, 140, 170).join("\n");
  if (notes) profile.notes = notes;
  const pedigree: PedigreeNode[] = [];
  for (const [side, top, step] of [
    ["sire", 144.2, 24.25],
    ["dam", 346.7, 24],
  ] as const) {
    for (let depth = 1; depth <= 4; depth++) {
      const count = 2 ** (depth - 1),
        cellHeight = (step * 8) / count;
      for (let index = 0; index < count; index++) {
        const lines = region(
          219 + (depth - 1) * 144,
          top + index * cellHeight - 2,
          143,
          cellHeight,
        );
        if (!lines.length) continue;
        // A cell must contain a name and an identification. Do not guess incomplete cells.
        if (lines.length !== 2) throw unsupported();
        const relation = [
          side,
          ...Array.from({ length: depth - 1 }, (_, bit) =>
            (index >> (depth - 2 - bit)) & 1 ? "dam" : "sire",
          ),
        ].join(".");
        pedigree.push({ relation, name: lines[0], code: lines[1] });
      }
    }
  }
  if (!pedigree.some((n) => n.relation === "sire") || !pedigree.some((n) => n.relation === "dam"))
    throw unsupported();
  // Each returned descendant must have its connecting parent in the document.
  for (const node of pedigree)
    if (
      node.relation.includes(".") &&
      !pedigree.some((p) => p.relation === node.relation.slice(0, node.relation.lastIndexOf(".")))
    )
      throw unsupported();
  profile.pedigree = pedigree;
  profile.sire = pedigree.find((n) => n.relation === "sire")!.code;
  profile.dam = pedigree.find((n) => n.relation === "dam")!.code;
  profile.documentSource = "PDF ABCZ · Certificado de Registro Genealógico de Nascimento";
  return AnimalProfileSchema.partial().parse(profile);
}

export async function importAbczPdf(bytes: Uint8Array): Promise<RegistryLookup> {
  if (
    bytes.length > MAX_ABCZ_PDF ||
    !new TextDecoder().decode(bytes.slice(0, 5)).startsWith("%PDF-")
  )
    throw unsupported();
  const options = { isEvalSupported: false, useSystemFonts: false, verbosity: 0 };
  const pdf = await getDocumentProxy(bytes, options);
  try {
    if (pdf.numPages !== 1) throw unsupported();
    const page = await pdf.getPage(1),
      viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PositionedText[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      items.push({ text: item.str, x, y });
    }
    return {
      profile: parseAbczCertificate(items, viewport.width, viewport.height),
      provider: "ABCZ",
      sourceUrl: "",
      consultedAt: new Date().toISOString(),
      sourceKind: "pdf",
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
