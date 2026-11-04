import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  LayoutDashboard,
  Beef,
  ClipboardList,
  NotebookPen,
  Wallet,
  Fuel,
  Package,
  Bell,
  Calculator,
  Plus,
  ArrowRight,
  Check,
  KeyRound,
  Leaf,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Menu,
  X,
  MessageCircle,
} from "lucide-react";
import { FarmMobileHome } from "@/components/guardian/FarmMobileHome";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AndroidReminders } from "@/components/guardian/AndroidReminders";
import { androidCommand } from "@/lib/guardian/android-bridge";
import "./mobile-panel.css";
import { InstallPanel } from "@/components/guardian/InstallPanel";
import { installedPanel } from "@/lib/guardian/app-mode";
import { GuardianWorkspace } from "@/components/guardian/GuardianWorkspace";
import { GuardianActionForm } from "@/components/guardian/GuardianActionForm";
import { describeAction } from "@/lib/guardian/book";
import type { FarmBook, GuardianAction, GuardianRole } from "@/lib/guardian/schema";
import type { GuardianDetail } from "@/lib/guardian.functions";

type View = {
  propertyId: string;
  version: number;
  role: GuardianRole;
  name: string;
  book: FarmBook;
  expiresAt: string;
  events: GuardianDetail["events"];
  audit: GuardianDetail["audit"];
};
const tabs = [
  ["overview", "Visão geral"],
  ["herd", "Rebanho e lotes"],
  ["tasks", "Tarefas"],
  ["records", "Caderno de campo"],
  ["finance", "Financeiro"],
  ["fuel", "Combustível"],
  ["supplies", "Estoque e insumos"],
  ["events", "Avisos e histórico"],
  ["calculator", "Calculadoras"],
] as const;
type Tab = (typeof tabs)[number][0];
const tabIcons = {
  overview: LayoutDashboard,
  herd: Beef,
  tasks: ClipboardList,
  records: NotebookPen,
  finance: Wallet,
  fuel: Fuel,
  supplies: Package,
  events: Bell,
  calculator: Calculator,
};
const endpoint = "/api/public/farm-panel";
const whatsapp = "https://wa.me/5516992256069?text=" + encodeURIComponent("Gerar código do painel");
async function api(method = "GET", body?: unknown) {
  const result = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-tpec-panel": "1",
      "x-tpec-panel-mode": installedPanel() ? "installed" : "browser",
      ...(body && typeof body === "object" && "kind" in body && body.kind === "logout_all"
        ? { "x-tpec-panel-all": "1" }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json();
  if (!result.ok)
    throw Object.assign(new Error(data.error ?? "Não foi possível acessar o painel."), {
      status: result.status,
    });
  return data;
}
export function FarmPanel() {
  const [view, setView] = useState<View | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<Tab>("overview"),
    [form, setForm] = useState(false),
    [proposal, setProposal] = useState<{
      action: GuardianAction;
      requestId: string;
      version: number;
    } | null>(null);
  const generation = useRef(0),
    inFlight = useRef(false),
    moreDialog = useRef<HTMLDialogElement>(null);
  const hasView = !!view,
    propertyId = view?.propertyId,
    propertyVersion = view?.version;
  const load = useCallback(async () => {
    const run = ++generation.current;
    try {
      const data = await api();
      if (run === generation.current) setView(data);
    } catch (e) {
      if (run === generation.current) {
        if (e instanceof Error && "status" in e && e.status === 401) {
          setView(null);
          setProposal(null);
          androidCommand({ type: "disconnect" });
        } else setError(e instanceof Error ? e.message : "Tente novamente.");
      }
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);
  useEffect(() => {
    if (!hasView) return;
    const refresh = () => {
      if (!document.hidden && !inFlight.current) void load();
    };
    const timer = window.setInterval(refresh, 45_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [hasView, load]);
  useEffect(() => {
    if (propertyId) androidCommand({ type: "sync" });
  }, [propertyId, propertyVersion]);

  function navigate(next: Tab) {
    if (inFlight.current) return;
    if (proposal && !window.confirm("Descartar a alteração que ainda não foi salva?")) return;
    setTab(next);
    setForm(false);
    setProposal(null);
    moreDialog.current?.close();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function enter() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await api("POST", { kind: "exchange", code });
      setCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confira o código.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (!proposal || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("POST", { kind: "action", ...proposal });
      setNotice(result.message);
      setProposal(null);
      setForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      if (e instanceof Error && "status" in e && (e.status === 409 || e.status === 401)) {
        setProposal(null);
        await load();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function exit(all = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    void api("DELETE", all ? { kind: "logout_all" } : undefined)
      .then(() => {
        generation.current++;
        androidCommand({ type: "disconnect" });
        moreDialog.current?.close();
        setView(null);
        setProposal(null);
        setNotice("");
        setForm(false);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }
  const allowed =
    view && !["owner", "manager"].includes(view.role)
      ? ["record", "animal", "weighing", "task_create"]
      : [
          "feed_consumption",
          "alert_rules",
          "property_update",
          "profile",
          "herd_count",
          "herd_event",
          "lot_transfer",
          "herd_relocate",
          "lot_update",
          "task_create",
          "expense",
          "income",
          "record",
          "animal",
          "weighing",
        ];
  const proposalTask = proposal?.action.kind === "task_update" ? proposal.action.task : null;
  const reviewAction =
    proposal?.action.kind === "task_update"
      ? {
          ...proposal.action,
          task:
            view?.book.tasks.find((task) => task.id === proposalTask)?.title ??
            proposal.action.task,
        }
      : proposal?.action;
  return (
    <div className="farm-panel min-h-screen bg-[#f4f6f2] text-slate-900">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-5 md:py-5">
          <Link to="/" className="flex items-center gap-3 font-semibold">
            <span className="rounded-xl bg-emerald-900 p-2.5 text-white">
              <Leaf size={23} />
            </span>
            <span>
              TPEC-IA<small className="block font-normal text-slate-500">Painel da Fazenda</small>
            </span>
          </Link>
          {view && (
            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={() => navigate("tasks")}
                aria-label="Tarefas e lembretes"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-900 md:hidden"
              >
                <Bell size={22} aria-hidden="true" />
              </button>
              <button
                disabled={busy}
                onClick={() => exit()}
                className="hidden items-center gap-2 rounded-lg border px-3 py-2 text-sm md:flex"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            {error}
          </p>
        )}
        {notice && view && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
          >
            {notice}
          </p>
        )}
        <div className={view ? "mb-6 hidden md:block" : "mb-6"}>
          <InstallPanel authenticated={!!view} />
        </div>
        {loading ? (
          <p role="status" className="py-20 text-center">
            Conferindo seu acesso…
          </p>
        ) : !view ? (
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-center">
            <section className="order-2 py-5 lg:order-1">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                Sua gestão, sempre por perto
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
                Tudo da sua fazenda.
                <br />
                <span className="text-emerald-800">No seu controle.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
                Acompanhe o rebanho, organize tarefas e cuide dos registros financeiros. O que você
                registra aqui também fica disponível na conversa com a TPEC-IA.
              </p>
              <ol className="mt-7 space-y-4 text-sm">
                {[
                  "Peça “gerar código do painel” à TPEC-IA no WhatsApp.",
                  "Se tiver mais de uma fazenda, escolha qual deseja administrar.",
                  "Digite o código recebido para abrir seu painel.",
                ].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-900">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 font-semibold text-emerald-800"
              >
                Pedir meu código no WhatsApp <ArrowRight size={17} />
              </a>
            </section>
            <section className="order-1 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-9 lg:order-2">
              <div className="mb-6 inline-flex rounded-2xl bg-emerald-50 p-4 text-emerald-900">
                <KeyRound size={28} />
              </div>
              <h2 className="text-2xl font-semibold">Acesse sua fazenda</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Use o código de uso único enviado pela TPEC-IA. Ele fica válido por 10 minutos.
              </p>
              <form
                className="mt-7 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enter();
                }}
              >
                <label className="block text-sm font-semibold" htmlFor="farm-code">
                  Código de acesso
                </label>
                <input
                  id="farm-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={40}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 font-mono text-lg tracking-wider outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                />
                <button
                  disabled={busy || !code.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? "Conferindo código…" : "Entrar no painel"}
                  <ArrowRight size={18} />
                </button>
              </form>
              <p className="mt-6 flex gap-2 border-t pt-5 text-xs leading-relaxed text-slate-500">
                <ShieldCheck className="shrink-0" size={17} />O código dá acesso aos dados da
                fazenda. Mantenha-o privado e saia do painel em dispositivos compartilhados.
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
                  Gestão da propriedade
                </p>
                <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{view.name}</h1>
                <p className="mt-2 text-sm text-slate-600">
                  {[view.book.city, view.book.uf].filter(Boolean).join(" / ") ||
                    "Localização ainda não informada"}{" "}
                  ·{" "}
                  {
                    {
                      owner: "Proprietário",
                      manager: "Gerente",
                      worker: "Funcionário",
                      technician: "Responsável técnico",
                    }[view.role]
                  }
                </p>
              </div>
              <div className="flex w-full justify-end gap-2 md:w-auto">
                <button
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    void load();
                  }}
                  className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm"
                >
                  <RefreshCw size={16} /> Atualizar
                </button>
                {!["fuel", "supplies"].includes(tab) && (
                  <button
                    disabled={busy}
                    onClick={() => setForm((f) => !f)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Plus size={17} aria-hidden="true" />
                    {form ? "Fechar" : "Novo registro"}
                  </button>
                )}
              </div>
            </div>
            <nav
              aria-label="Áreas da fazenda"
              className="mb-6 hidden gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 md:flex"
            >
              {tabs.map(([id, label]) => {
                const Icon = tabIcons[id];
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    aria-current={tab === id ? "page" : undefined}
                    className={`inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transform-none ${tab === id ? "border-emerald-900 bg-emerald-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-600 hover:bg-emerald-50"}`}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </nav>
            {tab !== "overview" && (
              <div className="mb-4 flex items-center gap-3 md:hidden">
                <button
                  disabled={busy}
                  onClick={() => navigate("overview")}
                  aria-label="Voltar ao início"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border bg-white"
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <h2 className="text-xl font-semibold">{tabs.find(([id]) => id === tab)?.[1]}</h2>
              </div>
            )}
            <div className="space-y-6">
              {tab === "overview" && (
                <FarmMobileHome
                  book={view.book}
                  busy={busy}
                  navigate={navigate}
                  complete={(task) => {
                    setProposal({
                      action: { kind: "task_update", task, status: "done" },
                      requestId: crypto.randomUUID(),
                      version: view.version,
                    });
                    setError("");
                    setNotice("");
                  }}
                />
              )}
              {tab === "tasks" && <AndroidReminders />}
              <div className={tab === "overview" ? "hidden md:block" : undefined}>
                <GuardianWorkspace
                  detail={{
                    id: view.propertyId,
                    version: view.version,
                    book: view.book,
                    events: view.events,
                    audit: view.audit,
                    members: [],
                  }}
                  tab={tab}
                  canManageFuel={["owner", "manager"].includes(view.role)}
                  busy={busy}
                  onPropose={async (action) => {
                    setProposal({ action, requestId: crypto.randomUUID(), version: view.version });
                    setError("");
                    setNotice("");
                  }}
                />
              </div>
            </div>
            <Dialog
              open={form && !["fuel", "supplies"].includes(tab)}
              onOpenChange={(open) => {
                if (!open && !busy) setForm(false);
              }}
            >
              <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
                <DialogHeader className="shrink-0 space-y-1 border-b border-slate-200 px-5 py-4 pr-14 text-left sm:px-6">
                  <DialogTitle className="text-xl">Novo registro</DialogTitle>
                  <DialogDescription>
                    Preencha os dados e revise a alteração antes de salvar.
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                  {form && view && (
                    <GuardianActionForm
                      key={`${view.propertyId}:${tab}`}
                      initialKind={
                        tab === "finance"
                          ? "expense"
                          : tab === "herd"
                            ? "herd_event"
                            : tab === "records"
                              ? "record"
                              : "task_create"
                      }
                      hasProperty
                      busy={busy}
                      allowedKinds={allowed}
                      onPropose={async (action) => {
                        setForm(false);
                        setProposal({
                          action,
                          requestId: crypto.randomUUID(),
                          version: view.version,
                        });
                        setError("");
                        setNotice("");
                      }}
                    />
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog
              open={!!proposal}
              onOpenChange={(open) => {
                if (!open && !busy) setProposal(null);
              }}
            >
              <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
                <DialogHeader className="pr-6 text-left">
                  <DialogTitle className="text-xl">Confira antes de salvar</DialogTitle>
                  <DialogDescription>
                    Confirme os dados antes de registrar a alteração na fazenda.
                  </DialogDescription>
                </DialogHeader>
                {reviewAction && (
                  <p className="whitespace-pre-wrap rounded-xl bg-amber-50 p-4 text-sm text-slate-800">
                    {describeAction(reviewAction)}
                  </p>
                )}
                <p className="text-sm text-slate-600">Fazenda: {view.name}.</p>
                {error && (
                  <p role="alert" className="text-sm text-rose-700">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    onClick={() => void save()}
                    className="flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check size={17} aria-hidden="true" />
                    {busy ? "Salvando…" : "Confirmar e salvar"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setProposal(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </DialogContent>
            </Dialog>
            <details className="mt-8 text-xs text-slate-500">
              <summary className="w-fit cursor-pointer">Acesso e informações dos dados</summary>
              <p className="mt-3 max-w-2xl leading-relaxed">
                Dados informados pelo produtor; cálculos usam os registros disponíveis.{" "}
                {installedPanel()
                  ? "Acesso mantido neste aplicativo. Renovação até "
                  : "Sessão do navegador até "}{" "}
                {new Date(view.expiresAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}{" "}
                (Brasília). Para acessar outra fazenda, saia e peça o código correspondente.
              </p>
              <button
                disabled={busy}
                onClick={() => exit(true)}
                className="mt-4 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700"
              >
                Sair de todos os meus acessos desta fazenda
              </button>
            </details>
            <dialog
              ref={moreDialog}
              aria-labelledby="farm-more-title"
              className="farm-more-dialog"
              onClick={(event) => {
                if (event.target === event.currentTarget) moreDialog.current?.close();
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="farm-more-title" className="text-xl font-semibold">
                  Sua fazenda
                </h2>
                <button
                  onClick={() => moreDialog.current?.close()}
                  aria-label="Fechar menu"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border"
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {tabs.map(([id, label]) => {
                  const Icon = tabIcons[id];
                  return (
                    <button
                      key={id}
                      disabled={busy}
                      onClick={() => navigate(id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium ${tab === id ? "border-emerald-800 bg-emerald-50 text-emerald-950" : "border-slate-200"}`}
                    >
                      <Icon size={22} className="shrink-0" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <a
                href="https://wa.me/5516992256069"
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-4 font-semibold text-white"
              >
                <MessageCircle size={21} aria-hidden="true" />
                Falar com a TPEC-IA
              </a>
              <button
                disabled={busy}
                onClick={() => exit()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-rose-700"
              >
                <LogOut size={19} aria-hidden="true" />
                Sair desta fazenda
              </button>
            </dialog>
            <nav
              aria-label="Navegação principal"
              className="farm-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-emerald-950/10 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.04)] md:hidden"
            >
              {(
                [
                  ["overview", "Início", LayoutDashboard],
                  ["herd", "Rebanho", Beef],
                  ["tasks", "Tarefas", ClipboardList],
                  ["finance", "Finanças", Wallet],
                  ["more", "Mais", Menu],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  disabled={busy}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => (id === "more" ? moreDialog.current?.showModal() : navigate(id))}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold ${tab === id ? "text-emerald-800" : "text-slate-500"}`}
                >
                  <Icon size={23} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
        <Link to="/" className="mt-10 inline-flex items-center gap-2 text-sm text-slate-600">
          <ArrowLeft size={15} /> Voltar ao site
        </Link>
      </main>
    </div>
  );
}
