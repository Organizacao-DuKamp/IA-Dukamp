import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  KeyRound,
  Leaf,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { GuardianWorkspace } from "@/components/guardian/GuardianWorkspace";
import { GuardianActionForm } from "@/components/guardian/GuardianActionForm";
import { describeAction } from "@/lib/guardian/book";
import type { FarmBook, GuardianAction, GuardianRole } from "@/lib/guardian/schema";
import type { GuardianDetail } from "@/lib/guardian.functions";

export const Route = createFileRoute("/painelfazenda")({
  head: () => ({
    meta: [
      { title: "Painel da Fazenda · TPEC-IA" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: FarmPanel,
});
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
  ["events", "Avisos e histórico"],
  ["calculator", "Calculadoras"],
] as const;
type Tab = (typeof tabs)[number][0];
const endpoint = "/api/public/farm-panel";
const whatsapp = "https://wa.me/5516992256069?text=" + encodeURIComponent("Gerar código do painel");
async function api(method = "GET", body?: unknown) {
  const result = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json", "x-tpec-panel": "1" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json();
  if (!result.ok)
    throw Object.assign(new Error(data.error ?? "Não foi possível acessar o painel."), {
      status: result.status,
    });
  return data;
}
function FarmPanel() {
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
    inFlight = useRef(false);
  const load = useCallback(async () => {
    const run = ++generation.current;
    try {
      const data = await api();
      if (run === generation.current) setView(data);
    } catch (e) {
      if (run === generation.current) {
        setView(null);
        setProposal(null);
        if (!(e instanceof Error && "status" in e && e.status === 401))
          setError(e instanceof Error ? e.message : "Tente novamente.");
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
          "lot_update",
          "task_create",
          "expense",
          "income",
          "record",
          "animal",
          "weighing",
        ];
  return (
    <div className="min-h-screen bg-[#f4f6f2] text-slate-900">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <Link to="/" className="flex items-center gap-3 font-semibold">
            <span className="rounded-xl bg-emerald-900 p-2.5 text-white">
              <Leaf size={23} />
            </span>
            <span>
              TPEC-IA<small className="block font-normal text-slate-500">Painel da Fazenda</small>
            </span>
          </Link>
          {view && (
            <button
              disabled={busy}
              onClick={() => {
                if (inFlight.current) return;
                inFlight.current = true;
                setBusy(true);
                void api("DELETE")
                  .then(() => {
                    generation.current++;
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
              }}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <LogOut size={16} /> Sair
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:py-12">
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
        {loading ? (
          <p role="status" className="py-20 text-center">
            Conferindo seu acesso…
          </p>
        ) : !view ? (
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-center">
            <section className="py-5">
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
            <section className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm sm:p-9">
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
                <h1 className="mt-2 text-3xl font-semibold">{view.name}</h1>
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
              <div className="flex gap-2">
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
                <button
                  disabled={busy}
                  onClick={() => setForm((f) => !f)}
                  className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  {form ? "Fechar formulário" : "Novo registro"}
                </button>
              </div>
            </div>
            <nav aria-label="Áreas da fazenda" className="mb-7 flex gap-2 overflow-x-auto pb-2">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium ${tab === id ? "bg-emerald-900 text-white" : "border bg-white text-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="space-y-6">
              {proposal && (
                <section
                  aria-label="Revisar alteração"
                  className="rounded-2xl border-2 border-amber-600/40 bg-amber-50 p-5"
                >
                  <h2 className="font-semibold">Confira antes de salvar</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {describeAction(proposal.action)}
                  </p>
                  <p className="mt-2 text-sm">Fazenda: {view.name}.</p>
                  <div className="mt-4 flex gap-3">
                    <button
                      disabled={busy}
                      onClick={() => void save()}
                      className="flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      <Check size={17} />
                      {busy ? "Salvando…" : "Confirmar e salvar"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setProposal(null)}
                      className="rounded-lg border bg-white px-4 py-3 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              )}
              {form && (
                <GuardianActionForm
                  key={view.propertyId}
                  hasProperty
                  busy={busy}
                  allowedKinds={allowed}
                  onPropose={async (action) => {
                    setProposal({ action, requestId: crypto.randomUUID(), version: view.version });
                    setError("");
                    setNotice("");
                  }}
                />
              )}
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
                busy={busy}
                onPropose={async (action) => {
                  setProposal({ action, requestId: crypto.randomUUID(), version: view.version });
                  setError("");
                  setNotice("");
                }}
              />
            </div>
            <p className="mt-8 text-xs leading-relaxed text-slate-500">
              Dados informados pelo produtor e cálculos sobre os registros disponíveis. Não
              representam medição em tempo real nem diagnóstico veterinário. A sessão vence em{" "}
              {new Date(view.expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}{" "}
              (Brasília). Para outra fazenda, saia e peça o código correspondente no WhatsApp.
            </p>
          </>
        )}
        <Link to="/" className="mt-10 inline-flex items-center gap-2 text-sm text-slate-600">
          <ArrowLeft size={15} /> Voltar ao site
        </Link>
      </main>
    </div>
  );
}
