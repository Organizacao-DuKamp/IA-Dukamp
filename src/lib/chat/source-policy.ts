export type EvidenceSource = "catalog" | "site" | "market" | "knowledge";

export interface EvidenceAssessment {
  sources: EvidenceSource[];
  hasInternalEvidence: boolean;
  knowledgeMatches: number;
  bestKnowledgeScore: number | null;
}

const PECUARIA_AUTHORITY_POLICY = `HIERARQUIA TÉCNICA PECUÁRIA: para produtos, composição, consumo, indicação, preço, estoque e vendedores, use nesta ordem: catálogo DuKamp vivo; rótulo/RTPI/ficha oficial DuKamp; base interna aprovada; fonte externa apenas para explicar conceito geral. Para nutrição, priorize NASEM/NRC, Embrapa e dados reais do animal, dieta, matéria seca e sistema; nunca transforme tabela em receita universal. Para legislação, ingredientes/aditivos, programas sanitários e status de doenças, consulte fonte oficial atual do MAPA/WOAH. Em sanidade, não feche diagnóstico nem prescreva medicamento, dose, via ou protocolo; sinais graves, surtos, abortos em série, síndrome vesicular, intoxicação ou alteração neurológica exigem veterinário e, quando aplicável, serviço oficial. Nunca extrapole entre espécies ou fases e nunca substitua dado oficial DuKamp por inferência externa.`;

/**
 * Registra, de forma determinística, se o turno encontrou evidência oficial.
 * A decisão fica fora do modelo para ele não "escolher" ignorar a DuKamp e
 * pesquisar a internet quando o catálogo ou a base já contêm a resposta.
 */
export function assessEvidence(input: {
  catalog?: boolean;
  site?: boolean;
  market?: boolean;
  knowledgeScores?: number[];
}): EvidenceAssessment {
  const scores = (input.knowledgeScores ?? []).filter(Number.isFinite);
  const sources: EvidenceSource[] = [];
  if (input.catalog) sources.push("catalog");
  if (input.site) sources.push("site");
  if (input.market) sources.push("market");
  if (scores.length > 0) sources.push("knowledge");

  return {
    sources,
    hasInternalEvidence: sources.length > 0,
    knowledgeMatches: scores.length,
    bestKnowledgeScore: scores.length > 0 ? Math.max(...scores) : null,
  };
}

export function sourceDirective(evidence: EvidenceAssessment): string {
  if (evidence.hasInternalEvidence) {
    return `POLÍTICA DE FONTES DESTE TURNO: foram encontrados dados oficiais/internos (${evidence.sources.join(", ")}). Responda primeiro e principalmente com eles. Não substitua dados DuKamp por resultados da internet. Use pesquisa externa somente para complementar conhecimento pecuário geral que realmente estiver ausente; deixe explícito o que é complemento externo e nunca use-o para inventar dados comerciais ou de produto. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  return `POLÍTICA DE FONTES DESTE TURNO: a busca no catálogo, no banco comercial e na base técnica não encontrou evidência relevante. Faça pesquisa externa aprofundada antes de responder: formule mais de uma busca mentalmente, confronte fontes independentes, priorize MAPA, WOAH/OMSA, Embrapa, NASEM/NRC, universidades, artigos científicos e manuais técnicos, confira data, espécie, fase e contexto brasileiro e cite as fontes externas. Se não houver evidência suficiente, declare a incerteza em vez de completar por suposição. ${PECUARIA_AUTHORITY_POLICY}`;
}
