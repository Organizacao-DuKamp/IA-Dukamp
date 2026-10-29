import { createHash } from "node:crypto";
import { completionIntent, completionTokens, completionText } from "./task-completion-language.ts";
import { applyFarmAction, describeAction, fold } from "./book.ts";
import {
  canEdit,
  farmName,
  type GuardianSnapshot,
  type GuardianTask,
  type GuardianAction,
  type TaskCompletionDraft,
} from "./schema.ts";
import type { GuardianStore, TaskNotification } from "./store.server.ts";
import type { GuardianHandled, GuardianInput } from "./handler.server.ts";
import { farmScopeMatches, eventDay } from "./herd-event-language.ts";
import { namedProperty } from "./property-scope.ts";
import { localDateForTimeZone } from "../whatsapp/proactive.ts";
import { taskClocks } from "./task-time.ts";
import { taskMarkers } from "./task-language.ts";
import { handleTaskBatch } from "./task-batch.server.ts";
import { automaticFarmEvent } from "./automatic.ts";
import { complementaryFarmGoals } from "./compound-goals.ts";

type Property = NonNullable<GuardianSnapshot["active"]>;
type Candidate = { property: Property; task: GuardianTask; notification?: TaskNotification };
const label = (c: Candidate) =>
  `${c.task.title} — ${farmName(c.property.book)}, ${new Date(c.task.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
function focus(history: GuardianInput["history"], c: Candidate) {
  const last = history?.at(-1);
  return (
    last?.role === "assistant" &&
    /concluiu|terminou|ja fez|já fez|quando terminar/i.test(last.content) &&
    (last.content.includes(c.task.id) ||
      (fold(last.content).includes(fold(c.task.title)) &&
        last.content.includes(
          new Date(c.task.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        )))
  );
}
function matches(text: string, c: Candidate, now: Date) {
  const t = completionText(text);
  if (t.includes(fold(c.task.id))) return true;
  const period = eventDay(text, now);
  if (period.invalid || period.ambiguous) return false;
  if (period.day && localDateForTimeZone(new Date(c.task.dueAt)) !== period.day) return false;
  const clock = taskClocks(text);
  if (clock.length) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(c.task.dueAt));
    if (
      !clock.some(
        (x) => parts === `${String(x.hour).padStart(2, "0")}:${String(x.minute).padStart(2, "0")}`,
      )
    )
      return false;
  }
  const lot = t.match(/\blote\s+([\p{L}\d_-]+)/u)?.[1];
  if (lot && fold(c.task.lot ?? c.task.title.match(/\blote\s+(\S+)/i)?.[1] ?? "") !== lot)
    return false;
  const tokens = completionTokens(text).filter(
    (x) => !/^\d+$/.test(x) && !completionTokens(c.property.book.name ?? "").includes(x),
  );
  const title = new Set(completionTokens(c.task.title));
  return tokens.length > 0
    ? tokens.every((x) => title.has(x))
    : !!(period.day || clock.length || lot || t.includes(fold(c.property.book.name ?? "___")));
}
function suffixes(text: string) {
  const marker = taskMarkers(text)[0];
  const other = text.match(
    /(?:\s+e\s+|[.;]\s+)(?=(?:hoje\s+)?(?:comprei|compramos|nasceram|nasceu|paguei|recebi|despesa|receita|anote|registre)\b)/i,
  );
  const indices = [marker?.index, other?.index].filter((x): x is number => x !== undefined);
  const index = indices.length ? Math.min(...indices) : undefined;
  if (index === undefined) return { completion: text, rest: "" };
  return {
    completion: text.slice(0, index).replace(/[,.;!\s]+(?:e\s*)?$/i, ""),
    rest: text.slice(index).replace(/^\s*e\s+/i, ""),
  };
}

export async function handleTaskCompletion(
  input: GuardianInput,
  snapshot: GuardianSnapshot,
  store: GuardianStore,
  now: Date,
  reference: Date,
): Promise<GuardianHandled | "conflict" | null> {
  if (input.mediaType && input.mediaType !== "audio") return null;
  let draft = snapshot.pending?.kind === "task_completion" ? snapshot.pending : null;
  const parts = suffixes(input.text),
    intent = completionIntent(parts.completion);
  if (!intent && !draft) return null;
  if (
    draft &&
    (/^(?:cancelar|cancela|deixa|nao)[.! ]*$/.test(completionText(input.text)) ||
      (Date.parse(draft.expiresAt) <= now.getTime() && !intent))
  ) {
    const pending =
      draft.previousPending && Date.parse(draft.previousPending.expiresAt) > now.getTime()
        ? draft.previousPending
        : null;
    const reply =
      Date.parse(draft.expiresAt) <= now.getTime()
        ? "Essa escolha expirou. Diga qual atividade terminou; nenhuma tarefa foi concluída agora."
        : "Certo, não dei baixa em nenhuma tarefa.";
    const result = await store.commit({
      phone: input.phone,
      messageId: input.messageId,
      accountVersion: snapshot.accountVersion,
      propertyId: snapshot.active?.id ?? null,
      propertyVersion: snapshot.active?.version ?? null,
      operation: "clear",
      pending,
      reply,
    });
    if (result === "conflict") return result;
    if (result !== "committed" && !result.startsWith("replay:"))
      throw Error("guardian_commit_unconfirmed");
    return {
      reply: result.startsWith("replay:") ? result.slice(7) : reply,
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  }
  if (draft && Date.parse(draft.expiresAt) <= now.getTime()) draft = null;

  if (!intent && draft && /\b(?:nao|ainda|vou|talvez)\b/.test(completionText(input.text)))
    return null;
  const named = namedProperty(input.text, snapshot);
  if (/\bfazenda\b/i.test(input.text) && !named && !farmScopeMatches(input.text, snapshot, false))
    return {
      reply: "Não encontrei essa fazenda entre os seus acessos. Nenhuma tarefa foi concluída.",
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  const notifications = store.taskNotifications
    ? await store.taskNotifications(
        input.phone,
        snapshot.properties.map((p) => p.id),
        new Date(reference.getTime() - 86400000).toISOString(),
        input.replyToMessageId,
      )
    : snapshot.lastNotification?.taskId && snapshot.active
      ? [
          {
            ...snapshot.lastNotification,
            propertyId: snapshot.active.id,
            taskId: snapshot.lastNotification.taskId,
            providerId: null,
            answeredAt: null,
          },
        ]
      : [];
  const valid = notifications.filter(
    (n) =>
      snapshot.properties.some((p) => p.id === n.propertyId) &&
      Date.parse(n.sentAt) <= reference.getTime(),
  );
  const properties = new Map<string, Property>();
  if (snapshot.active) properties.set(snapshot.active.id, snapshot.active);
  const ids = new Set([
    ...valid.map((n) => n.propertyId),
    ...(draft?.choices.map((c) => c.propertyId) ?? []),
  ]);
  const loaded = await Promise.all(
    [...ids]
      .filter(
        (id) =>
          !properties.has(id) && snapshot.properties.some((p) => p.id === id) && store.loadProperty,
      )
      .map((id) => store.loadProperty!(input.phone, id)),
  );
  for (const p of loaded) if (p) properties.set(p.id, p);
  const all: Candidate[] = [];
  for (const p of properties.values())
    for (const task of p.book.tasks) {
      if (Date.parse(task.source.sourceAt ?? task.source.at) > reference.getTime()) continue;
      if (
        task.status === "open" &&
        task.updatedAt !== task.source.at &&
        Date.parse(task.updatedAt) > reference.getTime()
      )
        continue;

      const n = valid.find(
        (n) =>
          n.propertyId === p.id &&
          n.taskId === task.id &&
          (task.status !== "open" || !n.taskUpdatedAt || n.taskUpdatedAt === task.updatedAt),
      );
      all.push({ property: p, task, ...(n ? { notification: n } : {}) });
    }
  let choices: Candidate[] = [],
    selected: Candidate[] = [],
    questionOnly = false;
  if (input.replyToMessageId) {
    choices = all.filter((c) => c.notification?.providerId === input.replyToMessageId);
    if (named) choices = choices.filter((c) => c.property.id === named.id);
    if (choices.length !== 1)
      return {
        reply:
          "Esse aviso não corresponde a uma tarefa atual à qual você tenha acesso. Diga a atividade e a fazenda para eu conferir, sem precisar de código.",
        activeProperty: !!snapshot.active,
        persisted: false,
      };
    if (!intent) return null;
    selected = choices;
  } else if (draft) {
    if (
      Date.parse(draft.expiresAt) <= now.getTime() ||
      draft.propertyId !== (snapshot.active?.id ?? null)
    )
      return {
        reply:
          "Essa escolha de tarefa expirou ou a fazenda mudou. Diga qual atividade terminou; nenhuma tarefa foi concluída agora.",
        activeProperty: !!snapshot.active,
        persisted: false,
      };
    const last = input.history?.at(-1);
    if (last?.role === "assistant" && !last.content.includes(draft.question)) return null;
    choices = all.filter((c) =>
      draft.choices.some((x) => x.propertyId === c.property.id && x.taskId === c.task.id),
    );
    const t = completionText(input.text).replace(/[.! ]+$/, "");
    const ordinal = t.match(/^(?:a |o )?(primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|\d+)$/);
    if (ordinal) {
      const index =
        (
          {
            primeira: 1,
            primeiro: 1,
            segunda: 2,
            segundo: 2,
            terceira: 3,
            terceiro: 3,
            quarta: 4,
            quarto: 4,
          } as Record<string, number>
        )[ordinal[1]] ?? Number(ordinal[1]);
      const originalChoice = draft.choices[index - 1];
      selected = originalChoice
        ? all.filter(
            (c) =>
              c.property.id === originalChoice.propertyId && c.task.id === originalChoice.taskId,
          )
        : [];
    } else if (
      /^(?:as duas|ambas|todas|todos)$/.test(t) &&
      new Set(choices.map((c) => c.property.id)).size === 1
    )
      selected = choices;
    else selected = choices.filter((c) => matches(input.text, c, reference));
    if (
      !intent &&
      !ordinal &&
      !selected.length &&
      !/^(?:a de|a do|essa|aquela|primeira|segunda|terceira|quarta)\b/.test(t)
    )
      return null;
  } else {
    const open = all.filter(
      (c) => c.task.status === "open" && (!named || c.property.id === named.id),
    );
    const notified = open.filter((c) => c.notification && !c.notification.answeredAt);
    const focused = notified.filter((c) => focus(input.history, c));
    const specific = open.filter((c) => matches(parts.completion, c, reference));
    if (
      !specific.length &&
      !notified.length &&
      completionTokens(parts.completion).length === 0 &&
      !/\b(?:todas as tarefas|todas tarefas|as duas tarefas)\b/.test(
        completionText(parts.completion),
      )
    ) {
      const closed = all
        .filter((c) => c.task.status === "done" && c.notification)
        .sort((a, b) => Date.parse(b.notification!.sentAt) - Date.parse(a.notification!.sentAt));
      if (closed.length)
        return {
          reply: `A tarefa do último aviso, “${closed[0].task.title}”, já consta como concluída em ${farmName(closed[0].property.book)}. Para outra tarefa, diga só a atividade.`,
          activeProperty: !!snapshot.active,
          persisted: false,
        };
    }

    const previousQuestion = input.history?.at(-1);
    if (
      intent === "strong" &&
      !/\b(?:tarefa|lembrete)\b/.test(completionText(parts.completion)) &&
      completionTokens(parts.completion).length === 0 &&
      previousQuestion?.role === "assistant" &&
      !focused.length
    )
      return null;

    if (specific.length) choices = specific;
    else if (
      completionTokens(parts.completion).filter(
        (x) => !completionTokens(named?.name ?? "").includes(x),
      ).length === 0
    ) {
      if (focused.length === 1) choices = focused;
      else if (intent === "strong" && notified.length) choices = notified;
      else if (intent === "strong")
        choices = open.filter((c) => c.property.id === snapshot.active?.id);
    }
    if (intent === "ack" && focused.length !== 1) return null;
    if (
      /\b(?:todas as tarefas|todas tarefas|as duas tarefas)\b/.test(
        completionText(parts.completion),
      )
    ) {
      choices = open.filter((c) => c.property.id === (named?.id ?? snapshot.active?.id));
      selected = choices;
    } else if (choices.length === 1) selected = choices;
  }
  if (!choices.length && !selected.length) {
    const done = all.filter(
      (c) => c.task.status === "done" && matches(parts.completion, c, reference),
    );
    if (done.length === 1)
      return {
        reply: `A tarefa “${done[0].task.title}” de ${farmName(done[0].property.book)} já consta como concluída. Não alterei nem repeti o registro.`,
        activeProperty: !!snapshot.active,
        persisted: false,
      };
    if (!/\b(?:tarefa|lembrete|conclui|terminei|finalizei)\b/.test(completionText(input.text)))
      return null;
    return {
      reply:
        "Qual atividade você terminou? Pode dizer “já dei ração” ou “terminei a limpeza do curral”. Não precisa de código.",
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  }
  if (
    selected.length !== 1 &&
    !(selected.length > 1 && new Set(selected.map((c) => c.property.id)).size === 1)
  )
    questionOnly = true;
  if (questionOnly || !selected.length) {
    const question =
      "Qual destas você terminou? Pode responder pelo nome da atividade ou pela posição:\n" +
      choices
        .slice(0, 8)
        .map((c, i) => `${i + 1}. ${label(c)}`)
        .join("\n");
    const pending: TaskCompletionDraft = {
      kind: "task_completion",
      propertyId: snapshot.active?.id ?? null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60000).toISOString(),
      sourceMessageId: draft?.sourceMessageId ?? input.messageId,
      sourceAt: draft?.sourceAt ?? reference.toISOString(),
      choices: choices.slice(0, 8).map((c) => ({ propertyId: c.property.id, taskId: c.task.id })),
      question,
      ...(draft?.previousPending
        ? { previousPending: draft.previousPending }
        : snapshot.pending && snapshot.pending.kind !== "task_completion"
          ? { previousPending: snapshot.pending }
          : {}),
    };
    const result = await store.commit({
      phone: input.phone,
      messageId: input.messageId,
      accountVersion: snapshot.accountVersion,
      propertyId: snapshot.active?.id ?? null,
      propertyVersion: snapshot.active?.version ?? null,
      operation: "pending",
      pending,
      reply: question,
    });
    if (result === "conflict") return result;
    if (result !== "committed" && !result.startsWith("replay:"))
      throw Error("guardian_commit_unconfirmed");
    return {
      reply: result.startsWith("replay:") ? result.slice(7) : question,
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  }
  const property = selected[0].property;
  if (selected.some((c) => c.task.status === "cancelled"))
    return {
      reply:
        "Essa tarefa está cancelada. Não alterei o registro; diga a atividade pendente que deseja concluir.",
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  if (selected.every((c) => c.task.status === "done"))
    return {
      reply: `Já consta como concluída: ${selected.map((c) => c.task.title).join("; ")}. Não repeti a baixa.`,
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  const actions: GuardianAction[] = selected
    .filter((c) => c.task.status === "open")
    .map((c) => ({ kind: "task_update", task: c.task.id, status: "done" }));
  const previous = draft?.previousPending;
  const pending = draft
    ? previous && Date.parse(previous.expiresAt) > now.getTime()
      ? previous
      : null
    : snapshot.pending?.kind === "task_completion"
      ? null
      : snapshot.pending;
  const notification = selected.find((c) => c.notification)?.notification;
  if (parts.rest && taskMarkers(parts.rest).length) {
    return handleTaskBatch(
      { ...input, text: parts.rest },
      { ...snapshot, active: property },
      store,
      now,
      reference,
      { actions, pending, replyToEventId: notification?.id },
    );
  }
  if (parts.rest) {
    const observation = automaticFarmEvent(
      { text: parts.rest, at: reference },
      { ...snapshot, active: property },
    );
    if (observation.status === "pending")
      return {
        reply:
          "Preciso esclarecer os dados do outro pedido antes de salvar. Nenhuma alteração deste envio foi confirmada.",
        activeProperty: !!snapshot.active,
        persisted: false,
      };
    const other = complementaryFarmGoals(
      parts.rest,
      observation.status === "batch"
        ? observation.actions
        : observation.status === "action"
          ? [observation.action]
          : [],
      { ...snapshot, active: property },
      input.phone,
      reference,
    );
    if (!other.actions.length || other.question)
      return {
        reply:
          other.question ??
          "Não consegui identificar o outro pedido com segurança. Nenhuma alteração deste envio foi confirmada.",
        activeProperty: !!snapshot.active,
        persisted: false,
      };
    actions.push(...other.actions);
  }
  if (!actions.every((a) => canEdit(property.role, a)))
    return {
      reply: "Seu acesso não permite estas alterações na fazenda. Nenhuma tarefa foi concluída.",
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  let book = property.book;
  const events: ReturnType<typeof applyFarmAction>["events"] = [];
  for (const [i, action] of actions.entries()) {
    const r = applyFarmAction(
      book,
      action,
      property.role,
      {
        actor: input.phone,
        messageId: input.messageId,
        sourceAt: draft?.sourceAt ?? reference.toISOString(),
        at: now.toISOString(),
        confirmed: true,
      },
      createHash("sha256")
        .update(input.phone + ":" + input.messageId + ":" + i)
        .digest("hex")
        .slice(0, 12),
    );
    book = r.book;
    events.push(...r.events);
  }
  const reply =
    `Concluída${selected.length > 1 ? "s" : ""} e salva${selected.length > 1 ? "s" : ""} em ${farmName(book)}: ${selected.map((c) => `“${c.task.title}”`).join("; ")}.` +
    (actions.length > selected.length
      ? "\n" +
        actions
          .filter((a) => a.kind !== "task_update")
          .map((a) => `• ${describeAction(a)}`)
          .join("\n")
      : "");
  const result = await store.commit({
    phone: input.phone,
    messageId: input.messageId,
    accountVersion: snapshot.accountVersion,
    propertyId: property.id,
    propertyVersion: property.version,
    operation: "update",
    book,
    pending,
    events,
    reply,
    details: {
      kind: "task_update",
      taskIds: selected.map((c) => c.task.id),
      naturalCompletion: true,
      sourceMessageId: draft?.sourceMessageId ?? input.messageId,
      sourceAt: draft?.sourceAt ?? reference.toISOString(),
      ...(draft ? { confirmedBy: input.messageId } : {}),
      ...(notification ? { replyToEventId: notification.id } : {}),
    },
  });
  if (result === "conflict") return result;
  if (result !== "committed" && !result.startsWith("replay:"))
    throw Error("guardian_commit_unconfirmed");
  return {
    reply: result.startsWith("replay:") ? result.slice(7) : reply,
    activeProperty: !!snapshot.active,
    persisted: true,
  };
}
