import { useMemo } from "react";
import { Beef, Sprout, HeartPulse } from "lucide-react";
import { herdOverview } from "@/lib/guardian/paddock-board";
import type { FarmBook, GuardianAction } from "@/lib/guardian/schema";
import { PaddockBoard } from "./PaddockBoard";

export function FarmOperations({
  book,
  compact = false,
  busy,
  onPropose,
}: {
  book: FarmBook;
  compact?: boolean;
  busy: boolean;
  onPropose(action: GuardianAction): Promise<void>;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  const data = useMemo(() => herdOverview(book, today), [book, today]);
  const metrics = [
    {
      label: "Rebanho calculado",
      value: data.stock.count,
      hint: data.stock.count === null ? "Contagem a informar" : "bovinos nos registros",
      Icon: Beef,
      tone: "herd",
    },
    {
      label: "Nascimentos",
      value: data.births,
      hint: "registrados neste mês",
      Icon: Sprout,
      tone: "births",
    },
    {
      label: "Mortes",
      value: data.deaths,
      hint: "registradas neste mês",
      Icon: HeartPulse,
      tone: "deaths",
    },
  ];
  return (
    <section aria-label="Gestão do rebanho" className="space-y-6">
      <div className="farm-herd-overview">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Seu rebanho</h2>
          <span className="text-xs text-slate-500">
            {new Date(`${today}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
              timeZone: "America/Sao_Paulo",
            })}
          </span>
        </div>
        <div className="farm-herd-stats">
          {metrics.map(({ label, value, hint, Icon, tone }) => (
            <article key={label} className={`farm-herd-stat farm-stat-${tone}`}>
              <span className="farm-stat-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <p>{label}</p>
              <strong>{value === null ? "—" : value.toLocaleString("pt-BR")}</strong>
              <small>{hint}</small>
            </article>
          ))}
        </div>
        {data.stocksBySpecies.some((s) => s.species !== "cattle") && (
          <div className="farm-species-chips">
            {data.stocksBySpecies
              .filter((s) => s.species !== "cattle")
              .map((s) => (
                <span key={s.species}>
                  {s.label} <strong>{s.count.toLocaleString("pt-BR")}</strong>
                </span>
              ))}
          </div>
        )}
      </div>
      {!compact && <PaddockBoard book={book} date={today} busy={busy} onPropose={onPropose} />}
    </section>
  );
}
