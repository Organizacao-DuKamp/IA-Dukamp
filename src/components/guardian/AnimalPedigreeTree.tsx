import { useId, useState } from "react";
import { Expand, GitFork, MoveHorizontal } from "lucide-react";
import type { AnimalProfile } from "@/lib/guardian/animal-profile";
import { pedigreeLabel } from "@/lib/guardian/animal-profile";
import { pedigreeTreeNodes } from "@/lib/guardian/pedigree-tree";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function PedigreeCanvas({
  animal,
  generations,
}: {
  animal: Partial<AnimalProfile>;
  generations: number;
}) {
  const marker = useId().replace(/:/g, "");
  const nodes = pedigreeTreeNodes(animal, generations);
  const cardWidth = 208,
    cardHeight = Math.max(
      108,
      42 +
        16 *
          Math.max(
            ...nodes.map(
              (n) => Math.ceil((n.name?.length ?? 0) / 26) + Math.ceil((n.code?.length ?? 0) / 26),
            ),
          ),
    ),
    gap = 48,
    row = cardHeight + 16,
    top = 42;
  const height = 2 ** generations * row + top;
  const width = (generations + 1) * (cardWidth + gap) - gap + 24;
  const x = (generation: number) => 12 + generation * (cardWidth + gap);
  const y = (generation: number, index: number) =>
    top + ((index + 0.5) * (height - top)) / 2 ** generation;
  const columns = ["Animal", "Pais", "Avós", "Bisavós", "Trisavós"];
  return (
    <div
      role="region"
      aria-label={`Árvore genealógica de ${animal.name || animal.code || "animal"}, ${generations} gerações de ascendentes`}
      tabIndex={0}
      className="max-h-[65vh] overflow-auto rounded-xl border border-border bg-secondary/15 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative" style={{ width, height }}>
        {columns.slice(0, generations + 1).map((label, generation) => (
          <div
            key={label}
            className="absolute top-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ left: x(generation), width: cardWidth }}
          >
            {label}
          </div>
        ))}
        <svg
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <defs>
            {["sire", "dam", "missing"].map((side) => (
              <marker
                key={side}
                id={`${marker}-${side}`}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path
                  d="M 0 0 L 8 4 L 0 8 z"
                  fill={side === "sire" ? "#3b82f6" : side === "dam" ? "#a855f7" : "#94a3b8"}
                />
              </marker>
            ))}
          </defs>
          {nodes
            .filter((n) => n.parentPath !== null)
            .map((node) => {
              const parent = nodes.find((p) => p.path === node.parentPath)!;
              const start = x(parent.generation) + cardWidth;
              const end = x(node.generation) - 4;
              const from = y(parent.generation, parent.index),
                to = y(node.generation, node.index);
              const side = node.code ? (node.path.startsWith("sire") ? "sire" : "dam") : "missing";
              return (
                <path
                  key={node.path}
                  d={`M ${start} ${from} H ${start + gap / 2} V ${to} H ${end}`}
                  fill="none"
                  stroke={side === "sire" ? "#3b82f6" : side === "dam" ? "#a855f7" : "#94a3b8"}
                  strokeWidth="1.5"
                  strokeDasharray={node.code ? undefined : "4 4"}
                  markerEnd={`url(#${marker}-${side})`}
                />
              );
            })}
        </svg>
        <ol className="m-0 list-none p-0">
          {nodes.map((node) => (
            <li
              key={node.path}
              aria-label={
                node.generation
                  ? `${pedigreeLabel(node.path)}: ${node.name ? `${node.name}, ` : ""}${node.code || "Não informado"}`
                  : `Animal: ${node.name || ""} ${node.code || ""}`
              }
              className={`absolute flex flex-col justify-center rounded-xl border p-3 shadow-sm ${!node.generation ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50" : !node.code ? "border-dashed border-border bg-background text-muted-foreground" : node.path.startsWith("sire") ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-50" : "border-purple-200 bg-purple-50 text-purple-950 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-50"}`}
              style={{
                left: x(node.generation),
                top: y(node.generation, node.index) - cardHeight / 2,
                width: cardWidth,
                height: cardHeight,
              }}
            >
              <span className="text-[11px] font-semibold opacity-70">{node.label}</span>
              <span className="mt-1 break-words text-xs font-semibold leading-snug">
                {node.name || node.code || "Não informado"}
              </span>
              {node.name && node.code && (
                <span className="mt-1 break-words text-[11px] opacity-75">{node.code}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function AnimalPedigreeTree({ animal }: { animal: Partial<AnimalProfile> }) {
  const available = Math.max(
    1,
    ...(animal.pedigree ?? []).map((n) => n.relation.split(".").length),
  );
  const [selected, setSelected] = useState(2);
  const generations = Math.min(selected, available);
  return (
    <section
      className="min-w-0 space-y-3 rounded-xl border border-border p-3 sm:p-4"
      aria-label="Genealogia registrada"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <GitFork size={16} aria-hidden="true" />
            Árvore genealógica
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Do animal aos seus ascendentes, geração por geração.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Expand size={14} aria-hidden="true" />
              Ampliar árvore
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[94dvh] w-[96vw] max-w-[1500px] overflow-y-auto rounded-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Genealogia · {animal.name || animal.code}</DialogTitle>
              <DialogDescription>
                Ramo paterno em azul e materno em roxo. Campos ausentes permanecem não informados.
              </DialogDescription>
            </DialogHeader>
            <PedigreeCanvas animal={animal} generations={available} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Gerações:</span>
        {Array.from({ length: available }, (_, i) => i + 1).map((depth) => (
          <button
            key={depth}
            type="button"
            aria-pressed={depth === generations}
            onClick={() => setSelected(depth)}
            className={`rounded-lg border px-3 py-1.5 font-medium focus-visible:ring-2 focus-visible:ring-ring ${depth === generations ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            {depth}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <MoveHorizontal size={14} aria-hidden="true" />
          Deslize para explorar
        </span>
      </div>
      <PedigreeCanvas animal={animal} generations={generations} />
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-blue-600 dark:text-blue-400">Azul: ramo paterno</span>
        <span aria-hidden="true"> · </span>
        <span className="font-medium text-purple-600 dark:text-purple-400">Roxo: ramo materno</span>
        . Tracejado: não informado.
      </p>
    </section>
  );
}
