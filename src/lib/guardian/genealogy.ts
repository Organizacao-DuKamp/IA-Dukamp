import { z } from "zod";

export const GenealogyQuery = z
  .object({ registry: z.enum(["RGN", "RGD"]), code: z.string().trim().min(2).max(100) })
  .strict();
export const GenealogyEvidence = z
  .object({
    registry: z.enum(["RGN", "RGD"]),
    code: z.string().min(2).max(100),
    animal: z.string().max(160),
    sire: z.string().max(160).nullable(),
    dam: z.string().max(160).nullable(),
    source: z.url().refine((url) => new URL(url).protocol === "https:"),
    retrievedAt: z.iso.datetime(),
    authorization: z.string().min(1).max(200),
  })
  .strict();
/** No official API is configured. A connector must supply its authorization and sources. */
export interface GenealogyConnector {
  id: string;
  authorized: boolean;
  lookup(query: z.infer<typeof GenealogyQuery>): Promise<unknown>;
}
export async function lookupGenealogy(raw: unknown, connector?: GenealogyConnector) {
  const query = GenealogyQuery.parse(raw);
  if (!connector || !connector.authorized)
    return {
      status: "not_configured" as const,
      evidence: null,
      reason:
        "A consulta oficial depende de documentação e autorização do provedor. O registro informado pelo produtor não comprova registro oficial.",
    };
  try {
    const evidence = GenealogyEvidence.parse(await connector.lookup(query));
    if (
      evidence.registry !== query.registry ||
      evidence.code.toUpperCase() !== query.code.toUpperCase()
    )
      return { status: "mismatch" as const, evidence: null };
    return { status: "found" as const, evidence };
  } catch {
    return { status: "unavailable" as const, evidence: null };
  }
}
export function compareGenealogy(
  left: z.infer<typeof GenealogyEvidence>,
  right: z.infer<typeof GenealogyEvidence>,
) {
  GenealogyEvidence.parse(left);
  GenealogyEvidence.parse(right);
  const known = (value: string | null) =>
    value
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  return {
    sameSire: left.sire && right.sire ? known(left.sire) === known(right.sire) : null,
    sameDam: left.dam && right.dam ? known(left.dam) === known(right.dam) : null,
    sources: [left.source, right.source],
    limitation:
      "Comparação apenas dos pais identificados nas fontes; não calcula consanguinidade ou mérito genético.",
  };
}
