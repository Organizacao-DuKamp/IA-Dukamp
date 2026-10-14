import { dukampSafetySnapshot } from "../../seed/dukamp-control.ts";
import { listControlledCatalog } from "../rag/dukamp-import.server.ts";
import {
  decideControlledTurn,
  matchControlledProducts,
  assessProducerNeed,
  approvedProductContext,
  sourceLabel,
} from "./dukamp-control.ts";
import { reviewIsOperational } from "../rag/dukamp-package.ts";
import type { CatalogEnvelope } from "../rag/dukamp-package.ts";
import type { ControlledTurn } from "./dukamp-control.ts";

/** Approval is read afresh for each relevant turn. A revoked review must not survive a cache TTL. */
export async function loadDuKampControl(): Promise<{
  catalog: CatalogEnvelope[];
  available: boolean;
}> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
    return { catalog: dukampSafetySnapshot, available: false };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const records = await listControlledCatalog(supabaseAdmin);
    if (!records.length) return { catalog: dukampSafetySnapshot, available: false };
    const byId = new Map(dukampSafetySnapshot.map((record) => [record.product.produto_id, record]));
    for (const record of records) byId.set(record.product.produto_id, record);
    return { catalog: [...byId.values()], available: true };
  } catch {
    // The source data registry is a deny-by-default safety fallback, never proof of live approval.
    return { catalog: dukampSafetySnapshot, available: false };
  }
}
export async function resolveControlledTurn(
  text: string,
  userHistory: string[],
  recommendation: boolean,
): Promise<ControlledTurn> {
  const preliminary = decideControlledTurn(text, dukampSafetySnapshot, {
    userHistory,
    recommendation,
    catalogAvailable: false,
  });
  if (!preliminary.active && !recommendation && !/\bdukamp\b/i.test(text)) return preliminary;
  const registry = await loadDuKampControl();
  return decideControlledTurn(text, registry.catalog, {
    userHistory,
    recommendation,
    catalogAvailable: registry.available,
  });
}

export interface ControlledMatch {
  content: string;
  filename: string;
  title: string;
  metadata?: {
    dukamp?: {
      produto_id: string;
      source_id: string;
      versao_papel: string;
      referencias?: unknown[];
    };
  };
}
export async function filterControlledMatches<T extends ControlledMatch>(
  matches: T[],
  query: string,
): Promise<T[]> {
  if (
    !matches.some(
      (m) =>
        m.filename.startsWith("dukamp_") ||
        matchControlledProducts(`${m.title} ${m.filename} ${m.content}`, dukampSafetySnapshot)
          .length,
    )
  )
    return matches;
  const { catalog, available } = await loadDuKampControl();
  const historical = assessProducerNeed(query).historic;
  const namedProducts = new Set(
    matchControlledProducts(query, catalog).map((e) => e.product.produto_id),
  );
  const byId = new Map(catalog.map((e) => [e.product.produto_id, e]));
  return matches.flatMap((match) => {
    const meta = match.metadata?.dukamp;
    if (!meta) {
      // A legacy duplicate cannot bypass the reviewed canonical version.
      if (
        match.filename.startsWith("dukamp_") ||
        matchControlledProducts(`${match.title} ${match.filename} ${match.content}`, catalog).length
      )
        return [];
      return [match];
    }
    const entry = byId.get(meta.produto_id);
    if (!entry) return [];
    if (namedProducts.size && !namedProducts.has(meta.produto_id)) return [];
    const historicalSource =
      meta.versao_papel === "historico_obsoleto" ||
      ["historico_obsoleto", "nao_lancado"].includes(entry.product.status_vigencia);
    if (historicalSource && !historical) return [];
    if (historicalSource)
      return [{ ...match, content: `FONTE HISTÓRICA, SEM LIBERAÇÃO DE USO.\n${match.content}` }];
    if (available && reviewIsOperational(entry)) {
      if (meta.source_id !== entry.review!.source_id_aprovado) return [];
      return [{ ...match, content: approvedProductContext(entry) }];
    }
    return [
      {
        ...match,
        content: `INDICAÇÃO DOCUMENTAL, SEM DOSE LIBERADA: ${entry.product.nome_comercial_documental}\n${entry.product.descricao_documental}\nPendências: ${entry.product.bloqueios.map((p) => p.descricao).join(" ")}\nRestrições: ${entry.product.restricoes_documentais}\n${sourceLabel(entry.product, "indicação e restrições")}`,
      },
    ];
  });
}
export function controlledSources(turn: ControlledTurn): string {
  return turn.selected
    .filter(reviewIsOperational)
    .map(
      (entry) =>
        `${sourceLabel(entry.product, "campos conferidos na revisão técnica", entry.review!.source_id_aprovado)} Evidência do rótulo vigente: ${entry.review!.evidencia_rotulo_atual}.`,
    )
    .join("\n");
}

export async function enforceControlledReply(
  reply: string,
  text: string,
  userHistory: string[],
  recommendation: boolean,
): Promise<string> {
  const registry = await loadDuKampControl();
  const latest = decideControlledTurn(text, registry.catalog, {
    userHistory,
    recommendation,
    catalogAvailable: registry.available,
  });
  if (latest.reply) return latest.reply;
  const generatedProducts = registry.catalog.filter(
    (entry) => matchControlledProducts(reply, [entry]).length > 0,
  );
  const prescribes =
    /(?:forne[cç]a|fornecer|mistur[ae]|dose|consumo|d[eê]|dar).{0,100}\d+\s*(?:g\b|kg\b|%|gramas|quilos)/i.test(
      reply,
    );
  const pendingGenerated = generatedProducts.filter((entry) => !reviewIsOperational(entry));
  if (pendingGenerated.length && (recommendation || prescribes)) {
    const blocked = decideControlledTurn(
      `Como usar ${pendingGenerated[0].product.nome_comercial_documental}?`,
      registry.catalog,
      { userHistory, catalogAvailable: registry.available },
    );
    return (
      blocked.reply ??
      "A ficha técnica da opção citada ainda não possui liberação para uma dose ou manejo. Confirme o rótulo vigente com o responsável técnico."
    );
  }
  if (prescribes && (generatedProducts.length || latest.selected.length)) {
    const entry = generatedProducts[0] ?? latest.selected[0];
    const grounded = decideControlledTurn(
      `Como usar ${entry.product.nome_comercial_documental}?`,
      registry.catalog,
      {
        userHistory: [...userHistory, text],
        catalogAvailable: registry.available,
      },
    );
    return (
      grounded.reply ??
      "Os valores de dose e mistura precisam ser reproduzidos da versão conferida pelo responsável técnico; uma resposta gerada não libera um cálculo novo."
    );
  }
  if (latest.allowOperationalModel) return `${reply}\n\n${controlledSources(latest)}`;
  return reply;
}
