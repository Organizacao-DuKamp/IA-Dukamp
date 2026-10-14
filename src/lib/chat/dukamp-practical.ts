import { assessProducerNeed, needsCompleteDiet } from "./dukamp-control.ts";
import type { ControlledTurn } from "./dukamp-control.ts";
import { normalized } from "../rag/dukamp-package.ts";
import { userRequestedSourceLinks } from "./response-format.ts";

export interface CatalogVariant {
  id: string;
  name: string;
  code: string | null;
  source: string;
}

export const DUKAMP_PRACTICAL_DIRECTIVE =
  "PRODUTOS DUKAMP: responda de forma direta e prática, relacionando cada opção à necessidade do produtor. Não use 'o relatório descreve', 'o trecho informa' nem cole uma ficha crua. Mantenha fontes, arquivos, hashes e versões na rastreabilidade interna; mostre referências somente se o usuário pedir. Preserve na resposta as restrições que mudam a decisão e a necessidade de revisão técnica, sem escolher doses conflitantes, prometer GMD ou tratar uma variante como outra. Peça apenas os dados que faltam para a próxima decisão.";

/** Presentation only: evidence, hashes and technical approval remain in the control registry. */
export function practicalControlledReply(
  turn: ControlledTurn,
  text: string,
  userHistory: string[] = [],
): string {
  const raw = turn.reply ?? "";
  if (userRequestedSourceLinks(text)) return raw;
  const context = [...userHistory.slice(-6), text].join("\n");
  const query = normalized(text);
  const need = assessProducerNeed(text, userHistory);
  const variants = turn.catalogVariants ?? [];
  const pendingExplanation = /O relatório descreve:/.test(raw);
  if (turn.catalogOnly && !variants.length) return withoutProductSources(raw);
  if (!pendingExplanation && !turn.catalogOnly) return withoutProductSources(raw);
  // When the question concerns a conflict, keep its exact units/values visible for explanation.
  if (/conflit|diverg|duas|cinco|frequencia|refeicoes|media|garantias/.test(query)) {
    const issues = turn.selected.flatMap((entry) =>
      entry.product.bloqueios
        .filter((issue) =>
          /duas|cinco|frequencia|refeicoes/.test(query) ? issue.tipo === "manejo" : true,
        )
        .map((issue) => issue.descricao),
    );
    return `${turn.selected.map((e) => e.product.nome_comercial_documental).join("; ")}\n\n${issues.join(" ")}\n\nNão posso escolher um desses valores para orientar o uso. Confirme com o responsável técnico da Dukamp antes de fornecer.`;
  }
  const complete = needsCompleteDiet(context);
  const products = turn.selected.map((entry) => {
    const p = entry.product;
    const detail = /composicao|ingredientes/.test(query)
      ? p.composicao_documental
      : p.descricao_documental;
    return `• ${p.nome_comercial_documental}: ${detail.replace(/^Produto pronto para uso, indicado para /i, "Suplemento para ")}`;
  });
  if (variants.length)
    products.push(
      ...variants.map((p) => `• ${p.name}: outra versão para avaliar com o rótulo próprio.`),
    );
  const intro =
    complete && need.species.includes("bovinos")
      ? `${/gmd|ganho medio diario/.test(normalized(context)) ? "Para buscar esse ganho, é preciso avaliar a dieta completa; não basta escolher um suplemento proteico." : /bagac(?:o|inho)/.test(normalized(context)) ? "Com o bagacinho como único volumoso, precisamos avaliar o restante da dieta." : "Para esse sistema, precisamos avaliar a dieta completa."} ${turn.catalogOnly ? "Esta versão precisa de conferência própria." : "Entre as opções Dukamp para avaliar estão:"}`
      : "";
  const hasBagasse = /bagac(?:o|inho)/.test(normalized(context));
  const limits =
    complete &&
    turn.selected.some((e) => /total m/.test(normalized(e.product.nome_comercial_documental)))
      ? `A Total M e a Energética acima são para confinamento sem volumoso.${hasBagasse ? " Para usá-las nesse sistema, seria preciso avaliar uma mudança de dieta, em vez de simplesmente acrescentá-las ao bagacinho." : " A escolha depende da dieta completa e da adaptação."}${variants.length ? " As versões 1% e 2% precisam de conferência própria, sem transferir a dose de outra Total M." : ""}`
      : "";
  const review = /dose|consumo|calcule|quant|mistur|puro|usar|fornecer|dar|inclusao|trato/.test(
    query,
  )
    ? "A dose, a mistura e a adaptação precisam ser confirmadas com o responsável técnico da Dukamp antes de usar; a ficha ainda está pendente de revisão."
    : "A escolha e o modo de usar ainda precisam de confirmação pelo responsável técnico da Dukamp.";
  const question = complete
    ? need.category === null
      ? `Os animais são para engorda/descarte, estão prenhes ou estão produzindo leite?${hasBagasse ? " Você pretende manter o bagacinho ou pode mudar a dieta?" : ""}`
      : hasBagasse
        ? "Você pretende manter o bagacinho ou pode mudar a dieta?"
        : ""
    : "";
  return [
    intro,
    products.join("\n\n"),
    limits,
    complete
      ? "O ganho de peso depende da dieta, dos animais e do manejo; não é garantido pelo produto."
      : "",
    review,
    question,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function withoutProductSources(reply: string): string {
  return reply
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:Fonte(?: documental)?\b|Evidência do rótulo atual:)/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
