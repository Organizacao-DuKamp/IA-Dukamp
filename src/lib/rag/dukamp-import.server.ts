import {
  DUKAMP_CATEGORY,
  DUKAMP_SCHEMA,
  checkedProduct,
  documentId,
  makeDocument,
  parseEnvelope,
  sha256,
  stableJson,
  reviewIsOperational,
  REVIEW_FIELDS,
  issueKey,
} from "./dukamp-package.ts";
import type {
  CatalogEnvelope,
  ControlledSection,
  ImportDocument,
  TechnicalReview,
} from "./dukamp-package.ts";

/** Existing knowledge tables, existing private storage bucket, existing embedding provider.
 * This module has no authority to approve an imported document.
 */
export interface KnowledgeDatabase {
  // The Supabase generated client and deterministic test doubles both implement this surface.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- existing SDK/test adapter
  from(table: string): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- private Storage SDK adapter
  storage: any;
}
const checkError = (result: { error?: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
};

export async function readKnowledgeDocumentPages<T>(
  db: KnowledgeDatabase,
  columns: string,
  orders: string[] = ["id"],
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = db.from("knowledge_documents").select(columns);
    for (const order of orders) query = query.order(order, { ascending: true });
    const page = await query.range(offset, offset + 499);
    checkError(page);
    rows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 500) return rows;
  }
}

export function controlledChunk(section: ControlledSection, fingerprint: string, title: string) {
  const related = section.perguntas_relacionadas.join("\n").slice(0, 2600);
  return {
    content:
      `${title}\nFonte: ${section.source_id}. Versão: ${section.versao_papel}.\n\n${section.texto}` +
      (related ? `\n\nPerguntas relacionadas (vocabulário de busca):\n${related}` : ""),
    metadata: {
      dukamp: {
        schema: DUKAMP_SCHEMA,
        produto_id: section.produto_id,
        source_id: section.source_id,
        source_sha256: section.sha256_fonte,
        fingerprint,
        versao_papel: section.versao_papel,
        status_vigencia: section.status_vigencia,
        referencias: section.referencias,
        restricoes: section.restricoes_da_versao,
        recomendacao_operacional_liberada: false,
      },
    },
  };
}

async function sanitizeDocument(
  db: KnowledgeDatabase,
  incoming: Pick<ImportDocument, "content">,
): Promise<ImportDocument> {
  const envelope = parseEnvelope(incoming.content);
  if (!envelope) throw new Error("Documento estruturado inválido.");
  if (envelope.kind === "catalog") {
    const product = checkedProduct(envelope.product);
    const fingerprint = await sha256(stableJson(product));
    return makeDocument(
      {
        schema: DUKAMP_SCHEMA,
        kind: "catalog",
        fingerprint,
        product,
        review: null,
        review_history: [],
      },
      `catalog/${product.produto_id}`,
      product.nome_comercial_documental,
    );
  }
  if (envelope.kind === "section") {
    const s = envelope.section;
    if (
      !s ||
      !/^P\d{3}-D\d{3}-S\d{2}$/.test(s.chunk_id) ||
      !s.chunk_id.startsWith(`${s.produto_id}-${s.source_id}-`) ||
      typeof s.texto !== "string" ||
      !s.texto.trim() ||
      s.texto.length > 24_000 ||
      !Array.isArray(s.referencias) ||
      !Array.isArray(s.perguntas_relacionadas)
    ) {
      throw new Error("Seção estruturada inválida.");
    }
    const result = await db
      .from("knowledge_documents")
      .select("content")
      .eq("source_path", `dukamp-controlled/catalog/${s.produto_id}.json`)
      .maybeSingle();
    checkError(result);
    const catalog = parseEnvelope(result.data?.content);
    if (!catalog || catalog.kind !== "catalog")
      throw new Error("Importe o catálogo antes das seções.");
    const source = catalog.product.fontes.find((v) => v.source_id === s.source_id);
    if (
      !source ||
      source.sha256 !== s.sha256_fonte ||
      !s.referencias.length ||
      s.referencias.some(
        (r) =>
          r.source_id !== source.source_id ||
          r.arquivo_original !== source.arquivo_original ||
          !new RegExp(`^${source.source_id}-S\\d{2}$`).test(r.evidence_id),
      )
    ) {
      throw new Error("A seção não corresponde à fonte registrada.");
    }
    const section: ControlledSection = {
      ...s,
      versao_papel: source.versao_papel,
      status_vigencia: catalog.product.status_vigencia,
      recomendacao_operacional_liberada: false,
    };
    return makeDocument(
      {
        schema: DUKAMP_SCHEMA,
        kind: "section",
        section,
        fingerprint: await sha256(stableJson(section)),
      },
      `section/${s.chunk_id}`,
      `${catalog.product.nome_comercial_documental} - ${s.titulo}`,
    );
  }
  if (envelope.kind === "questions") {
    if (
      !/^P\d{3}$/.test(envelope.produto_id) ||
      !Array.isArray(envelope.questions) ||
      envelope.questions.some(
        (q) =>
          q.produto_id !== envelope.produto_id ||
          typeof q.resposta !== "string" ||
          typeof q.pergunta !== "string",
      )
    )
      throw new Error("Perguntas inválidas.");
    return makeDocument(
      envelope,
      `questions/${envelope.produto_id}`,
      `Perguntas - ${envelope.produto_id}`,
    );
  }
  return makeDocument(envelope, "manifest/sources", "Fontes e cobertura da base Dukamp");
}

export async function importControlledDocuments(
  db: KnowledgeDatabase,
  incoming: Array<Pick<ImportDocument, "content">>,
) {
  let inserted = 0,
    changed = 0,
    unchanged = 0;
  for (const item of incoming) {
    const doc = await sanitizeDocument(db, item);
    const previous = await db
      .from("knowledge_documents")
      .select("id, content, content_hash, status, chunk_count, version")
      .eq("source_path", doc.source_path)
      .maybeSingle();
    checkError(previous);
    // Preserve both completed embeddings and signed-in human reviews on identical re-import.
    if (previous.data?.content_hash === doc.content_hash) {
      const parsed = parseEnvelope(doc.content);
      if (parsed?.kind !== "section") {
        unchanged++;
        continue;
      }
      const existingChunk = await db
        .from("knowledge_chunks")
        .select("id,metadata,embedding")
        .eq("document_id", previous.data.id)
        .eq("chunk_index", 0)
        .maybeSingle();
      checkError(existingChunk);
      if (existingChunk.data?.metadata?.dukamp?.fingerprint === parsed.fingerprint) {
        if (previous.data.status === "concluido" && !existingChunk.data.embedding) {
          checkError(
            await db
              .from("knowledge_documents")
              .update({
                status: "aguardando",
                error_message: "Embedding ausente; reprocessamento necessário.",
              })
              .eq("id", previous.data.id),
          );
        }
        unchanged++;
        continue;
      }
      // A prior request may have saved the document and failed before its lexical chunk.
      // Replaying the same package repairs that interrupted step rather than skipping it.
    }
    const parsed = parseEnvelope(doc.content);
    if (parsed?.kind === "catalog") {
      const old = parseEnvelope(previous.data?.content);
      if (old?.kind === "catalog") {
        parsed.review_history = [...old.review_history, ...(old.review ? [old.review] : [])];
        doc.content = stableJson(parsed); // A content change invalidates approval, not its audit history.
      }
    }
    if (previous.data) doc.id = previous.data.id;
    doc.version = (previous.data?.version ?? 0) + 1;
    const saved = await db.from("knowledge_documents").upsert(doc, { onConflict: "source_path" });
    checkError(saved);
    if (parsed?.kind === "section") {
      const chunk = controlledChunk(parsed.section, parsed.fingerprint, doc.title);
      // Populate lexical search immediately. No metadata from the upload can grant approval.
      const oldChunks = await db.from("knowledge_chunks").delete().eq("document_id", doc.id);
      checkError(oldChunks);
      const stored = await db.from("knowledge_chunks").insert({
        document_id: doc.id,
        chunk_index: 0,
        ...chunk,
        embedding: null,
        category: DUKAMP_CATEGORY,
        subcategory: "section",
        filename: doc.filename,
        title: doc.title,
      });
      checkError(stored);
    }
    if (previous.data) changed++;
    else inserted++;
  }
  return { inserted, changed, unchanged };
}

export async function uploadControlledOriginal(
  db: KnowledgeDatabase,
  source: {
    sha256: string;
    storage_path: string;
    bytes: number;
  },
  bytes: Uint8Array,
): Promise<{ uploaded: boolean }> {
  if (
    !/^[a-f0-9]{64}$/i.test(source.sha256) ||
    !new RegExp(`^dukamp/originals/${source.sha256}\\.(doc|docx|pdf|xls|xlsx|txt)$`).test(
      source.storage_path,
    ) ||
    bytes.length !== source.bytes ||
    (await sha256(bytes)) !== source.sha256
  )
    throw new Error("O original não confere com o hash e o tamanho registrados.");
  const bucket = await db.storage.getBucket("knowledge-base");
  checkError(bucket);
  if (!bucket.data || bucket.data.public !== false)
    throw new Error("É necessário o bucket privado knowledge-base já usado pelo projeto.");
  const target = db.storage.from("knowledge-base");
  const result = await target.upload(source.storage_path, bytes, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (!result.error) return { uploaded: true };
  if (!/already exists|duplicate|resource already|409/i.test(result.error.message))
    throw new Error(result.error.message);
  const existing = await target.download(source.storage_path);
  checkError(existing);
  if (
    !existing.data ||
    (await sha256(new Uint8Array(await existing.data.arrayBuffer()))) !== source.sha256
  )
    throw new Error("O arquivo existente não confere com o hash esperado.");
  return { uploaded: false };
}

export async function processControlledSection(
  db: KnowledgeDatabase,
  doc: {
    id: string;
    title: string;
    filename: string;
    content: string;
  },
  embeddings: {
    embedTexts(texts: string[]): Promise<number[][]>;
    embeddingProvider(): string;
    toPgVector(vector: number[]): string;
  },
) {
  const envelope = parseEnvelope(doc.content);
  if (envelope?.kind !== "section") throw new Error("Documento não é uma seção canônica.");
  const chunk = controlledChunk(envelope.section, envelope.fingerprint, doc.title);
  const [vector] = await embeddings.embedTexts([chunk.content]);
  if (!vector || vector.length !== 3072 || vector.some((n) => !Number.isFinite(n)))
    throw new Error("Embedding da seção inválido (esperado: 3072 dimensões).");
  // Update in place only after successful vector generation. Failure preserves lexical safety context.
  const updated = await db
    .from("knowledge_chunks")
    .update({
      embedding: embeddings.toPgVector(vector),
      metadata: { ...chunk.metadata, embedding_provider: embeddings.embeddingProvider() },
    })
    .eq("document_id", doc.id)
    .eq("chunk_index", 0)
    .eq("metadata->dukamp->>fingerprint", envelope.fingerprint)
    .select("id");
  checkError(updated);
  if (updated.data?.length !== 1)
    throw new Error("Seção canônica ausente; reimporte o pacote para reparar a fila.");
  return 1;
}

export async function processControlledBatch(
  db: KnowledgeDatabase,
  documents: Array<{
    id: string;
    title: string;
    filename: string;
    content: string;
  }>,
  embeddings: {
    embedTexts(texts: string[]): Promise<number[][]>;
    embeddingProvider(): string;
    toPgVector(vector: number[]): string;
  },
) {
  if (!documents.length || documents.length > 10) throw new Error("Lote de seções inválido.");
  const entries = documents.map((doc) => {
    const envelope = parseEnvelope(doc.content);
    if (envelope?.kind !== "section")
      throw new Error("Um lote de vetores só pode conter seções canônicas.");
    return {
      doc,
      envelope,
      chunk: controlledChunk(envelope.section, envelope.fingerprint, doc.title),
    };
  });
  const vectors = await embeddings.embedTexts(entries.map((entry) => entry.chunk.content));
  if (
    vectors.length !== entries.length ||
    vectors.some((vector) => vector.length !== 3072 || vector.some((n) => !Number.isFinite(n)))
  )
    throw new Error("Vetores do lote inválidos (3072 dimensões por seção).");
  let completed = 0;
  for (const [index, entry] of entries.entries()) {
    const updated = await db
      .from("knowledge_chunks")
      .update({
        embedding: embeddings.toPgVector(vectors[index]),
        metadata: { ...entry.chunk.metadata, embedding_provider: embeddings.embeddingProvider() },
      })
      .eq("document_id", entry.doc.id)
      .eq("chunk_index", 0)
      .eq("metadata->dukamp->>fingerprint", entry.envelope.fingerprint)
      .select("id");
    checkError(updated);
    if (updated.data?.length !== 1)
      throw new Error("A seção mudou ou não está disponível; reabra a fila.");
    const saved = await db
      .from("knowledge_documents")
      .update({ status: "concluido", chunk_count: 1, error_message: null })
      .eq("id", entry.doc.id)
      .eq("content_hash", await sha256(stableJson(entry.envelope)))
      .select("id");
    checkError(saved);
    if (saved.data?.length !== 1)
      throw new Error(
        "O documento mudou durante o processamento; nenhuma conclusão foi presumida.",
      );
    completed++;
  }
  return completed;
}

export async function saveTechnicalReview(
  db: KnowledgeDatabase,
  input: {
    produto_id: string;
    product_fingerprint: string;
    source_id_aprovado: string;
    evidencia_rotulo_atual: string;
    revisor_responsavel: string;
    campos_validados: Record<string, string>;
    resolucoes: Record<string, string>;
    especies_autorizadas: string[];
    disponibilidade_confirmada: boolean;
    confirmar_responsabilidade_tecnica: boolean;
    liberar: boolean;
    observacoes?: string | null;
  },
  actor: { userId: string; isAdmin: boolean },
  now = new Date(),
) {
  if (!actor.isAdmin || !actor.userId)
    throw new Error("Revisão restrita a administrador autenticado.");
  const result = await db
    .from("knowledge_documents")
    .select("id, content, content_hash, version")
    .eq("source_path", `dukamp-controlled/catalog/${input.produto_id}.json`)
    .maybeSingle();
  checkError(result);
  const envelope = parseEnvelope(result.data?.content);
  if (
    !envelope ||
    envelope.kind !== "catalog" ||
    envelope.fingerprint !== input.product_fingerprint
  )
    throw new Error("A ficha mudou. Reabra o produto antes de revisar.");
  const source = envelope.product.fontes.find((s) => s.source_id === input.source_id_aprovado);
  if (
    !source ||
    !input.confirmar_responsabilidade_tecnica ||
    !input.evidencia_rotulo_atual.trim() ||
    !input.revisor_responsavel.trim()
  )
    throw new Error("Informe fonte, evidência atual e responsável técnico autorizado.");
  const review: TechnicalReview = {
    ...input,
    source_sha256: source.sha256,
    product_fingerprint: envelope.fingerprint,
    user_id: actor.userId,
    data_revisao: now.toISOString(),
    status_vigencia: input.disponibilidade_confirmada ? "vigente_confirmado" : "nao_verificada",
    recomendacao_operacional_liberada: input.liberar,
    bloqueios_resolvidos: Object.keys(input.resolucoes).filter((key) =>
      input.resolucoes[key]?.trim(),
    ),
    campos_corrigidos_com_evidencia: input.campos_validados,
    observacoes: input.observacoes ?? null,
  };
  if (input.liberar && !reviewIsOperational({ ...envelope, review })) {
    throw new Error(
      `Liberação incompleta: valide ${REVIEW_FIELDS.join(", ")}, disponibilidade, espécies e todas as pendências (${envelope.product.bloqueios.map(issueKey).join(", ")}). Versões obsoletas/não lançadas não podem ser liberadas.`,
    );
  }
  envelope.review_history = [
    ...envelope.review_history,
    ...(envelope.review ? [envelope.review] : []),
  ];
  envelope.review = review;
  const saved = await db
    .from("knowledge_documents")
    .update({ content: stableJson(envelope), version: result.data.version + 1 })
    .eq("id", result.data.id)
    .eq("content_hash", envelope.fingerprint)
    .eq("version", result.data.version)
    .select("id");
  checkError(saved);
  if (saved.data?.length !== 1)
    throw new Error("A ficha foi atualizada durante a revisão. Reabra e confira os dados.");
  return review;
}

export async function listControlledCatalog(db: KnowledgeDatabase): Promise<CatalogEnvelope[]> {
  const result = await db
    .from("knowledge_documents")
    .select("content")
    .eq("category", DUKAMP_CATEGORY)
    .eq("file_type", "dukamp_catalog")
    .order("source_path");
  checkError(result);
  const records = (result.data ?? [])
    .map((row: { content: string }) => parseEnvelope(row.content))
    .filter((record: CatalogEnvelope | null) => record?.kind === "catalog");
  for (const record of records) {
    const product = checkedProduct(record.product);
    if ((await sha256(stableJson(product))) !== record.fingerprint)
      throw new Error("A identidade da ficha não corresponde ao conteúdo; liberação indisponível.");
  }
  return records;
}
