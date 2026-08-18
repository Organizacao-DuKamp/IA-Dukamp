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
    "current_research",
    /\b(ainda|atual(?:mente)?|hoje|vigente|obrigat[oó]ri[oa]|permitid[oa]|proibid[oa]|status)\b.{0,120}\b(brucelose|tuberculose|febre\s+aftosa|vacina[cç][aã]o|aditivo|monensina|mapa|pncebt|pnefa)\b|\b(brucelose|tuberculose|febre\s+aftosa|vacina[cç][aã]o|aditivo|monensina|mapa|pncebt|pnefa)\b.{0,120}\b(ainda|atual(?:mente)?|hoje|vigente|obrigat[oó]ri[oa]|permitid[oa]|proibid[oa]|status)\b/i,
    true,
    true,
  ],
  [
    "animal_health",
    /\b(doente|febre|diarreia|timpanismo|convuls|intoxica|veterin|medicamento|dose|dosagem|antibi[oó]tico|verm[ií]fugo|anemi|aborto|abortaram|c[oó]lica|mastite|pneumonia|ca[ií]do|n[aã]o\s+levanta|dificuldade\s+para\s+respirar|ferida\w*\s+na\s+boca)\b/i,
    true,
    false,
  ],
  [
    "market_quote",
    /\b(boi gordo|arroba|cota[cç][aã]o|pre[cç]o do leite|pre[cç]o da arroba|soja|milho)\b|\b(pre[cç]o|valor|cota[cç][aã]o)\b.{0,100}\b(carnes?|carne bovina|bovinos?|su[ií]nos?|frango|aves?|leite|boi|novilha|vaca|soja|milho)\b|\b(carnes?|carne bovina|bovinos?|su[ií]nos?|frango|aves?|leite|boi|novilha|vaca|soja|milho)\b.{0,100}\b(pre[cç]o|valor|cota[cç][aã]o)\b/i,
    false,
    true,
  ],
  [
    "current_research",
    /\b(mercado|cen[aá]rio|setor|panorama)\b.{0,100}\b(carnes?|carne bovina|prote[ií]na animal|pecu[aá]ria|bovinos?|su[ií]nos?|frango|aves?|leite)\b|\b(carnes?|carne bovina|prote[ií]na animal|pecu[aá]ria|bovinos?|su[ií]nos?|frango|aves?|leite)\b.{0,100}\b(mercado|cen[aá]rio|setor|panorama)\b/i,
    false,
    true,
  ],
  [
    "seller_contact",
    /\b(vendedor(?:es)?|representante(?:s)?|consultor(?:es)?|equipe comercial|contatos? comerciais?)\b/i,
    true,
    false,
  ],
  ["order", /\b(pedido|rastre|entrega|nota fiscal)\b/i, true, false],
  ["internal_price", /\b(pre[cç]o|valor|quanto custa|estoque)\b/i, true, false],
  [
    "out_of_scope",
    /\b(crie|monte|fa[cç]a)\b.{0,80}\b(ficha|produto)\b.{0,80}\b(inventad[oa]|fict[ií]ci[oa]|simulad[oa])\b|\b(inventad[oa]|fict[ií]ci[oa]|simulad[oa])\b.{0,80}\bdukamp\b/i,
    false,
    false,
  ],
  [
    "product_recommendation",
    /\b(recomend\w*|qual produto|qual suplemento|melhor para|indiqu\w*|produto para)\b/i,
    true,
    false,
  ],
  // Perguntas de compatibilidade entre espécies são dúvidas técnicas de
  // segurança, não pedidos para despejar o catálogo comercial. Um produto
  // nomeado ainda pode ser localizado pelo roteador de aliases e entrar como
  // evidência oficial, mas termos genéricos como "mineral" não devem retornar
  // itens irrelevantes do site (ex.: óleo mineral agrícola para uma ovelha).
  [
    "nutrition",
    /\b(posso|pode|podem|serve|servem|usar|fornecer|dar)\b.{0,100}\b(suplemento|mineral|ra[cç][aã]o|produto|ureia)\b.{0,100}\b(ovino|ovinos|ovelha|ovelhas|caprino|caprinos|cabra|cabras|equino|equinos|cavalo|cavalos)\b|\b(ovino|ovinos|ovelha|ovelhas|caprino|caprinos|cabra|cabras|equino|equinos|cavalo|cavalos)\b.{0,100}\b(posso|pode|podem|serve|servem|usar|fornecer|dar)\b.{0,100}\b(suplemento|mineral|ra[cç][aã]o|produto|ureia)\b/i,
    true,
    false,
  ],
  // Perguntas de catálogo precisam vir antes de "nutrition"; caso contrário
  // frases como "quais suplementos vocês têm?" viram dúvida técnica e não
  // executam a consulta comercial no Supabase da DuKamp.
  [
    "product",
    /\b(produtos?|cat[aá]logo|dukamp|ficha(?:\s+t[eé]cnica)?|composi[cç][aã]o|garantia)\b|\b(?:quais|liste|lista|mostre|voc[eê]s\s+t[eê]m|vendem?)\b.{0,50}\b(suplementos?|ra[cç][oõ]es?|minerais?|proteinados?)\b/i,
    true,
    false,
  ],
  ["nutrition", /\b(nutri\w*|suplement\w*|ra[cç][aã]o|proteinado|mineral|consumo)\b/i, true, false],
  ["management", /\b(manejo|pasto|confinamento|desmama|recria|engorda)\b/i, true, false],
  ["document_or_image", /\b(pdf|documento|arquivo|imagem|foto|anexo|[aá]udio)\b/i, true, false],
  ["store", /\b(loja|unidade|matriz|endere[cç]o|hor[aá]rio)\b/i, true, false],
  ["human_support", /\b(atendente|humano|pessoa|sac|suporte)\b/i, true, false],
  ["current_research", /\b(hoje|agora|atual|not[ií]cia|clima|previs[aã]o|mercado)\b/i, false, true],
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
