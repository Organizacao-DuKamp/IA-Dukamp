import { handleEnhancedWhatsAppWebhookRequest } from "../../src/lib/whatsapp/enhanced-http.server.ts";
import { enforceDurableWhatsAppStateStore } from "../../src/lib/whatsapp/state-store-guard.server.ts";

/**
 * O webhook público apenas enfileira esta função. A Netlify devolve 202 ao
 * invocador imediatamente e mantém o processamento rodando em background,
 * permitindo que GPT-5.6 Sol + Web Search terminem sem prender a requisição da
 * Meta ao limite de uma Function síncrona.
 */
export default async function whatsappProcess(request: Request): Promise<Response> {
  enforceDurableWhatsAppStateStore();
  console.info("[whatsapp-background] processing started");

  const started = Date.now();
  try {
    const response = await handleEnhancedWhatsAppWebhookRequest(request);
    console.info(
      `[whatsapp-background] processing completed status=${response.status} duration_ms=${Date.now() - started}`,
    );
    return response;
  } catch (error) {
    console.error(
      `[whatsapp-background] processing failed duration_ms=${Date.now() - started} ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export const config = {
  background: true,
};
