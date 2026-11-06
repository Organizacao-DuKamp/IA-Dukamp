// Local preview only: no real users, credentials or external services.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimalProfileDetails } from "../../src/components/guardian/AnimalProfileDetails";
import { AnimalProfileFields } from "../../src/components/guardian/AnimalProfileFields";
import {
  animalFormValues,
  type AnimalProfile,
  type PedigreeNode,
} from "../../src/lib/guardian/animal-profile";
import { pedigreeTreeNodes } from "../../src/lib/guardian/pedigree-tree";
import "../../src/styles.css";

const pedigree: PedigreeNode[] = pedigreeTreeNodes({}, 4)
  .filter((n) => n.generation && !["sire.dam.dam.sire", "sire.dam.dam.dam"].includes(n.path))
  .map((n, i) => ({
    relation: n.path,
    code: `TEST ${100 + i}`,
    name: ["REM DANUT", "MATRIZ DE EXEMPLO", "3898 FIV KATISPERA", "SULAMITA DA FAZENDA"][i % 4],
  }));
const animal: AnimalProfile = {
  code: "EXEMPLO 340",
  name: "ANTHONY DA FAZENDA",
  registry: "EXEMPLO 340",
  breed: "Nelore",
  sex: "male",
  sire: pedigree.find((n) => n.relation === "sire")!.code,
  dam: pedigree.find((n) => n.relation === "dam")!.code,
  pedigree,
  birthDate: "2023-07-15",
};
export function Preview() {
  const [values, setValues] = useState(animalFormValues(animal));
  const [edit, setEdit] = useState(false);
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-xl font-bold">Ficha do animal</h1>
      <button className="mt-3 rounded-lg border px-4 py-2 text-sm" onClick={() => setEdit(!edit)}>
        {edit ? "Ver ficha" : "Editar ficha"}
      </button>
      {edit ? (
        <AnimalProfileFields values={values} onChange={setValues} disabled={false} />
      ) : (
        <AnimalProfileDetails
          animal={{
            ...animal,
            sex: "male",
            weights: [],
            source: {
              actor: "000000000000000",
              messageId: "fixture",
              at: "2026-11-06T12:00:00Z",
              confirmed: true,
            },
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
