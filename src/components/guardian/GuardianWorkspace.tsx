import { FinanceLedger } from "./FinanceLedger";
import { PanelMetric } from "./PanelMetric";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { FarmOperations } from "./FarmOperations";
import { useRef, useState } from "react";
import { ArrowDownToLine, Check, ClipboardList, TrendingUp, Users } from "lucide-react";
import type { GuardianDetail, GuardianEventHistoryView } from "@/lib/guardian.functions";
import type { GuardianAction } from "@/lib/guardian/schema";
import { GuardianCalculator } from "./GuardianCalculator";
import { farmCsv } from "@/lib/guardian/export";
import { farmReport } from "@/lib/guardian/book";
import { printFarm } from "@/lib/guardian/print";
import { ledgerForTotals } from "@/lib/guardian/finance";
type Tab =
  | "overview"
  | "tasks"
  | "herd"
  | "records"
  | "finance"
  | "events"
  | "calculator"
  | "settings";
const cash = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const when = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
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
    sent: "Envio aceito",
    uncertain: "Envio incerto",
    failed: "Falhou",
    expired: "Expirado",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${["sent", "done"].includes(value) ? "bg-emerald-100 text-emerald-950" : ["failed", "uncertain"].includes(value) ? "bg-amber-100 text-amber-950" : value === "open" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}
    >
      {title[value] ?? value}
    </span>
  );
}

type HistoryLoader = (eventId: string) => Promise<{
  entries: GuardianEventHistoryView[];
  partial: boolean;
}>;
function EventTimeline({ eventId, load }: { eventId: string; load: HistoryLoader }) {
  const [result, setResult] = useState<Awaited<ReturnType<HistoryLoader>> | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    // Clear the old result on refresh so a revoked session cannot keep showing it.
    setResult(null);
    try {
      setResult(await load(eventId));
    } catch {
      setError("Não foi possível consultar o histórico. Confira seu acesso e tente novamente.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }
  return (
    <details
      className="mt-4 border-t border-border pt-3"
      onToggle={(e) => {
        if (e.currentTarget.open && !result) void refresh();
      }}
    >
      <summary className="cursor-pointer text-xs font-semibold text-emerald-700">
        Histórico de processamento
      </summary>
      {loading && (
        <p role="status" className="mt-3 text-xs">
          Consultando o histórico…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
      {result && (
        <>
          {result.partial && (
            <p className="mt-3 text-xs text-muted-foreground">
              Histórico parcial: exibindo as 200 mudanças mais recentes.
            </p>
          )}
          <ol
            aria-label="Mudanças de estado do aviso"
            className="mt-3 space-y-3 border-l-2 border-emerald-700/25 pl-4"
          >
            {result.entries.map((h) => (
              <li key={h.id} className="space-y-1 text-xs">
                <p className="text-muted-foreground">{when(h.created_at)}</p>
                <Badge value={h.status} />
                {h.reason && (
                  <p className="break-words text-muted-foreground">Motivo: {h.reason}</p>
                )}
              </li>
            ))}
          </ol>
          {!result.entries.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Nenhuma mudança de estado registrada.
            </p>
          )}
        </>
      )}
      {!loading && (
        <button
          onClick={() => void refresh()}
          className="mt-3 text-xs font-semibold text-emerald-700"
        >
          {error ? "Tentar novamente" : "Atualizar histórico"}
        </button>
      )}
    </details>
  );
}

export function GuardianWorkspace({
  detail,
  tab,
  onPropose,
  busy,
  ownPhone,
  loadEventHistory,
}: {
  detail: GuardianDetail;
  tab: Tab;
  onPropose: (a: GuardianAction) => Promise<void>;
  busy: boolean;
  ownPhone?: string;
  loadEventHistory?: HistoryLoader;
}) {
  const book = detail.book,
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [lot, setLot] = useState("");
  const ledgerTotals = ledgerForTotals(book.ledger);
  const expense = ledgerTotals
      .filter((e) => e.direction === "expense")
      .reduce((s, e) => s + e.amountCents, 0),
    income = ledgerTotals
      .filter((e) => e.direction === "income")
      .reduce((s, e) => s + e.amountCents, 0);
  const ownRole = detail.members.find((m) => m.phone_number === ownPhone && m.active)?.role;
  if (tab === "calculator") return <GuardianCalculator />;
  return (
    <div className="space-y-5">
      {(tab === "overview" || tab === "herd") && (
        <FarmOperations book={book} compact={tab === "overview"} />
      )}
      {tab === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PanelMetric
              label="Receitas"
              value={cash(income)}
              icon={ArrowDownLeft}
              tone="positive"
            />
            <PanelMetric
              label="Despesas"
              value={cash(expense)}
              icon={ArrowUpRight}
              tone="negative"
            />
            <PanelMetric
              label="Saldo registrado"
              value={cash(income - expense)}
              icon={TrendingUp}
              tone={income - expense < 0 ? "negative" : "positive"}
            />
            <PanelMetric
              label="Tarefas pendentes"
              value={book.tasks.filter((t) => t.status === "open").length}
              icon={ClipboardList}
              tone="warning"
            />
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
                  <Empty>Tudo em dia. Nenhuma tarefa pendente.</Empty>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Últimos lançamentos</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {book.ledger
                  .slice()
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) || b.source.at.localeCompare(a.source.at),
                  )
                  .slice(0, 4)
                  .map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{e.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {e.direction === "expense" ? "Despesa" : "Receita"} ·{" "}
                          {e.date.split("-").reverse().join("/")}
                          {!ledgerTotals.includes(e) && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5">
                              Já incluído no total
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold ${e.direction === "expense" ? "text-rose-700" : "text-emerald-700"}`}
                      >
                        {e.direction === "expense" ? "−" : "+"} {cash(e.amountCents)}
                      </span>
                    </div>
                  ))}
              </div>
              {!book.ledger.length && <Empty>Nenhum lançamento financeiro.</Empty>}
            </section>
          </div>
          <section className="rounded-2xl border border-border bg-card p-5">
            <details>
              <summary className="cursor-pointer font-semibold">Relatórios e exportação</summary>
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
            </details>
          </section>
        </>
      )}
      {tab === "tasks" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Tarefas da propriedade</h2>

          <div className="mt-5 space-y-3">
            {book.tasks.map((t) => (
              <article key={t.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{t.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {when(t.dueAt)} · Brasília{t.lot ? ` · Lote ${t.lot}` : ""}
                    </p>
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
          <h2 className="text-lg font-semibold">Fichas dos animais</h2>

          <div className="mt-5 space-y-3">
            {book.animals.map((a) => (
              <details key={a.code} className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  {a.code} ·{" "}
                  {a.sex === "female" ? "Fêmea" : a.sex === "male" ? "Macho" : "Sexo pendente"}
                  {a.breed ? ` · ${a.breed}` : ""}
                  {a.lot ? ` · Lote ${a.lot}` : ""}
                  {a.rgn && (
                    <span className="ml-2 inline-flex rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">
                      RGN {a.rgn}
                    </span>
                  )}
                </summary>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nascimento: {a.birthDate ?? "não informado"} · Atualizado em {when(a.source.at)}
                </p>
                {(a.name || a.rgn || a.rgd || a.sire || a.dam || a.category) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.name ? `${a.name} · ` : ""}
                    {a.category ? `Categoria: ${a.category} · ` : ""}
                    {a.rgn ? `RGN informado: ${a.rgn} · ` : ""}
                    {a.rgd ? `RGD informado: ${a.rgd} · ` : ""}Pai: {a.sire ?? "não informado"};
                    mãe: {a.dam ?? "não informada"}. Dados declarados, sem validação automática do
                    registro oficial.
                  </p>
                )}
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
                  {r.lot ? ` · Lote ${r.lot}` : ""}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.type === "health" ? "bg-violet-50 text-violet-800" : "bg-sky-50 text-sky-800"}`}
                >
                  {r.type === "health" ? "Sanidade" : "Manejo"}
                </span>
                <p className="mt-2 text-sm">{r.description}</p>
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="w-fit cursor-pointer">Origem do registro</summary>
                  <p className="mt-2">
                    Código: {r.id} · {when(r.source.at)}
                  </p>
                </details>
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
            {!book.records.length && <Empty>Nenhuma anotação no caderno de campo.</Empty>}
          </div>
          <details className="mt-4 text-xs text-slate-500">
            <summary className="cursor-pointer">Sobre relatos sanitários</summary>
            <p className="mt-2">
              Fotografias e descrições não confirmam diagnóstico nem autorizam prescrição
              individualizada.
            </p>
          </details>
        </section>
      )}
      {tab === "finance" && (
        <FinanceLedger
          ledger={book.ledger}
          busy={busy}
          canDelete={ownRole === "owner" || ownRole === "manager"}
          onPropose={onPropose}
        />
      )}
      {tab === "events" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Avisos da fazenda</h2>
          <details className="mt-2 text-xs text-slate-500">
            <summary className="w-fit cursor-pointer">Sobre os avisos</summary>
            <p className="mt-2">
              Últimos 50 eventos. Envio aceito não confirma entrega nem leitura.
            </p>
          </details>
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
                {loadEventHistory && (
                  <EventTimeline key={e.id} eventId={e.id} load={loadEventHistory} />
                )}
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
                onClick={() =>
                  void onPropose({
                    kind: "property_delete",
                    name: book.name ?? "Propriedade sem nome",
                  })
                }
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
