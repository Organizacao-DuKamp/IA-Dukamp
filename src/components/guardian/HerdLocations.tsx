import { herdLocationReport } from "@/lib/guardian/herd-location-report";
import type { FarmBook } from "@/lib/guardian/schema";

export function HerdLocations({ book, date }: { book: FarmBook; date: string }) {
  const report = herdLocationReport(book, date);
  const rows = [...report.locations, ...report.unassigned].filter(
    (r) => r.count !== 0 || r.registered > 0,
  );
  return (
    <section
      className="rounded-xl border border-emerald-900/15 bg-emerald-50/40 p-4"
      aria-label="Localização atual do rebanho"
    >
      <h3 className="font-semibold">Localização atual do rebanho</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Posição em {date.split("-").reverse().join("/")}. Grupos já movimentados aparecem no destino
        atual.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Animais por lote atual</caption>
          <thead>
            <tr className="border-b">
              <th className="p-2">Animais</th>
              <th className="p-2">Quantidade</th>
              <th className="p-2">Lote atual</th>
              <th className="p-2">Grupos e fichas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.species}:${r.lot ?? "unassigned"}`} className="border-b">
                <td className="p-2">{r.label}</td>
                <td className="p-2">
                  {r.count ?? (r.registered ? `${r.registered} registrados` : "Não informado")}
                  {r.count === null && (
                    <small className="block text-muted-foreground">
                      Total da espécie ainda não confirmado
                    </small>
                  )}
                </td>
                <td className="p-2 font-medium">{r.lot ?? "Sem lote definido"}</td>
                <td className="p-2">
                  {r.groups.length || r.codes.length ? (
                    <details>
                      <summary className="cursor-pointer">Ver grupos e fichas</summary>
                      {r.groups.slice(-50).map((g) => (
                        <p className="mt-2" key={g.movementId}>
                          {g.count} {r.label.toLocaleLowerCase("pt-BR")} · {g.description}
                        </p>
                      ))}
                      {r.groups.length > 50 && (
                        <p className="mt-2">
                          Mostrando os 50 grupos mais recentes de {r.groups.length}.
                        </p>
                      )}
                      {!!r.codes.length && (
                        <p className="mt-2">
                          Fichas: {r.codes.slice(0, 50).join(", ")}
                          {r.codes.length > 50 ? "…" : ""}. As fichas estão incluídas no rebanho.
                        </p>
                      )}
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="py-4 text-sm text-muted-foreground">
            Ainda não há animais com localização registrada.
          </p>
        )}
      </div>
    </section>
  );
}
