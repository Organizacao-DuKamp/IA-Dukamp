import { PanelMetric } from "./PanelMetric";
import { Beef, Sprout, MinusCircle } from "lucide-react";
import { useState } from "react";
import { farmIndicators, emptyOperations, stockAt, speciesNames } from "@/lib/guardian/operations";
import type { FarmBook } from "@/lib/guardian/schema";

export function FarmOperations({ book, compact = false }: { book: FarmBook; compact?: boolean }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [start, setStart] = useState(today.slice(0, 7) + "-01"),
    [end, setEnd] = useState(today),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const data = farmIndicators(book, start, end),
    operations = book.operations ?? emptyOperations();
  const rows = [
    ...operations.counts.map((c) => ({
      ...c,
      type: "Contagem declarada",
      description: "Quantidade ao fim do dia — " + speciesNames[c.species ?? "cattle"],
    })),
    ...operations.movements.map((m) => ({
      ...m,
      type: {
        birth: "Nascimento",
        death: "Morte",
        sale: "Venda",
        purchase: "Compra",
        transfer_in: "Entrada de lote",
        transfer_out: "Saída de lote",
      }[m.type],
    })),
  ]
    .filter(
      (r) =>
        r.date >= start &&
        r.date <= end &&
        `${r.type} ${r.lot ?? ""} ${r.description} ${speciesNames[r.species ?? "cattle"]}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.source.at.localeCompare(a.source.at));
  const replaced = new Set(operations.movements.map((m) => m.replaces).filter(Boolean));
  return (
    <section
      className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
      aria-label="Gestão do rebanho"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Rebanho e desempenho</h2>
        <span className="text-xs text-slate-500">
          {compact
            ? "Neste mês"
            : `${start.split("-").reverse().join("/")} — ${end.split("-").reverse().join("/")}`}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <PanelMetric
          label={
            data.stocksBySpecies.some((s) => s.species !== "cattle")
              ? "Bovinos contabilizados"
              : "Rebanho calculado"
          }
          value={data.stock.count ?? "Não informado"}
          icon={Beef}
          hint={data.stock.count === null ? "Contagem inicial pendente" : "cabeças"}
        />
        <PanelMetric
          label={
            data.stocksBySpecies.some((s) => s.species !== "cattle")
              ? "Nascimentos bovinos"
              : "Nascimentos"
          }
          value={data.births}
          icon={Sprout}
          tone="positive"
        />
        <PanelMetric
          label={
            data.stocksBySpecies.some((s) => s.species !== "cattle")
              ? "Mortes de bovinos"
              : "Mortes"
          }
          value={data.deaths}
          icon={MinusCircle}
          tone={data.deaths > 0 ? "negative" : "neutral"}
        />
      </div>
      {data.stocksBySpecies.some((s) => s.species !== "cattle") && (
        <section className="rounded-xl border p-4 text-sm" aria-label="Animais por espécie">
          <h3 className="font-semibold">Animais por espécie</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.stocksBySpecies.map((s) => (
              <div key={s.species} className="rounded-lg bg-slate-50 p-3">
                <span>{s.label}</span>
                <strong className="block text-xl">{s.count}</strong>
              </div>
            ))}
          </div>
          <p className="mt-3 font-semibold">
            Total das espécies com contagem: {data.stocksBySpecies.reduce((n, s) => n + s.count, 0)}{" "}
            animais.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            As espécies têm saldos separados. Porcos e aves não são somados aos bovinos.
          </p>
        </section>
      )}
      {!!operations.inventories?.length &&
        (() => {
          const inventory = operations.inventories
            .filter((i) => i.date <= end)
            .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))
            .at(-1);
          return inventory ? (
            <section className="rounded-xl border p-4 text-sm" aria-label="Rebanho por grupos">
              <h3 className="font-semibold">
                Rebanho por grupos · {inventory.date.split("-").reverse().join("/")}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {inventory.mode === "additional"
                  ? "Animais adicionais já somados aos saldos por espécie"
                  : inventory.complete
                    ? "Levantamento do rebanho existente"
                    : "Levantamento parcial"}
                . Subgrupos incluídos nos grupos principais. Identificação individual pode ser
                informada depois.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {inventory.groups.map((g) => (
                  <article key={g.name} className="rounded-lg border p-3">
                    <strong>
                      {g.count} · {g.name}
                    </strong>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {speciesNames[g.species ?? "cattle"]}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{g.description}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null;
        })()}
      {!compact && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              De
              <input
                type="date"
                aria-label="Início do período"
                value={start}
                max={end}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPage(0);
                }}
                className="mt-1 block w-full rounded-xl border bg-background p-2.5"
              />
            </label>
            <label className="text-sm">
              Até
              <input
                type="date"
                aria-label="Fim do período"
                value={end}
                min={start}
                max={today}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPage(0);
                }}
                className="mt-1 block w-full rounded-xl border bg-background p-2.5"
              />
            </label>
            <label className="text-sm">
              Buscar movimento ou lote
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Ex.: nascimento, lote 2"
                className="mt-1 block w-full rounded-xl border bg-background p-2.5"
              />
            </label>
          </div>
          {(data.consumption.measuredKg > 0 || data.consumption.estimatedKg > 0) && (
            <div className="rounded-xl border p-4 text-sm">
              <h3 className="font-semibold">Consumo de alimentos / suplementos no período</h3>
              <p className="mt-2">
                Informado como medido: {data.consumption.measuredKg.toLocaleString("pt-BR")} kg.
                Estimado: {data.consumption.estimatedKg.toLocaleString("pt-BR")} kg.
              </p>
              <p className="mt-2 text-muted-foreground">{data.consumption.formula}</p>
            </div>
          )}
          {!operations.inventories?.some((i) => i.complete && i.date <= end) &&
            Object.keys(data.categories).length > 0 && (
              <div className="rounded-xl border p-4 text-sm">
                <h3 className="font-semibold">Categorias informadas</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {Object.entries(data.categories).map(([category, c]) => (
                    <p key={category}>
                      {
                        (
                          {
                            cows: "Vacas",
                            oxen: "Bois",
                            calves: "Bezerros",
                            heifers: "Novilhas",
                          } as Record<string, string>
                        )[category]
                      }
                      : <strong>{c.count}</strong>
                      <span className="block text-xs text-muted-foreground">
                        Referência: {c.date}
                      </span>
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Não somamos as categorias ao total sem conferir se os grupos se sobrepõem.
                </p>
              </div>
            )}
          {data.evolution && (
            <p className="text-sm text-muted-foreground">
              Contagens declaradas: {data.evolution.initial} ({data.evolution.from}) →{" "}
              {data.evolution.final} ({data.evolution.to}), variação de {data.evolution.change}{" "}
              cabeças
              {data.evolution.percent !== null
                ? ` (${data.evolution.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`
                : ""}
              . O registro não presume a causa dessa diferença.
            </p>
          )}
          <details className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <summary className="cursor-pointer font-medium">Detalhes dos indicadores</summary>
            <p className="mt-3">
              Regra: {data.ruleVersion}. Período: {start} a {end} (Brasília).
            </p>
            <p className="mt-2">
              {data.stock.formula}.{" "}
              {data.stock.baseline
                ? `Contagem de origem: ${data.stock.baseline.count} em ${data.stock.baseline.date}; ${data.stock.included.length} movimentações posteriores.`
                : "Informe uma contagem inicial para calcular o estoque. Quantidade de fichas individuais não é um censo."}
            </p>
            <p className="mt-2">{data.gmdFormula}</p>
            {data.gmd.map((g) => (
              <p key={g.animal} className="mt-2">
                Animal {g.animal}: {g.value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                kg/dia, de {g.initialKg} kg ({g.start}) a {g.finalKg} kg ({g.end}).
              </p>
            ))}
            {!data.gmd.length && (
              <p className="mt-2">
                GMD indisponível: faltam duas pesagens medidas do mesmo animal no período.
              </p>
            )}
            {data.missing.map((m) => (
              <p key={m} className="mt-2">
                {m}
              </p>
            ))}
            <p className="mt-2">
              Zero eventos lançados não comprova ausência de acontecimentos. Não calculamos taxas
              com cobertura desconhecida.
            </p>
          </details>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-3 text-left font-semibold">
                Movimentações · {rows.length} registros
              </caption>
              <thead>
                <tr className="border-b">
                  <th className="p-2">Data</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Quantidade</th>
                  <th className="p-2">Lote</th>
                  <th className="p-2">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * 20, page * 20 + 20).map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="whitespace-nowrap p-2">
                      {r.date.split("-").reverse().join("/")}
                    </td>
                    <td className="p-2">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${["Nascimento", "Compra", "Entrada de lote"].includes(r.type) ? "bg-emerald-50 text-emerald-800" : ["Morte", "Venda", "Saída de lote"].includes(r.type) ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-800"}`}
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="p-2">
                      {r.count} {speciesNames[r.species ?? "cattle"]}
                    </td>
                    <td className="p-2">{r.lot ?? "Fazenda"}</td>
                    <td className="p-2">
                      <details>
                        <summary className="cursor-pointer">
                          {replaced.has(r.id) ? "Substituído por correção" : "Ver origem"}
                        </summary>
                        <p className="mt-2">{r.description}</p>
                        <p className="mt-1 break-all text-xs">
                          Código: {r.id}. Registrado em{" "}
                          {new Date(r.source.at).toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })}
                          .
                        </p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="py-6 text-sm text-muted-foreground">Nenhum registro neste período.</p>
            )}
          </div>
          {rows.length > 20 && (
            <div className="flex items-center gap-4 text-sm">
              <button
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border px-3 py-2 disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {page + 1} de {Math.ceil(rows.length / 20)}
              </span>
              <button
                disabled={(page + 1) * 20 >= rows.length}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-3 py-2 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
          {!!operations.lots.length && (
            <div>
              <h3 className="font-semibold">Lotes e pastagens</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {operations.lots.map((l) => (
                  <article key={l.name} className="rounded-lg border p-3 text-sm">
                    <strong>{l.name}</strong>
                    <p>
                      {l.pasture ?? "Piquete não informado"}
                      {l.areaHa ? ` · ${l.areaHa} ha` : ""}
                    </p>
                    <p className="mt-2">
                      Saldo:{" "}
                      {stockAt(operations, end, l.name).count ?? "contagem inicial não informada"}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
