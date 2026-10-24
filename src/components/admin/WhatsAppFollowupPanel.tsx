import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  whatsappFollowupDetail,
  type WhatsAppFollowupDetail,
} from "@/lib/whatsapp/proactive.functions";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function WhatsAppFollowupPanel({ phone }: { phone: string }) {
  const detailFn = useServerFn(whatsappFollowupDetail);
  const [detail, setDetail] = useState<WhatsAppFollowupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load(resetFeedback = true) {
    setLoading(true);
    if (resetFeedback) setFeedback(null);
    try {
      const data = await detailFn({ data: { phone } });
      setDetail(data as WhatsAppFollowupDetail);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar a memória.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [phone]);

  const activeFacts = detail?.facts.filter((fact) => fact.status === "active") ?? [];
  const resolvedFacts = detail?.facts.filter((fact) => fact.status === "resolved") ?? [];
  const recentQueue = detail?.queue.slice(0, 8) ?? [];

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BellRing size={17} className="text-primary" />
            <h3 className="text-sm font-semibold">Memória e acompanhamento pelo WhatsApp</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Memórias extraídas ajudam a recuperar o contexto e precisam ser conferidas com as
            mensagens originais. Avisos agora dependem de eventos e autorização na Guardiã.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {feedback && (
        <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-xs">
          {feedback}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Acompanhamento</p>
          <p className="mt-1 text-sm font-medium">Slots diários desativados</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Memórias extraídas</p>
          <p className="mt-1 text-sm font-medium">{activeFacts.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Último contato proativo</p>
          <p className="mt-1 text-sm font-medium">{formatDate(detail?.profile?.lastProactiveAt)}</p>
        </div>
      </div>

      <Link to="/guardia" className="mt-4 inline-block text-sm font-semibold text-primary">
        Abrir Guardiã da Fazenda
      </Link>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Informações extraídas (não são cadastros confirmados)
          </h4>
          <div className="mt-2 space-y-2">
            {activeFacts.map((fact) => (
              <div
                key={fact.id}
                className="rounded-md border border-border bg-background p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{fact.subject}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">
                    ativa
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{fact.valueText}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  atualizada em {formatDate(fact.lastSeenAt)}
                </p>
              </div>
            ))}
            {activeFacts.length === 0 && !loading && (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Ainda não há uma informação ativa relevante para acompanhamento.
              </div>
            )}
            {resolvedFacts.length > 0 && (
              <details className="rounded-md border border-border bg-background p-3 text-xs">
                <summary className="cursor-pointer font-medium">
                  Situações resolvidas ({resolvedFacts.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {resolvedFacts.slice(0, 10).map((fact) => (
                    <div key={fact.id} className="text-muted-foreground">
                      <strong className="text-foreground">{fact.subject}:</strong> {fact.valueText}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico dos envios anteriores
          </h4>
          <div className="mt-2 space-y-2">
            {recentQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border bg-background p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {item.source === "manual"
                      ? "Manual"
                      : "Automático" + (item.slotNo ? " #" + item.slotNo : "")}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">{item.status}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {item.status === "sent" && item.sentAt
                    ? "enviado em " + formatDate(item.sentAt)
                    : "previsto para " + formatDate(item.scheduledFor)}
                  {item.deliveryMode ? " · " + item.deliveryMode : ""}
                </p>
                {item.messageText && <p className="mt-2 whitespace-pre-wrap">{item.messageText}</p>}
                {item.lastError && (
                  <p className="mt-1 text-[10px] text-destructive">{item.lastError}</p>
                )}
              </div>
            ))}
            {recentQueue.length === 0 && !loading && (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Nenhum envio proativo registrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
