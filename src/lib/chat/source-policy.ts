export type EvidenceSource = "catalog" | "site" | "market" | "knowledge";

export interface EvidenceAssessment {
  sources: EvidenceSource[];
  hasInternalEvidence: boolean;
  knowledgeMatches: number;
  bestKnowledgeScore: number | null;
  requiresCurrentMarketSearch: boolean;
}

const PECUARIA_AUTHORITY_POLICY = `HIERARQUIA TÉCNICA PECUÁRIA: para produtos, composição, consumo, indicação, preço, estoque e vendedores, use nesta ordem: catálogo DuKamp vivo; rótulo/RTPI/ficha oficial DuKamp; base interna aprovada; fonte externa apenas para explicar conceito geral. Para nutrição de bovinos de corte no Brasil, considere BR-CORTE e CQBAL junto de análise real dos alimentos, NASEM/NRC, Embrapa e dados do animal, dieta, matéria seca e sistema; para leite, pequenos ruminantes e equinos, use a referência específica da espécie e fontes brasileiras aplicáveis. NRC é a denominação histórica; NASEM publicou tanto a 8ª edição de bovinos de corte em 2016 quanto a 8ª edição de bovinos de leite em 2021. Nunca descreva NASEM como referência apenas de leite. Nunca transforme tabela em receita universal. CQBAL é referência de composição e NUNCA deve ser descrita como substituta da análise bromatológica do lote ou como forma de dispensar laboratório em uma decisão de formulação. Se o usuário pedir uma dieta e faltarem ingredientes disponíveis, análise bromatológica, matéria seca, sistema, categoria, sexo, consumo e objetivo, NÃO forneça uma pseudoformulação com quilogramas de silagem, concentrado ou proporções prontas: explique os dados faltantes e pare antes da receita. Em perguntas genéricas sobre proteína, consumo ou quantidade de ração, não despeje números de estudos diferentes como se fossem recomendação; peça peso, fase, produção/trabalho, ganho desejado, dieta e matéria seca. Para perguntas genéricas de compatibilidade entre espécies, não despeje catálogo nem selecione produto por uma palavra solta como “mineral”; somente cite produto comercial quando houver correspondência oficial inequívoca. Para comparar produtos DuKamp, não use “melhor” de forma absoluta, não use “consumo estimado” e não complete campos ausentes; diga qual é mais compatível apenas com base em indicação, consumo e restrições oficiais confirmadas. Produto inexistente ou não confirmado: recuse inventar ficha, composição, benefício ou nome e não ofereça uma ficha comercial simulada usando a marca DuKamp; no máximo, ofereça um formulário vazio e neutro sem dados de produto. Para legislação, ingredientes/aditivos, programas sanitários e status de doenças, use fonte oficial atual do MAPA/WOAH/OMSA recuperada no contexto, informe data de referência e não use catálogo comercial como resposta. Para clima e previsão do tempo, use pesquisa atual com localização confirmada, priorize INMET, CPTEC/INPE, Defesa Civil/CEMADEN, ANA e fontes meteorológicas regionais, cruze referências e preserve data, hora/fuso, período e incerteza. Em sanidade, não feche diagnóstico nem prescreva medicamento, dose, via ou protocolo. Quando o usuário pedir qual antibiótico, vermífugo, remédio ou dose usar, NÃO forneça nomes de princípios ativos nem números de dose, mesmo como exemplo de artigo, estudo ou bula: explique por que depende de diagnóstico, peso, resistência, registro, carência e avaliação veterinária. Sinais graves, surtos, abortos em série, síndrome vesicular, intoxicação ou alteração neurológica exigem veterinário e, quando aplicável, serviço oficial. Nunca extrapole entre espécies ou fases e nunca substitua dado oficial DuKamp por inferência externa.`;

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
    return `POLÍTICA DE FONTES DESTE TURNO — MERCADO ATUAL: a base interna não contém cotação recente para a combinação pedida. A etapa de recuperação externa ocorre ANTES de você redigir; procure no contexto o bloco "PESQUISA EXTERNA ATUAL" e use somente as evidências ali recuperadas. A recuperação prioriza hoje, ontem e anteontem e, geograficamente, praça pedida, praça vizinha, indicador estadual e indicador nacional. Não trate registro histórico interno como preço atual. Não finja uma nova busca, não prometa consultar depois e não use conhecimento de memória como cotação. Se o bloco externo não trouxer valor verificável, diga que não conseguiu confirmar. Toda cotação exige preço, unidade, praça, data e fonte; descarte qualquer valor que não tenha esses elementos. Nunca invente, estime ou complete um preço. Quando houver evidência suficiente, entregue todos esses dados já na primeira resposta em vez de adiar a confirmação para outra mensagem. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  if (evidence.hasInternalEvidence) {
    return `POLÍTICA DE FONTES DESTE TURNO: foram encontrados dados oficiais/internos (${evidence.sources.join(", ")}). Responda primeiro e principalmente com eles. Não substitua dados DuKamp por resultados da internet. Se também houver um bloco "PESQUISA EXTERNA ATUAL", use-o apenas para o que realmente exige atualidade ou para complementar conhecimento geral, sempre preservando fonte e data. Nunca invente dados comerciais ou de produto. ${PECUARIA_AUTHORITY_POLICY}`;
  }

  return `POLÍTICA DE FONTES DESTE TURNO: a busca no catálogo, no banco comercial e na base técnica não encontrou evidência interna relevante. NÃO finja que você consegue navegar por conta própria nesta etapa. Se o contexto trouxer um bloco "PESQUISA EXTERNA ATUAL", a pesquisa já foi realizada pelo módulo de recuperação: use essas evidências, confronte as fontes recuperadas, preserve datas e deixe clara qualquer incerteza. Se esse bloco não existir, responda apenas com conhecimento estável que não dependa de atualidade; para fatos atuais ou específicos que não estejam confirmados, declare que faltam evidências em vez de completar por suposição. ${PECUARIA_AUTHORITY_POLICY}`;
}
