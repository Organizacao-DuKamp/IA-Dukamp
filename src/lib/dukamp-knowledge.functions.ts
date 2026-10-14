import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ImportDocument } from "./rag/dukamp-package.ts";

async function admin(context: {
  supabase: { rpc: (name: never, params: never) => PromiseLike<{ data: unknown; error: unknown }> };
  userId: string;
}) {
  const result = await context.supabase.rpc(
    "has_role" as never,
    { _user_id: context.userId, _role: "admin" } as never,
  );
  if (result.error)
    throw new Error("Não foi possível verificar a permissão administrativa. Tente novamente.");
  if (result.data !== true) throw new Error("Acesso restrito a administradores autenticados.");
}
const ImportBatch = z.object({
  documents: z
    .array(z.object({ content: z.string().max(500_000) }))
    .min(1)
    .max(15),
});
export const importDuKampBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ImportBatch.parse(value))
  .handler(async ({ context, data }) => {
    await admin(context);
    const { duKampIngestionClient } = await import("./rag/dukamp-ingestion-client.server.ts");
    const { importControlledDocuments } = await import("./rag/dukamp-import.server.ts");
    return importControlledDocuments(await duKampIngestionClient(context.supabase), data.documents);
  });

const OriginalInput = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  storage_path: z.string().max(150),
  bytes: z.number().int().positive().max(5_000_000),
  base64: z.string().max(7_000_000),
});
export const uploadDuKampOriginal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => OriginalInput.parse(value))
  .handler(async ({ context, data }) => {
    await admin(context);
    const { duKampIngestionClient } = await import("./rag/dukamp-ingestion-client.server.ts");
    const { uploadControlledOriginal } = await import("./rag/dukamp-import.server.ts");
    const decoded = atob(data.base64);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    return uploadControlledOriginal(await duKampIngestionClient(context.supabase), data, bytes);
  });

export const listDuKampReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { getPrivilegedClient } = await import("./privileged.server");
    const { listControlledCatalog } = await import("./rag/dukamp-import.server.ts");
    return JSON.stringify(await listControlledCatalog(await getPrivilegedClient(context.supabase)));
  });
const ReviewInput = z.object({
  produto_id: z.string().regex(/^P\d{3}$/),
  product_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  source_id_aprovado: z.string().regex(/^D\d{3}$/),
  evidencia_rotulo_atual: z.string().trim().min(10).max(2000),
  revisor_responsavel: z.string().trim().min(3).max(200),
  campos_validados: z.record(z.string(), z.string().max(24_000)),
  resolucoes: z.record(z.string(), z.string().max(8000)),
  especies_autorizadas: z.array(z.enum(["bovinos", "equinos", "ovinos", "caprinos"])).min(1),
  disponibilidade_confirmada: z.boolean(),
  confirmar_responsabilidade_tecnica: z.literal(true),
  liberar: z.boolean(),
  observacoes: z.string().max(8000).nullable().optional(),
});
export const reviewDuKampProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ReviewInput.parse(value))
  .handler(async ({ context, data }) => {
    await admin(context);
    const { getPrivilegedClient } = await import("./privileged.server");
    const { saveTechnicalReview } = await import("./rag/dukamp-import.server.ts");
    return saveTechnicalReview(await getPrivilegedClient(context.supabase), data, {
      userId: context.userId,
      isAdmin: true,
    });
  });

export const auditDuKampKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    const { duKampIngestionClient } = await import("./rag/dukamp-ingestion-client.server.ts");
    const { auditDuKampImport } = await import("./rag/dukamp-audit.server.ts");
    return JSON.stringify(await auditDuKampImport(await duKampIngestionClient(context.supabase)));
  });
export const testDuKampQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ question: z.string().min(3).max(2000) }).parse(value))
  .handler(async ({ context, data }) => {
    await admin(context);
    const { handleIncoming } = await import("./chat/core.server.ts");
    const result = await handleIncoming({
      sessionId: `dukamp-qa:${context.userId}`,
      conversationId: `dukamp-qa:${context.userId}:${Date.now()}`,
      text: data.question,
      history: [],
      channel: "web",
    });
    const { searchKnowledge } = await import("./rag/search.server.ts");
    let retrieval: unknown;
    try {
      retrieval = (await searchKnowledge(data.question, 5)).map((m) => ({
        filename: m.filename,
        title: m.title,
        metadata: m.metadata,
        retrieval: m.retrieval,
      }));
    } catch (error) {
      retrieval = { error: error instanceof Error ? error.message : "Busca indisponível" };
    }
    return JSON.stringify({
      question: data.question,
      reply: result.reply,
      retrieval,
      checked_at: new Date().toISOString(),
    });
  });
