// Compatibilidade temporária com o antigo ponto de integração de pesquisa.
//
// IMPORTANTE: este módulo NÃO chama mais a API da Perplexity. Ele apenas cria
// um plano de pesquisa que é interpretado por openai.server.ts. A pesquisa
// real acontece dentro da Responses API da OpenAI, usando o Web Search nativo
// do mesmo GPT que produz a resposta final.
//
// Manter os exports antigos evita quebrar rotas publicadas durante a migração
// para a arquitetura ChatGPT-first.

export type ResearchProfile =
  | "weather"
  | "current_market"
  | "regulation"
  | "animal_health_status"
  | "market_intelligence"
  | "technical_livestock"
  | "general_current";

export type ResearchDepth = "medium" | "high";

export interface ResearchOptions {
  currentMarketSearch?: boolean;
  weatherSearch?: boolean;
  weatherLocation?: string | null;
  deepResearch?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** @deprecated Mantido apenas para compatibilidade binária com código legado. */
export class PerplexityError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PerplexityError";
    this.status = status;
  }
}

function normalized(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function researchProfileForQuery(
  query: string,
  options: ResearchOptions = {},
): ResearchProfile {
  if (options.weatherSearch) return "weather";
  if (options.currentMarketSearch) return "current_market";

  const q = normalized(query);

  if (
    /\b(mapa|portaria|instrucao normativa|decreto|lei|legislacao|regulamento|vigente|obrigatorio|proibido|permitido)\b/.test(
      q,
    )
  ) {
    return "regulation";
  }

  if (
    /\b(febre aftosa|brucelose|tuberculose|foco|surto|status sanitario|emergencia sanitaria|vacina obrigatoria)\b/.test(
      q,
    )
  ) {
    return "animal_health_status";
  }

  // Panorama/tendência é análise de mercado, mesmo quando a commodity é citada.
  // Uma simples ocorrência de "boi gordo" não transforma a consulta em pedido
  // de cotação; preço exato exige linguagem explícita de valor/cotação.
  if (
    /\b(panorama|tendencia|cenario|mercado|exportacao|abate|oferta|demanda|relacao de troca)\b/.test(q) &&
    !/\b(cotacao|preco|quanto (?:esta|ta|custa)|valor|r\$)\b/.test(q)
  ) {
    return "market_intelligence";
  }

  if (
    /\b(cotacao|preco|quanto (?:esta|ta|custa)|valor|arroba|preco do boi|boi china|preco do milho|preco da soja|preco do leite)\b/.test(
      q,
    )
  ) {
    return "current_market";
  }

  if (
    /\b(manejo|nutricao|suplementacao|confinamento|semi-confinamento|pasto|reproducao|genetica|sanidade|bem-estar|bovino|ovino|caprino|equino)\b/.test(
      q,
    )
  ) {
    return "technical_livestock";
  }

  return "general_current";
}

export function researchDepthForQuery(
  query: string,
  options: ResearchOptions = {},
): ResearchDepth {
  const profile = researchProfileForQuery(query, options);

  if (options.deepResearch === true) return "high";

  switch (profile) {
    case "weather":
    case "current_market":
    case "regulation":
    case "animal_health_status":
    case "market_intelligence":
      return "high";
    case "technical_livestock":
    case "general_current":
    default:
      return "medium";
  }
}

function sourceGuidance(profile: ResearchProfile, location?: string | null): string[] {
  switch (profile) {
    case "weather":
      return [
        `Local prioritário: ${location || "o local informado pelo usuário"}.`,
        "Cruze dados atuais e dê preferência a fontes meteorológicas oficiais e modelos reconhecidos.",
        "Verifique data/hora de atualização, período previsto, alertas, chuva, temperatura, vento e incerteza.",
        "Quando útil, traduza os dados em impactos prudentes para manejo pecuário.",
      ];
    case "current_market":
      return [
        "Para cotação diária, procure primeiro hoje, depois ontem e anteontem; se não houver publicação nesse intervalo, use a publicação confiável mais recente e destaque a data real.",
        "Todo valor deve conservar unidade, praça, data de referência e fonte.",
        "Prefira CEPEA/ESALQ, B3, Conab, IEA, órgãos públicos, bolsas, cooperativas e fontes setoriais reconhecidas.",
      ];
    case "regulation":
      return [
        "Priorize legislação e páginas oficiais vigentes (MAPA, Diário Oficial, órgãos estaduais e bases normativas).",
        "Confirme alterações, revogações, data de vigência e escopo antes de concluir.",
      ];
    case "animal_health_status":
      return [
        "Priorize MAPA, órgãos estaduais de defesa sanitária, WOAH e fontes oficiais atuais.",
        "Diferencie status epidemiológico atual de orientação clínica individual.",
      ];
    case "market_intelligence":
      return [
        "Cruze dados primários recentes com ao menos uma fonte independente confiável.",
        "Separe fatos, cálculos, tendências e hipóteses; não apresente cenário como certeza.",
      ];
    case "technical_livestock":
      return [
        "Priorize Embrapa, universidades, NASEM/NRC, artigos técnicos e fontes veterinárias/agronômicas reconhecidas.",
        "Compare recomendações quando houver divergência e deixe limites/condições de aplicação explícitos.",
      ];
    case "general_current":
    default:
      return [
        "Busque fontes atuais e confiáveis, dando preferência a fontes primárias quando disponíveis.",
        "Cruze informações relevantes antes de afirmar fatos sensíveis ao tempo.",
      ];
  }
}

/**
 * Gera somente um descritor de pesquisa. A chamada real ao Web Search acontece
 * em askOpenAI(), para que pesquisa, raciocínio e resposta pertençam ao mesmo
 * modelo da OpenAI e ao mesmo turno da conversa.
 */
export async function researchChatGPT(
  query: string,
  options: ResearchOptions = {},
): Promise<string> {
  const cleanQuery = query.trim().slice(0, 4_000);
  if (!cleanQuery) return "";

  const profile = researchProfileForQuery(cleanQuery, options);
  const depth = researchDepthForQuery(cleanQuery, options);
  const guidance = sourceGuidance(profile, options.weatherLocation);

  return [
    "CHATGPT_WEB_SEARCH_REQUIRED",
    `PROFILE: ${profile}`,
    `DEPTH: ${depth}`,
    `QUERY: ${cleanQuery}`,
    "GOAL: pesquise na web antes de responder, valide os fatos relevantes e use o resultado diretamente na resposta deste turno.",
    ...guidance.map((item) => `- ${item}`),
  ].join("\n");
}

/**
 * @deprecated Alias legado. Não há nenhuma chamada à Perplexity por trás dele.
 */
export async function researchPerplexity(
  query: string,
  options: ResearchOptions = {},
): Promise<string> {
  return researchChatGPT(query, options);
}