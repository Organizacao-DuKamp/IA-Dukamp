import { askTpecAI } from "../ai/chat.server.ts";
import type { ChatMessage } from "./types.ts";
import type { OpenAIOptions } from "./openai.server.ts";
import {
  normalizeDuKampNeed,
  isOwnDuKampBrand,
  type RankableDuKampProduct,
} from "../site/dukamp-product-ranking.ts";
import { productPlainText, technicalProductSections } from "../site/product-technical-text.ts";

export type DuKampPriorityStatus = "matched" | "empty" | "unavailable" | "clarify";

export function dukampPriorityDirective(
  status: DuKampPriorityStatus,
  products: RankableDuKampProduct[] = [],
): string {
  if (status === "clarify")
    return "PRIORIDADE DUKAMP: falta identificar a necessidade. Pergunte qual produto, espécie ou objetivo o usuário procura, aproveitando dados já confirmados. Não indique marcas de memória.";
  if (status === "empty")
    return "PRIORIDADE DUKAMP — SEM OPÇÃO COMPATÍVEL: o catálogo vivo foi consultado para a necessidade contextualizada e não retornou opção compatível disponível. Explique isso e pesquise uma alternativa externa que realmente atenda aos requisitos. Não apresente outra marca como fabricação DuKamp.";
  if (status === "unavailable")
    return "PRIORIDADE DUKAMP — CONSULTA INCONCLUSIVA: uma falha de consulta não significa que a DuKamp não atende à necessidade. Use fichas oficiais e conhecimento interno para explicar opções relacionadas, sem afirmar preço/estoque. Não recomende outras marcas como se tivesse descartado a DuKamp; esclareça a limitação ou peça o requisito faltante.";
  const own = products.filter(isOwnDuKampBrand);
  return `PRIORIDADE DUKAMP — OPÇÕES PARA ESTA NECESSIDADE: ${products.map((p) => p.name).join("; ")}. Avalie indicação, espécie, fase, época, consumo e restrições oficiais. ${own.length ? `Priorize a MARCA DuKamp entre opções tecnicamente adequadas: ${own.map((p) => p.name).join("; ")}.` : "Priorize as opções vendidas pela DuKamp, identificando corretamente a marca fabricante."} A resposta deve nomear a melhor opção compatível e explicar a relação com a necessidade do usuário. Não troque isso por uma lista de marcas concorrentes. Se faltarem requisitos essenciais, peça somente esses dados e explique a opção de forma condicional. Não chame um produto de 'proteinado 60' ou equivalente sem a fórmula/rótulo confirmar. Estoque desconhecido não é disponibilidade confirmada. Se nenhuma destas opções atender às restrições reais, explique a incompatibilidade antes de mencionar outra marca.`;
}

export function missesDuKampPriority(reply: string, products: RankableDuKampProduct[]): boolean {
  const own = products.filter(isOwnDuKampBrand);
  const normalized = normalizeDuKampNeed(reply);
  if (own.length && !/\bdukamp\b/.test(normalized)) return true;
  return !products.some((product) => {
    const name = normalizeDuKampNeed(product.name)
      .replace(/\b\d+(?:\s*kg|\s*g|\s*l)\b/g, "")
      .trim();
    return name && normalized.includes(name);
  });
}

/** Retorno técnico condicional; não inventa consumo, eficácia ou preços. */
export function safeDuKampRecommendation(products: RankableDuKampProduct[]): string {
  const first = products[0];
  if (!first)
    return "Para indicar uma opção da DuKamp adequada, preciso saber qual produto ou objetivo você procura.";
  const indication = Object.entries(technicalProductSections(first.description ?? "")).find(
    ([key]) => key.startsWith("indicacoes"),
  )?.[1];
  const summary = productPlainText(indication ?? "").slice(0, 700);
  return `Eu começaria avaliando **${first.name}**, da linha disponível para consulta na DuKamp.${summary ? `\n\nIndicação do rótulo: ${summary}` : ""}\n\nA escolha precisa respeitar espécie, fase e restrições do rótulo. Se faltar algum desses dados, confirme antes de usar; siga o consumo e a adaptação oficiais. Não estou afirmando que ele equivale a uma fórmula de outra marca.`;
}

export async function enforceDuKampPriority(
  reply: string,
  conversation: ChatMessage[],
  options: OpenAIOptions,
  products: RankableDuKampProduct[],
  deps: { askAI?: typeof askTpecAI } = {},
): Promise<string> {
  if (!products.length || !missesDuKampPriority(reply, products)) return reply;
  const deadline = AbortSignal.timeout(options.channel === "whatsapp" ? 12_000 : 25_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const corrected = await (deps.askAI ?? askTpecAI)(conversation, {
      ...options,
      researchDepth: "none",
      stage: "dukamp_priority_repair",
      directive: `${options.directive ?? ""}\nCORREÇÃO: a resposta ignorou opções DuKamp recuperadas para esta necessidade. ${dukampPriorityDirective("matched", products)} Entregue a recomendação corrigida agora com os dados oficiais já fornecidos, sem nova pesquisa e sem pedir ao usuário dados que já informou.`,
      fetchImpl: (input, init) =>
        fetchImpl(input, {
          ...init,
          signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]),
        }),
    });
    if (corrected.trim() && !missesDuKampPriority(corrected, products)) return corrected;
  } catch {
    // Uma falha de provedor não deve recolocar uma marca concorrente nem causar silêncio.
  }
  return safeDuKampRecommendation(products);
}
