import { useEffect, useState } from "react";
import { MapPin, RefreshCw, Users } from "lucide-react";
import type { ObservedSummary, ObservedDetail } from "@/lib/guardian.functions";
import { observedFields } from "@/lib/guardian/observed-property";

function day(value: string) {
  return value.split("-").reverse().join("/");
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
function display(value: string | number, field: string) {
  if (typeof value === "number")
    return new Intl.NumberFormat("pt-BR").format(value) + (field === "areaHa" ? " ha" : " cabeças");
  return value;
}
export function GuardianObservedProfiles({
  profiles,
  partial,
  loadDetail,
}: {
  profiles: ObservedSummary[];
  partial: boolean;
  loadDetail: (id: string) => Promise<ObservedDetail>;
}) {
  const [selected, setSelected] = useState(profiles[0]?.id ?? "");
  const [detail, setDetail] = useState<ObservedDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setSelected((id) => (profiles.some((p) => p.id === id) ? id : (profiles[0]?.id ?? "")));
  }, [profiles]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    if (!selected || !profiles.some((p) => p.id === selected)) return;
    setLoading(true);
    void loadDetail(selected)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível consultar este perfil. Atualize a lista ou confira seu acesso.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, profiles, loadDetail, version]);
  const shown = profiles.filter((p) =>
    [p.name, p.phone, String(p.facts.city?.value ?? "")]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(filter.toLocaleLowerCase("pt-BR")),
  );
  const title = profiles.find((p) => p.id === selected)?.name;
  return (
    <section aria-label="Perfis informados nas conversas" className="space-y-5">
      <div className="rounded-2xl border border-emerald-700/20 bg-emerald-700/5 p-5 text-sm leading-relaxed">
        <p className="font-semibold">O que o produtor afirmou, com data e origem.</p>
        <p className="mt-1 text-muted-foreground">
          Estes perfis aparecem automaticamente quando a pessoa informa dados da propriedade. Não é
          necessário conhecer o nome da fazenda. Hipóteses, dúvidas, estimativas e planos futuros
          não preenchem o perfil.
        </p>
        <p className="mt-2 text-muted-foreground">
          Quantidades são variáveis: o painel mostra o último valor informado e mantém os anteriores
          no histórico. Uma quantidade relatada não cria fichas individuais de animais. O acesso a
          estes perfis é restrito à administração.
        </p>
      </div>
      {!profiles.length ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Ainda não há perfis com informações afirmadas pelo produtor. Eles aparecerão aqui conforme
          as conversas forem processadas.
        </p>
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Buscar produtor ou propriedade
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Nome, telefone ou município"
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 font-normal"
              />
            </label>
            <div
              aria-label="Propriedades da conversa"
              className="max-h-[650px] space-y-2 overflow-auto"
            >
              {shown.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  aria-pressed={selected === p.id}
                  className={`block w-full break-words rounded-xl border p-4 text-left text-sm ${selected === p.id ? "border-emerald-700 bg-emerald-700/10" : "border-border bg-card hover:bg-accent"}`}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    WhatsApp {p.phone}
                  </span>
                  {p.facts.city && (
                    <span className="mt-2 flex items-center gap-1 text-xs">
                      <MapPin size={13} />
                      {String(p.facts.city.value)}
                      {p.facts.uf ? "/" + p.facts.uf.value : ""}
                    </span>
                  )}
                  {p.facts.herdTotal && (
                    <span className="mt-2 flex items-center gap-1 text-xs">
                      <Users size={13} />
                      {display(p.facts.herdTotal.value, "herdTotal")} ·{" "}
                      {day(p.facts.herdTotal.effectiveDate)}
                    </span>
                  )}
                </button>
              ))}
              {!shown.length && (
                <p className="py-5 text-sm text-muted-foreground">
                  Nenhum perfil corresponde à busca.
                </p>
              )}
            </div>
            {partial && (
              <p className="text-xs text-muted-foreground">
                Mostrando os 100 perfis atualizados mais recentemente. A lista é parcial.
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="break-words text-lg font-semibold">
                  {title ?? "Selecione um perfil"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Perfil formado a partir de informações do produtor
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVersion((v) => v + 1)}
                disabled={loading || !selected}
                aria-label="Atualizar perfil"
                className="rounded-lg border border-border p-2 disabled:opacity-50"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {loading && (
              <p role="status" className="py-8 text-sm text-muted-foreground">
                Carregando as informações e suas origens…
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {detail && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.current.map((f) => (
                    <article
                      key={f.id}
                      className="min-w-0 rounded-xl border border-border bg-card p-4"
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {observedFields[f.field].label}
                      </p>
                      <p className="mt-2 break-words text-lg font-semibold">
                        {display(f.value, f.field)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {observedFields[f.field].variable ? "Dado variável" : "Dado de cadastro"} ·
                        referência em {day(f.effective_date)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Informado em {dateTime(f.source_at)}
                      </p>
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-medium text-emerald-700">
                          Mensagem de origem
                        </summary>
                        {f.source_question && (
                          <p className="mt-2 break-words text-muted-foreground">
                            Pergunta de contexto: {f.source_question}
                          </p>
                        )}
                        <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-emerald-700/30 pl-3 text-muted-foreground">
                          {f.source_excerpt}
                        </blockquote>
                      </details>
                    </article>
                  ))}
                </div>
                <section className="rounded-xl border border-border bg-card p-4">
                  <h4 className="font-semibold">Histórico das informações</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    As atualizações preservam o que foi informado antes. Um relato antigo processado
                    depois não substitui um valor mais recente.
                  </p>
                  <ol aria-label="Histórico dos dados do produtor" className="mt-4 space-y-3">
                    {detail.history.map((f) => (
                      <li key={f.id} className="rounded-lg bg-secondary/50 p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">
                            {observedFields[f.field].label}: {display(f.value, f.field)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Referência: {day(f.effective_date)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Informado em {dateTime(f.source_at)}
                        </p>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer">Ver relato original</summary>
                          <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                            {f.source_excerpt}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ol>
                  {detail.partial && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Histórico parcial: mostrando até 200 informações mais recentes.
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
