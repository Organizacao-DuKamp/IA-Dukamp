import { createRoot } from "react-dom/client";
import { GuardianObservedProfiles } from "../../src/components/guardian/GuardianObservedProfiles";
import type { ObservedSummary, ObservedDetail } from "../../src/lib/guardian.functions";
import "../../src/styles.css";

const first = "00000000-0000-4000-8000-000000000001",
  second = "00000000-0000-4000-8000-000000000002";
const fact = (
  id: string,
  field: "city" | "herdTotal",
  value: string | number,
  quote: string,
  at: string,
) => ({
  id,
  field,
  value,
  source_message_id: "synthetic-" + id,
  source_excerpt: quote,
  source_question: null,
  source_at: at,
  effective_date: "2026-10-26",
});
const city = fact(
  "00000000-0000-4000-8000-000000000003",
  "city",
  "Tanabi",
  "Minha fazenda fica em Tanabi.",
  "2026-10-26T12:00:00Z",
);
const count = fact(
  "00000000-0000-4000-8000-000000000004",
  "herdTotal",
  38,
  "Agora tenho 38 bovinos.",
  "2026-10-26T13:00:00Z",
);
const previous = fact(
  "00000000-0000-4000-8000-000000000005",
  "herdTotal",
  40,
  "Tenho 40 bovinos.",
  "2026-10-26T12:00:00Z",
);
const profiles: ObservedSummary[] = [
  {
    id: first,
    phone: "5517000000000",
    name: "Propriedade de 5517000000000",
    updatedAt: count.source_at,
    facts: {
      city: { value: "Tanabi", effectiveDate: "2026-10-26", sourceAt: city.source_at },
      herdTotal: { value: 38, effectiveDate: "2026-10-26", sourceAt: count.source_at },
    },
  },
  {
    id: second,
    phone: "5517000000001",
    name: "Fazenda Teste",
    updatedAt: count.source_at,
    facts: { city: { value: "Poloni", effectiveDate: "2026-10-26", sourceAt: city.source_at } },
  },
];
const details: Record<string, ObservedDetail> = {
  [first]: {
    id: first,
    phone: profiles[0].phone,
    updatedAt: count.source_at,
    current: [city, count],
    history: [count, previous, city],
    partial: false,
  },
  [second]: {
    id: second,
    phone: profiles[1].phone,
    updatedAt: count.source_at,
    current: [{ ...city, value: "Poloni", source_excerpt: "Minha fazenda fica em Poloni." }],
    history: [{ ...city, value: "Poloni", source_excerpt: "Minha fazenda fica em Poloni." }],
    partial: false,
  },
};
async function loadDetail(id: string) {
  await new Promise((r) => setTimeout(r, id === first ? 100 : 20));
  return structuredClone(details[id]);
}
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-6xl p-4">
    <h1 className="mb-5 text-2xl font-semibold">Perfis da conversa</h1>
    <GuardianObservedProfiles profiles={profiles} partial={false} loadDetail={loadDetail} />
  </main>,
);
