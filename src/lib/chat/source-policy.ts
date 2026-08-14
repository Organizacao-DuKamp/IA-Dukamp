export type EvidenceSource = "catalog" | "site" | "market" | "knowledge";

export interface EvidenceAssessment {
  sources: EvidenceSource[];
  hasInternalEvidence: boolean;
  knowledgeMatches: number;
  bestKnowledgeScore: number | null;
  requiresCurrentMarketSearch: boolean;
}

const PECUARIA_AUTHORITY_POLICY = `HIERARQUIA TÉCNICA PECUÁRIA: para produtos, composição, consumo, indicação, preço, estoque e vendedores, use nesta ordem: catálogo DuKamp vivo; rótulo/RTPI/ficha oficial DuKamp; base interna aprovada; fonte externa apenas para explicar conceito geral. Para nutrição de bovinos de corte no Brasil, considere BR-CORTE e CQBAL junto de análise real dos alimentos, NASEM/NRC, Embrapa e dados do animal, dieta, matéria seca e sistema; para leite, pequenos ruminantes e equinos, use a referência específica da espécie e fontes brasileiras aplicáveis. NRC é a denominação histórica; NASEM publicou tanto a 8ª edição de bovinos de corte em 2016 quanto a 8ª edição de bovinos de leite em 2021. Nunca descreva NASEM como referência apenas de leite. Nunca transforme tabela em receita universal. CQBAL é referência de composição e NUNCA deve ser descrita como substituta da análise bromatológica do lote ou como forma de dispensar laboratório em uma decisão de formulação. Se o usuário pedir uma dieta e faltarem ingredientes disponíveis, análise bromatológica, matéria seca, sistema, categoria, sexo, consumo e objetivo, NÃO forneça uma pseudoformulação com quilogramas de silagem, concentrado ou proporções prontas: explique os dados faltantes e pare antes da receita. Em perguntas genéricas sobre proteína, consumo ou quantidade de ração, não despeje números de estudos diferentes como se fossem recomendação; peça peso, fase, produção/trabalho, ganho desejado, dieta e matéria seca. Para perguntas genéricas de compatibilidade entre espécies, não despeje catálogo nem selecione produto por uma palavra solta como “mineral”; somente cite produto comercial quando houver correspondência oficial inequívoca. Para comparar produtos DuKamp, não use “melhor” de forma absoluta, não use “consumo estimado” e não complete campos ausentes; diga qual é mais compatível apenas com base em indicação, consumo e restrições oficiais confirmadas. Produto inexistente ou não confirmado: recuse inventar ficha, composição, benefício ou nome e não ofereça uma ficha comercial simulada usando a marca DuKamp; no máximo, ofereça um formulário vazio e neutro sem dados de produto. Para legislação, ingredientes/aditivos, programas sanitários e status de doenças, consulte fonte oficial atual do MAPA/WOAH, informe data de referência e não use catálogo comercial como resposta. Em sanidade, não feche diagnóstico nem prescreva medicamento, dose, via ou protocolo. Quando o usuário pedir qual antibiótico, vermífugo, remédio ou dose usar, NÃO forneça nomes de princípios ativos nem números de dose, mesmo como exemplo de artigo, estudo ou bula: explique por que depende de diagnóstico, peso, resistência, registro, carência e avaliação veterinária. Sinais graves, surtos, abortos em série, síndrome vesicular, intoxicação ou alteração neurológica exigem veterinário e, quando aplicável, serviço oficial. Nunca extrapole entre espécies ou fases e nunca substitua dado oficial DuKamp por inferência externa.`;

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
    return `POLÍTICA DE FONTES DESTE TURNO — MERCADO ATUAL: a base interna não contém cotação pecuária recente para a combinação pedida. Pesquise obrigatoriamente antes de responder, nesta ordem temporal: hoje, ontem e anteontem; e nesta ordem geográfica: praça pedida, praça vizinha, indicador estadual e indicador nacional. Priorize CEPEA/ESALQ, IEA, B3, Scot Consultoria, Conab e outras fontes de mercado identificáveis. Não trate registro histórico interno como preço atual. Se não houver publicação nos três dias, use somente a fonte confiável mais recente encontrada, com data explícita e sem chamá-la de cotação de hoje. Toda cotação exige preço, unidade, praça, data e fonte. Nunca invente, estime ou use preço de memória. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  if (evidence.hasInternalEvidence) {
    return `POLÍTICA DE FONTES DESTE TURNO: foram encontrados dados oficiais/internos (${evidence.sources.join(", ")}). Responda primeiro e principalmente com eles. Não substitua dados DuKamp por resultados da internet. Use pesquisa externa somente para complementar conhecimento pecuário geral que realmente estiver ausente; deixe explícito o que é complemento externo e nunca use-o para inventar dados comerciais ou de produto. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  return `POLÍTICA DE FONTES DESTE TURNO: a busca no catálogo, no banco comercial e na base técnica não encontrou evidência relevante. Faça pesquisa externa aprofundada antes de responder: formule mais de uma busca mentalmente, confronte fontes independentes, priorize MAPA, WOAH/OMSA, Embrapa, BR-CORTE, CQBAL, NASEM/NRC, universidades, artigos científicos e manuais técnicos, confira data, espécie, fase e contexto brasileiro e cite as fontes externas. Se não houver evidência suficiente, declare a incerteza em vez de completar por suposição. ${PECUARIA_AUTHORITY_POLICY}`;
}
