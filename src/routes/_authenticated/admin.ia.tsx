import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Clock3,
  DollarSign,
  MessageCircle,
  RefreshCw,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  aiAnalyticsOverview,
  aiAnalyticsUsers,
  aiChatHistory,
  type AIAnalyticsOverview,
  type AIAnalyticsTurn,
  type AIAnalyticsUser,
} from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/ia")({
  head: () => ({
    meta: [
      { title: "Análise da IA · TPEC-IA" },
      {
        name: "description",
        content: "Desempenho, uso e custo das conversas da TPEC-IA.",
      },
      { property: "og:title", content: "Análise da IA · TPEC-IA" },
      {
        property: "og:description",
        content: "Desempenho, uso e custo das conversas da TPEC-IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAIAnalytics,
});

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.max(0, Math.min(100, value))) + "%"
  );
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatUser(user: AIAnalyticsUser): string {
  if (user.channel === "whatsapp" && user.phone_number) {
    const digits = user.phone_number.replace(/\D/g, "");
    return digits.length > 4 ? "••••" + digits.slice(-4) : digits;
  }
  return user.user_key.length > 22 ? user.user_key.slice(0, 22) + "…" : user.user_key;
}

function formatChannel(channel: AIAnalyticsUser["channel"]): string {
  return channel === "whatsapp" ? "WhatsApp" : "Web";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function AnalyticsStat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function UsageMetric({
  label,
  value,
  color,
  description,
}: {
  label: string;
  value: number;
  color: string;
  description: string;
}) {
  const safeValue = clampPercent(value);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{formatPercent(safeValue)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={"h-full rounded-full " + color}
          style={{ width: safeValue + "%" }}
          aria-label={label + ": " + formatPercent(safeValue)}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function TurnBadge({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span className={"rounded-full px-2 py-1 text-[11px] font-medium " + tone}>{children}</span>
  );
}

function AdminAIAnalytics() {
  const overviewFn = useServerFn(aiAnalyticsOverview);
  const usersFn = useServerFn(aiAnalyticsUsers);
  const historyFn = useServerFn(aiChatHistory);

  const [from, setFrom] = useState(localDate(-29));
  const [to, setTo] = useState(localDate());
  const [overview, setOverview] = useState<AIAnalyticsOverview | null>(null);
  const [users, setUsers] = useState<AIAnalyticsUser[]>([]);
  const [selected, setSelected] = useState<AIAnalyticsUser | null>(null);
  const [history, setHistory] = useState<AIAnalyticsTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const range = { from: from || undefined, to: to || undefined };
      const [summary, rows] = await Promise.all([
        overviewFn({ data: range }),
        usersFn({ data: { ...range, limit: 200, offset: 0 } }),
      ]);
      setOverview(summary as AIAnalyticsOverview);
      setUsers(rows as AIAnalyticsUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a análise.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function openUser(user: AIAnalyticsUser) {
    setSelected(user);
    setHistory([]);
    setDetailLoading(true);
    setError(null);
    try {
      const rows = await historyFn({
        data: {
          userKey: user.user_key,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setHistory(rows as AIAnalyticsTurn[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a conversa.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setHistory([]);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">Análise de desempenho e custo da IA</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Uso real por usuário, conversa, modelo, pesquisa e base de conhecimento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              to="/admin/base-conhecimento"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              Base
            </Link>
            <Link
              to="/admin/produtos"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              Produtos
            </Link>
            <Link
              to="/admin/cotacoes"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              Cotações
            </Link>
            <Link to="/" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              Chat
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="underline">
              fechar
            </button>
          </div>
        )}

        <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold">Período da análise</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              As porcentagens consideram apenas respostas concluídas; o custo inclui tentativas que
              consumiram tokens.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              De
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Até
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </section>

        {!overview && loading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Carregando métricas…
          </div>
        )}

        {overview && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <AnalyticsStat
                label="Usuários no período"
                value={formatNumber(overview.unique_users)}
                detail="Web + WhatsApp"
                icon={<Users size={18} />}
              />
              <AnalyticsStat
                label="Números WhatsApp"
                value={formatNumber(overview.whatsapp_numbers)}
                detail="identificados por telefone"
                icon={<MessageCircle size={18} />}
              />
              <AnalyticsStat
                label="Conversas"
                value={formatNumber(overview.conversations)}
                detail={
                  formatNumber(overview.completed_turns) +
                  " respostas · " +
                  formatNumber(overview.failed_turns) +
                  " falhas"
                }
                icon={<Activity size={18} />}
              />
              <AnalyticsStat
                label="Tokens"
                value={formatNumber(overview.total_tokens)}
                detail={formatNumber(overview.output_tokens) + " de saída"}
                icon={<Zap size={18} />}
              />
              <AnalyticsStat
                label="Custo total estimado"
                value={formatUsd(overview.total_cost_usd)}
                detail={
                  overview.pricing_configured
                    ? "tarifas configuradas"
                    : "configure as tarifas no ambiente"
                }
                icon={<DollarSign size={18} />}
              />
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <UsageMetric
                label="Pesquisa profunda"
                value={overview.deep_research_pct}
                color="bg-amber-500"
                description="Respostas que precisaram de pesquisa Web Search em nível alto."
              />
              <UsageMetric
                label="Apoio na base"
                value={overview.knowledge_base_pct}
                color="bg-emerald-600"
                description="Respostas apoiadas por RAG, catálogo, mercado ou site oficial interno."
              />
              <UsageMetric
                label="Resposta rápida"
                value={overview.quick_response_pct}
                color="bg-sky-500"
                description="Respostas atendidas pelo caminho leve da IA."
              />
            </section>

            {!overview.pricing_configured && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                O painel já registra tokens e calcula o que consegue, mas algumas tarifas dos
                modelos adaptativos ainda não estão configuradas. Os custos exibidos podem ficar
                abaixo do real até preencher as variáveis de preço no ambiente do backend.
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      Usuários e números que conversaram com a IA
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clique em “Analisar chat” para ver cada turno, origem e custo.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{users.length} registros</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Usuário</th>
                      <th className="px-3 py-3 text-left">Canal</th>
                      <th className="px-3 py-3 text-right">Conversas</th>
                      <th className="px-3 py-3 text-right">Respostas</th>
                      <th className="px-3 py-3 text-right">Custo</th>
                      <th className="px-3 py-3 text-left">Distribuição</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.user_key + ":" + user.channel}
                        className="border-t border-border"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{formatUser(user)}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            última atividade: {formatDate(user.last_message_at)}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs">{formatChannel(user.channel)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(user.conversation_count)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(user.completed_turns)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          {formatUsd(user.total_cost_usd)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1.5 text-[11px]">
                            <MiniMetric
                              label="profunda"
                              value={user.deep_research_pct}
                              color="bg-amber-500"
                            />
                            <MiniMetric
                              label="base"
                              value={user.knowledge_base_pct}
                              color="bg-emerald-600"
                            />
                            <MiniMetric
                              label="rápida"
                              value={user.quick_response_pct}
                              color="bg-sky-500"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => void openUser(user)}
                            className="rounded-md border border-primary px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
                          >
                            Analisar chat
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhuma conversa registrada neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {selected && (
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-base font-semibold">Histórico de {formatUser(selected)}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatChannel(selected.channel)} · {formatNumber(selected.completed_turns)}{" "}
                  respostas · custo {formatUsd(selected.total_cost_usd)}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
              >
                <X size={14} /> Fechar
              </button>
            </div>

            <div className="grid gap-3 border-b border-border p-4 md:grid-cols-3">
              <UsageMetric
                label="Pesquisa profunda"
                value={selected.deep_research_pct}
                color="bg-amber-500"
                description="Percentual dos turnos concluídos com pesquisa Web Search em nível alto."
              />
              <UsageMetric
                label="Apoio na base"
                value={selected.knowledge_base_pct}
                color="bg-emerald-600"
                description="Percentual dos turnos concluídos que usaram a base interna."
              />
              <UsageMetric
                label="Resposta rápida"
                value={selected.quick_response_pct}
                color="bg-sky-500"
                description="Percentual dos turnos concluídos atendidos pelo caminho leve."
              />
            </div>

            <div className="p-4">
              {detailLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando histórico…
                </div>
              )}
              {!detailLoading && history.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum turno encontrado para este usuário no período.
                </div>
              )}
              {!detailLoading && history.length > 0 && (
                <div className="space-y-5">
                  {history.map((turn) => (
                    <article key={turn.id} className="rounded-lg border border-border/80 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={13} /> {formatDate(turn.created_at)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {turn.used_deep_research && (
                            <TurnBadge tone="bg-amber-100 text-amber-800">
                              Pesquisa profunda
                            </TurnBadge>
                          )}
                          {turn.used_knowledge_base && (
                            <TurnBadge tone="bg-emerald-100 text-emerald-800">
                              Base ({turn.knowledge_match_count})
                            </TurnBadge>
                          )}
                          {turn.used_quick_response && (
                            <TurnBadge tone="bg-sky-100 text-sky-800">Resposta rápida</TurnBadge>
                          )}
                          <TurnBadge
                            tone={
                              turn.status === "completed"
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-destructive/10 text-destructive"
                            }
                          >
                            {turn.status === "completed" ? "concluída" : "erro"}
                          </TurnBadge>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg bg-secondary/50 p-3">
                          <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                            Usuário
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {turn.user_text}
                          </p>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="mb-1 text-[11px] font-semibold uppercase text-primary">
                            TPEC-IA
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {turn.assistant_text ||
                              turn.error_message ||
                              "Sem resposta registrada."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          custo:{" "}
                          <strong className="text-foreground">
                            {formatUsd(turn.estimated_cost_usd)}
                          </strong>
                        </span>
                        <span>tokens: {formatNumber(turn.total_tokens)}</span>
                        <span>modelo: {turn.model || "não informado"}</span>
                        <span>rota: {turn.route_reason || turn.response_mode}</span>
                        <span>
                          tempo: {turn.duration_ms ? formatNumber(turn.duration_ms) + " ms" : "—"}
                        </span>
                        {turn.web_search_enabled && (
                          <span>Web Search: {turn.web_search_calls} chamada(s)</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = clampPercent(value);
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-muted-foreground">{label}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div className={"h-full rounded-full " + color} style={{ width: safeValue + "%" }} />
      </div>
      <span className="w-10 tabular-nums">{formatPercent(safeValue)}</span>
    </div>
  );
}
