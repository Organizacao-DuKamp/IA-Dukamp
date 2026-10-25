import { z } from "zod";
import type { ChatMessage } from "../chat/types.ts";

export const NoteCategory = z.enum([
  "property",
  "herd",
  "animal",
  "nutrition",
  "health",
  "management",
  "sale",
  "purchase",
  "finance",
  "goal",
  "infrastructure",
  "preference",
]);
export const NoteKind = z.enum([
  "reported",
  "plan",
  "estimate",
  "correction",
  "third_party",
  "answer",
]);
export interface LearnedNote {
  category: z.infer<typeof NoteCategory>;
  kind: z.infer<typeof NoteKind>;
  quote: string;
  question?: string;
}
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const rural =
  /\b(fazenda|sitio|chacara|propriedade|rebanho|gado|bovinos?|bois?|vacas?|bezerros?|bezerras?|novilhas?|touros?|animais|animal|lote|brinco|racao|silagem|pasto|capim|arroba|leite|ordenha|curral|cocho|hectares?|piquetes?|suplemento|vermifug|vacin)/;
const sensitive =
  /\b(senha|password|token|api[_ -]?key|chave (?:pix|de acesso)|cpf|cnpj|cartao|conta bancaria|agencia bancaria|codigo de verificacao)\b|sk-[a-z0-9]{12}|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/i;
const hypothetical =
  /\b(se (?:eu |a gente |nos |meu |minha |o |a )?(?:vender|comprar|tiver|nascer|fosse|tivesse|vendesse|comprasse)|suponh\w*|imagin\w*|hipotetic\w*|por exemplo|exemplo ficticio|faca de conta|simul\w*)\b/;
const questionStart =
  /^(?:e )?(?:qual|quais|quanto|quantos|quantas|como|onde|quando|por que|porque|sera que|voce|voces|pode me|me (?:diga|fale|explique))\b/;

/** Only explicit control requests enter the shared, confirmed farm book. */
export function explicitNotebookRequest(text: string): boolean {
  const t = fold(text.trim());
  return (
    /^(?:(?:eu )?quero |pode |por favor[, ]+)?(?:anot[ae]r?|registr[ae]r?|cadastr[ae]r?|cadastre|cri[ae]r?|corrij[ae]|corrigir|exclu[ai]r?|apag[ae]r?|convid[ae]r?|revog[au]r?|usar|selecionar|aceitar|vincular|exportar|concluir|cancelar|reagendar|agendar|agende|me lembr[ae]|ativar|ative|reativar|retomar|parar|pausar|desativar)\b/.test(
      t,
    ) ||
    /^(?:despesa|receita|peso d[oa] animal|pesagem d[oa] animal|horario dos avisos|temas dos avisos|\d+ avisos por dia|relatorio (?:diario|semanal|mensal)|parar relatorios|usar anotacoes anteriores)\b/.test(
      t,
    )
  );
}

export function userStatement(text: string, mediaType?: string): string {
  if (mediaType && mediaType !== "audio") return "";
  return text
    .replace(
      /^\[Mensagem recebida por áudio[^\]]*\]\s*Pedido do usuário:[\s\S]*?Transcrição do áudio:\s*/i,
      "",
    )
    .trim()
    .slice(0, 16000);
}

function safeStatement(text: string): boolean {
  const t = fold(text.trim());
  return (
    text.length >= 1 &&
    !sensitive.test(text) &&
    !hypothetical.test(t) &&
    !questionStart.test(t) &&
    !/^(?:venda|vendam|compre|comprem|aplique|trate|alimente|considere|suponha)\b/.test(t) &&
    !text.includes("?") &&
    !explicitNotebookRequest(text) &&
    !/\b(ignore (?:as |todas |instrucoes)|system prompt|instrucoes de sistema|finja|retorne json)\b/.test(
      t,
    )
  );
}

function categoryFor(text: string): LearnedNote["category"] | null {
  const t = fold(text);
  if (/\b(vendi|vendemos|venda|vendeu|vendido|vender|recebi.{0,50}(?:boi|gado|venda))\b/.test(t))
    return "sale";
  if (/\b(comprei|compramos|compra|comprou|comprado|comprar)\b/.test(t)) return "purchase";
  if (/\b(gastei|pagamos|paguei|recebi|despesa|receita|custo|r\$|reais)\b/.test(t))
    return "finance";
  if (
    /\b(febre|doente|diarreia|mancando|sem comer|nao come|melhorou|piorou|tratamento|vacin\w*|vermifug\w*|sintoma|sanidade)\b/.test(
      t,
    )
  )
    return "health";
  if (/\b(racao|silagem|capim|alimentacao|suplemento|mineral|sal|dieta|kg por cabeca)\b/.test(t))
    return "nutrition";
  if (/\b(nasceram|nasceu|parto|transferi|transferimos|pesamos|pesei|manejo|ordenha)\b/.test(t))
    return "management";
  if (/\b(brinco|animal|vaca|bezerro|bezerra|novilha|touro|boi)\s+[a-z0-9_-]+\b/.test(t))
    return "animal";
  if (/\b(rebanho|cabecas|vacas|bezerros|novilhas|bois|animais|gado|lote)\b/.test(t)) return "herd";
  if (/\b(meta|objetivo|pretendo|quero (?:aumentar|melhorar|reduzir)|engordar)\b/.test(t))
    return "goal";
  if (/\b(curral|cocho|bebedouro|cerca|galpao|piquete|hectares)\b/.test(t)) return "infrastructure";
  if (/\b(fazenda|sitio|chacara|propriedade|moro|municipio|sou de|estou em)\b/.test(t))
    return "property";
  if (/\b(prefiro|pode me chamar|meu nome|me chamo)\b/.test(t)) return "preference";
  return null;
}

function kindFor(text: string): LearnedNote["kind"] {
  const t = fold(text);
  if (
    /\b(vizinh[oa]|amig[oa]|meu pai|minha mae|fazenda dele|fazenda dela|segundo|me disseram)\b/.test(
      t,
    )
  )
    return "third_party";
  if (
    /\b(na verdade|corrigindo|me enganei|nao (?:vendi|comprei|tenho|foi|era)|nao eram|errei|o certo)\b/.test(
      t,
    )
  )
    return "correction";
  if (/\b(acho|aproximad\w*|cerca de|mais ou menos|estimo|estimad\w*|talvez)\b/.test(t))
    return "estimate";
  if (
    /\b(vou|vamos|pretendo|planejo|quero|pensando em|vender|comprar|amanha|semana que vem|mes que vem)\b/.test(
      t,
    )
  )
    return "plan";
  return "reported";
}

export function memoryQuestion(history: ChatMessage[] = []): string | undefined {
  const last = history.at(-1);
  if (last?.role !== "assistant" || !last.content.trim().endsWith("?")) return;
  const question = last.content
    .trim()
    .split(/(?<=[.!?])\s+|\n+/u)
    .at(-1)!;
  if (question.length > 300 || sensitive.test(question)) return;
  return rural.test(fold(question)) ||
    /\b(seu nome|sua cidade|municipio|seu objetivo)\b/.test(fold(question))
    ? question
    : undefined;
}

/** Keep the user's exact words. No inferred totals, dates, payment, diagnoses or ownership. */
export function collectLearnedNotes(text: string, history: ChatMessage[] = []): LearnedNote[] {
  const notes: LearnedNote[] = [];
  const recent = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .some((m) => rural.test(fold(m.content)));
  for (const part of text.split(/(?<=[.!?;])\s+|\n+/u)) {
    // Do not split decimal numbers; retain the whole clause as evidence, within a bounded note.
    const quote = part.trim();
    if (quote.length > 1500 || !safeStatement(quote)) continue;
    const category = categoryFor(quote);
    if (
      !category ||
      (!rural.test(fold(quote)) &&
        !recent &&
        category !== "preference" &&
        !(category === "property" && /\b(moro|sou de|estou em)\b/.test(fold(quote))))
    )
      continue;
    notes.push({ category, kind: kindFor(quote), quote });
    if (notes.length === 24) break;
  }
  const question = memoryQuestion(history);
  if (
    !notes.length &&
    question &&
    text.length <= 160 &&
    safeStatement(text) &&
    !/^(sim|nao|ok|pode|pode ser|o primeiro|o segundo|tanto faz)[.! ]*$/.test(fold(text))
  ) {
    notes.push({
      category: categoryFor(question) ?? "property",
      kind: "answer",
      quote: text.trim(),
      question,
    });
  }
  return notes;
}

/** AI may select more exact excerpts, but cannot fabricate a summary or mutate another fact. */
export function validateExtractedNotes(value: unknown, text: string): LearnedNote[] {
  const parsed = z
    .object({
      notes: z
        .array(z.object({ category: NoteCategory, quote: z.string().min(3).max(1500) }).strict())
        .max(24),
    })
    .safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.notes.flatMap((n) => {
    // Selected substrings cannot drop a negation, plan, condition or the subject's owner.
    const clause = text
      .split(/(?<=[.!?;])\s+|\n+/u)
      .find((c) => c.includes(n.quote))
      ?.trim();
    if (!clause || clause.length > 1500 || !safeStatement(clause)) return [];
    return [{ ...n, quote: clause, kind: kindFor(clause) }];
  });
}
export function mergeLearnedNotes(...groups: LearnedNote[][]): LearnedNote[] {
  return [...new Map(groups.flat().map((n) => [n.quote, n])).values()].slice(0, 24);
}

export function naturalNotebookTurn(text: string, history: ChatMessage[] = []): boolean {
  return !explicitNotebookRequest(text) && collectLearnedNotes(text, history).length > 0;
}

export function shouldExtractNotes(text: string, history: ChatMessage[] = []): boolean {
  const ruralContext = history.some((m) => m.role === "user" && rural.test(fold(m.content)));
  return (
    collectLearnedNotes(text, history).length > 0 ||
    text
      .split(/(?<=[.!?;])\s+|\n+/u)
      .some((part) => safeStatement(part.trim()) && (rural.test(fold(part)) || ruralContext))
  );
}

const INBOX_ENVELOPE = "[conversation-notes-v1]\n";
export function encodeNoteInbox(text: string, history: ChatMessage[], at: string): string {
  return INBOX_ENVELOPE + JSON.stringify({ text, question: memoryQuestion(history), at });
}
export function decodeNoteInbox(value: string): {
  text: string;
  history: ChatMessage[];
  at?: string;
} {
  if (!value.startsWith(INBOX_ENVELOPE)) return { text: value, history: [] };
  const parsed = z
    .object({
      text: z.string().max(16000),
      question: z.string().max(300).optional(),
      at: z.iso.datetime(),
    })
    .safeParse(JSON.parse(value.slice(INBOX_ENVELOPE.length)));
  if (!parsed.success) throw new Error("invalid_note_inbox");
  return {
    text: parsed.data.text,
    at: parsed.data.at,
    history: parsed.data.question ? [{ role: "assistant", content: parsed.data.question }] : [],
  };
}
