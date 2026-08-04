import { z } from "zod";

export const IntentSchema = z.object({
  intent: z.enum([
    "general_conversation",
    "product",
    "product_recommendation",
    "seller_contact",
    "store",
    "order",
    "internal_price",
    "market_quote",
    "management",
    "nutrition",
    "animal_health",
    "document_or_image",
    "current_research",
    "human_support",
    "out_of_scope",
  ]),
  needs_internal_search: z.boolean(),
  needs_web_search: z.boolean(),
  needs_conversation_context: z.boolean(),
  location: z.string().max(120).nullable(),
  entities: z.array(z.string().max(120)).max(12),
  confidence: z.number().min(0).max(1),
});
export type IntentClassification = z.infer<typeof IntentSchema>;

const rules: Array<[IntentClassification["intent"], RegExp, boolean, boolean]> = [
  [
    "animal_health",
    /\b(doente|febre|diarreia|timpanismo|convuls|intoxica|veterin|medicamento|dose|dosagem)\b/i,
    true,
    false,
  ],
  [
    "market_quote",
    /\b(boi gordo|arroba|cota[cç][aã]o|mercado|pre[cç]o do leite|soja|milho)\b/i,
    false,
    true,
  ],
  [
    "seller_contact",
    /\b(vendedor(?:es)?|representante|consultor|equipe comercial)\b/i,
    true,
    false,
  ],
  ["order", /\b(pedido|rastre|entrega|nota fiscal)\b/i, true, false],
  ["internal_price", /\b(pre[cç]o|valor|quanto custa|estoque)\b/i, true, false],
  [
    "product_recommendation",
    /\b(recomend\w*|qual produto|qual suplemento|melhor para)\b/i,
    true,
    false,
  ],
  ["nutrition", /\b(nutri\w*|suplement\w*|ra[cç][aã]o|proteinado|mineral|consumo)\b/i, true, false],
  ["management", /\b(manejo|pasto|confinamento|desmama|recria|engorda)\b/i, true, false],
  ["document_or_image", /\b(pdf|documento|arquivo|imagem|foto|anexo|[aá]udio)\b/i, true, false],
  ["store", /\b(loja|unidade|matriz|endere[cç]o|hor[aá]rio)\b/i, true, false],
  ["human_support", /\b(atendente|humano|pessoa|sac|suporte)\b/i, true, false],
  ["current_research", /\b(hoje|agora|atual|not[ií]cia|clima|previs[aã]o)\b/i, false, true],
  ["product", /\b(produto|dukamp|ficha|composi[cç][aã]o|garantia)\b/i, true, false],
];

export function classifyDomainIntent(text: string, hasHistory = false): IntentClassification {
  const normalized = text.trim();
  const hit = rules.find(([, pattern]) => pattern.test(normalized));
  const followUp =
    hasHistory &&
    /^(e\s+)?(qual|quais|quanto|onde|quem|ness[ae]|dele|deles|esse|essa|aquele|aquela)/i.test(
      normalized,
    );
  const [intent, , internal, web] = hit ?? ["general_conversation", /$^/, false, false];
  const location =
    normalized.match(/(?:em|na regi[aã]o de|para)\s+([A-ZÀ-Ú][\p{L}\s.'-]{2,60})/u)?.[1]?.trim() ??
    null;
  return IntentSchema.parse({
    intent,
    needs_internal_search: internal,
    needs_web_search: web,
    needs_conversation_context: followUp,
    location,
    entities: [],
    confidence: hit ? (followUp ? 0.84 : 0.9) : 0.65,
  });
}
