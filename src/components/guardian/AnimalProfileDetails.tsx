import { AnimalPedigreeTree } from "./AnimalPedigreeTree";
import {
  animalFieldLabels,
  animalFieldValue,
  type AnimalProfile,
} from "@/lib/guardian/animal-profile";
import type { GuardianAnimal } from "@/lib/guardian/schema";

const groups: Array<[string, Array<keyof AnimalProfile>]> = [
  [
    "Identificação",
    [
      "name",
      "earTag",
      "electronicTag",
      "registry",
      "registrySeries",
      "rgn",
      "rgd",
      "category",
      "breed",
      "coat",
      "birthDate",
      "sex",
      "status",
    ],
  ],
  [
    "Manejo e localização",
    ["lot", "responsible", "pasture", "pen", "origin", "destination", "entryDate", "weaningDate"],
  ],
  [
    "Pesos e valores",
    [
      "entryWeightKg",
      "currentWeightKg",
      "dailyIntakeKg",
      "carcassPercent",
      "purchasePriceCents",
      "salePriceCents",
      "seller",
    ],
  ],
  ["Parentesco", ["kinship"]],
  [
    "Dados do documento ABCZ",
    [
      "documentOwner",
      "documentFarm",
      "documentMunicipality",
      "documentState",
      "documentBreeder",
      "documentSource",
    ],
  ],
];
export function AnimalProfileDetails({ animal }: { animal: GuardianAnimal }) {
  const profile = {
    ...animal,
    currentWeightKg: animal.weights.at(-1)?.weightKg ?? animal.currentWeightKg,
  };
  return (
    <div className="mt-4 space-y-4">
      {groups.map(([title, keys]) => {
        const filled = keys.filter((key) => profile[key] !== undefined && profile[key] !== "");
        return filled.length ? (
          <section key={title} className="rounded-xl bg-secondary/30 p-4">
            <h3 className="text-sm font-semibold">{title}</h3>
            <dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              {filled.map((key) => (
                <div key={key} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{animalFieldLabels[key]}</dt>
                  <dd className="mt-1 break-words font-medium">
                    {animalFieldValue(key, profile[key])}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null;
      })}
      {animal.sire || animal.dam || animal.pedigree?.length ? (
        <AnimalPedigreeTree animal={animal} />
      ) : null}
      {animal.notes && (
        <section className="rounded-xl bg-secondary/30 p-4">
          <h3 className="text-sm font-semibold">Observações</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{animal.notes}</p>
        </section>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Identificação e genealogia declaradas ou importadas para a ficha. O cadastro no aplicativo
        não substitui o certificado oficial da associação.
      </p>
    </div>
  );
}
