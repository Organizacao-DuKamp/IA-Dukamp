import type { RecallArchive, RecallTurn } from "./whatsapp.server.ts";

/** Reciprocal-rank fusion combines independent scores without comparing their scales. */
export function fuseConversationRecall(
  lexical: RecallArchive | null,
  semantic: RecallArchive,
  query = "",
): RecallArchive {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");
  const entities = (
    fold(query).match(/\b(?:lote|brinco|animal|boi|vaca)\s+(?:[a-z]{1,12}\s*)?\d+[a-z0-9_-]*\b/g) ??
    []
  ).map((entity) => new RegExp(`\\b${entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
  const turns = new Map<string, RecallTurn>();
  const scores = new Map<string, number>();
  for (const archive of [semantic, lexical]) {
    if (!archive) continue;
    const ranked = [...archive.turns].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.created_at.localeCompare(a.created_at),
    );
    for (let i = 0; i < ranked.length; i++) {
      const turn = ranked[i];
      // The lexical read runs against fresh originals too, and wins duplicate identity.
      turns.set(turn.id, turn);
      scores.set(turn.id, (scores.get(turn.id) ?? 0) + 1 / (60 + i + 1));
    }
  }
  const boundary = [lexical?.reset_at, semantic.reset_at]
    .filter((s): s is string => !!s)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1)!;
  const selected = [...turns.values()]
    .filter((t) => Date.parse(t.created_at) >= Date.parse(boundary))
    .map((t) => ({
      ...t,
      score: (scores.get(t.id) ?? 0) + (entities.some((e) => e.test(fold(t.user_text))) ? 0.02 : 0),
    }));
  return {
    turns: selected,
    facts: (lexical?.facts ?? []).filter((f) => Date.parse(f.last_seen_at) >= Date.parse(boundary)),
    total: Math.max(selected.length, lexical?.total ?? 0),
    reset_at: boundary,
    partial: true,
    coverageNote:
      "Recuperação híbrida privada: palavras, datas e similaridade semântica. A busca vetorial usa até 2.000 episódios indexados mais recentes e vizinhos do mesmo telefone. A indexação é assíncrona e pode estar incompleta; os trechos continuam sendo relatos históricos, não fatos automaticamente confirmados.",
  };
}
