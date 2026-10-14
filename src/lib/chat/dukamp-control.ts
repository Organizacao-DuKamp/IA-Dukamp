import { normalized, reviewIsOperational, speciesFromIndication } from "../rag/dukamp-package.ts";
import type {
  CatalogEnvelope,
  ControlledProduct,
  EvidenceReference,
} from "../rag/dukamp-package.ts";

export interface ProducerNeed {
  species: string[];
  ageMonths: number | null;
  weightKg: number | null;
  objective: string[];
  system: string | null;
  season: string | null;
  category: string | null;
  dietKnown: boolean;
  adaptationKnown: boolean;
  forageKnown: boolean;
  cochoKnown: boolean;
  clinical: boolean;
  historic: boolean;
}
const speciesPatterns: Array<[string, RegExp]> = [
  ["bovinos", /\b(?:bovino\w*|gado|bois?|vaca\w*|nelore|bezerro\w*|touro\w*|novilha\w*)\b/],
  ["ovinos", /\b(?:ovino\w*|ovelha\w*|carneiro\w*|cordeiro\w*)\b/],
  ["caprinos", /\b(?:caprino\w*|cabra\w*|bode\w*|cabrito\w*)\b/],
  ["equinos", /\b(?:equino\w*|equideo\w*|cavalo\w*|egua\w*|potro\w*)\b/],
];
const goalPatterns: Array<[string, RegExp]> = [
  ["cria", /\bcria\b|bezerro|aleitamento/],
  ["recria", /recria|crescimento|desenvolvimento/],
  ["engorda", /engorda|terminacao|acabamento|ganho de peso|ganhar peso|gmd|ganho medio diario/],
  ["leite", /lactacao|leiteir|litros de leite/],
  ["reproducao", /reproducao|reprodutor|gestacao|gestante|prenhez|fertilidade|iatf/],
  ["pre_parto", /pre parto|antecede o parto|antes do parto/],
  ["atletas", /atleta|rodeio|competicao|performance|alta intensidade/],
  ["manutencao", /manutencao|repouso/],
];
const uncoveredHistoricNames = [
  "Dukamp Uréia",
  "Dukamp Protéico",
  "Dukamp Protéico Premium",
  "Dukamp Ração Lactação 24 AE",
  "Núcleo Dukamp Bezerro GL",
  "Núcleo Dukamp Crescimento",
  "Dukamp Eqüinos Premium",
  "Ração Dukavallus Atleta",
  "Dukamp 40",
  "Dukamp Reprodução",
  "Dukamp 87",
  "Dukamp Leite",
  "Dukamp Ração Seca",
  "Dukamp Concentrado Confinamento CGI-15",
];
export function assessProducerNeed(text: string, userHistory: string[] = []): ProducerNeed {
  const current = normalized(text),
    context = normalized([...userHistory.slice(-6), text].join("\n"));
  const numberWords: Record<string, string> = {
    um: "1",
    uma: "1",
    dois: "2",
    duas: "2",
    tres: "3",
    quatro: "4",
    cinco: "5",
    seis: "6",
    sete: "7",
    oito: "8",
    nove: "9",
    dez: "10",
    onze: "11",
    doze: "12",
  };
  const numericalContext = [...userHistory.slice(-6), text]
    .join("\n")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(
      /\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)(?=\s+(?:mes|meses|ano|anos)\b)/g,
      (word) => numberWords[word],
    );
  const currentSpecies = speciesPatterns.filter(([, p]) => p.test(current)).map(([s]) => s);
  const ageMatches = [...numericalContext.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(mes(?:es)?|anos?)\b/g)];
  const age = ageMatches.at(-1);
  const weights = [...numericalContext.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|quilos)\b/g)];
  const clinical =
    /intoxic|tremor|convuls|espumando|caindo|nao consegue levantar|morrendo|comeu.*(?:racao|ureia|produto)|ingeriu/.test(
      current,
    ) &&
    /meu|minha|animal|gado|boi|vaca|cavalo|ovelha|comeu|ingeriu|suspeit/.test(current) &&
    !/como prevenir|o que e|quais riscos/.test(current);
  const choose = (pattern: RegExp, label: string) =>
    pattern.test(current) || pattern.test(context) ? label : null;
  return {
    species: currentSpecies.length
      ? currentSpecies
      : speciesPatterns.filter(([, p]) => p.test(context)).map(([s]) => s),
    ageMonths: age ? Number(age[1].replace(",", ".")) * (age[2].startsWith("ano") ? 12 : 1) : null,
    weightKg: weights.length ? Number(weights.at(-1)![1].replace(",", ".")) : null,
    objective: goalPatterns.filter(([, p]) => p.test(context)).map(([s]) => s),
    system:
      choose(/semi confin/, "semi_confinamento") ??
      choose(/confin/, "confinamento") ??
      choose(/pasto|pastagem|campo/, "pasto"),
    season: /\bseca\b/.test(current)
      ? "seca"
      : /aguas|chuv|primavera/.test(current)
        ? "aguas"
        : null,
    category: /lactacao|leiteir/.test(context)
      ? "lactacao"
      : /reprodutor|touro.*reproducao/.test(context)
        ? "macho_reprodutor"
        : /gestante|gestacao/.test(context)
          ? "gestacao"
          : /bezerro|potro|cordeiro|cabrito|crescimento/.test(context)
            ? "jovem"
            : /adulto/.test(context)
              ? "adulto"
              : null,
    dietKnown:
      /ja (?:come|recebe|usa)|dieta|medicamento|tiamulina|outro suplemento|ureia adicional/.test(
        context,
      ),
    adaptationKnown: /adaptad|adaptacao/.test(context),
    forageKnown: /pasto|pastagem|volumoso|feno|silagem/.test(context),
    cochoKnown: /cocho|outras especies|outros animais/.test(context),
    clinical,
    historic: /histor|obsoleto|versao antiga|rotulo antigo|ate 2015|2012|nao lancado/.test(current),
  };
}
function containsAlias(text: string, alias: string): boolean {
  return ` ${text} `.includes(` ${alias} `);
}
/** Feeding-system evidence, never a performance promise or a rule based on a product name. */
export function needsCompleteDiet(text: string): boolean {
  const query = normalized(text);
  return (
    (/bagac(?:o|inho)|bagacinho/.test(query) && /somente|\bso\b|apenas|unico/.test(query)) ||
    /dieta (?:completa|total)|sem volumoso|\bconfinamento\b/.test(query)
  );
}
export function matchControlledProducts(
  text: string,
  catalog: CatalogEnvelope[],
  recommendation = false,
  ignorePreviousNames = false,
): CatalogEnvelope[] {
  const query = normalized(text);
  // A percentage is part of variant identity, not an interchangeable dose or alias.
  const variant = /\btotal\s+m\b/i.test(query)
    ? text.match(/\b(\d+(?:[.,]\d+)?)\s*%/)?.[1]
    : undefined;
  const named = catalog
    .filter(
      (entry) =>
        !variant ||
        entry.product.nome_comercial_documental.match(/\b(\d+(?:[.,]\d+)?)\s*%/)?.[1] === variant,
    )
    .map((entry) => {
      const compactNucleus = normalized(entry.product.nome_comercial_documental).match(
        /nucleo.*\b(\d+)\s+([bi])$/,
      );
      const grainCode = normalized(entry.product.nome_comercial_documental).match(
        /\bgi\s+\d+(?:\s+\d+)?$/,
      )?.[0];
      const aliases = [
        entry.product.nome_comercial_documental,
        ...entry.product.aliases,
        ...(compactNucleus
          ? [
              `nucleo${compactNucleus[1]}${compactNucleus[2]}`,
              `nucleo ${compactNucleus[1]} ${compactNucleus[2]}`,
            ]
          : []),
        ...(grainCode ? [grainCode, grainCode.replaceAll(" ", "")] : []),
      ]
        .flatMap((alias) => [normalized(alias), normalized(alias).replace(/^dukamp /, "")])
        .filter(
          (alias) =>
            (alias.length >= 9 || /^gi\s*\d+(?:\s+\d+)?$/.test(alias)) && !/\brtpi\b/.test(alias),
        );
      return {
        entry,
        matched:
          aliases
            .filter((alias) => containsAlias(query, alias))
            .sort((a, b) => b.length - a.length)[0] ?? "",
        length: Math.max(
          0,
          ...aliases.filter((alias) => containsAlias(query, alias)).map((a) => a.length),
        ),
      };
    })
    .filter((match) => match.length > 0)
    .sort((a, b) => b.length - a.length);
  if (named.length && !ignorePreviousNames) {
    return named
      .filter(
        (m) =>
          !named.some(
            (other) => other.length > m.length && containsAlias(other.matched, m.matched),
          ),
      )
      .map((m) => m.entry)
      .slice(0, 3);
  }
  if (!recommendation) return [];
  const need = assessProducerNeed(text);
  const completeDiet = needsCompleteDiet(text);
  if (need.species.length !== 1 || (!need.objective.length && !completeDiet)) return [];
  const candidates = catalog
    .filter((e) => !["historico_obsoleto", "nao_lancado"].includes(e.product.status_vigencia))
    .filter((e) => speciesFromIndication(e.product).includes(need.species[0]))
    .filter((e) => incompatibilities(e, need, text).length === 0)
    .filter(
      (e) =>
        need.category !== "lactacao" ||
        !/bovinos de corte/.test(normalized(e.product.descricao_documental)) ||
        /leite|lactacao/.test(normalized(e.product.descricao_documental)),
    )
    .map((entry) => {
      const indication = normalized(
        entry.product.classificacao_documental + " " + entry.product.descricao_documental,
      );
      const goals = goalPatterns.filter(
        ([name, pattern]) => need.objective.includes(name) && pattern.test(indication),
      ).length;
      const seasonMatches = !/seca|chuvos|aguas|primavera/.test(indication)
        ? true
        : need.season === "seca"
          ? /seca/.test(indication)
          : need.season === "aguas"
            ? /chuvosa|aguas|primavera/.test(indication)
            : true;
      const ration =
        /racao/.test(indication) &&
        /confinamento/.test(indication) &&
        /sem volumoso/.test(indication);
      return {
        entry,
        score: goals + (seasonMatches && need.season ? 2 : 0) + (completeDiet && ration ? 10 : 0),
        goals,
        seasonMatches,
        ration,
      };
    })
    .filter((m) => (m.goals > 0 || (completeDiet && m.ration)) && m.seasonMatches)
    .filter((m) => !completeDiet || m.ration)
    .sort(
      (a, b) =>
        b.score - a.score || a.entry.product.produto_id.localeCompare(b.entry.product.produto_id),
    );
  return candidates.slice(0, completeDiet ? 2 : 3).map((c) => c.entry);
}
export function sourceLabel(
  product: ControlledProduct,
  section: string,
  sourceId = product.principal_documental_source_id,
): string {
  const source = product.fontes.find((s) => s.source_id === sourceId);
  if (!source) return `Fonte documental ${sourceId}.`;
  const filename = source.arquivo_original.replaceAll("\\", "/").split("/").at(-1);
  return `Fonte: ${filename}; versão ${source.source_id}; ${section}.`;
}
export function citationLabel(reference: EvidenceReference): string {
  const filename = reference.arquivo_original.replaceAll("\\", "/").split("/").at(-1);
  return `${filename} (${reference.source_id}, seção ${reference.secao_numero_original ?? reference.secao_semantica}${reference.pagina_pdf_inicio ? `, página ${reference.pagina_pdf_inicio}` : ""})`;
}
export function incompatibilities(
  entry: CatalogEnvelope,
  need: ProducerNeed,
  text: string,
): string[] {
  const p = entry.product,
    warnings = normalized(
      reviewIsOperational(entry)
        ? entry.review!.campos_validados.restricoes +
            " " +
            entry.review!.campos_validados.modo_de_usar
        : p.restricoes_documentais + " " + p.modo_de_usar_documental,
    );
  const declared = reviewIsOperational(entry)
    ? entry.review!.especies_autorizadas
    : speciesFromIndication(p);
  const reasons: string[] = [];
  if (need.species.length && need.species.some((s) => !declared.includes(s)))
    reasons.push(
      `A indicação documental não autoriza este produto para ${need.species.filter((s) => !declared.includes(s)).join(", ")}.`,
    );
  if (
    need.category === "lactacao" &&
    /bovinos de corte/.test(normalized(p.descricao_documental)) &&
    !/leite|lactacao/.test(normalized(p.descricao_documental))
  )
    reasons.push(
      "A indicação é para bovinos de corte; não autoriza este uso em vacas em lactação.",
    );
  if (need.ageMonths !== null) {
    const indication = normalized(p.descricao_documental + " " + p.modo_de_usar_documental);
    const above = indication.match(/acima de (\d+) (meses|ano)/);
    const under = warnings.match(/menos de (\d+) meses/);
    if (above && need.ageMonths <= Number(above[1]) * (above[2] === "ano" ? 12 : 1))
      reasons.push(
        `A idade informada não atende à faixa descrita: acima de ${above[1]} ${above[2]}.`,
      );
    else if (under && need.ageMonths < Number(under[1]))
      reasons.push(`O relatório restringe animais com menos de ${under[1]} meses.`);
  }
  if (
    need.category === "macho_reprodutor" &&
    /nao fornecer.*(?:machos|reprodutores)/.test(warnings)
  )
    reasons.push("O relatório proíbe o uso para machos destinados à reprodução.");
  if (need.category === "jovem" && /exclusivamente.*adultos|somente.*adultos/.test(warnings))
    reasons.push(
      "Esta versão restringe o uso a animais adultos; a categoria em crescimento precisa de confirmação.",
    );
  const query = normalized(text);
  if (
    /puro|sem mistur/.test(query) &&
    /nao.*(?:fornecido puro|fornecer puro|diretamente ao)/.test(warnings)
  )
    reasons.push("O produto não deve ser fornecido puro: o relatório exige preparar a mistura.");
  if (/tiamulina/.test(query) && /tiamulina/.test(warnings))
    reasons.push(
      "O relatório registra incompatibilidade com tiamulina. Encaminhe a combinação de produtos e medicamentos ao responsável técnico.",
    );
  if (/adicion.*ureia|ureia adicional|mais ureia/.test(query) && /ureia adicional/.test(warnings))
    reasons.push(
      "O relatório restringe uréia adicional. Não acrescente uréia com base nesta conversa.",
    );
  return reasons;
}
export interface ControlledTurn {
  active: boolean;
  selected: CatalogEnvelope[];
  reply: string | null;
  allowOperationalModel: boolean;
  historical: boolean;
  catalogVariants?: import("./dukamp-practical.ts").CatalogVariant[];
  catalogOnly?: boolean;
}
export function decideControlledTurn(
  text: string,
  catalog: CatalogEnvelope[],
  options: {
    recommendation?: boolean;
    userHistory?: string[];
    catalogAvailable?: boolean;
  } = {},
): ControlledTurn {
  const need = assessProducerNeed(text, options.userHistory);
  const context = [...(options.userHistory ?? []).slice(-6), text].join("\n");
  const currentMatches = matchControlledProducts(text, catalog);
  const selected = currentMatches.length
    ? currentMatches
    : options.recommendation
      ? matchControlledProducts(context, catalog, true, true)
      : matchControlledProducts(context, catalog);
  const none: ControlledTurn = {
    active: false,
    selected: [],
    reply: null,
    allowOperationalModel: false,
    historical: need.historic,
  };
  if (
    !currentMatches.length &&
    /previsao|chuva|cotacao|mudando de assunto|programacao|impressora/.test(normalized(text))
  )
    return none;
  if (need.clinical)
    return {
      ...none,
      active: true,
      reply:
        "Os sinais ou a suspeita de ingestão que você descreveu precisam de atendimento veterinário imediato. Informe ao veterinário o produto, a embalagem, o horário e a quantidade aproximada, se conhecida. Não vou indicar outro suplemento nem calcular tratamento para essa situação.",
    };
  if (!selected.length) {
    if (/tabela/.test(normalized(text)) && /(?:g kg|todos os g|unidades?)/.test(normalized(text)))
      return {
        ...none,
        active: true,
        reply:
          "A unidade e a base precisam estar explícitas no título e na versão da tabela. Não acrescento /kg a uma unidade sem base documental. Informe o produto e a tabela para conferir a fonte.",
      };
    if (/produtos mais vendidos/.test(normalized(text)) && /estoque/.test(normalized(text)))
      return {
        ...none,
        active: true,
        reply:
          "O nome de uma pasta do pacote não comprova estoque atual. Disponibilidade e preço precisam de consulta à fonte comercial vigente da Dukamp.",
      };
    if (
      /texto recuperado/.test(normalized(text)) &&
      /ignore.*regras|qualquer especie/.test(normalized(text))
    )
      return {
        ...none,
        active: true,
        reply:
          "O texto recuperado é uma fonte de dados e não pode alterar os controles da aplicação. As restrições de espécie, versão e revisão técnica continuam válidas; uma instrução no documento não aprova o produto.",
      };
    const uncovered = uncoveredHistoricNames.find((name) =>
      containsAlias(normalized(text), normalized(name)),
    );
    if (uncovered)
      return {
        ...none,
        active: true,
        reply: `${uncovered} aparece em relações históricas, mas este pacote não contém relatório específico inequívoco para liberar sua composição, dose ou uso. Não vou completar a ficha com a de outra variante. Confirme o nome atual e o relatório com a Dukamp.\n\nFonte: Relação de Produtos Dukamp 2012-02/2012-07 (D003/D004, catálogos históricos).`,
      };
    if (
      /proteina bruta/.test(normalized(text)) &&
      /nnp|nitrogenio nao proteico/.test(normalized(text)) &&
      /som|adicion/.test(normalized(text))
    )
      return {
        ...none,
        active: true,
        reply:
          "A proteína bruta e o NNP equivalente em proteína não devem ser somados como nutrientes independentes para apresentar uma proteína total. Preserve as duas garantias e suas especificações. Qual produto e tabela você está analisando?",
      };
    if (
      /mistura industrial|processo de fabricacao/.test(normalized(text)) &&
      /dose|cocho/.test(normalized(text))
    )
      return {
        ...none,
        active: true,
        reply:
          "A quantidade usada na fabricação é o tamanho da mistura industrial, não a dose por animal. Para o cocho, é necessário o modo de usar da versão correta e sua revisão técnica; não transferir um valor da seção de fabricação para uma dose.",
      };
    if (
      options.recommendation &&
      /dukamp|racao|mineral|suplement|proteico|nucleo/.test(normalized(context)) &&
      !need.species.length
    )
      return {
        ...none,
        active: true,
        reply:
          "Para qual espécie e categoria você procura o produto? Informe também o objetivo, por exemplo manutenção, cria, recria, engorda, leite ou reprodução.",
      };
    return none;
  }
  const normalizedText = normalized(text);
  const commercialOnly =
    /preco|custa|estoque|disponivel|vendedor|telefone|foto|imagem/.test(normalizedText) &&
    !/dose|consumo|mistur|uso|usar|dar|aliment|recomend|indica/.test(normalizedText);
  if (
    commercialOnly &&
    !selected.some((e) => ["historico_obsoleto", "nao_lancado"].includes(e.product.status_vigencia))
  )
    return none; // Current commercial facts still use the live catalog.
  for (const entry of selected) {
    const reasons = incompatibilities(entry, need, context);
    if (reasons.length)
      return {
        ...none,
        active: true,
        selected,
        reply: `${entry.product.nome_comercial_documental}: ${reasons.join(" ")}\n\n${sourceLabel(entry.product, "indicação, modo de usar e restrições")}`,
      };
  }
  if (
    selected.some((entry) =>
      ["historico_obsoleto", "nao_lancado"].includes(entry.product.status_vigencia),
    )
  ) {
    return {
      ...none,
      active: true,
      selected,
      reply: selected
        .map(
          (e) =>
            `${e.product.nome_comercial_documental}: o documento está marcado como ${e.product.status_vigencia === "nao_lancado" ? "não lançado" : "histórico/obsoleto"}. Ele não comprova comercialização atual e não será usado como recomendação de uso.\n${sourceLabel(e.product, "identificação e versão documental")}`,
        )
        .join("\n\n"),
    };
  }
  if (need.historic) {
    return {
      ...none,
      active: true,
      selected,
      reply: selected
        .map((e) => {
          const old = e.product.fontes.filter((s) => s.versao_papel === "historico_obsoleto");
          return `${e.product.nome_comercial_documental}: ${old.length ? `há versão histórica (${old.map((s) => s.source_id).join(", ")}) e versão principal (${e.product.principal_documental_source_id})` : "a vigência deste documento precisa de confirmação"}. As fórmulas e as vias de fornecimento dessas versões não devem ser transferidas entre si.\n${sourceLabel(e.product, "classificação e modo de usar", old[0]?.source_id)}`;
        })
        .join("\n\n"),
    };
  }
  const pending = selected.filter((entry) => !reviewIsOperational(entry));
  if (pending.length || options.catalogAvailable === false) {
    const operational =
      /dose|consumo|calcule|quant|mistur|puro|usar|fornecer|dar|inclusao|refeic|trato/.test(
        normalizedText,
      );
    const body = selected
      .map((entry) => {
        const p = entry.product;
        let detail = p.descricao_documental;
        let section = "indicação e restrições";
        if (/composicao|ingredientes/.test(normalizedText)) {
          detail = p.composicao_documental;
          section = "composição qualitativa";
        }
        const issues = p.bloqueios
          .slice(0, 3)
          .map((i) => i.descricao)
          .join(" ");
        return (
          `${p.nome_comercial_documental}\nO relatório descreve: ${detail}\n` +
          (issues ? `Pontos a confirmar: ${issues}\n` : "") +
          (operational
            ? "Não posso calcular ou liberar dose, mistura ou manejo com esta ficha pendente de revisão do rótulo vigente. Confirme esses campos com o responsável técnico da Dukamp.\n"
            : "A indicação é documental; o rótulo vigente e a adequação ao seu lote ainda precisam de confirmação técnica.\n") +
          sourceLabel(p, section)
        );
      })
      .join("\n\n");
    return {
      ...none,
      active: true,
      selected,
      reply:
        body +
        (options.catalogAvailable === false
          ? "\n\nA confirmação administrativa da ficha está indisponível neste momento; a liberação de uso permanece bloqueada."
          : ""),
    };
  }
  const missing = [
    !need.species.length && "espécie",
    !need.category && "categoria e fase fisiológica",
    need.ageMonths === null && "idade",
    need.weightKg === null && "peso aproximado",
    !need.system && "sistema de criação",
    !need.dietKnown && "dieta, suplementos e medicamentos atuais",
    !need.forageKnown && "pasto ou volumoso",
    !need.adaptationKnown && "adaptação",
    !need.cochoKnown && "condições do cocho e acesso de outras espécies",
  ].filter(Boolean);
  if (
    /dose|consumo|calcule|quant|mistur|usar|fornecer|dar|recomend|indica/.test(normalizedText) &&
    missing.length
  )
    return {
      ...none,
      active: true,
      selected,
      reply: `Antes de orientar o uso de ${selected.map((e) => e.product.nome_comercial_documental).join(" ou ")}, preciso confirmar ${missing.slice(0, 2).join(" e ")}.`,
    };
  if (
    /dose|consumo|calcule|quant|mistur|usar|fornecer|dar|refeic|trato|inclusao/.test(normalizedText)
  )
    return {
      ...none,
      active: true,
      selected,
      reply: selected
        .map((entry) => {
          const r = entry.review!;
          return `${entry.product.nome_comercial_documental}\nModo de usar conferido pelo responsável técnico:\n${r.campos_validados.modo_de_usar}\nRestrições da mesma versão:\n${r.campos_validados.restricoes}\nUnidades e bases:\n${r.campos_validados.unidades_e_bases}\nA conversa não recalcula nem converte esses valores sem um cálculo validado para esta versão.\n${sourceLabel(entry.product, "modo de usar, restrições e unidades conferidas", r.source_id_aprovado)}\nEvidência do rótulo atual: ${r.evidencia_rotulo_atual}; revisão ${r.data_revisao}.`;
        })
        .join("\n\n"),
    };
  return { ...none, active: true, selected, reply: null, allowOperationalModel: true };
}

export function approvedProductContext(entry: CatalogEnvelope): string {
  if (!reviewIsOperational(entry))
    return "Liberação operacional ausente. Não usar como dose ou indicação aprovada.";
  const review = entry.review!;
  return (
    stableReviewContext(entry.product.nome_comercial_documental, review.campos_validados) +
    `\nVersão aprovada: ${review.source_id_aprovado}; evidência do rótulo atual: ${review.evidencia_rotulo_atual}; revisão ${review.data_revisao}.`
  );
}
function stableReviewContext(name: string, fields: Record<string, string>): string {
  return (
    `PRODUTO COM REVISÃO TÉCNICA REGISTRADA: ${name}\n` +
    Object.entries(fields)
      .map(([k, value]) => `${k}: ${value}`)
      .join("\n")
  );
}
