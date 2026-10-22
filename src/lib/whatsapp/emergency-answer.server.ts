import { askOpenAI, type OpenAIOptions } from "../chat/openai.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import { friendlyWhatsAppError } from "./presence.ts";

export function isLivestockMarketOutlook(text: string): boolean {
  return (
    /\b(boi|gado|bovin|arroba|pecu[aá]ri)/i.test(text) &&
    /mercado|pers?pectiva|perpectiva|cen[aá]rio|tend[eê]ncia|proje[cç][aã]o|20\d{2}/i.test(text)
  );
}

export function emergencyFallback(text: string, error?: unknown): string {
  if (isLivestockMarketOutlook(text)) {
    const year = text.match(/\b20\d{2}\b/)?.[0];
    return `Não consegui confirmar as projeções atualizadas${year ? ` para ${year}` : ""}. Ainda assim, para avaliar o mercado do boi, acompanhe oferta de animais para abate, retenção de matrizes, exportações, consumo interno e custos de reposição e alimentação. Menor oferta com demanda firme pode sustentar preços; maior oferta ou demanda fraca pode pressioná-los. São cenários condicionais, não uma previsão confirmada nem garantia de preço. No planejamento, compare a margem em cenários de alta, estabilidade e queda, sem depender de uma única cotação futura.`;
  }
  return friendlyWhatsAppError(error);
}

/** Última tentativa curta, sem pesquisa; nenhum fato atual ou preço é inventado. */
export async function answerWhatsAppEmergency(
  text: string,
  error?: unknown,
  dependencies: {
    askAI?: (history: ChatMessage[], options: OpenAIOptions) => Promise<string>;
    timeoutMs?: number;
    phone?: string;
    history?: ChatMessage[];
    conversationRecall?: import("../chat/context/types.ts").ConversationRecall;
  } = {},
): Promise<string> {
  // Outer transport/watchdog fallbacks must also retain the verified sender's context.
  if (
    dependencies.phone &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !dependencies.conversationRecall
  ) {
    const [{ recallWhatsAppContext }, { loadWhatsAppConversation }] = await Promise.all([
      import("../chat/context/whatsapp.server.ts"),
      import("./store.server.ts"),
    ]);
    const [archive, snapshot] = await Promise.allSettled([
      recallWhatsAppContext({ phone: dependencies.phone, text }),
      loadWhatsAppConversation(dependencies.phone),
    ]);
    if (archive.status === "fulfilled") dependencies.conversationRecall = archive.value;
    if (!dependencies.history && snapshot.status === "fulfilled")
      dependencies.history = snapshot.value?.history;
  }
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  const deadline = AbortSignal.timeout(timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const task = (dependencies.askAI ?? askOpenAI)(
      [...(dependencies.history ?? []).slice(-20), { role: "user", content: text }],
      {
        context: dependencies.conversationRecall?.context,
        model: "luna",
        channel: "whatsapp",
        timeoutMs,
        fetchImpl: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]),
          }),
        researchDepth: "none",
        maxToolCalls: 0,
        stage: "whatsapp_emergency_response",
        directive:
          "A consulta principal falhou. Responda à parte estável da pergunta em português, de forma curta e útil. Não use pesquisa, não afirme tendência atual, não dê preços, percentuais, previsões confirmadas, produtos ou contatos não verificados. Se depender de dados atuais, diga que não conseguiu confirmá-los e explique critérios ou cenários condicionais. Use o histórico e a memória recuperada para dar continuidade ao assunto. Não peça que o usuário repita a pergunta ou dados já presentes. Não declare que o histórico está ausente se houver evidência recuperada. Não prometa gravação ou anexo sem ferramenta.",
      },
    );
    const reply = await Promise.race([
      task,
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error("emergency_timeout")), timeoutMs);
      }),
    ]);
    if (reply.trim() && !/(?:R\$|US\$)\s*\d/.test(reply)) return reply.trim();
  } catch {
    // Até a indisponibilidade de todos os provedores deve produzir um retorno.
  } finally {
    if (timer) clearTimeout(timer);
  }
  return emergencyFallback(text, error);
}
