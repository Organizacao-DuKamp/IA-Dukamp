import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { importDuKampBatch, uploadDuKampOriginal } from "@/lib/dukamp-knowledge.functions";
import { planDuKampImport, parseJsonLines } from "@/lib/rag/dukamp-package";
import { DuKampReviewPanel } from "@/components/dukamp-review-panel";
import {
  knowledgeStats,
  listKnowledgeDocs,
  processNextPending,
  registerSeed,
  reprocessDocument,
  uploadKnowledgeZip,
} from "@/lib/knowledge.functions";

export const Route = createFileRoute("/_authenticated/admin/base-conhecimento")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento · TPEC-IA" },
      {
        name: "description",
        content: "Gestão da base de conhecimento RAG da TPEC-IA.",
      },
      { property: "og:title", content: "Base de conhecimento · TPEC-IA" },
      {
        property: "og:description",
        content: "Gestão da base de conhecimento RAG da TPEC-IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminKnowledgeBase,
});

type Doc = {
  id: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
  status: "aguardando" | "processando" | "concluido" | "erro";
  chunk_count: number;
  error_message: string | null;
  updated_at: string;
  file_type?: string | null;
};
type Stats = {
  docs: {
    aguardando: number;
    processando: number;
    concluido: number;
    erro: number;
    total: number;
  };
  chunks: number;
};

const DOCUMENT_DELAY_MS = 12_000;
const RATE_LIMIT_DELAY_MS = 60_000;

function isRateLimitMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("tokens per min") ||
    normalized.includes("tpm")
  );
}

function AdminKnowledgeBase() {
  const navigate = useNavigate();
  const list = useServerFn(listKnowledgeDocs);
  const stats = useServerFn(knowledgeStats);
  const register = useServerFn(registerSeed);
  const processOne = useServerFn(processNextPending);
  const reprocess = useServerFn(reprocessDocument);
  const uploadZip = useServerFn(uploadKnowledgeZip);
  const importControlled = useServerFn(importDuKampBatch);
  const uploadOriginal = useServerFn(uploadDuKampOriginal);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [statData, setStatData] = useState<Stats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [processingNote, setProcessingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([list(), stats()]);
      setDocs(d as Doc[]);
      setStatData(s as Stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
    }
  }, [list, stats]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function waitWithCountdown(ms: number, message: string) {
    const endsAt = Date.now() + ms;
    while (Date.now() < endsAt) {
      const remainingMs = endsAt - Date.now();
      const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
      setProcessingNote(`${message} ${seconds}s…`);
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000, remainingMs)));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function handleRegister() {
    setBusy("register");
    try {
      const r = (await register()) as { total: number; inserted: number };
      setLog((l) => [`Seed registrado: ${r.inserted}/${r.total} documentos.`, ...l]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar seed.");
    } finally {
      setBusy(null);
    }
  }

  async function processAll() {
    setRunning(true);
    setError(null);
    setProcessingNote(null);
    let successfulThisRun = 0;
    let consecutiveRateLimits = 0;

    try {
      const recoverable = docs.filter(
        (doc) => doc.status === "erro" && isRateLimitMessage(doc.error_message),
      );

      if (recoverable.length > 0) {
        setProcessingNote(`Recuperando ${recoverable.length} falha(s) temporária(s) da OpenAI…`);
        for (const doc of recoverable) {
          await reprocess({ data: { id: doc.id } });
        }
        setLog((l) => [
          `↻ ${recoverable.length} documento(s) com rate limit voltaram para a fila sem tocar nos concluídos.`,
          ...l,
        ]);
        await refresh();
      }

      while (true) {
        setProcessingNote(
          successfulThisRun > 0
            ? `Processando próximo documento · ${successfulThisRun} concluído(s) nesta execução…`
            : "Processando próximo documento…",
        );

        const r = (await processOne()) as
          | { done: true }
          | {
              done: false;
              id: string;
              title: string;
              chunks?: number;
              error?: string;
              halt?: boolean;
            };

        if (r.done) {
          setLog((l) => ["✅ Todos os pendentes foram processados.", ...l]);
          break;
        }
        if (r.halt) {
          setError(
            r.error ??
              "O processamento foi interrompido. Os trechos e as restrições continuam preservados; confira o erro antes de retomar.",
          );
          break;
        }

        if (r.error && isRateLimitMessage(r.error)) {
          consecutiveRateLimits += 1;

          // O backend atual marca 429 como erro. Voltamos somente este documento
          // para aguardando e retomamos depois da janela do limite, sem perder trabalho.
          await reprocess({ data: { id: r.id } });
          const waitMs = Math.min(
            RATE_LIMIT_DELAY_MS + (consecutiveRateLimits - 1) * 15_000,
            120_000,
          );

          setLog((l) => [
            `⏳ ${r.title}: limite temporário da OpenAI; documento devolvido à fila.`,
            ...l,
          ]);
          await refresh();
          await waitWithCountdown(waitMs, "Limite da OpenAI atingido. Retomando em");
          continue;
        }

        if (r.error) {
          consecutiveRateLimits = 0;
          setLog((l) => [`❌ ${r.title}: ${r.error}`, ...l]);
          await refresh();
          continue;
        }

        consecutiveRateLimits = 0;
        successfulThisRun += 1;
        setLog((l) => [`✔ ${r.title} — ${r.chunks} trechos`, ...l]);
        await refresh();

        // O limite atual da conta é 40k TPM. O intervalo entre documentos é
        // proposital: a maioria deles cabe em um único batch de embeddings.
        await waitWithCountdown(
          DOCUMENT_DELAY_MS,
          "Controlando o limite da OpenAI. Próximo documento em",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar.");
    } finally {
      setProcessingNote(null);
      setRunning(false);
      await refresh();
    }
  }

  async function handleReprocess(id: string) {
    await reprocess({ data: { id } });
    await refresh();
  }

  async function handleUploadZip(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const JSZip = (await import("jszip")).default;
      const archive = await JSZip.loadAsync(buf);
      const catalogPath = Object.keys(archive.files).find((name) =>
        name.endsWith("dados/catalogo_produtos.json"),
      );
      if (catalogPath) {
        if (replaceAll)
          throw new Error(
            "O pacote Dukamp deve ser mesclado à base existente. Desmarque a substituição completa.",
          );
        const prefix = catalogPath.slice(0, -"dados/catalogo_produtos.json".length);
        const read = async (name: string) => {
          const entry = archive.file(prefix + name);
          if (!entry) throw new Error(`Arquivo necessário ausente: ${name}`);
          return entry.async("string");
        };
        setProcessingNote("Validando produtos, versões e referências…");
        const plan = await planDuKampImport({
          catalog: JSON.parse(await read("dados/catalogo_produtos.json")),
          sections: parseJsonLines(await read("dados/trechos_rag.jsonl"), "trechos"),
          questions: parseJsonLines(await read("dados/perguntas_respostas.jsonl"), "perguntas"),
          sources: JSON.parse(await read("dados/fontes.json")),
          evaluations: parseJsonLines(await read("dados/avaliacao.jsonl"), "avaliação"),
        });
        const toBase64 = (input: Uint8Array) => {
          let binary = "";
          for (let i = 0; i < input.length; i += 0x8000)
            binary += String.fromCharCode(...input.subarray(i, i + 0x8000));
          return btoa(binary);
        };
        for (const [i, source] of plan.originals.entries()) {
          const original = archive.file(prefix + source.package_path);
          if (!original) throw new Error(`Original ausente: ${source.package_path}`);
          setProcessingNote(`Preservando originais ${i + 1}/${plan.originals.length}…`);
          await uploadOriginal({
            data: { ...source, base64: toBase64(await original.async("uint8array")) },
          });
        }
        const totals = { inserted: 0, changed: 0, unchanged: 0 };
        for (let i = 0; i < plan.documents.length; i += 15) {
          setProcessingNote(
            `Registrando a base ${Math.min(i + 15, plan.documents.length)}/${plan.documents.length}…`,
          );
          const result = await importControlled({
            data: { documents: plan.documents.slice(i, i + 15) },
          });
          for (const key of ["inserted", "changed", "unchanged"] as const)
            totals[key] += result[key];
        }
        setLog((l) => [
          `Base Dukamp registrada: ${plan.counts.products} produtos/variantes, ${plan.counts.sourceVersions} versões, ${plan.counts.questions} perguntas e ${plan.counts.sections} trechos. ${totals.unchanged} registros já estavam iguais. Os vetores ainda precisam ser processados e a revisão técnica permanece pendente.`,
          ...l,
        ]);
        await refresh();
        return;
      }
      // Convert ArrayBuffer -> base64 in chunks to avoid stack overflow.
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const zipBase64 = btoa(binary);
      const r = (await uploadZip({ data: { zipBase64, replaceAll } })) as {
        total: number;
        inserted: number;
      };
      setLog((l) => [
        `📦 ZIP recebido: ${r.inserted}/${r.total} documentos ${replaceAll ? "(base substituída)" : "(mesclados)"}. Clique em "Processar pendentes" para gerar os embeddings.`,
        ...l,
      ]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar ZIP.");
    } finally {
      setBusy(null);
      setProcessingNote(null);
      setProcessingNote(null);
    }
  }

  const s = statData?.docs;
  const lexicalReady = docs.filter((doc) => doc.chunk_count > 0).length;
  const recoverableRateLimitErrors = docs.filter(
    (doc) => doc.status === "erro" && isRateLimitMessage(doc.error_message),
  ).length;
  const hasProcessableWork = Boolean(s && (s.aguardando > 0 || recoverableRateLimitErrors > 0));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">Base de conhecimento</h1>
            <p className="text-xs text-muted-foreground">
              Gestão RAG da TPEC-IA ·{" "}
              <Link
                to="/admin/cotacoes"
                className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
              >
                Cotações
              </Link>
              <Link to="/admin/produtos" className="underline">
                Produtos
              </Link>{" "}
              ·{" "}
              <Link to="/admin/ia" className="underline">
                Análise da IA
              </Link>{" "}
              ·{" "}
              <Link to="/" className="underline">
                voltar ao chat
              </Link>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {s && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total" value={s.total} />
            <Stat label="Disponíveis" value={lexicalReady} tone="success" />
            <Stat label="Vetores pendentes" value={s.aguardando} />
            <Stat label="Processando" value={s.processando} />
            <Stat label="Vetorizados" value={s.concluido} tone="success" />
            <Stat label="Erros" value={s.erro} tone={s.erro > 0 ? "danger" : undefined} />
          </div>
        )}
        {statData && (
          <p className="text-xs text-muted-foreground">
            {statData.chunks} trechos disponíveis para busca. Documentos com trechos e vetores
            pendentes já participam da busca lexical; “vetorizados” indica embeddings OpenAI · 3072d
            concluídos.
          </p>
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Atualizar via ZIP</h2>
            <p className="text-xs text-muted-foreground">
              Envie o <code>base-conhecimento.zip</code> atualizado. O sistema descompacta, preserva
              a estrutura de pastas como categoria/subcategoria e enfileira os documentos para
              reprocessamento. O pacote <code>DUKAMP_BASE_TPEC_IA.zip</code> importa os dados
              estruturados, preserva os originais e mantém a revisão técnica separada da geração de
              vetores.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={replaceAll}
              onChange={(e) => setReplaceAll(e.target.checked)}
            />
            Substituir toda a base (apaga documentos e trechos existentes)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              disabled={busy !== null || running}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadZip(f);
                e.target.value = "";
              }}
              className="text-xs file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:bg-secondary"
            />
            {busy === "upload" && (
              <span className="text-xs text-muted-foreground">Enviando e descompactando…</span>
            )}
          </div>
        </div>

        <DuKampReviewPanel key={docs.length} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRegister}
            disabled={busy !== null || running}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy === "register" ? "Registrando…" : "1. Registrar seed embutido"}
          </button>
          <button
            onClick={processAll}
            disabled={running || busy !== null || !hasProcessableWork}
            className="rounded-md border border-primary bg-background px-3 py-1.5 text-sm text-primary disabled:opacity-50"
          >
            {running
              ? "Processando…"
              : s && s.aguardando > 0
                ? `2. Gerar vetores pendentes (${s.aguardando})`
                : recoverableRateLimitErrors > 0
                  ? `2. Retomar falhas temporárias (${recoverableRateLimitErrors})`
                  : "2. Gerar vetores pendentes (0)"}
          </button>
          <button
            onClick={refresh}
            disabled={running}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          >
            Atualizar
          </button>
          {running && processingNote && (
            <span className="text-xs text-muted-foreground">{processingNote}</span>
          )}
        </div>

        {log.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card p-3 text-xs">
            {log.map((l, i) => (
              <div key={i} className="border-b border-border/40 py-1 last:border-none">
                {l}
              </div>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Documento</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Trechos</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{d.title}</div>
                    <div className="text-[11px] text-muted-foreground">{d.filename}</div>
                    {d.error_message && (
                      <div className="mt-1 text-[11px] text-destructive">{d.error_message}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {d.category}
                    {d.subcategory ? ` / ${d.subcategory}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {["dukamp_catalog", "dukamp_questions", "dukamp_manifest"].includes(
                      d.file_type ?? "",
                    ) ? (
                      <span className="text-xs text-muted-foreground">
                        Registro de apoio / revisão
                      </span>
                    ) : (
                      <StatusBadge status={d.status} chunkCount={d.chunk_count} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.chunk_count}</td>
                  <td className="px-3 py-2 text-right">
                    {(d.status === "concluido" || d.status === "erro") &&
                      !["dukamp_catalog", "dukamp_questions", "dukamp_manifest"].includes(
                        d.file_type ?? "",
                      ) && (
                        <button
                          onClick={() => handleReprocess(d.id)}
                          disabled={running}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          reprocessar
                        </button>
                      )}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhum documento registrado. Clique em "Registrar seed".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-primary"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, chunkCount }: { status: Doc["status"]; chunkCount: number }) {
  if (status === "aguardando" && chunkCount > 0) {
    return (
      <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
        disponível · vetores pendentes
      </span>
    );
  }

  const map: Record<Doc["status"], string> = {
    aguardando: "bg-muted text-muted-foreground",
    processando: "bg-primary/20 text-primary",
    concluido: "bg-primary text-primary-foreground",
    erro: "bg-destructive/20 text-destructive",
  };
  const label: Record<Doc["status"], string> = {
    aguardando: "aguardando conteúdo",
    processando: "gerando vetores...",
    concluido: "vetorizado",
    erro: "erro",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}
