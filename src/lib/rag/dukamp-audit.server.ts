import { DUKAMP_CATEGORY, parseEnvelope, reviewIsOperational } from "./dukamp-package.ts";
import { listControlledCatalog, readKnowledgeDocumentPages } from "./dukamp-import.server.ts";
import type { KnowledgeDatabase } from "./dukamp-import.server.ts";

export async function auditDuKampImport(db: KnowledgeDatabase) {
  const rows = await readKnowledgeDocumentPages<{
    id: string;
    category: string;
    content: string;
    status: string;
  }>(db, "id,category,content,status");
  const controlled = rows.filter((row) => row.category === DUKAMP_CATEGORY);
  const entries = controlled.map((row) => ({ row, body: parseEnvelope(row.content) }));
  const catalogs = await listControlledCatalog(db);
  const sections = entries.filter((e) => e.body?.kind === "section");
  const questions = entries.flatMap((e) => (e.body?.kind === "questions" ? e.body.questions : []));
  const manifest = entries.find((e) => e.body?.kind === "manifest")?.body;
  const expected = new Map<string, number>();
  if (manifest?.kind === "manifest")
    for (const item of manifest.sources) {
      const source = item as { sha256?: string; bytes?: number };
      if (source.sha256 && typeof source.bytes === "number")
        expected.set(source.sha256, source.bytes);
    }
  const [chunks, vectors, originals] = await Promise.all([
    db
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("category", DUKAMP_CATEGORY),
    db
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("category", DUKAMP_CATEGORY)
      .not("embedding", "is", null),
    db.storage.from("knowledge-base").list("dukamp/originals", { limit: 1000 }),
  ]);
  for (const result of [chunks, vectors, originals])
    if (result.error) throw new Error(result.error.message);
  const saved = (originals.data ?? []) as Array<{ name: string; metadata?: { size?: number } }>;
  const preserved = [...expected].filter(([hash, size]) =>
    saved.some((f) => f.name.startsWith(hash + ".") && f.metadata?.size === size),
  );
  return {
    checked_at: new Date().toISOString(),
    products: catalogs.length,
    source_versions: new Set(catalogs.flatMap((e) => e.product.fontes.map((s) => s.source_id)))
      .size,
    questions: questions.length,
    sections: sections.length,
    documents: controlled.length,
    lexical_chunks: chunks.count ?? 0,
    embeddings_completed: vectors.count ?? 0,
    embeddings_pending: sections.length - (vectors.count ?? 0),
    section_documents_completed: sections.filter((e) => e.row.status === "concluido").length,
    originals_registered: expected.size,
    originals_preserved: preserved.length,
    originals_in_storage: saved.length,
    missing_original_hashes: [...expected.keys()].filter(
      (hash) => !preserved.some(([h]) => h === hash),
    ),
    operational_reviews: catalogs.filter(reviewIsOperational).length,
    pending_issues: catalogs.reduce((sum, e) => sum + e.product.bloqueios.length, 0),
  };
}
