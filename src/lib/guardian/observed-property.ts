import { z } from "zod";
import type { ChatMessage } from "../chat/types.ts";
import {
  certainStatement,
  memoryQuestion,
  statementParts,
  userStatement,
} from "../whatsapp/learned-notes.ts";
import { localDay, recallPeriod } from "../chat/context/recall.ts";

export const observedFields = {
  name: { label: "Nome da propriedade", variable: false },
  city: { label: "Município informado", variable: false },
  uf: { label: "UF informada", variable: false },
  areaHa: { label: "Área em hectares", variable: false },
  activity: { label: "Atividade informada", variable: false },
  breed: { label: "Raça informada", variable: false },
  herdTotal: { label: "Bovinos informados", variable: true },
  cows: { label: "Vacas informadas", variable: true },
  oxen: { label: "Bois informados", variable: true },
  calves: { label: "Bezerros informados", variable: true },
  heifers: { label: "Novilhas informadas", variable: true },
  feeding: { label: "Alimentação informada", variable: true },
} as const;
export type ObservedField = keyof typeof observedFields;
export const ObservedFactSchema = z
  .object({
    field: z.enum(Object.keys(observedFields) as [ObservedField, ...ObservedField[]]),
    value: z.union([z.string().trim().min(1).max(500), z.number().finite().min(0).max(1e7)]),
    quote: z.string().min(1).max(1500),
    effectiveDate: z.iso.date(),
    question: z.string().max(300).optional(),
  })
  .strict();
export type ObservedFact = z.infer<typeof ObservedFactSchema>;
export interface PropertyObservation {
  name: string | null;
  another: boolean;
  facts: ObservedFact[];
}
const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const ufPattern =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;
const ownFarm =
  /\b(?:(?:minha|nossa) (?:fazenda|propriedade|chacara|sitio)|(?:eu )?(?:tenho|possuo|temos) (?:uma?|a|o|outra|uma segunda) (?:fazenda|propriedade|chacara|sitio))\b/;
const numeric = "(\\d{1,3}(?:\\.\\d{3})+|\\d{1,7})";
function cattleField(unit: string): ObservedField {
  const u = fold(unit);
  if (/^vaca/.test(u)) return "cows";
  if (/^boi/.test(u)) return "oxen";
  if (/^bezerr/.test(u)) return "calves";
  if (/^novilha/.test(u)) return "heifers";
  return "herdTotal";
}
function factDay(quote: string, at: Date): string | null {
  const p = recallPeriod(quote, at);
  if (p) return Date.parse(p.endDay) - Date.parse(p.startDay) === 86400000 ? p.startDay : null;
  if (
    /\b(tinha|tinhamos|antes|ano passado|mes passado|semana passada|em 20\d\d)\b/.test(fold(quote))
  )
    return null;
  return localDay(at);
}
export function extractPropertyObservation(input: {
  text: string;
  mediaType?: string;
  history?: ChatMessage[];
  at: Date;
}): PropertyObservation {
  const text = userStatement(input.text, input.mediaType);
  const facts: ObservedFact[] = [];
  const names = new Set<string>();
  let name: string | null = null,
    another = false;
  const add = (
    field: ObservedField,
    value: string | number,
    quote: string,
    date: string,
    question?: string,
  ) => {
    const parsed = ObservedFactSchema.safeParse({
      field,
      value,
      quote,
      effectiveDate: date,
      ...(question ? { question } : {}),
    });
    if (parsed.success) facts.push(parsed.data);
  };
  for (const quote of statementParts(text)) {
    if (!certainStatement(quote) || quote.length > 1500) continue;
    const t = fold(quote.replace(/^\s*tpec[ -]?ia[,!: ]*/i, ""));
    const day = factDay(quote, input.at);
    if (!day) continue;
    if (/\bnao\s+(?:tenho|possuo|temos|estou|fica|tem|possui|se chama|e)\b/.test(t)) continue;
    const owned = ownFarm.test(t);
    if (
      /(?:\btenho|\bpossuo|\bminha|\bnossa).{0,20}\b(outra|segunda|terceira) (?:fazenda|propriedade|chacara|sitio)\b/.test(
        t,
      )
    )
      another = true;
    const namingCandidate =
      quote.match(
        /\b(?:minha|nossa)\s+(?:(?:outra|segunda|terceira)\s+)?(?:fazenda|propriedade|chácara|chacara|sítio|sitio)\s+(?:(?:se chama|chama-se|tem o nome de|é a|é o|e a|e o)\s+)([\p{L}\d][\p{L}\d '-]{1,100}?)(?=\s+(?:fica|está|esta|em|com|tem)\b|[.,;?!]|$)/iu,
      ) ??
      quote.match(
        /\b(?:minha|nossa)\s+(?:(?:outra|segunda|terceira)\s+)?(?:fazenda|propriedade|chácara|chacara|sítio|sitio)\s+([\p{L}][\p{L}\d '-]{1,100}?)\s+(?:fica|está localizada|esta localizada)\b/iu,
      ) ??
      quote.match(
        /\b(?:tenho|possuo)\s+(?:outra|uma segunda)\s+fazenda\s+(?:chamada\s+)([\p{L}\d][\p{L}\d '-]{1,100}?)(?=\s+(?:em|com|que|fica)\b|[.,;?!]|$)/iu,
      );
    const naming =
      namingCandidate &&
      !/^(?:agora|hoje|atualmente|antes|ainda|tambem|ja|em|na|no|com|aqui|ali)\b/.test(
        fold(namingCandidate[1]),
      )
        ? namingCandidate
        : null;
    if (naming) {
      name = naming[1].trim();
      names.add(fold(name));
      add("name", name, quote, day);
    }
    if (owned || naming) {
      const location = quote.match(
        /\b(?:fica(?: localizada)?|está localizada|esta localizada|está situada|esta situada|localizada|situada|aqui|chamada\s+[^,.;]+?)\s+em\s+([\p{L}][\p{L} '-]{1,100}?)(?=\s*(?:[/,.;?!]|$)|\s+(?:e|eu|com|onde|tenho|mas|porque)\b)/iu,
      );
      if (location) {
        let city = location[1].trim();
        let uf: string | undefined;
        const suffix = city.match(/\s+([A-Z]{2})$/);
        if (suffix && ufPattern.test(suffix[1])) {
          uf = suffix[1];
          city = city.slice(0, -3).trim();
        }
        const after = quote
          .slice((location.index ?? 0) + location[0].length)
          .match(/^\s*[/,-]\s*([A-Za-z]{2})\b/);
        if (after && ufPattern.test(after[1].toUpperCase())) uf = after[1].toUpperCase();
        if (
          city.length >= 2 &&
          !/^(?:uma?|minha|outra|regiao|interior|bairro|zona|brasil|qualquer)\b/.test(fold(city))
        ) {
          add("city", city, quote, day);
          if (uf) add("uf", uf, quote, day);
        }
      }
      const area = quote.match(/\b(?:tem|possui|com|de)\s+(\d+(?:[.,]\d+)?)\s*(?:hectares?|ha)\b/i);
      if (area) add("areaHa", Number(area[1].replace(",", ".")), quote, day);
      const activity = quote.match(
        /\b(?:trabalho|trabalhamos|atuo|atuamos|atividade é|atividade e)\s+(?:com|na|em)?\s*(cria|recria|engorda|pecuária leiteira|pecuaria leiteira|produção de leite|producao de leite)\b/i,
      );
      if (activity) add("activity", activity[1], quote, day);
    }
    const units =
      "(cabeças(?: de gado)?|cabecas(?: de gado)?|gados?|bovinos?|vacas?|bois?|bezerros?|bezerras?|novilhas?)";
    const quantity =
      quote.match(
        new RegExp(
          "\\b(?:eu\\s+)?(?:tenho|possuo|temos|tinha|tinhamos|estou com|estamos com|tô com|to com)\\s+(?:(?:hoje|atualmente|agora)\\s+)?" +
            numeric +
            "\\s*" +
            units +
            "\\b",
          "i",
        ),
      ) ??
      (owned
        ? quote.match(
            new RegExp(
              "\\b(?:com|tem|possui|conta com)\\s+" + numeric + "\\s*" + units + "\\b",
              "i",
            ),
          )
        : null) ??
      quote.match(
        new RegExp(
          "\\b(?:meu|nosso) rebanho (?:é|e|tem|está com|esta com)\\s*(?:de\\s+)?" +
            numeric +
            "\\s*" +
            units +
            "\\b",
          "i",
        ),
      );
    if (quantity && !/\b(?:nao|não)\s+(?:tenho|possuo|temos|estou|estamos)\b/i.test(quote))
      add(cattleField(quantity[2]), Number(quantity[1].replace(/\./g, "")), quote, day);
    const breed = quote.match(
      /\b(?:meu|nosso)\s+(?:gado|rebanho)\s+(?:é|e|da raça|da raca)\s+([\p{L}][\p{L} '-]{1,50}?)(?=[.,;?!]|$)/iu,
    );
    if (breed) add("breed", breed[1].trim(), quote, day);
    if (
      /^(?:eu\s+)?(?:dou|forneço|forneco|fornecemos|alimento|alimentamos)\b/i.test(quote) &&
      /\b(?:ração|racao|silagem|pasto|capim|suplemento|mineral)\b/i.test(quote)
    )
      add("feeding", quote.slice(0, 500), quote, day);
  }
  // A numeric answer can confirm a count, but the assistant's own suggestion cannot.
  const question = memoryQuestion(input.history);
  if (question && certainStatement(text) && text.length <= 160) {
    const q = fold(question);
    const day = localDay(input.at);
    if (
      /\bquant[oa]s?\b/.test(q) &&
      /\b(?:tem|possui|seu rebanho)\b/.test(q) &&
      !/\b(?:quer|pretende|comprar|vender|vai|teria)\b/.test(q)
    ) {
      const answer = text.trim().match(/^(\d{1,3}(?:\.\d{3})+|\d{1,7})[.! ]*$/);
      const unit = question.match(
        /\b(cabeças|cabecas|gados?|bovinos?|vacas?|bois?|bezerros?|bezerras?|novilhas?)\b/i,
      );
      if (answer && unit)
        add(cattleField(unit[1]), Number(answer[1].replace(/\./g, "")), text.trim(), day, question);
    }
    if (
      /\b(?:nome|chama)\b/.test(q) &&
      /\b(?:sua|sua) (?:fazenda|propriedade|chacara|sitio)\b/.test(q) &&
      /^[\p{L}\d][\p{L}\d '-]{1,100}$/u.test(text.trim())
    ) {
      name = text.trim();
      add("name", name, text.trim(), day, question);
    }
    if (
      /\b(?:municipio|cidade)\b/.test(q) &&
      /\b(?:sua|sua) (?:fazenda|propriedade|chacara|sitio)\b/.test(q) &&
      /^[\p{L}][\p{L} '-]{1,100}$/u.test(text.trim())
    )
      add("city", text.trim(), text.trim(), day, question);
  }
  const unique = Object.keys(observedFields).flatMap((field) => {
    const matches = facts.filter((f) => f.field === field);
    // Several conflicting values in one turn require clarification, not an arbitrary choice.
    return new Set(matches.map((f) => JSON.stringify(f.value))).size === 1
      ? matches.slice(0, 1)
      : [];
  });
  if (names.size > 1) return { name: null, another: true, facts: [] };
  return { name: unique.some((f) => f.field === "name") ? name : null, another, facts: unique };
}
