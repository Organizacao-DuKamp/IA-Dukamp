import { z } from "zod";
import type { AnimalProfile } from "./animal-profile.ts";

export const ABCZ_PUBLIC_URL =
  "https://www.abcz.org.br/produtos-e-servicos/consulta-publica-de-animais";
export const RegistryQuerySchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("rgn"),
      series: z.string().trim().max(6).optional(),
      rgn: z.string().trim().max(24).optional(),
      code: z.string().trim().max(40).optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("rgd"),
      rgd: z.string().trim().min(1).max(24),
      breedCode: z.string().trim().min(1).max(12),
      category: z.string().trim().min(1).max(12),
      sex: z.enum(["male", "female"]),
    })
    .strict(),
]);
export type RegistryQuery = z.infer<typeof RegistryQuerySchema>;
export type NormalizedRegistryQuery =
  | { mode: "rgn"; series: string; rgn: string }
  | Extract<RegistryQuery, { mode: "rgd" }>;
export type RegistryLookup = {
  profile: Partial<AnimalProfile>;
  provider: "ABCZ";
  sourceUrl: string;
  consultedAt: string;
};
export function normalizeRegistryQuery(input: RegistryQuery): NormalizedRegistryQuery {
  if (input.mode === "rgd") {
    if (
      ![input.rgd, input.breedCode, input.category].every((value) => /^[A-Z0-9 .-]+$/i.test(value))
    )
      throw Error("Informe os dados do RGD sem caracteres especiais.");
    return {
      ...input,
      rgd: input.rgd.toUpperCase(),
      breedCode: input.breedCode.toUpperCase(),
      category: input.category.toUpperCase(),
    };
  }
  let series = input.series?.toUpperCase() ?? "",
    rgn = input.rgn?.toUpperCase() ?? "";
  const combined = (rgn || input.code || "")
    .toUpperCase()
    .match(/^([A-Z]{1,6})[ .-]*(\d{1,10}[A-Z]{0,2})$/);
  if (combined) {
    if (series && series !== combined[1])
      throw Error("A série e o RGN informados não correspondem. Confira a identificação.");
    series = combined[1];
    rgn = combined[2];
  }
  if (!series && /^\d{1,10}[A-Z]{0,2}$/.test(rgn)) {
    const fromCode = input.code?.toUpperCase().match(/^([A-Z]{1,6})[ .-]*(\d{1,10}[A-Z]{0,2})$/);
    if (fromCode && fromCode[2].replace(/^0+(?=\d)/, "") === rgn.replace(/^0+(?=\d)/, ""))
      series = fromCode[1];
  }
  if (!/^[A-Z]{1,6}$/.test(series) || !/^\d{1,10}[A-Z]{0,2}$/.test(rgn))
    throw Error(
      "Informe a série alfabética e o RGN, por exemplo DKN 404. Um número isolado não identifica o animal.",
    );
  return { mode: "rgn", series, rgn };
}
