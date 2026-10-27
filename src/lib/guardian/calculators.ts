/** Deterministic arithmetic, never a nutritional prescription or a forecast. */
import { z } from "zod";

const positive = z.number().finite().positive().max(1e12);
const nonnegative = z.number().finite().nonnegative().max(1e12);
const rateInput = <K extends "mortality_rate" | "birth_rate" | "weaning_rate" | "pregnancy_rate">(
  kind: K,
) =>
  z
    .object({
      kind: z.literal(kind),
      events: nonnegative.int().max(1e7),
      eligible: positive.int().max(1e7),
      start: z.iso.date(),
      end: z.iso.date(),
    })
    .strict()
    .refine(
      (v) => v.start <= v.end && (kind === "birth_rate" || v.events <= v.eligible),
      "Confira período, ocorrências e população de referência.",
    );
const rates = [
  rateInput("mortality_rate"),
  rateInput("birth_rate"),
  rateInput("weaning_rate"),
  rateInput("pregnancy_rate"),
] as const;
export const CalculationInput = z.discriminatedUnion("kind", [
  ...rates,
  z
    .object({
      kind: z.literal("productivity"),
      producedKg: nonnegative,
      productiveHa: positive,
      start: z.iso.date(),
      end: z.iso.date(),
    })
    .strict()
    .refine((v) => v.start <= v.end),
  z
    .object({
      kind: z.literal("gmd"),
      initialKg: positive.max(2000),
      finalKg: positive.max(2000),
      days: positive.max(3650),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dry_matter"),
      liveWeightKg: positive.max(2000),
      intakePercent: positive.max(10),
      feedDryMatterPercent: positive.max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("feeding"),
      heads: positive.int().max(1e6),
      kgPerHeadDay: positive.max(500),
      days: positive.max(3650),
      pricePerKg: nonnegative,
    })
    .strict(),
  z
    .object({
      kind: z.literal("conversion"),
      consumedDryMatterKg: positive,
      gainedLiveKg: positive,
    })
    .strict(),
  z
    .object({ kind: z.literal("cost_per_kg"), totalCost: nonnegative, gainedLiveKg: positive })
    .strict(),
  z
    .object({
      kind: z.literal("cost_per_head"),
      totalCost: nonnegative,
      heads: positive.int().max(1e6),
    })
    .strict(),
  z
    .object({
      kind: z.literal("margin"),
      revenue: nonnegative,
      recordedExpenses: nonnegative,
      completeCosts: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("scenario"),
      heads: positive.int().max(1e6),
      saleKgPerHead: positive.max(2000),
      pricePerKg: positive,
      totalCost: nonnegative,
      priceChangePercent: z.number().finite().min(-100).max(1000),
    })
    .strict(),
]);
export type Calculation = z.infer<typeof CalculationInput>;
export interface CalculationResult {
  kind: Calculation["kind"];
  values: Record<string, number | null>;
  units: Record<string, string>;
  formula: string;
  assumptions: string[];
  estimated: boolean;
  reference?: string;
}
export const PERFORMANCE_REFERENCE =
  "https://ainfo.cnptia.embrapa.br/digital/bitstream/item/164236/1/Pecuaria-de-leite-no-Brasil.pdf";
export function calculate(raw: unknown): CalculationResult {
  const p = CalculationInput.parse(raw);
  const result: CalculationResult = {
    kind: p.kind,
    values: {},
    units: {},
    formula: "",
    assumptions: [],
    estimated: false,
  };
  switch (p.kind) {
    case "mortality_rate":
    case "birth_rate":
    case "weaning_rate":
    case "pregnancy_rate":
      result.values = { ratePercent: (p.events / p.eligible) * 100 };
      result.units = { ratePercent: "%" };
      result.formula = "taxa = ocorrências registradas / população de referência informada × 100";
      result.assumptions = [
        `Período informado: ${p.start} a ${p.end}. Regra guardian-calculators-v2.`,
        "O usuário deve confirmar a cobertura completa e a mesma população: mortes/animais expostos; nascidos/fêmeas expostas; desmamados/nascidos vivos; prenhezes/fêmeas examinadas. Não usar quantidade de fichas como denominador.",
      ];
      break;
    case "productivity":
      result.values = { kgPerHa: p.producedKg / p.productiveHa };
      result.units = { kgPerHa: "kg/ha no período informado" };
      result.formula =
        "produtividade = produção medida em kg / área produtiva correspondente em hectares";
      result.assumptions = [
        `Período: ${p.start} a ${p.end}. Regra guardian-calculators-v2.`,
        "Produção e área informadas devem corresponder ao mesmo sistema e período. Não anualiza nem converte estoque de animais em produção.",
      ];
      break;
    case "gmd":
      result.values = { gain: p.finalKg - p.initialKg, gmd: (p.finalKg - p.initialKg) / p.days };
      result.units = { gain: "kg de peso vivo", gmd: "kg de peso vivo/cabeça/dia" };
      result.formula = "GMD = (peso final − peso inicial) / dias entre pesagens";
      result.assumptions = [
        "Mesmos animais, balança e condições de pesagem comparáveis; perda de peso é um resultado possível.",
      ];
      result.reference = PERFORMANCE_REFERENCE;
      break;
    case "dry_matter": {
      const dm = (p.liveWeightKg * p.intakePercent) / 100;
      result.values = { dryMatter: dm, asFed: dm / (p.feedDryMatterPercent / 100) };
      result.units = {
        dryMatter: "kg MS/cabeça/dia",
        asFed: "kg de alimento na matéria natural/cabeça/dia",
      };
      result.formula =
        "MS = peso vivo × consumo informado (% PV) / 100; matéria natural = MS / fração de MS do alimento";
      result.assumptions = [
        "Percentual de consumo e teor de MS fornecidos pelo usuário. Não estima exigências, não balanceia dieta e não indica quantidade de um suplemento comercial.",
      ];
      result.estimated = true;
      break;
    }
    case "feeding": {
      const total = p.heads * p.kgPerHeadDay * p.days;
      result.values = {
        totalFeedKg: total,
        totalCost: total * p.pricePerKg,
        costPerHead: (total * p.pricePerKg) / p.heads,
      };
      result.units = {
        totalFeedKg: "kg na base informada",
        totalCost: "R$",
        costPerHead: "R$/cabeça no período",
      };
      result.formula = "alimento = cabeças × kg/cabeça/dia × dias; custo = alimento × R$/kg";
      result.assumptions = [
        "Consumo e preço fornecidos; consumo constante, sem perdas, frete ou outros custos não informados. Não é uma recomendação nutricional.",
      ];
      result.estimated = true;
      break;
    }
    case "conversion":
      result.values = { conversion: p.consumedDryMatterKg / p.gainedLiveKg };
      result.units = { conversion: "kg MS/kg de ganho de peso vivo" };
      result.formula = "conversão alimentar = MS consumida / ganho de peso vivo";
      result.assumptions = [
        "Mesmos animais e período; consumo efetivo na matéria seca, descontadas sobras, e ganho positivo.",
      ];
      result.reference = PERFORMANCE_REFERENCE;
      break;
    case "cost_per_kg":
      result.values = { costPerKg: p.totalCost / p.gainedLiveKg };
      result.units = { costPerKg: "R$/kg de ganho de peso vivo" };
      result.formula = "custo por kg produzido = custos informados / ganho de peso vivo";
      result.assumptions = ["Somente os custos fornecidos, no mesmo período e lote do ganho."];
      break;
    case "cost_per_head":
      result.values = { costPerHead: p.totalCost / p.heads };
      result.units = { costPerHead: "R$/cabeça no período" };
      result.formula = "custo por cabeça = custos informados / número de animais";
      result.assumptions = [
        "Custos e quantidade correspondem ao mesmo lote e período. Não inclui custos ausentes.",
      ];
      break;
    case "margin": {
      const net = p.revenue - p.recordedExpenses;
      result.values = {
        recordedCashResult: net,
        marginPercent: p.revenue > 0 ? (net / p.revenue) * 100 : null,
      };
      result.units = { recordedCashResult: "R$", marginPercent: "% da receita" };
      result.formula = "saldo registrado = receitas − despesas; margem = saldo / receita × 100";
      result.assumptions = [
        p.completeCosts
          ? "O usuário declarou custos completos; o resultado não substitui apuração contábil."
          : "Custos incompletos: saldo dos lançamentos, não lucro líquido da fazenda.",
        "Sem receita, a margem percentual é indefinida.",
      ];
      break;
    }
    case "scenario": {
      const kg = p.heads * p.saleKgPerHead;
      const revenue = kg * p.pricePerKg;
      const scenarioRevenue = revenue * (1 + p.priceChangePercent / 100);
      result.values = {
        baseRevenue: revenue,
        baseResult: revenue - p.totalCost,
        scenarioRevenue,
        scenarioResult: scenarioRevenue - p.totalCost,
        difference: scenarioRevenue - revenue,
        breakEvenPrice: p.totalCost / kg,
      };
      result.units = {
        baseRevenue: "R$",
        baseResult: "R$",
        scenarioRevenue: "R$",
        scenarioResult: "R$",
        difference: "R$",
        breakEvenPrice: "R$/kg na base de venda informada",
      };
      result.formula =
        "receita = cabeças × kg de venda/cabeça × preço/kg; cenário altera somente preço; equilíbrio = custos / kg vendidos";
      result.assumptions = [
        "Mesmo lote, peso e custos. Peso e preço devem usar a mesma base (peso vivo ou carcaça). Não converte arroba nem supõe rendimento. Simulação, sem garantia de preço ou desempenho.",
      ];
      result.estimated = true;
    }
  }
  if (Object.values(result.values).some((v) => v !== null && !Number.isFinite(v)))
    throw new Error("calculation_overflow");
  return result;
}
export function renderCalculation(result: CalculationResult): string {
  return [
    result.estimated ? "Simulação com suas premissas:" : "Cálculo com os dados informados:",
    ...Object.entries(result.values).map(
      ([key, value]) =>
        `${({ ratePercent: "Taxa", kgPerHa: "Produtividade", gain: "Ganho", gmd: "GMD", dryMatter: "Matéria seca", asFed: "Matéria natural", totalFeedKg: "Alimento no período", totalCost: "Custo no período", costPerHead: "Custo por cabeça", conversion: "Conversão alimentar", costPerKg: "Custo por kg", recordedCashResult: "Saldo registrado", marginPercent: "Margem dos lançamentos", baseRevenue: "Receita base", baseResult: "Resultado base", scenarioRevenue: "Receita do cenário", scenarioResult: "Resultado do cenário", difference: "Variação", breakEvenPrice: "Preço de equilíbrio" } as Record<string, string>)[key]}: ${value === null ? "não definida" : value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${result.units[key]}`,
    ),
    result.formula,
    ...result.assumptions,
  ].join("\n");
}
