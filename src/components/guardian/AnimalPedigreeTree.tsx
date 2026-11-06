import { useId, useState } from "react";
import { Expand, GitFork, X } from "lucide-react";
import type { AnimalProfile } from "@/lib/guardian/animal-profile";
import { pedigreeLabel } from "@/lib/guardian/animal-profile";
import { pedigreeTreeNodes, type PedigreeTreeNode } from "@/lib/guardian/pedigree-tree";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// The complete viewBox is fitted on BOTH axes by SVG; no oversized HTML canvas
// is clipped or hidden. Short labels are backed by full titles and a detail card.
function PedigreeCanvas({
  animal,
  generations,
}: {
  animal: Partial<AnimalProfile>;
  generations: number;
}) {
  const marker = useId().replace(/:/g, "");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const nodes = pedigreeTreeNodes(animal, generations);
  const selected = nodes.find((node) => node.path === selectedPath);
  const cardWidth = 164,
    cardHeight = 28,
    gap = 22,
    row = 32,
    top = 24;
  const height = 2 ** generations * row + top + 4;
  const width = (generations + 1) * (cardWidth + gap) - gap + 16;
  const x = (generation: number) => 8 + generation * (cardWidth + gap);
  const y = (generation: number, index: number) =>
    top + ((index + 0.5) * (height - top - 4)) / 2 ** generation;
  const columns = ["Animal", "Pais", "Avós", "Bisavós", "Trisavós"];
  const shorten = (value: string, limit: number) =>
    value.length > limit ? value.slice(0, limit - 1) + "…" : value;
  const fullLabel = (node: PedigreeTreeNode) =>
    `${node.generation ? pedigreeLabel(node.path) : "Animal"}: ${node.name ? node.name + " · " : ""}${node.code || "Não informado"}`;
  return (
    <div className="min-w-0 space-y-2">
      <div
        role="region"
        aria-label={`Árvore genealógica de ${animal.name || animal.code || "animal"}, ${generations} gerações de ascendentes`}
        className="flex min-w-0 justify-center rounded-xl border border-border bg-secondary/15 p-1.5"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Animais e vínculos entre gerações"
          className="block h-auto min-w-0 w-full text-muted-foreground"
          style={{ maxWidth: width, maxHeight: "min(62dvh, 560px)" }}
        >
          <defs>
            <clipPath id={`${marker}-label`}>
              <rect x="5" y="1" width={cardWidth - 10} height={cardHeight - 2} />
            </clipPath>
            {["sire", "dam", "missing"].map((side) => (
              <marker
                key={side}
                id={`${marker}-${side}`}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="4"
                markerHeight="4"
                orient="auto"
              >
                <path
                  d="M 0 0 L 8 4 L 0 8 z"
                  fill={side === "sire" ? "#3b82f6" : side === "dam" ? "#a855f7" : "#94a3b8"}
                />
              </marker>
            ))}
          </defs>
          {columns.slice(0, generations + 1).map((label, generation) => (
            <text
              key={label}
              x={x(generation) + cardWidth / 2}
              y={13}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="currentColor"
            >
              {label}
            </text>
          ))}
          <g aria-hidden="true">
            {nodes
              .filter((n) => n.parentPath !== null)
              .map((node) => {
                const parent = nodes.find((p) => p.path === node.parentPath)!;
                const start = x(parent.generation) + cardWidth;
                const end = x(node.generation) - 2;
                const from = y(parent.generation, parent.index),
                  to = y(node.generation, node.index);
                const side = node.code
                  ? node.path.startsWith("sire")
                    ? "sire"
                    : "dam"
                  : "missing";
                return (
                  <path
                    key={node.path}
                    d={`M ${start} ${from} H ${start + gap / 2} V ${to} H ${end}`}
                    fill="none"
                    stroke={side === "sire" ? "#3b82f6" : side === "dam" ? "#a855f7" : "#94a3b8"}
                    strokeWidth="1"
                    strokeDasharray={node.code ? undefined : "3 3"}
                    markerEnd={`url(#${marker}-${side})`}
                  />
                );
              })}
          </g>
          {nodes.map((node) => {
            const colors = !node.generation
              ? ["#ecfdf5", "#6ee7b7", "#064e3b"]
              : !node.code
                ? ["#f8fafc", "#cbd5e1", "#64748b"]
                : node.path.startsWith("sire")
                  ? ["#eff6ff", "#bfdbfe", "#1e3a8a"]
                  : ["#faf5ff", "#e9d5ff", "#581c87"];
            const active = selectedPath === node.path;
            return (
              <g
                key={node.path}
                role="button"
                tabIndex={0}
                aria-label={fullLabel(node)}
                aria-pressed={active}
                onClick={() => setSelectedPath(node.path)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPath(node.path);
                  }
                }}
                className="cursor-pointer outline-none focus-visible:stroke-primary"
                transform={`translate(${x(node.generation)}, ${y(node.generation, node.index) - cardHeight / 2})`}
              >
                <title>{fullLabel(node)}</title>
                <rect
                  width={cardWidth}
                  height={cardHeight}
                  rx="5"
                  fill={colors[0]}
                  stroke={active ? colors[2] : colors[1]}
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={node.code ? undefined : "3 3"}
                  className="[g:focus-visible>&]:stroke-primary [g:focus-visible>&]:stroke-2"
                />
                <text
                  x="6"
                  y={node.name && node.code ? 11 : 18}
                  fontSize="10.5"
                  fontWeight="600"
                  fill={colors[2]}
                  clipPath={`url(#${marker}-label)`}
                >
                  {shorten(node.name || node.code || "Não informado", 24)}
                </text>
                {node.name && node.code && (
                  <text
                    x="6"
                    y="23"
                    fontSize="9"
                    fill={colors[2]}
                    opacity="0.8"
                    clipPath={`url(#${marker}-label)`}
                  >
                    {shorten(node.code, 28)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <label className="block text-xs text-muted-foreground sm:hidden">
        Ler dados de um animal
        <select
          aria-label="Consultar animal da genealogia"
          value={selectedPath === null ? "" : selectedPath || "animal"}
          onChange={(event) =>
            setSelectedPath(event.target.value === "animal" ? "" : event.target.value || null)
          }
          className="mt-1 block w-full min-w-0 rounded-lg border border-input bg-background p-2.5 text-sm text-foreground"
        >
          <option value="">Escolha um animal da árvore</option>
          {nodes.map((node) => (
            <option key={node.path} value={node.path || "animal"}>
              {node.name || node.code || node.label}
              {node.name && node.code ? ` · ${node.code}` : ""}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div
          className="relative rounded-lg border border-border bg-secondary/30 p-3 pr-10 text-sm"
          aria-live="polite"
        >
          <p className="text-xs text-muted-foreground">
            {selected.generation ? pedigreeLabel(selected.path) : "Animal"}
          </p>
          <p className="mt-1 break-words font-semibold">
            {selected.name || selected.code || "Não informado"}
          </p>
          {selected.name && selected.code && (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{selected.code}</p>
          )}
          <button
            type="button"
            aria-label="Fechar detalhes do ancestral"
            onClick={() => setSelectedPath(null)}
            className="absolute right-2 top-2 rounded-md p-1.5 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Árvore ajustada à tela. Toque em um animal para ler o nome e o registro completos.
        </p>
      )}
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
