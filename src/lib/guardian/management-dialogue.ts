import {
  ActionSchema,
  type GuardianAction,
  type GuardianSnapshot,
  type ManagementDraft,
} from "./schema.ts";
import { cardinal, foldHerd, herdStatement } from "./herd-language.ts";
import { eventDay, farmScopeMatches } from "./herd-event-language.ts";
import { moneyValue } from "./record-dialogue.ts";
import { userStatement } from "../whatsapp/learned-notes.ts";
import type { ChatMessage } from "../chat/types.ts";

export type ManagementSlots = Pick<ManagementDraft, "section" | "targets" | "lot" | "changes">;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mentions(text: string, value: string) {
  return new RegExp(`(?:^|[^\\p{L}\\d_-])${escape(foldHerd(value))}(?=$|[^\\p{L}\\d_-])`, "u").test(
    foldHerd(text),
  );
}
function lotIn(text: string) {
  const matches = [...text.matchAll(/\blote\s+([\p{L}\d_-]+)/giu)];
  const value = matches.at(-1)?.[1];
  if (
    !value ||
    /^(?:da|do|de|desses|deles|desses|atual|certo|correto|novo|que|para|errado)$/i.test(value)
  )
    return undefined;
  return cardinal(value) !== null ? String(cardinal(value)) : value;
}
export function managementCandidate(text: string) {
  const t = foldHerd(text);
  return (
    /\b(?:coloque|coloca|colocar|mova|mover|mude|muda|mudar|passe|passa|passar|transfira|transferir|altere|alterar|troque|trocar|corrija|corrigir|atualize|atualizar|quero|deixe)\b/.test(
      t,
    ) &&
    /\b(?:lote|despesa|receita|lancamento|financeiro|anotacao|registro|caderno|animal|animais|bezerros|bezerro|gado)\b/.test(
      t,
    )
  );
}
function safeEdit(text: string) {
  const t = foldHerd(text);
  if (/^(?:como|qual|quais|sera|posso|podemos|por que)\b/.test(t)) return false;
  if (/\b(?:se|quando|semana que vem|proximo mes)\b/.test(t)) return false;
  return !/\b(?:se eu|se nos|se tivesse|se fossem|suponha|simule|hipotetic|talvez|acho|vizinho|disse|encaminhad|nao (?:mova|coloque|altere|mude|quero)|amanha|vou)\b|```|["“”]|^>/i.test(
    t,
  );
}
function animalTargets(
  text: string,
  snapshot: GuardianSnapshot,
  phone: string,
  at: Date,
  history: ChatMessage[],
) {
  const all = snapshot.active!.book.animals;
  const selection = text.replace(/\b(?:lote)\s+[\p{L}\d_-]+/giu, "");
  const t = foldHerd(selection),
    count = t.match(
      /\b(?:os|as|esses|estes|essas|estas)\s+(?:(?:ultimos?|ultimas?|novos?|novas?)\s+)?(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/,
    )?.[1],
    n = count ? cardinal(count) : /\b(?:o|a) ultim[oa]\b/.test(t) ? 1 : undefined;
  const explicit = all.filter((a) => {
    const referenced = (value: string) =>
      /^\d+$/.test(value)
        ? new RegExp(`\\b(?:animal|codigo|brinco)\\s+${escape(value)}\\b`).test(t)
        : mentions(selection, value);
    return referenced(a.code) || (a.rgn && referenced(a.rgn));
  });
  const unknownCodes =
    selection.match(/\b(?=[\p{L}\d_-]*\p{L})(?=[\p{L}\d_-]*\d)[\p{L}\d_-]+\b/gu) ?? [];
  if (
    unknownCodes.some(
      (code) => !explicit.some((a) => mentions(a.code, code) || (a.rgn && mentions(a.rgn, code))),
    )
  )
    return [];
  // An explicit unknown code in a list must not silently turn a batch into a partial edit.
  const labeled = [...text.matchAll(/\b(?:c[oó]digo|brinco|animal)\s+([\p{L}\d_-]+)/giu)]
    .map((m) => m[1])
    .filter((v) => /\d/.test(v));
  if (
    labeled.some((c) => !explicit.some((a) => mentions(a.code, c) || (a.rgn && mentions(a.rgn, c))))
  )
    return [];
  if (explicit.length && (!n || explicit.length === n)) return explicit.map((a) => a.code);
  if (n !== undefined && n !== null && (n <= 0 || n > 100 || n > all.length)) return [];
  if (n && /\bultim[oa]s?\b/.test(t)) return all.slice(-n).map((a) => a.code);
  if (/\b(?:esses?|estes?|essas?|estas?|eles|elas|novos?|novas?|recem)\b/.test(t)) {
    // Only producer messages can identify conversational referents. Assistant prose
    // and retrieved text cannot select animals for a mutation.
    for (const message of history.slice(-10).reverse()) {
      if (
        /^(?:Fazenda selecionada:|usar fazenda|selecionar fazenda|cadastrar fazenda)/i.test(
          message.content.trim(),
        )
      )
        break;
      if (message.role !== "user") continue;
      const statement = userStatement(message.content);
      if (!farmScopeMatches(herdStatement(statement), snapshot, true)) break;
      if (/\b(?:vizinho|disse|exemplo|outra fazenda)\b/.test(foldHerd(statement))) continue;
      const matched = all.filter(
        (a) => mentions(statement, a.code) || (a.rgn && mentions(statement, a.rgn)),
      );
      if (matched.length && (!n || matched.length === n)) return matched.map((a) => a.code);
    }
    const last = all.at(-1);
    if (
      last &&
      last.source.actor === phone &&
      Date.parse(last.source.at) > at.getTime() - 30 * 60000
    ) {
      const group = all.filter((a) => a.source.messageId === last.source.messageId);
      if ((!n || group.length === n) && group.length <= 100) return group.map((a) => a.code);
    }
  }
  return [];
}
function recordTargets(text: string, section: "ledger" | "records", snapshot: GuardianSnapshot) {
  let rows = snapshot.active!.book[section];
  const ids = rows.filter((r) => mentions(text, r.id));
  if (ids.length) return ids.map((r) => r.id);
  const t = foldHerd(text);
  if (section === "ledger")
    rows = snapshot.active!.book.ledger.filter((r) =>
      /\bdespesa\b/.test(t)
        ? r.direction === "expense"
        : /\breceita\b/.test(t)
          ? r.direction === "income"
          : true,
    );
  if (/\bultim[oa]\b/.test(t)) return rows.length ? [rows.at(-1)!.id] : [];
  // A distinctive existing description is also a usable name for a record.
  const described = rows.filter(
    (r) => foldHerd(r.description).length >= 5 && t.includes(foldHerd(r.description)),
  );
  if (described.length === 1) return [described[0].id];
  if (rows.length === 1) return [rows[0].id];
  return [];
}
function changesIn(text: string, section: "ledger" | "records", at: Date) {
  const changes: NonNullable<ManagementSlots["changes"]> = {};
  const day = eventDay(text, at),
    lot = lotIn(text);
  if (day.day && !day.invalid && !day.ambiguous) changes.date = day.day;
  if (lot) changes.lot = lot;
  if (section === "ledger") {
    const money = text.match(
      /(?:para|por|valor(?:\s+(?:certo|correto))?(?:\s+[eé])?|foi|era)\s*[:=]?\s*(?:r\$\s*)?([\d.,]+(?:\s+mil)?)(?:\s+reais)?/i,
    );
    const value = moneyValue(money?.[1] ?? text);
    if (value) changes.amountCents = value;
  }
  const description = text.match(
    /(?:descri[cç][aã]o|texto|anota[cç][aã]o)\s+(?:para|[eé]|por)\s*:?\s*(.+)$/i,
  )?.[1];
  if (description) changes.description = description.trim();
  return changes;
}
export function managementDialogue(
  input: { text: string; phone: string; at: Date; history?: ChatMessage[] },
  snapshot: GuardianSnapshot,
): ManagementSlots | null {
  const text = herdStatement(input.text),
    t = foldHerd(text);
  if (!snapshot.active || !managementCandidate(text) || !safeEdit(text)) return null;
  if (/^(?:transferir|transfira)\s+\d+\s+animais\s+do\s+lote\b/i.test(text)) return null;
  // New entries and registrations remain with their own handlers. Editing is an
  // operation over existing entities, never a birth inferred from a relative clause.
  if (/\blote\b/.test(t) && !/\b(?:despesa|receita|lancamento|anotacao|caderno)\b/.test(t))
    return {
      section: "animals",
      targets: animalTargets(text, snapshot, input.phone, input.at, input.history ?? []),
      ...(lotIn(text) ? { lot: lotIn(text) } : {}),
    };
  if (
    !/\b(?:altere|alterar|mude|mudar|corrija|corrigir|troque|trocar|atualize|atualizar)\b/.test(t)
  )
    return null;
  const section = /\b(?:despesa|receita|financeiro|lancamento)\b/.test(t)
    ? "ledger"
    : /\b(?:anotacao|caderno|registro)\b/.test(t)
      ? "records"
      : null;
  if (!section) return null;
  return {
    section,
    targets: recordTargets(text, section, snapshot),
    changes: changesIn(text, section, input.at),
  };
}
export function managementQuestion(slots: ManagementSlots, snapshot?: GuardianSnapshot) {
  if (!slots.targets.length) {
    const rows =
      slots.section === "animals"
        ? snapshot?.active?.book.animals.map((a) => `${a.code}${a.rgn ? ` (RGN ${a.rgn})` : ""}`)
        : snapshot?.active?.book[slots.section].map((r) => `${r.id}: ${r.description}`);
    return `${slots.section === "animals" ? "Quais animais você quer mudar? Pode dizer os códigos ou “os dois últimos cadastrados”." : "Qual registro você quer alterar? Pode dizer o código ou “a última despesa”, por exemplo."}${rows?.length ? `\nRegistros recentes: ${rows.slice(-5).join("; ")}.` : " Ainda não encontrei uma ficha correspondente nesta fazenda."} Não alterei nenhum registro.`;
  }
  if (slots.section === "animals") return `Para qual lote devo mover ${slots.targets.join(", ")}?`;
  return `O que devo corrigir ${slots.section === "ledger" ? "no lançamento financeiro" : "na anotação"} ${slots.targets.join(", ")}? Pode informar o ${slots.section === "ledger" ? "valor, a data, o lote ou a descrição" : "lote, a data ou a descrição"}.`;
}
export function managementActions(slots: ManagementSlots): GuardianAction[] | null {
  if (!slots.targets.length) return null;
  if (slots.section === "animals" && !slots.lot) return null;
  if (slots.section !== "animals" && !Object.keys(slots.changes ?? {}).length) return null;
  const parsed = slots.targets.map((id) =>
    ActionSchema.safeParse(
      slots.section === "animals"
        ? { kind: "move", code: id, lot: slots.lot }
        : { kind: "edit_record", section: slots.section, id, changes: slots.changes },
    ),
  );
  return parsed.every((r) => r.success) ? parsed.map((r) => r.data!) : null;
}
export function managementAnswer(
  text: string,
  draft: ManagementDraft,
  snapshot: GuardianSnapshot,
  phone: string,
  at: Date,
): ManagementSlots | null {
  if (!safeEdit(text)) return null;
  const next: ManagementSlots = {
    section: draft.section,
    targets: [...draft.targets],
    ...(draft.lot ? { lot: draft.lot } : {}),
    ...(draft.changes ? { changes: { ...draft.changes } } : {}),
  };
  if (!next.targets.length) {
    next.targets =
      next.section === "animals"
        ? animalTargets(text, snapshot, phone, at, [])
        : recordTargets(text, next.section, snapshot);
    if (!next.targets.length) return null;
  } else if (next.section === "animals") {
    const lot = lotIn(text);
    if (!lot) return null;
    next.lot = lot;
  } else {
    const changes = changesIn(text, next.section, at);
    if (!Object.keys(changes).length) return null;
    next.changes = { ...next.changes, ...changes };
  }
  return next;
}
