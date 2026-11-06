// Synthetic, local-only UI fixture. No credentials, farm mutations or external requests.
import { createRoot } from "react-dom/client";
import { AnimalImports } from "../../src/components/guardian/AnimalImports";
import "../../src/styles.css";
const batch = "00000000-0000-4000-8000-000000000001";
window.fetch = async (_input, options) => {
  if (options?.method === "POST")
    return Response.json({ ok: true, message: "Correção de teste salva." });
  return Response.json({
    batch: { id: batch, revision: 4, status: "review" },
    rows: Array.from({ length: 5 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`,
      batch_id: batch,
      source_id: batch,
      page: i + 1,
      ordinal: i + 1,
      profile: {
        code: `DUKN ${340 + i}`,
        name:
          i === 1
            ? "Animal com nome muito longo para conferir no telefone do produtor"
            : "Animal de teste",
        sex: i % 2 ? "female" : "male",
        birthDate: "2024-07-15",
      },
      issues:
        i === 1 ? ["Identificação repetida com dados divergentes; confira as duas linhas."] : [],
      status: "review",
      update_fields: [],
    })),
    files: [
      {
        id: batch,
        filename: "relatório genealógico de todos os animais.pdf",
        mime: "application/pdf",
        status: "complete",
        completed_pages: 13,
      },
    ],
    total: 5,
    page: 1,
    totals: { identified: 5, validated: 4, created: 0, updated: 0, duplicates: 0, pending: 1 },
  });
};
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-5xl bg-slate-50 p-4">
    <AnimalImports farmName="Fazenda de teste" onImported={() => {}} />
  </main>,
);
