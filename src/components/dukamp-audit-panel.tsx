import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { auditDuKampKnowledge, testDuKampQuestion } from "@/lib/dukamp-knowledge.functions";

const questions = [
  "Posso dar Dukamp Protéico Seca para um bezerro de dois meses?",
  "Posso usar Dukamp 60/S nos meus ovinos?",
  "Posso colocar Núcleo Dukamp Confinamento 200 B puro no cocho?",
  "Dukamp Ração Total M deve ser dada duas ou cinco vezes por dia?",
  "O Protéico Águas AC é para a estação das águas?",
  "Quero comprar GI-33/190 que aparece no material.",
  "Vi uma versão antiga de Horse Power Gold que permite top dress. Vale para o núcleo atual?",
];
export function DuKampAuditPanel() {
  const audit = useServerFn(auditDuKampKnowledge),
    testQuestion = useServerFn(testDuKampQuestion);
  const [report, setReport] = useState("");
  const [question, setQuestion] = useState(questions[0]);
  const [answer, setAnswer] = useState<{
    reply: string;
    retrieval: unknown;
    checked_at: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function verify() {
    setBusy(true);
    setError(null);
    try {
      setReport(JSON.stringify(JSON.parse(await audit()), null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível conferir a importação.");
    } finally {
      setBusy(false);
    }
  }
  async function runQuestion() {
    setBusy(true);
    setError(null);
    try {
      setAnswer(JSON.parse(await testQuestion({ data: { question } })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao verificar a resposta.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">Conferência da importação Dukamp</h2>
      <p className="text-sm text-muted-foreground">
        Confira os registros realmente salvos, os originais, os vetores e as respostas com fontes.
        Esta conferência não concede liberação técnica.
      </p>
      <button disabled={busy} onClick={verify} className="rounded border px-3 py-2 text-sm">
        {busy ? "Conferindo…" : "Conferir importação Dukamp"}
      </button>
      {report && (
        <pre
          aria-label="Relatório da importação Dukamp"
          className="overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs"
        >
          {report}
        </pre>
      )}
      <label className="block text-sm">
        Cenário de verificação
        <select
          aria-label="Cenário de verificação Dukamp"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-1 w-full rounded border bg-background p-2"
        >
          {questions.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy} onClick={runQuestion} className="rounded border px-3 py-2 text-sm">
        Testar controles e fontes
      </button>
      {answer && (
        <div className="space-y-2">
          <p aria-label="Resposta do teste Dukamp" className="whitespace-pre-wrap text-sm">
            {answer.reply}
          </p>
          <details>
            <summary className="text-sm">Resultado da busca e referências</summary>
            <pre
              aria-label="Recuperação do teste Dukamp"
              className="overflow-auto whitespace-pre-wrap text-xs"
            >
              {JSON.stringify(answer.retrieval, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
