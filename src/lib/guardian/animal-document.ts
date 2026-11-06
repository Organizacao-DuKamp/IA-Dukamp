import { z } from "zod";
import { AnimalActionSchema, AnimalProfileSchema, sameAnimalRegistry } from "./animal-profile.ts";
import type { FarmBook } from "./schema.ts";

// Created only by the server's deterministic PDF reader, never from a public request body.
export const AnimalDocumentSchema = z
  .object({
    profile: AnimalProfileSchema,
    sourceMessageId: z.string().min(1).max(128),
    sourceAt: z.iso.datetime(),
  })
  .strict();
export type AnimalDocument = z.infer<typeof AnimalDocumentSchema>;

export function animalDocumentAction(document: AnimalDocument, book: FarmBook) {
  const { profile } = AnimalDocumentSchema.parse(document);
  const registryMatch = book.animals.filter((animal) => sameAnimalRegistry(animal, profile));
  const codeMatch = book.animals.find(
    (animal) => animal.code.trim().toUpperCase() === profile.code.trim().toUpperCase(),
  );
  if (
    registryMatch.length > 1 ||
    (codeMatch && registryMatch.length && codeMatch !== registryMatch[0])
  )
    throw Error(
      "Há fichas diferentes com o código e o registro desse PDF. Confira a identificação no painel antes de importar.",
    );
  if (
    codeMatch &&
    !sameAnimalRegistry(codeMatch, profile) &&
    (codeMatch.registry || codeMatch.rgn || codeMatch.rgd)
  )
    throw Error(
      "O código desse PDF já pertence a uma ficha com outro registro. Confira a identificação no painel antes de importar.",
    );
  const existing = registryMatch[0] ?? codeMatch;
  const action = AnimalActionSchema.parse({
    kind: "animal",
    ...profile,
    code: existing?.code ?? profile.code,
  });
  const changed = Object.entries(action).filter(
    ([key, value]) =>
      key !== "kind" &&
      key !== "code" &&
      JSON.stringify(existing?.[key as keyof typeof existing]) !== JSON.stringify(value),
  );
  // Do not silently replace a previously filled value. Management fields absent from the
  // certificate remain untouched; repeated ancestors stay in their own pedigree paths.
  const needsReview =
    !!existing &&
    changed.some(([key]) => {
      const value = existing[key as keyof typeof existing];
      return (
        value !== undefined &&
        value !== "" &&
        value !== "unknown" &&
        (!Array.isArray(value) || value.length > 0)
      );
    });
  return { action, needsReview, unchanged: !!existing && !changed.length };
}
