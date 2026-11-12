import { memo, useMemo, useState } from "react";
import { ArrowUpRight, Beef, ChevronDown, MapPin, Search, Sprout } from "lucide-react";
import { paddockBoard, type PaddockView } from "@/lib/guardian/paddock-board";
import type { FarmBook, GuardianAction, GuardianAnimal } from "@/lib/guardian/schema";
import { GuardianActionForm } from "./GuardianActionForm";
import { AnimalProfileDetails } from "./AnimalProfileDetails";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function AnimalButtons({
  animals,
  onSelect,
}: {
  animals: GuardianAnimal[];
  onSelect(animal: GuardianAnimal): void;
}) {
  const [limit, setLimit] = useState(20);
  return (
    <>
      <ul className="farm-animal-list">
        {animals.slice(0, limit).map((animal) => (
          <li key={animal.code}>
            <button
              type="button"
              onClick={() => onSelect(animal)}
              aria-label={`Abrir ficha de ${animal.code}`}
            >
              <span className="farm-animal-avatar">
                <Beef size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>{animal.code}</strong>
                <small>
                  {animal.name || animal.breed || "Ficha do animal"}
                  {animal.status && animal.status !== "active" ? " · Arquivado" : ""}
                </small>
              </span>
              <ArrowUpRight size={17} className="text-slate-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {limit < animals.length && (
        <button type="button" className="farm-text-button" onClick={() => setLimit((n) => n + 20)}>
          Mostrar mais animais ({limit} de {animals.length})
        </button>
      )}
    </>
  );
}
function DraftButtons({
  count,
  start,
  lot,
  onSelect,
}: {
  count: number;
  start: number;
  lot: string | null;
  onSelect(slot: { number: number; lot: string | null }): void;
}) {
  const [limit, setLimit] = useState(20);
  return (
    <>
      <p className="mt-3 text-xs text-slate-500">
        {count} {count === 1 ? "bovino sem ficha" : "bovinos sem ficha"}.
        São rascunhos da quantidade informada.
      </p>
      <ul className="farm-animal-list">
        {Array.from({ length: Math.min(limit, count) }, (_, offset) => start + offset).map(
          (number) => (
            <li key={number}>
              <button
                type="button"
                onClick={() => onSelect({ number, lot })}
                aria-label={`Completar ficha provisória: Animal não identificado ${number}`}
              >
                <span className="farm-animal-avatar">
                  <Beef size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>{`Animal não identificado ${number}`}</strong>
                  <small>Rascunho · completar ficha</small>
                </span>
                <ArrowUpRight size={17} className="text-slate-400" aria-hidden="true" />
              </button>
            </li>
          ),
        )}
      </ul>
      {limit < count && (
        <button type="button" className="farm-text-button" onClick={() => setLimit((n) => n + 20)}>
          Mostrar mais rascunhos ({limit} de {count})
        </button>
      )}
    </>
  );
}
function LotCard({
  lot,
  onSelect,
  onDraft,
}: {
  lot: PaddockView["lots"][number];
  onSelect(animal: GuardianAnimal): void;
  onDraft(slot: { number: number; lot: string | null }): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details className="farm-lot-card" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="farm-lot-mark">
          <Beef size={19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <strong>{lot.name === null ? "Animais sem lote" : `Lote ${lot.name}`}</strong>
          <span className="farm-lot-counts">
            {lot.rows.length ? (
              lot.rows.map((row) => (
                <small key={row.species}>
                  {row.label}:{" "}
                  {row.count === null
                    ? row.registered
                      ? `${row.registered} com localização registrada · total a confirmar`
                      : "contagem não informada"
                    : row.species === "cattle" && lot.animals.length > row.count
                      ? `${lot.animals.length} fichas identificadas · saldo calculado ${row.count} (conferir)`
                      : row.count.toLocaleString("pt-BR")}
                </small>
              ))
            ) : (
              <small>Contagem não informada</small>
            )}
          </span>
        </span>
        <ChevronDown size={18} className="farm-expand-icon" aria-hidden="true" />
      </summary>
      {open && (
        <div className="farm-lot-content">
          <p className="text-xs text-slate-500">
            {lot.animals.length}{" "}
            {lot.animals.length === 1 ? "ficha identificada" : "fichas identificadas"}.
          </p>
          <p className="text-xs text-slate-500">
            Fichas identificadas não alteram as contagens declaradas.
          </p>
          {lot.animals.length > 0 && <AnimalButtons animals={lot.animals} onSelect={onSelect} />}
          {lot.unidentified > 0 && (
            <DraftButtons
              count={lot.unidentified}
              start={lot.draftStart}
              lot={lot.name}
              onSelect={onDraft}
            />
          )}
          {!lot.animals.length && !lot.unidentified && (
            <p className="py-4 text-sm text-slate-500">
              Ainda não há fichas individuais vinculadas a este lote.
            </p>
          )}
        </div>
      )}
    </details>
  );
}
export const PaddockBoard = memo(function PaddockBoard({
  book,
  date,
  busy,
  onPropose,
}: {
  book: FarmBook;
  date: string;
  busy: boolean;
  onPropose(action: GuardianAction): Promise<void>;
}) {
  const paddocks = useMemo(() => paddockBoard(book, date), [book, date]);
  const [query, setQuery] = useState(""),
    [animalCode, setAnimalCode] = useState<string | null>(null),
    [draft, setDraft] = useState<{ number: number; lot: string | null } | null>(null),
    [weights, setWeights] = useState(20);
  const animal = book.animals.find((a) => a.code === animalCode);
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q
      ? book.animals.filter((a) =>
          [a.code, a.name, a.earTag, a.rgn, a.rgd].some((v) =>
            v?.toLocaleLowerCase("pt-BR").includes(q),
          ),
        )
      : [];
  }, [book, query]);
  const select = (animal: GuardianAnimal) => {
    setAnimalCode(animal.code);
    setWeights(20);
  };
  return (
    <section aria-label="Piquetes e lotes da fazenda" className="farm-paddock-board">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Seus piquetes</h2>
          <p className="mt-1 text-sm text-slate-500">Abra um lote para ver os animais.</p>
        </div>
        <span className="farm-board-icon">
          <Sprout size={23} aria-hidden="true" />
        </span>
      </div>
      <label className="farm-animal-search">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Buscar animal por nome, brinco ou registro"
          placeholder="Buscar animal, brinco ou registro"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {query.trim() ? (
        <div aria-label="Resultados da busca de animais">
          <p className="text-sm text-slate-500">
            {matches.length} fichas encontradas, incluindo arquivadas.
          </p>
          <AnimalButtons key={query} animals={matches} onSelect={select} />
        </div>
      ) : (
        <div className="farm-paddock-grid">
          {paddocks.map((paddock) => (
            <article
              key={paddock.key}
              className={`farm-paddock ${paddock.name === null ? "farm-paddock-unassigned" : ""}`}
            >
              <div className="farm-paddock-heading">
                <MapPin size={19} aria-hidden="true" />
                <h3>{paddock.name ?? "Localização a definir"}</h3>
                <span>
                  {paddock.lots.filter((l) => l.name !== null).length}{" "}
                  {paddock.lots.filter((l) => l.name !== null).length === 1 ? "lote" : "lotes"}
                </span>
              </div>
              {paddock.lots.length ? (
                paddock.lots.map((lot) => (
                  <LotCard key={lot.key} lot={lot} onSelect={select} onDraft={setDraft} />
                ))
              ) : (
                <p className="p-4 text-sm text-slate-500">Nenhum lote vinculado a este piquete.</p>
              )}
            </article>
          ))}
          {!paddocks.length && (
            <p className="farm-board-empty">
              Seus piquetes e lotes aparecerão aqui conforme forem registrados. Você também pode
              cadastrá-los em Pastagens.
            </p>
          )}
        </div>
      )}
      <Dialog open={!!animal} onOpenChange={(open) => !open && setAnimalCode(null)}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {animal?.code}
              {animal?.name ? ` · ${animal.name}` : ""}
            </DialogTitle>
            <DialogDescription>Ficha do animal e pesagens registradas.</DialogDescription>
          </DialogHeader>
          {animal && (
            <>
              <AnimalProfileDetails animal={animal} />
              <h3 className="font-semibold">Pesagens</h3>
              {animal.weights
                .slice(-weights)
                .reverse()
                .map((w) => (
                  <div key={w.date} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <strong>{w.weightKg} kg</strong> · {w.date.split("-").reverse().join("/")}
                    {w.estimated ? " · Estimado" : " · Informado"}
                    {w.corrections.map((c, i) => (
                      <p key={i} className="mt-1 text-xs text-slate-500">
                        Correção: {c.weightKg} kg em {new Date(c.at).toLocaleString("pt-BR")}
                      </p>
                    ))}
                  </div>
                ))}
              {!animal.weights.length && (
                <p className="text-sm text-slate-500">Ainda sem pesagem.</p>
              )}
              {weights < animal.weights.length && (
                <button
                  type="button"
                  className="farm-text-button"
                  onClick={() => setWeights((n) => n + 20)}
                >
                  Mostrar pesagens anteriores
                </button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft ? `Animal não identificado ${draft.number}` : "Ficha provisória"}
            </DialogTitle>
            <DialogDescription>
              Esta ficha provisória já está incluída na quantidade informada.
              <span className="block">
                Informe série/RGN ou brinco; o total do rebanho não será alterado.
              </span>
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <GuardianActionForm
              key={`${draft.lot ?? "sem-lote"}:${draft.number}`}
              hasProperty
              initialKind="animal"
              initialValues={draft.lot ? { lot: draft.lot } : {}}
              allowedKinds={["animal"]}
              book={book}
              busy={busy}
              onPropose={async (action) => {
                await onPropose(action);
                setDraft(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
});
