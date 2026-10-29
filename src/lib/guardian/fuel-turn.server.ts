import { amountIn, moneyValue } from "./record-dialogue.ts";
import { userStatement } from "../whatsapp/learned-notes.ts";
import { createHash } from "node:crypto";
import { fuelObservation, fuelFold, fuelTopic, fuelPeriod } from "./fuel-language.ts";
import { fuelMonth, fuelNames, fuelStocks, ledgerFuel } from "./fuel.ts";
import { applyFarmAction, describeAction } from "./book.ts";
import {
  canEdit,
  farmName,
  farmActionFamily,
  FarmBookSchema,
  type GuardianSnapshot,
  type FuelDraft,
} from "./schema.ts";
import type { GuardianStore } from "./store.server.ts";
import type { GuardianInput, GuardianHandled } from "./handler.server.ts";
import { hasTaskIntent } from "./task-language.ts";
import { eventDay, farmScopeMatches } from "./herd-event-language.ts";
import { automaticFarmEvent } from "./automatic.ts";
import { complementaryFarmGoals } from "./compound-goals.ts";

export async function handleFuelTurn(
  input: GuardianInput,
  s: GuardianSnapshot,
  store: GuardianStore,
  now: Date,
  reference: Date,
): Promise<GuardianHandled | "conflict" | null> {
  if (input.mediaType && input.mediaType !== "audio") return null;
  const draft = s.pending?.kind === "fuel_draft" ? s.pending : null;
  let continuationText: string | undefined;
  if (!fuelTopic(input.text) && !draft) {
    if (!s.active) return null;
    const history = input.history ?? [],
      last = history.at(-1);
    const extra = input.text
      .trim()
      .match(/^(?:e[ ,]+)?(?:(hoje|ontem)[ ,]+)?(?:mais|gastei mais|paguei mais)\s+(.+?)[.! ]*$/i);
    if (
      extra &&
      last?.role === "assistant" &&
      last.content.startsWith(`Salvo em ${farmName(s.active.book)}:`)
    ) {
      const previous = history
        .slice(0, -1)
        .reverse()
        .find((x) => x.role === "user");
      const o = previous ? fuelObservation(userStatement(previous.content), reference) : null,
        amount = moneyValue(extra[2]);
      if (
        o?.status === "actions" &&
        o.actions.every((a) => a.kind === "fuel_expense") &&
        new Set(o.actions.map((a) => (a.kind === "fuel_expense" ? a.fuel : ""))).size === 1 &&
        amount
      ) {
        const a = o.actions[0];
        if (a.kind === "fuel_expense")
          continuationText = `${extra[1] ?? "hoje"} gastei R$ ${(amount / 100).toFixed(2).replace(".", ",")} com ${fuelNames[a.fuel].toLowerCase()}`;
      }
    }
    if (!continuationText) return null;
  }
  if (hasTaskIntent(input.text)) return null;
  const active = s.active;
  if (!active)
    return {
      reply: "Selecione a fazenda autorizada para consultar ou registrar combustível.",
      activeProperty: false,
      persisted: false,
    };
  const last = input.history?.at(-1);
  let text = continuationText ?? input.text,
    origin = input.messageId,
    sourceAt = reference.toISOString();
  const commit = async (
    book: typeof active.book | undefined,
    pending: typeof s.pending,
    reply: string,
    details: Record<string, unknown>,
    events: ReturnType<typeof applyFarmAction>["events"] = [],
  ) => {
    const result = await store.commit({
      phone: input.phone,
      messageId: input.messageId,
      accountVersion: s.accountVersion,
      propertyId: active.id,
      propertyVersion: active.version,
      operation: book ? "update" : "pending",
      ...(book ? { book } : {}),
      pending,
      reply,
      details,
      events,
    });
    if (result === "conflict") return result;
    if (result !== "committed" && !result.startsWith("replay:"))
      throw Error("guardian_commit_unconfirmed");
    return {
      reply: result.startsWith("replay:") ? result.slice(7) : reply,
      activeProperty: true,
      persisted: !!book,
    };
  };
  const restore =
    draft?.previousPending && Date.parse(draft.previousPending.expiresAt) > now.getTime()
      ? draft.previousPending
      : null;
  if (draft && /^(?:cancela|cancelar|deixa)[.! ]*$/.test(fuelFold(text)))
    return commit(
      undefined,
      restore,
      "Pedido de combustível cancelado. Nenhum lançamento novo foi feito.",
      {},
    );
  let repeatConfirmed = false;
  if (draft?.repeatCheck && !fuelTopic(text)) {
    const same = /^(?:o mesmo|a mesma|mesmo|mesma|sim[, ]+o mesmo)[.! ]*$/.test(fuelFold(text));
    if (same)
      return commit(
        undefined,
        restore,
        "Esse registro já estava salvo. Não dupliquei o lançamento de combustível.",
        {},
      );
    repeatConfirmed = /^(?:outro|outra|e outro|e outra|novo|nova)[.! ]*$/.test(fuelFold(text));
    if (!repeatConfirmed) return { reply: draft.question, activeProperty: true, persisted: false };
  }
  if (draft && !fuelTopic(text)) {
    if (draft.propertyId !== active.id || Date.parse(draft.expiresAt) <= now.getTime())
      return commit(
        undefined,
        restore,
        "O pedido de combustível expirou ou a fazenda mudou. Conte novamente apenas esse registro.",
        {},
      );
    if (last?.role === "assistant" && !last.content.includes(draft.question)) return null;
    if (!/^(?:[\p{L}\d$.,/ _-]){1,160}[.! ]*$/u.test(text)) return null;
    const answer = fuelFold(text);
    if (/\b(?:rebanho|bezerro|nasceu|nasceram|racao|tarefa|clima|chuva|tempo)\b/.test(answer))
      return null;
    if (/litros/.test(draft.question) && /^\d+(?:[.,]\d+)?$/.test(answer)) text += " litros";
    else if (/tanque/.test(draft.question)) text = "tanque " + text;
    else if (/Para onde/.test(draft.question)) text = "para " + text;
    else if (/valor gasto/.test(draft.question) && /^\d+(?:[.,]\d+)?$/.test(answer))
      text = "R$ " + text;
    text = draft.text + (repeatConfirmed ? " outro lançamento" : " " + text);
    origin = draft.sourceMessageId;
    sourceAt = draft.sourceAt;
  } else if (draft && /^(?:diesel|gasolina|etanol)[.! ]*$/.test(fuelFold(text))) {
    text = draft.text + " " + text;
    origin = draft.sourceMessageId;
    sourceAt = draft.sourceAt;
  }
  const justSelected =
    last?.role === "assistant" && last.content.startsWith("Fazenda selecionada:");
  if (!farmScopeMatches(text, s, !!justSelected))
    return {
      reply:
        "De qual fazenda é esse combustível? Selecione a propriedade correta para não misturar os tanques.",
      activeProperty: true,
      persisted: false,
    };
  let observed = fuelObservation(text, new Date(sourceAt));
  const cancel = /\b(?:cancele|cancela|cancelar|desfaca|estorne|anule|apague|exclua)\b/.test(
    fuelFold(text),
  );
  if (cancel && observed.status !== "ignored") {
    const t = fuelFold(text),
      fuel = /\bdiesel\b/.test(t)
        ? "diesel"
        : /\bgasolina\b/.test(t)
          ? "gasoline"
          : /\b(?:etanol|alcool)\b/.test(t)
            ? "ethanol"
            : null;
    const period = fuelPeriod(text, new Date(sourceAt)),
      date = eventDay(text, new Date(sourceAt));
    const money = amountIn(text)?.amount;
    const movements =
      /\b(?:entrada|saida|saldo|litros)\b/.test(t) && !/\b(?:gasto|despesa|valor)\b/.test(t);
    const quantity = t.match(/(\d+(?:[.,]\d+)?)\s*(?:litros?|l)\b/)?.[1];
    let candidates = movements
      ? (active.book.fuel?.movements ?? []).filter(
          (x) =>
            !x.voided &&
            (!fuel || x.fuel === fuel) &&
            (!period || x.date.startsWith(period)) &&
            (!date.day || period || x.date === date.day) &&
            (!quantity || x.liters === Number(quantity.replace(",", "."))) &&
            (!/\bentrada\b/.test(t) || x.type === "in") &&
            (!/\bsaida\b/.test(t) || x.type === "out"),
        )
      : active.book.ledger.filter(
          (e) =>
            !e.voided &&
            ledgerFuel(e) !== null &&
            (!fuel || ledgerFuel(e) === fuel) &&
            (!period || (e.periodMonth ?? e.date.slice(0, 7)) === period) &&
            (!date.day || period || e.date === date.day) &&
            (!money || e.amountCents === money),
        );
    candidates = candidates.slice().sort((a, b) => b.source.at.localeCompare(a.source.at));
    if (/\b(?:ultima|ultimo)\b/.test(t)) candidates = candidates.slice(0, 1);
    if (date.invalid || (date.ambiguous && !period))
      observed = {
        status: "pending",
        question: "Qual é a data correta do registro de combustível que deseja cancelar?",
        residual: text,
      };
    else if (candidates.length === 1)
      observed = {
        status: "actions",
        actions: [
          {
            kind: "fuel_void",
            id: candidates[0].id,
            reason: "Cancelamento solicitado pelo produtor em conversa",
          },
        ],
        residual: "",
      };
    else
      observed = {
        status: "pending",
        question: candidates.length
          ? "Qual foi o valor gasto ou a data do registro de combustível que deseja cancelar? Você também pode dizer “último”."
          : "Não encontrei esse registro de combustível. Qual foi o valor gasto, a data ou a movimentação?",
        residual: text,
      };
  }
  if (observed.status === "none") return null;
  if (observed.status === "ignored")
    return {
      reply:
        "Não fiz lançamento de combustível desse relato. Para registrar, informe o que realmente entrou, saiu ou foi gasto na sua fazenda; para corrigir um valor mensal, informe o total correto e o mês.",
      activeProperty: true,
      persisted: false,
    };
  if (observed.status === "query") {
    const month =
      observed.month ??
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
        .format(reference)
        .slice(0, 7);
    const q = fuelFold(text),
      typed = [
        /\bdiesel\b/.test(q) ? "diesel" : null,
        /\bgasolina\b/.test(q) ? "gasoline" : null,
        /\b(?:etanol|alcool)\b/.test(q) ? "ethanol" : null,
      ].filter(Boolean);
    const queryFuel = typed.length === 1 ? (typed[0] as "diesel" | "gasoline" | "ethanol") : "all";
    const summary = fuelMonth(active.book, month, queryFuel),
      cash = (n: number) =>
        (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    let reply =
      `Combustível de ${farmName(active.book)} — ${month.slice(5)}/${month.slice(0, 4)}\nGastos registrados: ${cash(summary.expenseCents)}\nEntradas: ${summary.entered.toLocaleString("pt-BR")} L · Saídas: ${summary.exited.toLocaleString("pt-BR")} L\n` +
      summary.stocks
        .map(
          (x) =>
            `${fuelNames[x.fuel]}, tanque ${x.tank}: ${x.liters === null ? "saldo não informado" : x.liters.toLocaleString("pt-BR") + " L"}`,
        )
        .join("\n") +
      (summary.destinations.length
        ? "\nDestinos:\n" +
          summary.destinations
            .map(
              (x) =>
                `${x.name}: ${x.liters.toLocaleString("pt-BR")} L de ${fuelNames[x.fuel].toLowerCase()}`,
            )
            .join("\n")
        : "");
    if (!summary.stocks.length) reply += "Saldo dos tanques ainda não informado.";
    if (observed.compare) {
      const prior = new Date(month + "-01T12:00:00Z");
      prior.setUTCMonth(prior.getUTCMonth() - 1);
      const m = prior.toISOString().slice(0, 7),
        p = fuelMonth(active.book, m, queryFuel);
      reply += `\nMês anterior (${m.slice(5)}/${m.slice(0, 4)}): ${cash(p.expenseCents)}, entradas ${p.entered.toLocaleString("pt-BR")} L e saídas ${p.exited.toLocaleString("pt-BR")} L. Valores registrados; ausência de lançamento não comprova consumo zero.`;
    }
    return { reply, activeProperty: true, persisted: false };
  }
  if (!["owner", "manager"].includes(active.role))
    return {
      reply: "Seu perfil não permite administrar combustível e despesas desta fazenda.",
      activeProperty: true,
      persisted: false,
    };
  let question = observed.status === "pending" ? observed.question : undefined;
  if (observed.status === "actions")
    for (const a of observed.actions) {
      if (a.kind !== "fuel_movement" || a.tank !== "Principal") continue;
      const tanks = fuelStocks(active.book).filter((x) => x.fuel === a.fuel);
      if (tanks.length > 1 && !/\btanque\s+/i.test(text))
        question = `De qual tanque é o combustível: ${tanks.map((x) => x.tank).join(", ")}?`;
      else if (tanks.length === 1 && !/\btanque\s+/i.test(text)) a.tank = tanks[0].tank;
    }
  if (question) {
    const pending: FuelDraft = {
      kind: "fuel_draft",
      propertyId: active.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60000).toISOString(),
      text,
      question,
      sourceMessageId: origin,
      sourceAt,
      ...(draft?.previousPending
        ? { previousPending: draft.previousPending }
        : s.pending && s.pending.kind !== "fuel_draft"
          ? { previousPending: s.pending }
          : {}),
    };
    return commit(undefined, pending, question + " Ainda não salvei esse pedido.", {});
  }
  if (observed.status !== "actions") return null;
  const automatic = cancel
    ? { status: "none" as const }
    : automaticFarmEvent({ text, at: new Date(sourceAt) }, s);
  if (automatic.status === "pending")
    return {
      reply:
        automatic.reply ??
        "Preciso esclarecer o outro acontecimento antes de salvar esta mensagem. Nenhum item foi salvo.",
      activeProperty: true,
      persisted: false,
    };
  const others =
    automatic.status === "batch"
      ? automatic.actions
      : automatic.status === "action"
        ? [automatic.action]
        : [];
  const combined = cancel
    ? { actions: observed.actions, question: undefined }
    : complementaryFarmGoals(
        text,
        [...observed.actions, ...others.filter((a) => !a.kind.startsWith("fuel_"))],
        s,
        input.phone,
        new Date(sourceAt),
      );
  if (combined.question)
    return {
      reply: combined.question + " Nenhum item deste pedido foi salvo.",
      activeProperty: true,
      persisted: false,
    };
  const actions = combined.actions;
  if (!actions.every((a) => canEdit(active.role, a)))
    return {
      reply: "Seu perfil não permite todos os registros deste pedido. Nenhum item foi salvo.",
      activeProperty: true,
      persisted: false,
    };
  const repeated =
    !repeatConfirmed &&
    !/\b(?:outro|outra|novo|nova|mais|tambem)\b/.test(fuelFold(input.text)) &&
    actions.some((a) => {
      if (a.kind === "fuel_expense")
        return active.book.ledger.some(
          (e) =>
            !e.voided &&
            ledgerFuel(e) === a.fuel &&
            e.amountCents === a.amountCents &&
            e.date === a.date &&
            e.periodMonth === a.periodMonth &&
            e.source.actor === input.phone &&
            (!!a.periodMonth || Date.parse(e.source.at) > now.getTime() - 15 * 60000),
        );
      if (a.kind === "fuel_movement")
        return (active.book.fuel?.movements ?? []).some(
          (e) =>
            !e.voided &&
            e.fuel === a.fuel &&
            fuelFold(e.tank) === fuelFold(a.tank) &&
            e.type === a.type &&
            e.liters === a.liters &&
            e.date === a.date &&
            fuelFold(e.destination ?? "") === fuelFold(a.destination ?? "") &&
            e.source.actor === input.phone &&
            Date.parse(e.source.at) > now.getTime() - 15 * 60000,
        );
      return false;
    });
  if (repeated) {
    const question =
      "Encontrei um registro igual de combustível. Você está repetindo o mesmo registro ou é outro? Responda “o mesmo” ou “outro”.";
    const pending: FuelDraft = {
      kind: "fuel_draft",
      repeatCheck: true,
      propertyId: active.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60000).toISOString(),
      text,
      question,
      sourceMessageId: origin,
      sourceAt,
      ...(s.pending && s.pending.kind !== "fuel_draft" ? { previousPending: s.pending } : {}),
    };
    return commit(undefined, pending, question, {});
  }
  let book = active.book;
  const events: ReturnType<typeof applyFarmAction>["events"] = [];
  try {
    for (const [i, a] of actions.entries()) {
      const aId = createHash("sha256")
        .update(input.phone + ":" + input.messageId + ":" + i)
        .digest("hex")
        .slice(0, 20);
      const r = applyFarmAction(
        book,
        a,
        active.role,
        { actor: input.phone, messageId: origin, at: now.toISOString(), sourceAt, confirmed: true },
        aId,
      );
      book = r.book;
      events.push(...r.events);
    }
    FarmBookSchema.parse(book);
  } catch (e) {
    return {
      reply:
        (e instanceof Error ? e.message : "Confira os dados de combustível.") +
        " Nenhum item deste pedido foi salvo.",
      activeProperty: true,
      persisted: false,
    };
  }
  return commit(
    book,
    draft ? restore : s.pending,
    `Salvo em ${farmName(book)}:\n` + actions.map((a) => `• ${describeAction(a)}`).join("\n"),
    {
      kind: farmActionFamily(actions[0]),
      actionKind: actions[0].kind,
      events: actions,
      sourceMessageId: origin,
      sourceAt,
      ...(draft ? { confirmedBy: input.messageId } : {}),
    },
    events,
  );
}
