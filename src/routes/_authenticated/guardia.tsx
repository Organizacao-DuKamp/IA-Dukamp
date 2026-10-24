import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowDownToLine,
  Bell,
  BookOpen,
  Calculator,
  Check,
  ClipboardList,
  Leaf,
  MapPin,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  guardianOverview,
  guardianPropertyDetail,
  guardianCreateWebLink,
  guardianSubmitAction,
  guardianEventHistory,
  type GuardianDetail,
  type PropertySummary,
} from "@/lib/guardian.functions";
import { GuardianCalculator } from "@/components/guardian/GuardianCalculator";
import { GuardianActionForm } from "@/components/guardian/GuardianActionForm";
import { GuardianPreferences } from "@/components/guardian/GuardianPreferences";
import { GuardianWorkspace } from "@/components/guardian/GuardianWorkspace";
import type { GuardianAction, GuardianSnapshot } from "@/lib/guardian/schema";

export const Route = createFileRoute("/_authenticated/guardia")({
  head: () => ({ meta: [{ title: "Guardiã da Fazenda · TPEC-IA" }] }),
  component: GuardianPage,
});
const tabs = [
  { id: "overview", label: "Visão geral", icon: Activity },
  { id: "tasks", label: "Tarefas", icon: ClipboardList },
  { id: "herd", label: "Rebanho", icon: Leaf },
  { id: "records", label: "Caderno de campo", icon: BookOpen },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "events", label: "Eventos e avisos", icon: Bell },
  { id: "calculator", label: "Calculadoras", icon: Calculator },
  { id: "settings", label: "Equipe e dados", icon: Settings2 },
] as const;
type Tab = (typeof tabs)[number]["id"];
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function GuardianPage() {
  const overviewFn = useServerFn(guardianOverview),
    detailFn = useServerFn(guardianPropertyDetail),
    linkFn = useServerFn(guardianCreateWebLink),
    submitFn = useServerFn(guardianSubmitAction),
    historyFn = useServerFn(guardianEventHistory);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof guardianOverview>> | null>(
      null,
    ),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<GuardianDetail | null>(null),
    [tab, setTab] = useState<Tab>("overview"),
    [form, setForm] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [pairing, setPairing] = useState(""),
    [proposal, setProposal] = useState<{ reply: string; snapshot: GuardianSnapshot } | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await overviewFn();
      setOverview(data);
      setSelected((current) =>
        data.properties.some((p: PropertySummary) => p.id === current)
          ? current
          : (data.properties[0]?.id ?? ""),
      );
    } catch {
      setError("Não foi possível carregar a Guardiã. Confira sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [overviewFn]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const id = ++request.current;
    let cancelled = false;
    setDetail(null);
    setProposal(null);
    if (!selected) return;
    setLoading(true);
    void detailFn({ data: { id: selected } })
      .then((data) => {
        if (!cancelled && id === request.current) setDetail(data);
      })
      .catch(() => {
        if (!cancelled && id === request.current)
          setError("Não foi possível acessar esta propriedade.");
      })
      .finally(() => {
        if (!cancelled && id === request.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, detailFn]);
  async function propose(action: GuardianAction) {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const result = await submitFn({
        data: {
          requestId: crypto.randomUUID(),
          ...(action.kind !== "property_create" && selected ? { propertyId: selected } : {}),
          action,
        },
      });
      if (result.snapshot.pending) {
        setProposal(result);
        setForm(false);
      } else setFeedback(result.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar o registro.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm(command: "confirm" | "cancel") {
    if (!proposal?.snapshot.pending) return;
    setBusy(true);
    setError("");
    try {
      const p = proposal.snapshot.pending;
      const result = await submitFn({
        data: {
          requestId: crypto.randomUUID(),
          ...(p.propertyId ? { propertyId: p.propertyId } : {}),
          command,
          proposalId: p.sourceMessageId,
        },
      });
      setFeedback(result.reply);
      setProposal(result.snapshot.pending ? result : null);
      await load();
      if (result.snapshot.active?.id === selected) {
        const d = await detailFn({ data: { id: selected } });
        setDetail(d);
      } else if (result.snapshot.active) setSelected(result.snapshot.active.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-emerald-950 text-emerald-50 print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-300" size={29} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-300">
                TPEC-IA
              </p>
              <h1 className="text-xl font-semibold">Guardiã da Fazenda</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="rounded-full border border-emerald-700 px-3 py-1 text-xs">
              Gratuita para o produtor
            </span>
            {overview?.isAdmin && (
              <Link to="/admin/ia" className="text-emerald-100">
                Administração
              </Link>
            )}
            <Link to="/" className="text-emerald-100">
              Início
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 md:grid-cols-[210px_minmax(0,1fr)] lg:px-6">
        <aside className="print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Propriedade
          </p>
          <select
            aria-label="Selecionar propriedade"
            disabled={busy || loading}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setForm(false);
            }}
            className="mb-5 w-full rounded-xl border border-input bg-card px-3 py-3 text-sm"
          >
            <option value="">Selecione uma fazenda</option>
            {overview?.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <nav aria-label="Guardiã da Fazenda" className="flex gap-1 overflow-auto md:flex-col">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setForm(false);
                }}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${tab === t.id ? "bg-emerald-800 font-semibold text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <t.icon size={18} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 hidden rounded-xl border border-border p-4 text-xs leading-relaxed text-muted-foreground md:block">
            Seu caderno acompanha os registros confirmados. Avisos e previsões dependem das fontes
            disponíveis.
          </div>
        </aside>
        <main className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
            <div>
              <p className="text-sm text-muted-foreground">Seu trabalho no campo, organizado.</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {detail?.book.name ?? "Bem-vindo à Guardiã"}
              </h2>
              {detail && (
                <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin size={14} />
                  {detail.book.city}/{detail.book.uf}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  void load()
                    .then(async () => {
                      if (selected) setDetail(await detailFn({ data: { id: selected } }));
                    })
                    .catch(() => setError("Não foi possível atualizar os dados."))
                }
                disabled={busy}
                aria-label="Atualizar dados"
                className="rounded-xl border border-border bg-card p-3"
              >
                <RefreshCw size={17} />
              </button>
              <button
                onClick={() => setForm((v) => !v)}
                disabled={busy || loading || !overview?.enabled || !overview.account}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus size={17} />
                Novo registro
              </button>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {feedback && (
            <p
              role="status"
              className="whitespace-pre-wrap rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-4 text-sm"
            >
              {feedback}
            </p>
          )}
          {overview && !overview.enabled && (
            <p className="rounded-xl border border-border bg-card p-4 text-sm">
              A Guardiã está em preparação. As calculadoras já podem ser usadas; os registros serão
              liberados após a ativação.
            </p>
          )}
          {overview?.enabled && !overview.templateConfigured && (
            <p className="rounded-xl border border-amber-600/30 bg-amber-500/5 p-4 text-sm">
              Os avisos automáticos pelo WhatsApp só estão disponíveis até 24 horas após sua última
              mensagem. Avisos para depois desse período ainda aguardam liberação. Você já pode
              registrar atividades e consultar seu caderno.
            </p>
          )}
          {overview?.enabled && !overview.account && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Vincule seu WhatsApp</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Confirme que esta conta e seu número pertencem a você. Gere um código e envie o
                comando à TPEC-IA pelo seu WhatsApp.
              </p>
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void linkFn()
                    .then((r) => setPairing(r.command))
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : "Não foi possível gerar o código."),
                    )
                    .finally(() => setBusy(false));
                }}
                className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
              >
                Gerar código de vínculo
              </button>
              {pairing && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">
                    Válido por dez minutos. Depois de enviar, atualize este painel.
                  </p>
                  <code className="mt-2 block break-all rounded-lg bg-secondary p-3 text-sm">
                    {pairing}
                  </code>
                </div>
              )}
            </section>
          )}
          {proposal && (
            <section
              aria-label="Confirmar proposta"
              className="rounded-2xl border-2 border-amber-600/40 bg-amber-500/5 p-5"
            >
              <h2 className="font-semibold">Confira antes de salvar</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{proposal.reply}</p>
              <div className="mt-4 flex gap-3">
                <button
                  disabled={busy}
                  onClick={() => void confirm("confirm")}
                  className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Confirmar e salvar
                </button>
                <button
                  disabled={busy}
                  onClick={() => void confirm("cancel")}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </section>
          )}
          {tab === "settings" && overview?.account && (
            <GuardianPreferences
              key={JSON.stringify(overview.account.preferences)}
              value={overview.account.preferences}
              disabled={busy || !overview.enabled}
              onSaved={async (message) => {
                setFeedback(message);
                await load();
              }}
            />
          )}
          {form && (
            <GuardianActionForm
              key={selected}
              hasProperty={!!detail}
              busy={busy}
              onPropose={propose}
            />
          )}
          {loading && (
            <p role="status" className="py-12 text-center text-sm text-muted-foreground">
              Carregando os dados autorizados…
            </p>
          )}
          {!loading && tab === "calculator" && <GuardianCalculator />}
          {!loading &&
            tab !== "calculator" &&
            (detail ? (
              <GuardianWorkspace
                key={detail.id}
                detail={detail}
                tab={tab}
                onPropose={propose}
                busy={busy || !overview?.enabled || !overview?.account}
                ownPhone={overview?.account?.phone_number}
                loadEventHistory={(eventId) => historyFn({ data: { eventId } })}
              />
            ) : (
              <Empty>
                {overview?.account
                  ? "Cadastre sua primeira fazenda em “Novo registro” ou envie “guardiã” pelo WhatsApp."
                  : "Suas propriedades aparecerão aqui após o vínculo e o cadastro. Você pode usar as calculadoras gratuitamente."}
              </Empty>
            ))}
          {overview?.partial && (
            <p className="text-xs text-muted-foreground">
              Exibindo as 100 propriedades atualizadas mais recentemente.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
