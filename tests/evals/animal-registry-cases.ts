/** Deterministic intent/routing evals; animal facts still require live source evidence. */
export const animalRegistryCases = [
  { message: "GTRT 2551", intent: "animal_registry", web: true, codes: ["GTRT 2551"] },
  {
    message: "Qual a raça do gtrt-2551?",
    intent: "animal_registry",
    web: true,
    codes: ["GTRT 2551"],
  },
  { message: "gtrt2551", intent: "animal_registry", web: true, codes: ["GTRT 2551"] },
  {
    message: "Consulte na ABCZ GTRT.2551",
    intent: "animal_registry",
    web: true,
    codes: ["GTRT 2551"],
  },
  {
    message: "Genealogia GTRT 2551 e GTRT 2552",
    intent: "animal_registry",
    web: true,
    codes: ["GTRT 2551", "GTRT 2552"],
  },
  { message: "registro RGN 2551", intent: "animal_registry", web: false, codes: [] },
  { message: "Consulte RGD 2551", intent: "animal_registry", web: false, codes: [] },
  {
    message: "Como descobrir a raça pelo código?",
    intent: "animal_registry",
    web: false,
    codes: [],
  },
  { message: "Tenho 100 bois de 420 kg", intent: "general_conversation", web: false, codes: [] },
  { message: "Qual o preço do DuKamp 40 S?", intent: "internal_price", web: false, codes: [] },
] as const;
