export type EvidenceSource = "catalog" | "site" | "market" | "knowledge";

export interface EvidenceAssessment {
  sources: EvidenceSource[];
  hasInternalEvidence: boolean;
  knowledgeMatches: number;
  bestKnowledgeScore: number | null;
  requiresCurrentMarketSearch: boolean;
}

// O prompt principal já carrega a política completa de especialização. Este
// bloco fica deliberadamente restrito às regras que variam com a origem da
// evidência, evitando reenviar centenas de frases duplicadas em todo turno.
const PECUARIA_AUTHORITY_POLICY = `REGRAS TÉCNICAS PECUÁRIAS: para produtos, composição, consumo, indicação, preço, estoque e vendedores, priorize catálogo DuKamp vivo; rótulo/RTPI/ficha oficial DuKamp; base interna aprovada; e só depois fonte externa para conceito geral. Em nutrição brasileira, combine BR-CORTE, CQBAL, NASEM/NRC e Embrapa com a análise real do lote e os dados do animal; para leite, pequenos ruminantes e equinos, use referências da espécie. NASEM publicou a 8ª edição de bovinos de corte em 2016 e a 8ª edição de bovinos de leite em 2021; nunca descreva NASEM como referência apenas de leite. CQBAL é referência de composição e NUNCA deve ser descrita como substituta da análise bromatológica do lote. Se faltarem dados para uma dieta, NÃO forneça uma pseudoformulação com quilogramas de silagem, concentrado ou proporções prontas. Em compatibilidade entre espécies, não despeje catálogo e só cite produto com correspondência oficial inequívoca. Ao comparar produtos, não use “melhor” absoluto nem consumo estimado. Produto inexistente: recuse inventar ficha e não ofereça uma ficha comercial simulada. Para legislação, ingredientes, aditivos e status sanitário, use fonte oficial atual do MAPA/WOAH/OMSA, informe data de referência e não use catálogo comercial como resposta. Para clima, exija localização confirmada, priorize INMET e CPTEC/INPE e preserve data, hora/fuso, período e incerteza. Em sanidade, não feche diagnóstico nem prescreva medicamento, dose, via ou protocolo; NÃO forneça nomes de princípios ativos nem números de dose; encaminhe casos graves ao veterinário e serviço oficial.`;

export function assessEvidence(input: {
  catalog?: boolean;
  site?: boolean;
  market?: boolean;
  knowledgeScores?: number[];
  requiresCurrentMarketSearch?: boolean;
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
    requiresCurrentMarketSearch: input.requiresCurrentMarketSearch === true,
  };
}

export function sourceDirective(evidence: EvidenceAssessment): string {
  if (evidence.requiresCurrentMarketSearch) {
    return `POLÍTICA DE FONTES DESTE TURNO — MERCADO ATUAL: a base interna não contém cotação recente suficiente para a combinação pedida. Use a pesquisa web nativa da OpenAI neste próprio turno; o contexto deve trazer o marcador "CHATGPT_WEB_SEARCH_REQUIRED". Para cotações diárias, priorize hoje, ontem e anteontem, nessa ordem; se não houver publicação nesse intervalo, use somente a publicação confiável mais recente encontrada, deixando a data real explícita e sem chamá-la de cotação de hoje. Geograficamente, priorize a praça pedida, depois praça vizinha, indicador estadual e indicador nacional. Não trate registro histórico interno como preço atual e não use memória do modelo como cotação. Não prometa consultar depois: pesquise agora. Se a pesquisa não trouxer valor verificável, diga que não conseguiu confirmar. Toda cotação exige preço, unidade, praça, data e fonte; descarte qualquer valor que não tenha esses elementos. Nunca invente, estime ou complete um preço. Quando houver evidência suficiente, entregue todos esses dados já na primeira resposta. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  if (evidence.hasInternalEvidence) {
    return `POLÍTICA DE FONTES DESTE TURNO: foram encontrados dados oficiais/internos (${evidence.sources.join(", ")}). Responda primeiro e principalmente com eles para os fatos que eles realmente cobrem. Não substitua dados DuKamp por resultados genéricos da internet. Se o contexto trouxer "CHATGPT_WEB_SEARCH_REQUIRED", use sua pesquisa web nativa para o que exige atualidade, verificação ou conhecimento externo, preservando fontes e datas. Nunca invente dados comerciais ou de produto. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  return `POLÍTICA DE FONTES DESTE TURNO — CHATGPT-FIRST: catálogo, banco comercial e base técnica não encontraram evidência interna suficientemente forte. Você pode e deve usar a pesquisa web nativa da OpenAI quando a resposta depender de fatos verificáveis, atuais, nichados, regionais ou quando houver incerteza material. Se a pergunta for de conhecimento estável e você tiver confiança suficiente, responda diretamente; a ferramenta de pesquisa estará disponível em modo automático. Para fatos atuais, não complete lacunas por memória ou suposição: pesquise. Prefira fontes primárias, confronte fontes quando isso melhorar a confiabilidade, preserve datas relevantes e deixe clara qualquer divergência. ${PECUARIA_AUTHORITY_POLICY}`;
}
