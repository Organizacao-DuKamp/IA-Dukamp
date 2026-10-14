import { dukampSafetySnapshot } from "../../seed/dukamp-control.ts";
import { listControlledCatalog } from "../rag/dukamp-import.server.ts";
import {
  decideControlledTurn,
  matchControlledProducts,
  assessProducerNeed,
  approvedProductContext,
  sourceLabel,
  needsCompleteDiet,
} from "./dukamp-control.ts";
import { practicalControlledReply, withoutProductSources } from "./dukamp-practical.ts";
import { normalized } from "../rag/dukamp-package.ts";
import { userRequestedSourceLinks } from "./response-format.ts";
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
  if (!preliminary.active && !recommendation && !/\bdukamp\b|total\s+m/i.test(text))
    return preliminary;
  const registry = await loadDuKampControl();
  const turn = decideControlledTurn(text, registry.catalog, {
    userHistory,
    recommendation,
    catalogAvailable: registry.available,
  });
  return addCatalogVariants(turn, text, userHistory, recommendation);
}

/** Catalog identities remain separate from technical identities; never copy a parent dose/review. */
export async function addCatalogVariants(
  turn: ControlledTurn,
  text: string,
  userHistory: string[],
  recommendation: boolean,
  lookup?: (query: string) => Promise<{
    data: Array<{
      id: string;
      name: string;
      code: string | null;
      description?: string | null;
      source?: string;
      stock?: number | null;
    }>;
  }>,
): Promise<ControlledTurn> {
  const context = [...userHistory.slice(-6), text].join("\n");
  const need = assessProducerNeed(text, userHistory);
  const explicitVariant = /\btotal\s+m\b/.test(normalized(text))
    ? text.match(/\b(\d+(?:[.,]\d+)?)\s*%/)?.[1]
    : undefined;
  const general =
    recommendation &&
    needsCompleteDiet(context) &&
    turn.selected.length > 0 &&
    /O relatório descreve:/.test(turn.reply ?? "");
  if (need.clinical || need.historic || (!explicitVariant && !general)) return turn;
  const unavailableVariant: ControlledTurn = {
    ...turn,
    active: true,
    selected: [],
    catalogOnly: true,
    allowOperationalModel: false,
    reply:
      "Não consegui confirmar a ficha técnica própria da versão Total M informada. Não use a dose ou a adaptação de outra Total M; confirme o rótulo específico com o responsável técnico da Dukamp.",
  };
  try {
    const query =
      lookup ??
      (async (q: string) =>
        (await import("../site/site-lookup.server.ts")).querySiteProducts(q, 12));
    const result = await query("Total M");
    const { technicalProductSections } = await import("../site/product-technical-text.ts");
    const variants = result.data
      .filter((p) => {
        const name = normalized(p.name);
        if (!/\bdukamp\b.*\btotal m\b/.test(name) || !/\b[12]\s*%/.test(p.name)) return false;
        if (explicitVariant && p.name.match(/\b(\d+(?:[.,]\d+)?)\s*%/)?.[1] !== explicitVariant)
          return false;
        if (p.stock !== null && p.stock !== undefined && p.stock <= 0) return false;
        const sections = technicalProductSections(p.description ?? "");
        const indication = normalized(
          Object.entries(sections)
            .filter(([key]) => key.startsWith("indicacoes"))
            .map(([, value]) => value)
            .join(" "),
        );
        return /bovinos de corte/.test(indication) && /confinamento/.test(indication);
      })
      .map((p) => ({ id: p.id, name: p.name, code: p.code, source: p.source ?? "live" }));
    if (!variants.length) return explicitVariant ? unavailableVariant : turn;
    if (need.species.some((species) => species !== "bovinos") || need.category === "lactacao") {
      if (!explicitVariant) return turn;
      return {
        ...turn,
        active: true,
        selected: [],
        reply:
          "Esta versão é indicada para bovinos de corte em confinamento. Não vou indicá-la para a espécie ou categoria informada.",
        catalogVariants: variants,
      };
    }
    if (explicitVariant)
      return {
        ...turn,
        active: true,
        selected: [],
        catalogOnly: true,
        catalogVariants: variants,
        reply: `${variants.map((p) => p.name).join("; ")}: há cadastro comercial, mas não há revisão técnica própria liberada. Não transferir fórmula, dose ou adaptação de outra Total M.\nFonte: catálogo Dukamp; ${variants.map((p) => `products.id=${p.id}; código ${p.code ?? "ausente"}; origem ${p.source}`).join("; ")}.`,
      };
    return { ...turn, catalogVariants: variants };
  } catch {
    return explicitVariant ? unavailableVariant : turn; // A catalog outage never weakens the original technical gate.
  }
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
  const unmappedVariant =
    !namedProducts.size &&
    /\btotal m\b/.test(normalized(query)) &&
    /\b\d+(?:[.,]\d+)?\s*%/.test(query);
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
    if (unmappedVariant) return []; // Parent sections cannot become evidence for a percentage variant.
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
  const latest = await addCatalogVariants(
    decideControlledTurn(text, registry.catalog, {
      userHistory,
      recommendation,
      catalogAvailable: registry.available,
    }),
    text,
    userHistory,
    recommendation,
  );
  if (latest.reply) return practicalControlledReply(latest, text, userHistory);
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
      (blocked.reply ? practicalControlledReply(blocked, text, userHistory) : null) ??
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
      (grounded.reply ? practicalControlledReply(grounded, text, userHistory) : null) ??
      "Os valores de dose e mistura precisam ser reproduzidos da versão conferida pelo responsável técnico; uma resposta gerada não libera um cálculo novo."
    );
  }
  if (latest.allowOperationalModel && userRequestedSourceLinks(text))
    return `${reply}\n\n${controlledSources(latest)}`;
  return userRequestedSourceLinks(text) ? reply : withoutProductSources(reply);
}
