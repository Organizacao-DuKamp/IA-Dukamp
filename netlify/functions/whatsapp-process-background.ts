import { handleEnhancedWhatsAppWebhookRequest } from "../../src/lib/whatsapp/enhanced-http.server.ts";
import { enforceDurableWhatsAppStateStore } from "../../src/lib/whatsapp/state-store-guard.server.ts";

/**
 * Processa o webhook do WhatsApp fora da Function síncrona. O sufixo
 * `-background` mantém o modo assíncrono explícito no Netlify, evitando que
 * chamadas de IA mais lentas sejam encerradas pelo limite do handler web.
 */
export default async function whatsappProcessBackground(request: Request): Promise<Response> {
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
