// Offline validation does not need a database key. Applying the plan uses the existing service runtime.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import {
  parseJsonLines,
  planDuKampImport,
  parseEnvelope,
  sha256,
} from "../src/lib/rag/dukamp-package.ts";
import {
  importControlledDocuments,
  uploadControlledOriginal,
  processControlledBatch,
} from "../src/lib/rag/dukamp-import.server.ts";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
if (!args.includes("--package"))
  throw new Error(
    "Informe --package <pasta DUKAMP_BASE_TPEC_IA>. Use --apply apenas no ambiente administrativo configurado.",
  );
const root = resolve(value("--package"));
const load = (path) => readFile(join(root, path), "utf8");
const plan = await planDuKampImport({
  catalog: JSON.parse(await load("dados/catalogo_produtos.json")),
  sections: parseJsonLines(await load("dados/trechos_rag.jsonl"), "trechos_rag.jsonl"),
  questions: parseJsonLines(
    await load("dados/perguntas_respostas.jsonl"),
    "perguntas_respostas.jsonl",
  ),
  sources: JSON.parse(await load("dados/fontes.json")),
  evaluations: parseJsonLines(await load("dados/avaliacao.jsonl"), "avaliacao.jsonl"),
});
const report = {
  schema: "dukamp-import-report:1",
  package_counts: plan.counts,
  database: {
    inserted: 0,
    changed: 0,
    unchanged: 0,
    originals_uploaded: 0,
    originals_preserved: 0,
  },
  embeddings: { completed: 0, pending: plan.counts.sections, errors: [] },
  applied: false,
  originals_verified_locally: 0,
  blockers: [],
  examples: [],
};

if (args.includes("--snapshot")) {
  const snapshot = plan.documents
    .map((doc) => parseEnvelope(doc.content))
    .filter((e) => e?.kind === "catalog")
    .map((e) => ({
      ...e,
      product: Object.fromEntries(
        Object.entries(e.product).filter(([key]) =>
          [
            "produto_id",
            "nome_comercial_documental",
            "aliases",
            "classificacao_documental",
            "descricao_documental",
            "composicao_documental",
            "modo_de_usar_documental",
            "restricoes_documentais",
            "status_vigencia",
            "principal_documental_source_id",
            "fontes",
            "bloqueios",
            "recomendacao_operacional_liberada",
          ].includes(key),
        ),
      ),
    }));
  const output = resolve(value("--snapshot"));
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(
    output,
    output.endsWith(".ts")
      ? `// Safety registry only: this file is not a database import or a technical approval.\nimport type { CatalogEnvelope } from "../lib/rag/dukamp-package.ts";\nexport const dukampSafetySnapshot = ${JSON.stringify(snapshot)} as unknown as CatalogEnvelope[];\n`
      : JSON.stringify(snapshot),
  );
}

try {
  for (const source of plan.originals) {
    const bytes = new Uint8Array(await readFile(resolve(root, source.package_path)));
    if (bytes.length !== source.bytes || (await sha256(bytes)) !== source.sha256)
      throw new Error(`Original não corresponde ao manifesto: ${source.source_id}`);
    report.originals_verified_locally++;
  }
  const evidence = new Set(
    plan.documents.flatMap((doc) => {
      const e = parseEnvelope(doc.content);
      return e?.kind === "section" ? e.section.referencias.map((r) => r.evidence_id) : [];
    }),
  );
  for (const example of plan.evaluations)
    for (const id of example.fontes_esperadas ?? [])
      if (!evidence.has(id)) throw new Error(`Aceitação aponta evidência inexistente: ${id}`);
  if (args.includes("--apply")) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      report.blockers.push(
        "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão disponíveis no ambiente administrativo.",
      );
    } else {
      const { createClient } = await import("@supabase/supabase-js");
      const db = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Check that the project's private bucket is available before mutating the knowledge tables.
      const bucket = await db.storage.getBucket("knowledge-base");
      if (bucket.error || bucket.data?.public !== false)
        throw new Error(
          "O bucket knowledge-base privado não está disponível para preservar os originais.",
        );
      for (const source of plan.originals) {
        const file = resolve(root, source.package_path);
        if (relative(root, file).startsWith("..")) throw new Error("Original fora do pacote.");
        const result = await uploadControlledOriginal(
          db,
          source,
          new Uint8Array(await readFile(file)),
        );
        if (result.uploaded) report.database.originals_uploaded++;
        else report.database.originals_preserved++;
      }
      for (let i = 0; i < plan.documents.length; i += 15) {
        const result = await importControlledDocuments(db, plan.documents.slice(i, i + 15));
        for (const key of ["inserted", "changed", "unchanged"]) report.database[key] += result[key];
      }
      report.applied = true;
      if (!process.env.OPENAI_API_KEY)
        report.blockers.push(
          "OPENAI_API_KEY não está disponível: importação lexical concluída, embeddings pendentes.",
        );
      else {
        const embeddings = await import("../src/lib/rag/embeddings.server.ts");
        const pending = [];
        for (const doc of plan.documents.filter((d) => d.file_type === "dukamp_section")) {
          const current = await db
            .from("knowledge_documents")
            .select("id,status,content,title,filename")
            .eq("source_path", doc.source_path)
            .single();
          if (current.error) throw new Error(current.error.message);
          const vector = await db
            .from("knowledge_chunks")
            .select("id")
            .eq("document_id", current.data.id)
            .eq("chunk_index", 0)
            .not("embedding", "is", null);
          if (vector.error) throw new Error(vector.error.message);
          if (current.data.status === "concluido" && vector.data?.length === 1)
            report.embeddings.completed++;
          else pending.push({ ...current.data, source_path: doc.source_path });
        }
        for (let i = 0; i < pending.length; i += 10) {
          const batch = pending.slice(i, i + 10);
          try {
            report.embeddings.completed += await processControlledBatch(db, batch, embeddings);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha de processamento.";
            for (const doc of batch) {
              report.embeddings.errors.push({ source_path: doc.source_path, error: message });
              // A partial batch may have saved some vectors. Recheck each status instead of assuming failure or success.
              const state = await db
                .from("knowledge_documents")
                .select("status")
                .eq("id", doc.id)
                .single();
              if (state.data?.status === "concluido") report.embeddings.completed++;
              else
                await db
                  .from("knowledge_documents")
                  .update({ status: "aguardando", error_message: message })
                  .eq("id", doc.id);
            }
            report.blockers.push(
              "Processamento interrompido após falha; corrija o acesso e reexecute de forma idempotente.",
            );
            break;
          }
        }
      }
    }
  } else
    report.blockers.push(
      "Validação local: --apply não foi solicitado; nenhum registro foi enviado ao banco.",
    );
} catch (error) {
  report.blockers.push(error instanceof Error ? error.message : "Falha de importação.");
  process.exitCode = 2;
}
report.embeddings.pending = plan.counts.sections - report.embeddings.completed;
if (args.includes("--report"))
  await writeFile(resolve(value("--report")), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (
  args.includes("--apply") &&
  (report.blockers.length || report.embeddings.pending || report.embeddings.errors.length)
)
  process.exitCode = 2;
