import { farmReport, fold } from "./book.ts";
import { parseGuardianRequest } from "./parse.ts";
import { describeHerdLocations } from "./herd-location-report.ts";
import { operationalReport, type OperationalView } from "./operational-intelligence.ts";
import type { GuardianInput } from "./handler.server.ts";
import type { GuardianSnapshot } from "./schema.ts";

/**
 * Only a complete, explicit read-only report may avoid the semantic planner.
 * New facts, corrections, multi-intent messages and pending confirmations
 * continue to the transactional/semantic flow unchanged.
 */
export function directFarmReport(
  input: Pick<GuardianInput, "text" | "mediaType" | "animalDocument">,
  snapshot: GuardianSnapshot,
  at: Date,
): string | null {
  if (
    !snapshot.active ||
    snapshot.pending ||
    (input.mediaType && input.mediaType !== "audio") ||
    input.animalDocument
  )
    return null;
  const phrase = fold(input.text)
    .trim()
    .replace(/[.!?]+$/, "");
  if (
    /^(?:onde estao os animais|em quais lotes estao os animais|mostre a localizacao dos animais|mostre a distribuicao do rebanho|localizacao do rebanho)$/.test(
      phrase,
    )
  ) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(at);
    return describeHerdLocations(snapshot.active.book, date);
  }
  const intent: OperationalView | null =
    /^(?:indicadores da fazenda|indicadores operacionais|resumo operacional|relatorio operacional|painel gerencial|visao geral da fazenda|como esta minha fazenda|como anda a fazenda)$/.test(
      phrase,
    )
      ? "overview"
      : /^(?:comparativo financeiro|comparar financeiro com mes passado|comparar financas com mes passado|gastos deste mes|quanto gastei este mes|receitas e despesas deste mes)$/.test(
            phrase,
          )
        ? "finance"
        : /^(?:alertas da fazenda|pendencias da fazenda|o que precisa de atencao na fazenda)$/.test(
              phrase,
            )
          ? "alerts"
          : null;
  if (intent) return operationalReport(snapshot.active.book, intent, at);
  const report =
    /^(?:resumo financeiro|relatorio financeiro|minhas tarefas|tarefas pendentes|resumo da fazenda|relatorio da fazenda)(?: (?:deste mes|desse mes|neste mes|nesse mes|do mes passado|de hoje|de ontem|desta semana|do ano))?$/.test(
      phrase,
    );
  if (!report) return null;
  const parsed = parseGuardianRequest(input.text, snapshot, at);
  if (!parsed || parsed.kind !== "query") return null;
  return farmReport(snapshot.active.book, { ...parsed, maxChars: 4500 });
}
