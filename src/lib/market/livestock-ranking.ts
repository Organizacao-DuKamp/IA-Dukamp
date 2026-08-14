/** Hoje, ontem e anteontem são tratados como janela de preço corrente. */
export const MAX_CURRENT_QUOTE_AGE_DAYS = 2;

export interface RankedLivestockCandidate<T> {
  value: T;
  date: string;
  ageDays: number;
  /** Menor número representa a praça mais específica. */
  localityRank: number;
}

/**
 * Escolhe primeiro a publicação mais nova dentro da janela corrente. A
 * proximidade geográfica só desempata publicações da mesma data. Quando não
 * existe dado recente, devolve o registro histórico mais novo para que ele
 * possa ser rotulado como antigo — nunca como cotação atual.
 */
export function selectLivestockCandidate<T>(
  candidates: RankedLivestockCandidate<T>[],
  maxAgeDays = MAX_CURRENT_QUOTE_AGE_DAYS,
): RankedLivestockCandidate<T> | null {
  const compare = (left: RankedLivestockCandidate<T>, right: RankedLivestockCandidate<T>) =>
    right.date.localeCompare(left.date) || left.localityRank - right.localityRank;
  const valid = candidates.filter((candidate) => candidate.ageDays >= 0);
  const recent = valid.filter((candidate) => candidate.ageDays <= maxAgeDays).sort(compare);
  return recent[0] ?? valid.sort(compare)[0] ?? null;
}
