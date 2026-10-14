import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { auditUserMemoryReset } from "@/lib/memory-reset.functions";
import { USER_MEMORY_EPOCH } from "@/lib/chat/memory-reset";
export function MemoryResetAuditPanel() {
  const audit = useServerFn(auditUserMemoryReset);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    setError("");
    try {
      setReport(JSON.stringify(JSON.parse(await audit()), null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conferência.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">Memória dos usuários reiniciada</h2>
      <p className="text-sm text-muted-foreground">
        Conversas e lembranças da geração anterior ficam fora do contexto da IA. As próximas
        mensagens começam uma nova memória. O conhecimento dos produtos permanece disponível.
      </p>
      <p className="text-xs text-muted-foreground">Geração: {USER_MEMORY_EPOCH}</p>
      <button disabled={busy} onClick={verify} className="rounded border px-3 py-2 text-sm">
        {busy ? "Conferindo memória…" : "Conferir reinício de memória"}
      </button>
      {report && (
        <pre
          aria-label="Conferência do reinício de memória"
          className="overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs"
        >
          {report}
        </pre>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
