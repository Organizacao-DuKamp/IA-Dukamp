import { useEffect, useState } from "react";
import { guardianOperationTraces } from "@/lib/guardian.functions";
import type { GuardianTrace } from "@/lib/guardian/trace";
export function GuardianOperationLog({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<Array<{ id: string; at: string; trace: GuardianTrace }>>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]);
    setError("");
    guardianOperationTraces({ data: { id: propertyId } })
      .then((r) => {
        if (active) setRows(r);
      })
      .catch(() => {
        if (active) setError("Diagnósticos indisponíveis ou sem permissão.");
      });
    return () => {
      active = false;
    };
  }, [propertyId]);
  const status = {
    completed: "Concluída",
    pending: "Aguardando dados",
    rejected: "Rejeitada",
    error: "Erro de validação/execução",
    cancelled: "Cancelada",
    replay: "Reenvio com recibo",
  };
  return (
    <section className="rounded-xl border p-5">
      <h2 className="font-semibold">Operações da IA</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Interpretação, validação e recibos das últimas 50 operações. A conversa original permanece
        no histórico de IA autorizado.
      </p>
      {error && <p role="alert">{error}</p>}
      {!rows.length && !error && (
        <p className="mt-3 text-sm">Nenhum diagnóstico desta versão disponível.</p>
      )}
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <details className="rounded border p-3 text-sm">
              <summary>
                {new Date(r.at).toLocaleString("pt-BR")} · {status[r.trace.status]} ·{" "}
                {r.trace.actionKinds.join(", ") || "Esclarecimento"}
              </summary>
              <dl className="mt-2 break-all">
                <dt>Operação</dt>
                <dd>{r.trace.operationId}</dd>
                <dt>Etapa</dt>
                <dd>{r.trace.stage}</dd>
                <dt>Mensagem de origem</dt>
                <dd>{r.trace.sourceMessageId}</dd>
                <dt>Recibo</dt>
                <dd>{r.trace.receiptMessageId}</dd>
                {r.trace.reason && (
                  <>
                    <dt>Motivo</dt>
                    <dd>{r.trace.reason}</dd>
                  </>
                )}
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
