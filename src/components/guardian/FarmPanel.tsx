import { FarmPhoto } from "./FarmPhoto";
import { primaryPanelTabs, swipePanelTab } from "@/lib/guardian/panel-navigation";
import { FarmTeam } from "./FarmTeam";
import { readAccessFragment, invitationWhatsApp } from "@/lib/guardian/access-link";
import type { FarmTeam as Team } from "@/lib/guardian/access-links.server";
import { AnimalImports } from "@/components/guardian/AnimalImports";
import { Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
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
  Leaf,
  LogOut,
  RefreshCw,
  Menu,
  Users,
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
import { androidCommand, nativeAndroid } from "@/lib/guardian/android-bridge";
import "./mobile-panel.css";
import { InstallPanel } from "@/components/guardian/InstallPanel";
import { installedPanel } from "@/lib/guardian/app-mode";
import { createPanelClient } from "@/lib/guardian/panel-client";
import { GuardianWorkspace } from "@/components/guardian/GuardianWorkspace";
import { GuardianActionForm } from "@/components/guardian/GuardianActionForm";
import { describeAction } from "@/lib/guardian/book";
import type { FarmBook, GuardianAction, GuardianRole } from "@/lib/guardian/schema";
import type { GuardianDetail } from "@/lib/guardian.functions";

type View = {
  team?: Team;
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
  ["imports", "Importação de animais"],
  ["tasks", "Tarefas"],
  ["records", "Caderno de campo"],
  ["finance", "Financeiro"],
  ["fuel", "Combustível"],
  ["supplies", "Estoque e insumos"],
  ["events", "Avisos e histórico"],
  ["calculator", "Calculadoras"],
  ["team", "Equipe e acessos"],
  ["more", "Mais"],
] as const;
type Tab = (typeof tabs)[number][0];
const tabIcons = {
  overview: LayoutDashboard,
  herd: Beef,
  imports: Upload,
  tasks: ClipboardList,
  records: NotebookPen,
  finance: Wallet,
  fuel: Fuel,
  supplies: Package,
  events: Bell,
  calculator: Calculator,
  team: Users,
  more: Menu,
};
const whatsapp = "https://wa.me/5516992256069?text=" + encodeURIComponent("Gerar link do painel");
export function FarmPanel() {
  const client = useRef<ReturnType<typeof createPanelClient> | null>(null);
  client.current ??= createPanelClient();
  const api = useCallback((method = "GET", body?: unknown) => client.current!(method, body), []);
  const [view, setView] = useState<View | null>(null),
    [invitation, setInvitation] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<Tab>("overview"),
    [visitedTabs, setVisitedTabs] = useState<Tab[]>(["overview"]),
    [form, setForm] = useState(false),
    [proposal, setProposal] = useState<{
      action: GuardianAction;
      requestId: string;
      version: number;
    } | null>(null);
  const [nativeApp, setNativeApp] = useState(false);
  useEffect(() => setNativeApp(nativeAndroid()), []);
  const generation = useRef(0),
    entering = useRef(false),
    inFlight = useRef(false),
    gesture = useRef<{ x: number; y: number; at: number; id: number } | null>(null);
  const swipeSurface = useRef<HTMLDivElement>(null);
  const touchIntent = useRef<{ x: number; y: number; at: number; done: boolean } | null>(null);
  const hasView = !!view,
    propertyId = view?.propertyId,
    propertyVersion = view?.version;
  const load = useCallback(async () => {
    if (entering.current) return;
    const run = ++generation.current;
    try {
      const data = await api();
      if (run === generation.current)
        setView((previous) =>
          previous && previous.propertyId === data.propertyId && previous.version === data.version
            ? { ...data, book: previous.book }
            : data,
        );
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
  }, [api]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  type Entry = { kind: "invite"; token: string } | { kind: "view"; view: View } | { kind: "guest" };
  // Reuse only the current operation across React's effect replay. Each incoming
  // URL starts a new operation; logout discards the completed startup result.
  const accessOperation = useRef<Promise<Entry> | null>(null);
  useEffect(() => {
    let disposed = false;
    const observe = (operation: Promise<Entry>) => {
      const run = ++generation.current;
      const current = () => !disposed && run === generation.current;
      entering.current = true;
      inFlight.current = true;
      setLoading(true);
      setBusy(true);
      setError("");
      setNotice("");
      setView(null);
      setInvitation(null);
      setProposal(null);
      setForm(false);
      setTab("overview");
      setVisitedTabs(["overview"]);

      void operation
        .then((result) => {
          if (!current()) return;
          if (result.kind === "invite") setInvitation(result.token);
          else if (result.kind === "view") setView(result.view);
          else androidCommand({ type: "disconnect" });
        })
        .catch((error) => {
          if (!current()) return;
          if (error instanceof Error && "status" in error && error.status === 401) {
            androidCommand({ type: "disconnect" });
          }
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir o painel. Tente novamente.",
          );
        })
        .finally(() => {
          if (!current()) return;
          entering.current = false;
          inFlight.current = false;
          setLoading(false);
          setBusy(false);
        });
    };
    const open = (initial = false) => {
      const access = readAccessFragment(window.location.hash);
      if (!access && !initial) return;
      if (access)
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      const operation: Promise<Entry> =
        access?.kind === "invite"
          ? Promise.resolve({ kind: "invite", token: access.token })
          : (async () => {
              if (access?.kind === "login")
                await api("POST", { kind: "link_exchange", token: access.token });
              try {
                return { kind: "view", view: (await api()) as View };
              } catch (error) {
                if (!access && error instanceof Error && "status" in error && error.status === 401)
                  return { kind: "guest" };
                throw error;
              }
            })();
      accessOperation.current = operation;
      observe(operation);
    };
    const incoming = () => open();
    window.addEventListener("hashchange", incoming);
    window.addEventListener("popstate", incoming);
    if (accessOperation.current) observe(accessOperation.current);
    else open(true);
    return () => {
      disposed = true;
      invalidate();
      window.removeEventListener("hashchange", incoming);
      window.removeEventListener("popstate", incoming);
    };
  }, [api, invalidate]);
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

  const navigate = useCallback(
    (next: Tab) => {
      if (inFlight.current) return;
      if (proposal && !window.confirm("Descartar a alteração que ainda não foi salva?")) return;
      setTab(next);
      setVisitedTabs((areas) => (areas.includes(next) ? areas : [...areas, next]));
      setForm(false);
      setProposal(null);

      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [proposal],
  );
  useEffect(() => {
    const surface = swipeSurface.current;
    if (!surface || !hasView || form || proposal || busy) {
      touchIntent.current = null;
      return;
    }
    const start = (event: TouchEvent) => {
      touchIntent.current = null;
      if (event.touches.length !== 1) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "button,a,input,select,textarea,dialog,[role=dialog],summary,[data-no-swipe]",
        )
      )
        return;
      let node: HTMLElement | null = target;
      while (node && node !== surface) {
        if (
          node.scrollWidth > node.clientWidth + 4 &&
          /auto|scroll/.test(getComputedStyle(node).overflowX)
        )
          return;
        node = node.parentElement;
      }
      const point = event.touches[0];
      touchIntent.current = { x: point.clientX, y: point.clientY, at: Date.now(), done: false };
    };
    const move = (event: TouchEvent) => {
      const intent = touchIntent.current;
      if (!intent || event.touches.length !== 1 || !event.cancelable) return;
      if (intent.done) {
        event.preventDefault();
        return;
      }
      const dx = event.touches[0].clientX - intent.x,
        dy = event.touches[0].clientY - intent.y;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        touchIntent.current = null;
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.6) event.preventDefault();
      const next = swipePanelTab(tab, dx, dy, Date.now() - intent.at);
      if (next) {
        intent.done = true;
        navigate(next);
      }
    };
    const end = () => {
      touchIntent.current = null;
    };
    // Cancel only committed horizontal page swipes. Native vertical scroll,
    // pinch zoom and horizontal shortcut carousels keep their default gestures.
    surface.addEventListener("touchstart", start, { passive: true });
    surface.addEventListener("touchmove", move, { passive: false });
    surface.addEventListener("touchend", end, { passive: true });
    surface.addEventListener("touchcancel", end, { passive: true });
    return () => {
      surface.removeEventListener("touchstart", start);
      surface.removeEventListener("touchmove", move);
      surface.removeEventListener("touchend", end);
      surface.removeEventListener("touchcancel", end);
    };
  }, [hasView, tab, navigate, form, proposal, busy]);
  const propose = useCallback(
    async (action: GuardianAction) => {
      if (!propertyId || propertyVersion === undefined) return;
      setProposal({ action, requestId: crypto.randomUUID(), version: propertyVersion });
      setError("");
      setNotice("");
    },
    [propertyId, propertyVersion],
  );
  const completeTask = useCallback(
    (task: string) => {
      void propose({ kind: "task_update", task, status: "done" });
    },
    [propose],
  );
  async function save() {
    if (!proposal || inFlight.current) return;
    inFlight.current = true;
    const scope = accessOperation.current;
    setBusy(true);
    setError("");
    try {
      const result = await api("POST", { kind: "action", ...proposal });
      if (scope !== accessOperation.current) return;
      setNotice(result.message);
      setProposal(null);
      setForm(false);
      await load();
    } catch (e) {
      if (scope !== accessOperation.current) return;
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      if (e instanceof Error && "status" in e && (e.status === 409 || e.status === 401)) {
        setProposal(null);
        await load();
      }
    } finally {
      if (scope === accessOperation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  const exit = useCallback(
    (all = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const run = ++generation.current;
      accessOperation.current = null;
      setBusy(true);
      void api("DELETE", all ? { kind: "logout_all" } : undefined)
        .then(() => {
          if (run !== generation.current) return;
          androidCommand({ type: "disconnect" });

          setView(null);
          setInvitation(null);
          setProposal(null);
          setNotice("");
          setError("");
          setForm(false);
          setTab("overview");
          setVisitedTabs(["overview"]);
        })
        .catch((e) => {
          if (run === generation.current) setError(e.message);
        })
        .finally(() => {
          if (run !== generation.current) return;
          inFlight.current = false;
          setBusy(false);
        });
    },
    [api],
  );
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
    <div className="farm-panel min-h-screen bg-white text-slate-900">
      <header className={`farm-topbar ${view ? "farm-topbar-authenticated" : ""}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-5 md:py-5">
          <Link
            to={nativeApp ? "/painelfazenda" : "/"}
            className="flex items-center gap-3 font-semibold"
          >
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
      <main className="farm-main mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
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
        ) : invitation ? (
          <section className="mx-auto max-w-lg rounded-3xl border bg-white p-7">
            <h1 className="text-2xl font-semibold">Convite para a equipe da fazenda</h1>
            <p className="my-5">
              Confirme pelo seu WhatsApp para registrar seu número como funcionário. A TPEC-IA
              enviará seu link pessoal de acesso, sem código.
            </p>
            <a
              href={invitationWhatsApp(invitation)}
              className="inline-flex rounded-xl bg-emerald-900 px-5 py-4 font-semibold text-white"
            >
              Confirmar pelo WhatsApp
            </a>
            <p className="mt-5 text-sm text-slate-600">
              Você terá acesso à gestão da fazenda. O proprietário poderá remover seu acesso a
              qualquer momento.
            </p>
          </section>
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
                  "Peça “gerar link do painel” à TPEC-IA no WhatsApp.",
                  "Se tiver mais de uma fazenda, escolha qual deseja administrar.",
                  "Toque no link recebido. Seu acesso fica salvo neste dispositivo.",
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
                Pedir meu link no WhatsApp <ArrowRight size={17} />
              </a>
            </section>
            <section className="order-1 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-9 lg:order-2">
              <h2 className="text-2xl font-semibold">Acesse sua fazenda por link</h2>
              <p className="my-5 text-sm leading-relaxed text-slate-600">
                Peça seu link pessoal à TPEC-IA. Ele abre o aplicativo instalado ou o painel na web,
                sem digitar código. Nas próximas visitas, basta abrir o painel neste dispositivo.
              </p>
              <a
                href={whatsapp}
                className="inline-flex rounded-xl bg-emerald-900 px-5 py-4 font-semibold text-white"
              >
                Pedir link pelo WhatsApp
              </a>
              <p className="mt-6 border-t pt-5 text-xs text-slate-500">
                Mantenha seu link pessoal privado. Em dispositivos compartilhados, use Sair ao
                terminar.
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="farm-property-header mb-7 flex flex-wrap items-start justify-between gap-4">
              <FarmPhoto
                key={view.propertyId}
                photo={view.book.photo}
                busy={busy}
                canEdit={["owner", "manager"].includes(view.role)}
                onChange={(photo) =>
                  setProposal({
                    action: { kind: "property_update", photo },
                    requestId: crypto.randomUUID(),
                    version: view.version,
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <p className="farm-eyebrow text-xs font-medium">Gestão da propriedade</p>
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
              <div className="farm-header-actions flex w-full gap-2 md:w-auto">
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
                {!["fuel", "supplies", "team", "more", "imports"].includes(tab) && (
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
              className="farm-desktop-nav mb-6 hidden gap-1 overflow-x-auto border-b border-slate-100 bg-white md:flex"
            >
              {tabs
                .filter(([id]) => id !== "more" && (id !== "team" || view.role === "owner"))
                .map(([id, label]) => {
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
            <div
              className="farm-pages"
              ref={swipeSurface}
              onPointerDown={(event) => {
                gesture.current = null;
                if (
                  event.pointerType === "touch" ||
                  event.button !== 0 ||
                  !event.isPrimary ||
                  form ||
                  proposal ||
                  busy
                )
                  return;
                const target = event.target as HTMLElement;
                if (
                  target.closest(
                    "button,a,input,select,textarea,dialog,[role=dialog],summary,[data-no-swipe]",
                  )
                )
                  return;
                // Horizontal tables and carousels retain their own drag gestures.
                let node: HTMLElement | null = target;
                while (node && node !== event.currentTarget) {
                  if (
                    node.scrollWidth > node.clientWidth + 4 &&
                    /auto|scroll/.test(getComputedStyle(node).overflowX)
                  )
                    return;
                  node = node.parentElement;
                }
                gesture.current = {
                  x: event.clientX,
                  y: event.clientY,
                  at: Date.now(),
                  id: event.pointerId,
                };
                if (event.pointerType === "mouse")
                  event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = gesture.current;
                if (!start || start.id !== event.pointerId) return;
                const next = swipePanelTab(
                  tab,
                  event.clientX - start.x,
                  event.clientY - start.y,
                  Date.now() - start.at,
                );
                if (next) {
                  gesture.current = null;
                  navigate(next);
                }
              }}
              onPointerCancel={() => {
                gesture.current = null;
              }}
              onPointerUp={(event) => {
                const start = gesture.current;
                gesture.current = null;
                if (!start || start.id !== event.pointerId) return;
                const next = swipePanelTab(
                  tab,
                  event.clientX - start.x,
                  event.clientY - start.y,
                  Date.now() - start.at,
                );
                if (next) navigate(next);
              }}
            >
              {visitedTabs
                .filter(
                  (area) => primaryPanelTabs.some((primary) => primary === area) || area === tab,
                )
                .map((area) => (
                  <div
                    key={`${view.propertyId}:${view.role}:${area}`}
                    hidden={area !== tab}
                    className="farm-page space-y-6"
                    data-farm-area={area}
                  >
                    <FarmAreaContent
                      area={area}
                      view={view}
                      busy={busy}
                      onPropose={propose}
                      completeTask={completeTask}
                      navigate={navigate}
                      load={load}
                      api={api}
                      exit={exit}
                    />
                  </div>
                ))}
            </div>
            <Dialog
              open={form && !["fuel", "supplies", "team", "more", "imports"].includes(tab)}
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
                      book={view.book}
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
              <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
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
                (Brasília). Para acessar outra fazenda, abra o link correspondente enviado pelo
                WhatsApp.
              </p>
              <button
                disabled={busy}
                onClick={() => exit(true)}
                className="mt-4 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700"
              >
                Sair de todos os meus acessos desta fazenda
              </button>
            </details>
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
                  aria-current={
                    tab === id ||
                    (id === "more" && !["overview", "herd", "tasks", "finance"].includes(tab))
                      ? "page"
                      : undefined
                  }
                  onClick={() => navigate(id)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold ${tab === id || (id === "more" && !["overview", "herd", "tasks", "finance"].includes(tab)) ? "text-emerald-800" : "text-slate-500"}`}
                >
                  <Icon size={23} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </>
        )}
        {!nativeApp && (
          <Link to="/" className="mt-10 inline-flex items-center gap-2 text-sm text-slate-600">
            <ArrowLeft size={15} /> Voltar ao site
          </Link>
        )}
      </main>
    </div>
  );
}

// Visited primary areas retain their DOM and local state. Stable props let React
// skip work when only visibility changes; private data is discarded on logout.
const FarmAreaContent = memo(function FarmAreaContent({
  area,
  view,
  busy,
  onPropose,
  completeTask,
  navigate,
  load,
  api,
  exit,
}: {
  area: Tab;
  view: View;
  busy: boolean;
  onPropose(action: GuardianAction): Promise<void>;
  completeTask(task: string): void;
  navigate(tab: Tab): void;
  load(): Promise<void>;
  api: ReturnType<typeof createPanelClient>;
  exit(all?: boolean): void;
}) {
  if (area === "overview")
    return (
      <FarmMobileHome book={view.book} busy={busy} navigate={navigate} complete={completeTask} />
    );
  if (area === "team")
    return view.role === "owner" ? (
      <FarmTeam key={view.propertyId} team={view.team} api={api} refresh={load} />
    ) : null;
  if (area === "more")
    return (
      <section aria-label="Mais opções" className="farm-more-page">
        <h2 className="mb-4 text-xl font-semibold">Sua fazenda</h2>
        {tabs
          .filter(
            ([id]) =>
              !["overview", "herd", "tasks", "finance", "more"].includes(id) &&
              (id !== "team" || view.role === "owner"),
          )
          .map(([id, label]) => {
            const Icon = tabIcons[id];
            return (
              <button
                key={id}
                disabled={busy}
                onClick={() => navigate(id)}
                className="farm-more-row"
              >
                <Icon size={21} aria-hidden="true" />
                <span>{label}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            );
          })}
        <button disabled={busy} onClick={() => exit()} className="farm-more-row text-rose-700">
          <LogOut size={21} aria-hidden="true" />
          <span>Sair desta fazenda</span>
        </button>
      </section>
    );
  if (area === "imports") return <AnimalImports farmName={view.name} onImported={load} />;
  return (
    <>
      {area === "tasks" && <AndroidReminders />}
      <GuardianWorkspace
        detail={{
          id: view.propertyId,
          version: view.version,
          book: view.book,
          events: view.events,
          audit: view.audit,
          members: [],
        }}
        tab={area}
        canManageFuel={["owner", "manager"].includes(view.role)}
        busy={busy}
        onPropose={onPropose}
      />
    </>
  );
});
