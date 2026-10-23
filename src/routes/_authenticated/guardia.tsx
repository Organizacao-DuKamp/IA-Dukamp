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
  type GuardianDetail,
  type PropertySummary,
} from "@/lib/guardian.functions";
import { GuardianCalculator } from "@/components/guardian/GuardianCalculator";
import { GuardianActionForm } from "@/components/guardian/GuardianActionForm";
import { GuardianPreferences } from "@/components/guardian/GuardianPreferences";
import { printFarm } from "@/lib/guardian/print";
import { farmCsv } from "@/lib/guardian/export";
import { farmReport } from "@/lib/guardian/book";
import type { GuardianAction, GuardianSnapshot } from "@/lib/guardian/schema";

export const Route = createFileRoute("/_authenticated/guardia")({
  head: () => ({ meta: [{ title: "Guardiã da Fazenda · TPEC-IA" }] }),
  component: GuardianPage,
});
const cash = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const when = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
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
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
function Badge({ value }: { value: string }) {
  const title: Record<string, string> = {
    open: "Pendente",
    done: "Concluída",
    cancelled: "Cancelado",
    pending: "Na fila",
    claimed: "Em processamento",
    dispatching: "Em envio",
    retry: "Nova tentativa",
    sent: "Aceito pela Meta",
    uncertain: "Envio incerto",
    failed: "Falhou",
    expired: "Expirado",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${["sent", "done"].includes(value) ? "bg-emerald-100 text-emerald-950" : ["failed", "uncertain"].includes(value) ? "bg-amber-100 text-amber-950" : "bg-secondary text-secondary-foreground"}`}
    >
      {title[value] ?? value}
    </span>
  );
}

export function GuardianWorkspace({
  detail,
  tab,
  onPropose,
  busy,
  ownPhone,
}: {
  detail: GuardianDetail;
  tab: Tab;
  onPropose: (a: GuardianAction) => Promise<void>;
  busy: boolean;
  ownPhone?: string;
}) {
  const book = detail.book,
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [lot, setLot] = useState("");
  const expense = book.ledger
      .filter((e) => e.direction === "expense")
      .reduce((s, e) => s + e.amountCents, 0),
    income = book.ledger
      .filter((e) => e.direction === "income")
      .reduce((s, e) => s + e.amountCents, 0);
  const ownRole = detail.members.find((m) => m.phone_number === ownPhone && m.active)?.role;
  if (tab === "calculator") return <GuardianCalculator />;
  return (
    <div className="space-y-5">
      {tab === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Animais cadastrados", book.animals.length, "Somente o cadastro confirmado", Leaf],
              [
                "Tarefas pendentes",
                book.tasks.filter((t) => t.status === "open").length,
                "Manejo e acompanhamento",
                ClipboardList,
              ],
              ["Despesas registradas", cash(expense), "Custos lançados no caderno", Wallet],
              [
                "Saldo registrado",
                cash(income - expense),
                "Receitas menos despesas registradas",
                TrendingUp,
              ],
            ].map(([label, value, hint, Icon]) => {
              const I = Icon as typeof Leaf;
              return (
                <article
                  key={String(label)}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <I size={19} className="mb-4 text-emerald-700" />
                  <p className="text-xs text-muted-foreground">{String(label)}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{String(value)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{String(hint)}</p>
                </article>
              );
            })}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Próximas atividades</h2>
              <div className="mt-4 space-y-3">
                {book.tasks
                  .filter((t) => t.status === "open")
                  .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
                  .slice(0, 5)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {when(t.dueAt)} · Brasília
                        </p>
                      </div>
                      <Badge value="open" />
                    </div>
                  ))}
                {!book.tasks.some((t) => t.status === "open") && (
                  <Empty>
                    Nenhuma tarefa pendente. Registre a próxima atividade pelo WhatsApp ou neste
                    painel.
                  </Empty>
                )}
              </div>
            </section>
            <section className="rounded-2xl bg-emerald-950 p-5 text-emerald-50">
              <ShieldCheck size={28} className="text-emerald-300" />
              <h2 className="mt-4 text-xl font-semibold">Informação que você pode conferir</h2>
              <p className="mt-3 text-sm leading-relaxed text-emerald-100">
                Cada registro tem origem, data e confirmação. A Guardiã usa os dados informados pela
                equipe e avisos meteorológicos disponíveis para a localidade.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-emerald-100">
                O saldo reflete os lançamentos deste caderno. Custos não registrados impedem apurar
                o lucro completo da fazenda.
              </p>
              <div className="mt-5 rounded-xl border border-emerald-700 p-3 text-sm">
                Tudo gratuito. Avisos pelo WhatsApp dependem da autorização de cada destinatário.
              </div>
            </section>
          </div>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Relatório por período e lote</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Data inicial
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
                />
              </label>
              <label className="text-sm">
                Data final (exclusiva)
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
                />
              </label>
              <label className="text-sm">
                Lote (opcional)
                <input
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
                />
              </label>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-emerald-700">
                Ver relatório dos registros
              </summary>
              <pre className="mt-3 max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-xl bg-secondary/40 p-4 font-sans text-sm">
                {farmReport(book, {
                  start: start || undefined,
                  end: end || undefined,
                  lot: lot || undefined,
                })}
              </pre>
            </details>
            <button
              onClick={() =>
                download(
                  farmReport(book, {
                    start: start || undefined,
                    end: end || undefined,
                    lot: lot || undefined,
                  }),
                  "text/plain;charset=utf-8",
                  "relatorio-fazenda.txt",
                )
              }
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
            >
              <ArrowDownToLine size={16} />
              Baixar relatório
            </button>
          </section>
        </>
      )}
      {tab === "tasks" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Tarefas da propriedade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada tarefa gera um lembrete com validade. Concluir ou reagendar cancela o aviso
            anterior.
          </p>
          <div className="mt-5 space-y-3">
            {book.tasks.map((t) => (
              <article key={t.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{t.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {when(t.dueAt)} · Brasília{t.lot ? ` · Lote ${t.lot}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Código {t.id}</p>
                  </div>
                  <Badge value={t.status} />
                </div>
                {t.status === "open" && (
                  <div className="mt-3 flex gap-4 text-sm">
                    <button
                      disabled={busy}
                      className="inline-flex items-center gap-1 font-medium text-emerald-700 disabled:opacity-50"
                      onClick={() =>
                        void onPropose({ kind: "task_update", task: t.id, status: "done" })
                      }
                    >
                      <Check size={16} />
                      Concluir
                    </button>
                    <button
                      disabled={busy}
                      className="text-muted-foreground disabled:opacity-50"
                      onClick={() =>
                        void onPropose({ kind: "task_update", task: t.id, status: "cancelled" })
                      }
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!book.tasks.length && <Empty>Você ainda não cadastrou tarefas nesta fazenda.</Empty>}
          </div>
        </section>
      )}
      {tab === "herd" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Rebanho e histórico de pesagens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pesos estimados aparecem separados. Correções preservam os valores anteriores.
          </p>
          <div className="mt-5 space-y-3">
            {book.animals.map((a) => (
              <details key={a.code} className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  {a.code} ·{" "}
                  {a.sex === "female" ? "Fêmea" : a.sex === "male" ? "Macho" : "Sexo pendente"}
                  {a.breed ? ` · ${a.breed}` : ""}
                  {a.lot ? ` · Lote ${a.lot}` : ""}
                </summary>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nascimento: {a.birthDate ?? "não informado"} · Atualizado em {when(a.source.at)}
                </p>
                <div className="mt-3 space-y-2">
                  {a.weights.map((w) => (
                    <div key={w.date} className="rounded-lg bg-secondary/50 p-3 text-sm">
                      {w.date.split("-").reverse().join("/")} · <strong>{w.weightKg} kg</strong>
                      {w.estimated ? " (estimado)" : " (informado)"}
                      {w.corrections.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Correções:{" "}
                          {w.corrections.map((c) => `${c.weightKg} kg em ${when(c.at)}`).join("; ")}
                        </p>
                      )}
                    </div>
                  ))}
                  {!a.weights.length && (
                    <p className="text-sm text-muted-foreground">Ainda sem pesagem.</p>
                  )}
                </div>
              </details>
            ))}
            {!book.animals.length && (
              <Empty>Cadastre o código dos animais para acompanhar pesagens individuais.</Empty>
            )}
          </div>
        </section>
      )}
      {tab === "records" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Caderno de campo</h2>
          <div className="mt-5 space-y-3">
            {book.records.map((r) => (
              <article key={r.id} className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">
                  {r.date.split("-").reverse().join("/")}
                  {r.lot ? ` · Lote ${r.lot}` : ""} · {r.id}
                </p>
                <p className="mt-2 text-sm">{r.description}</p>
                {r.count && (
                  <p className="mt-1 text-sm font-medium">Quantidade informada: {r.count}</p>
                )}
                {(ownRole === "owner" || ownRole === "manager") && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void onPropose({ kind: "delete_record", section: "records", id: r.id })
                    }
                    className="mt-3 text-xs text-destructive"
                  >
                    Revisar exclusão
                  </button>
                )}
              </article>
            ))}
            {!book.records.length && (
              <Empty>
                Registre manejo, nascimentos, compras e ocorrências em texto ou áudio pelo WhatsApp.
              </Empty>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Relatos sanitários organizam informações. Fotografias e descrições não confirmam
            diagnóstico nem autorizam prescrição individualizada.
          </p>
        </section>
      )}
      {tab === "finance" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Receitas e despesas registradas</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Receitas", income],
              ["Despesas", expense],
              ["Saldo", income - expense],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold">{cash(Number(value))}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {book.ledger.map((l) => (
                  <tr key={l.id} className="border-b border-border/70">
                    <td className="whitespace-nowrap p-3">
                      {l.date.split("-").reverse().join("/")}
                    </td>
                    <td className="p-3">
                      {l.description}
                      {l.lot && (
                        <span className="block text-xs text-muted-foreground">Lote {l.lot}</span>
                      )}
                    </td>
                    <td className="p-3">{l.direction === "expense" ? "Despesa" : "Receita"}</td>
                    <td className="whitespace-nowrap p-3 text-right font-medium">
                      {cash(l.amountCents)}
                    </td>
                    <td>
                      {(ownRole === "owner" || ownRole === "manager") && (
                        <button
                          disabled={busy}
                          className="text-xs text-destructive"
                          onClick={() =>
                            void onPropose({ kind: "delete_record", section: "ledger", id: l.id })
                          }
                          aria-label={`Revisar exclusão de ${l.description}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!book.ledger.length && <Empty>Nenhuma movimentação registrada.</Empty>}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Saldo dos lançamentos não equivale a lucro líquido. Use a calculadora para simular
            custos por cabeça, por kg e cenários de venda.
          </p>
        </section>
      )}
      {tab === "events" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Eventos e histórico de avisos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Últimos 50 eventos da propriedade. “Aceito pela Meta” confirma a aceitação do envio; não
            confirma leitura.
          </p>
          <div className="mt-5 space-y-3">
            {detail.events.map((e) => (
              <article key={e.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {e.type === "task_due"
                      ? "TAREFA"
                      : e.type === "weather_alert"
                        ? "CLIMA"
                        : e.topic.toUpperCase()}
                  </span>
                  <Badge value={e.status} />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{e.message}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Previsto: {when(e.not_before)} · Validade: {when(e.expires_at)} · Tentativas:{" "}
                  {e.attempts}
                </p>
                {e.last_error && (
                  <p className="mt-2 text-xs text-muted-foreground">Motivo: {e.last_error}</p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Conferir evidências
                  </summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-xs">
                    {JSON.stringify(e.evidence, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
            {!detail.events.length && (
              <Empty>
                Nenhum evento desta fazenda. A Guardiã envia avisos quando há um motivo verificável
                e autorização do destinatário.
              </Empty>
            )}
          </div>
        </section>
      )}
      {tab === "settings" && (
        <>
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Users size={20} />
              <h2 className="text-lg font-semibold">Equipe autorizada</h2>
            </div>
            <div className="mt-4 space-y-3">
              {detail.members.map((m) => (
                <div
                  key={m.phone_number}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{m.phone_number}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {{
                        owner: "Proprietário",
                        manager: "Gerente",
                        worker: "Funcionário",
                        technician: "Responsável técnico",
                      }[m.role] ?? m.role}{" "}
                      · {m.active ? "Acesso ativo" : "Revogado"}
                    </p>
                  </div>
                  {ownRole === "owner" && m.role !== "owner" && m.active && (
                    <button
                      disabled={busy}
                      onClick={() => void onPropose({ kind: "revoke", phone: m.phone_number })}
                      className="text-sm text-destructive"
                    >
                      Revogar acesso
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Um convite concede acesso após a aceitação pelo número convidado. Conversas privadas
              de cada integrante não são compartilhadas com a equipe.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Seus dados</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Baixe o caderno completo da propriedade. O JSON inclui origem e correções; o CSV
              organiza os registros para planilha.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  download(
                    JSON.stringify(
                      { propertyId: detail.id, exportedAt: new Date().toISOString(), book },
                      null,
                      2,
                    ),
                    "application/json",
                    "fazenda-dados.json",
                  )
                }
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Exportar JSON
              </button>
              <button
                onClick={() =>
                  download(farmCsv(book), "text/csv;charset=utf-8", "fazenda-registros.csv")
                }
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Exportar CSV
              </button>
              <button
                onClick={() => printFarm(book)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Imprimir / salvar PDF
              </button>
            </div>
            {ownRole === "owner" && (
              <button
                disabled={busy}
                onClick={() => void onPropose({ kind: "property_delete", name: book.name })}
                className="mt-6 text-sm text-destructive"
              >
                Revisar exclusão da propriedade e de seus registros
              </button>
            )}
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Histórico de alterações</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Últimas 50 operações. Cada gravação exige confirmação e registra a origem.
            </p>
            <div className="mt-4 space-y-2">
              {detail.audit.map((a) => (
                <details key={a.id} className="rounded-lg bg-secondary/50 p-3 text-sm">
                  <summary className="cursor-pointer">
                    {when(a.created_at)} ·{" "}
                    {(
                      {
                        create: "Criação da propriedade",
                        update: "Registro atualizado",
                        invite: "Convite criado",
                        revoke: "Acesso revogado",
                        accept: "Convite aceito",
                        select: "Propriedade selecionada",
                      } as Record<string, string>
                    )[a.action] ?? a.action}
                  </summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(a.details, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function GuardianPage() {
  const overviewFn = useServerFn(guardianOverview),
    detailFn = useServerFn(guardianPropertyDetail),
    linkFn = useServerFn(guardianCreateWebLink),
    submitFn = useServerFn(guardianSubmitAction);
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
