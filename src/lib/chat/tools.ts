import { z } from "zod";
import type { IntentClassification } from "./intent";
export type ToolName =
  | "search_products"
  | "get_product_details"
  | "search_sellers"
  | "get_store_contact"
  | "search_internal_documents"
  | "search_market_prices"
  | "search_current_information"
  | "get_order_status"
  | "handoff_to_human";
export interface ToolDefinition {
  name: ToolName;
  description: string;
  schema: z.ZodType;
}
const Query = z.object({ query: z.string().trim().min(2).max(200) });
export const toolDefinitions: Record<ToolName, ToolDefinition> = {
  search_products: {
    name: "search_products",
    description: "Busca produtos oficiais por nome ou finalidade.",
    schema: Query,
  },
  get_product_details: {
    name: "get_product_details",
    description: "Obtém a ficha de um produto identificado.",
    schema: z.object({ product_id: z.string().uuid() }),
  },
  search_sellers: {
    name: "search_sellers",
    description: "Busca vendedores ativos, opcionalmente por região.",
    schema: z.object({ region: z.string().max(120).optional() }),
  },
  get_store_contact: {
    name: "get_store_contact",
    description: "Obtém o contato institucional oficial.",
    schema: z.object({ city: z.string().max(120).optional() }),
  },
  search_internal_documents: {
    name: "search_internal_documents",
    description: "Pesquisa trechos técnicos internos relevantes.",
    schema: Query,
  },
  search_market_prices: {
    name: "search_market_prices",
    description: "Pesquisa cotação atual por categoria e região.",
    schema: z.object({ commodity: z.string().min(2).max(80), region: z.string().min(2).max(120) }),
  },
  search_current_information: {
    name: "search_current_information",
    description: "Pesquisa informação externa temporal.",
    schema: Query,
  },
  get_order_status: {
    name: "get_order_status",
    description: "Consulta pedido autorizado do cliente.",
    schema: z.object({ order_id: z.string().min(3).max(80) }),
  },
  handoff_to_human: {
    name: "handoff_to_human",
    description: "Encaminha atendimento mediante consentimento.",
    schema: z.object({ reason: z.string().min(3).max(200), consent: z.literal(true) }),
  },
};
export function toolsForIntent(c: IntentClassification): ToolDefinition[] {
  const map: Partial<Record<IntentClassification["intent"], ToolName[]>> = {
    product: ["search_products", "get_product_details", "search_internal_documents"],
    product_recommendation: ["search_products", "search_internal_documents"],
    seller_contact: ["search_sellers"],
    store: ["get_store_contact"],
    internal_price: ["search_products", "get_product_details"],
    market_quote: ["search_market_prices"],
    current_research: ["search_current_information"],
    order: ["get_order_status", "handoff_to_human"],
    human_support: ["handoff_to_human"],
    nutrition: ["search_internal_documents"],
    management: ["search_internal_documents"],
    animal_health: ["search_internal_documents", "handoff_to_human"],
    weather_forecast: ["search_internal_documents", "search_current_information"],
  };
  return (map[c.intent] ?? []).map((name) => toolDefinitions[name]);
}
export function validateToolArguments(name: ToolName, input: unknown): Record<string, unknown> {
  return toolDefinitions[name].schema.parse(input) as Record<string, unknown>;
}
