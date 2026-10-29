import { complementaryFarmGoals, compoundRestAnswer } from "./compound-goals.ts";
import { taskMarkers, recoverTaskContext } from "./task-language.ts";
import { createHash } from "node:crypto";
import { automaticFarmEvent } from "./automatic.ts";
import { applyFarmAction, describeAction, fold } from "./book.ts";
import { parseDueDate, parseGuardianRequest } from "./parse.ts";
import { normalizeTaskClock, taskClocks, removeTaskClocks } from "./task-time.ts";
import { farmScopeMatches } from "./herd-event-language.ts";
import { identificationAfterEntry, identificationQuestion } from "./herd-identification.ts";
import {
  canEdit,
  farmName,
  type GuardianAction,
  type GuardianSnapshot,
  type TaskBatchDraft,
} from "./schema.ts";
import type { GuardianStore } from "./store.server.ts";
import type { GuardianInput, GuardianHandled } from "./handler.server.ts";
import { localDateForTimeZone } from "../whatsapp/proactive.ts";
import { recordDialogue, recordActions } from "./record-dialogue.ts";
import { stockAt } from "./operations.ts";

const dayPattern =
  /(?<![\p{L}\d])(?:hoje|amanh[ãa]|depois de amanh[ãa]|(?:pr[oó]xim[ao] )?(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?|(?:dia )?\d{1,2}\/\d{1,2}(?:\/20\d{2})?|20\d{2}-\d{2}-\d{2}|(?:daqui a|em) \d+ dias?)(?![\p{L}\d])/giu;

function task(text: string, reference: Date, now: Date, zone: string) {
  const normalized = normalizeTaskClock(text);
  const clocks = taskClocks(text);
  const days = text.match(dayPattern) ?? [];
  // Clock-only scheduling explicitly means today; never silently move it to tomorrow.
  const dated = days.length ? normalized : `${normalized} hoje`;
  const due = parseDueDate(dated, reference, zone);
  const title = removeTaskClocks(text)
    .replace(dayPattern, " ")
    .replace(/^(?:[\s,.:;!]+|(?:tamb[eé]m|de|para|pra|eu|uma|outra|primeira|segunda)\b\s*)+/gi, "")
    .replace(/(?:[, ]*(?:ok|t[aá]|por favor|por a[ií])[.!?]*)+$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;: ]+|[,.;:!? ]+$/g, "")
    .trim();
  if (clocks.length === 1 && clocks[0].ambiguous)
    return {
      missing: "date" as const,
      question: `Você quer ${clocks[0].hour}h${String(clocks[0].minute).padStart(2, "0")} da manhã ou ${clocks[0].hour + 12}h${String(clocks[0].minute).padStart(2, "0")} da tarde/noite?`,
    };
  if (clocks.length > 1 || days.length > 1)
    return {
      missing: "date" as const,
      question: "Qual é a única data e horário desejados para essa tarefa?",
    };
  if (
    !due ||
    (clocks.length === 0 && days.length === 0) ||
    (due && Date.parse(due) <= now.getTime())
  )
    return {
      missing: "date" as const,
      question:
        clocks.length && (!due || Date.parse(due) <= now.getTime())
          ? "Esse horário não é futuro na data informada, no horário de Brasília. Qual data e horário devo usar?"
          : "Qual dia e horário devo usar para essa tarefa?",
    };
  if (!title || /^(?:me|isso|essa tarefa|tarefa)$/i.test(title))
    return { missing: "title" as const, question: "O que devo lembrar você de fazer?" };
  const lot = title.match(/\blote\s+([\p{L}\d_-]+)/iu)?.[1];
  return {
    action: { kind: "task_create", title, dueAt: due, ...(lot ? { lot } : {}) } as GuardianAction,
  };
}

function splitTimedTasks(text: string): string[] {
  for (const conjunction of text.matchAll(
    /\s+e\s+(?!(?:meia|quinze|trinta|quarenta|um|dois|tres)\b)|;\s*/gi,
  )) {
    const left = text.slice(0, conjunction.index),
      right = text.slice(conjunction.index! + conjunction[0].length);
    if (taskClocks(left).length && taskClocks(right).length)
      return [...splitTimedTasks(left), ...splitTimedTasks(right)];
  }
  return [text];
}

/** Explicit multi-objective requests use one versioned commit, without an LLM acknowledgement. */
export async function handleTaskBatch(
  input: GuardianInput,
  snapshot: GuardianSnapshot,
  store: GuardianStore,
  now: Date,
  reference: Date,
  additional?: {
    actions: GuardianAction[];
    pending: GuardianSnapshot["pending"];
    replyToEventId?: string;
  },
): Promise<GuardianHandled | "conflict" | null> {
  if (input.mediaType && input.mediaType !== "audio") return null;
  const incomingText = input.text;
  const recovered = recoverTaskContext(input.text, input.history, snapshot, now);
  if (recovered) input = { ...input, text: recovered.text };
  const matches = taskMarkers(input.text);
  const previous = snapshot.pending?.kind === "task_batch" ? snapshot.pending : null;
  // Preserve the existing confirmation flow for a single conventional task.
  const combined =
    matches.length > 1 ||
    (matches.length === 1 &&
      /\b(?:comprei|compramos|nasceram|nasceu|morreu|morreram|vendi|vendemos|despesa|receita|paguei|recebi|selecione|selecionar|usar fazenda|adicione|registre|anote|cadastre|remova|altere)\b/i.test(
        input.text,
      ));
  const spoken =
    matches.length &&
    /\b(?:uma?|duas?|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+(?:e meia|da tarde|da noite|da manh[ãa])/i.test(
      input.text,
    );
  const newTaskWording = matches.some(
    (m) => !/^(?:me lembr[ae]|criar tarefa|crie uma tarefa|agende|agendar)$/i.test(m[0]),
  );
  if (!additional && !combined && !spoken && !previous && !recovered && !newTaskWording)
    return null;
  if (
    /\b(?:n[aã]o me (?:lembr[ae]|avis[ae]r?|mand[ae])|vizinh[oa]|disse|falou|suponha|hipot[eé]tic|exemplo|simule|ser[aá] que|como (?:criar|agendar))\b|["“”]|(?:^|\n)\s*>/i.test(
      input.text,
    )
  )
    return {
      reply:
        "Não executei pedidos negados, hipotéticos ou atribuídos a outra pessoa. Envie os pedidos que deseja realizar na sua fazenda.",
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  if (!snapshot.active || !farmScopeMatches(input.text, snapshot, false))
    return {
      reply: "Selecione uma única fazenda autorizada para estes pedidos. Nenhum item foi salvo.",
      activeProperty: !!snapshot.active,
      persisted: false,
    };
  const active = snapshot.active;
  let rest: string,
    texts: string[],
    sourceMessageId = input.messageId,
    sourceAt = recovered?.sourceAt ?? reference.toISOString();
  if (recovered) {
    sourceMessageId = recovered.sourceMessageId;
    reference = new Date(recovered.sourceAt);
  }
  if (previous && !matches.length) {
    if (previous.propertyId !== active.id || Date.parse(previous.expiresAt) <= now.getTime())
      return {
        reply:
          "O pedido pendente expirou ou a fazenda mudou. Reenvie os pedidos na fazenda correta. Nenhum item foi salvo.",
        activeProperty: true,
        persisted: false,
      };
    if (/^(?:cancelar|cancela|deixa|n[aã]o)[.! ]*$/i.test(input.text)) {
      const cancelReply = previous.completedTasks?.length
        ? "Pendência cancelada. A tarefa já salva continua no painel."
        : "Pedido cancelado. Nenhum item foi salvo.";
      const result = await store.commit({
        phone: input.phone,
        messageId: input.messageId,
        accountVersion: snapshot.accountVersion,
        propertyId: active.id,
        propertyVersion: active.version,
        operation: "clear",
        pending: null,
        reply: cancelReply,
      });
      if (result !== "committed" && result !== "conflict" && !result.startsWith("replay:"))
        throw Error("guardian_commit_unconfirmed");
      return result === "conflict"
        ? result
        : {
            reply: cancelReply,
            activeProperty: true,
            persisted: false,
          };
    }
    // A follow-up fills only the requested slot. An unrelated turn cannot execute a suspended batch.
    let answer = fold(input.text).replace(
      /^(?:ele )?(?:pode colocar|pode ser|coloque|coloca|para|pra)\s+/,
      "",
    );
    if (
      /^(?:uma?|duas?|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+(?:e meia|da tarde|da noite|da manha)/.test(
        answer,
      )
    )
      answer = "as " + answer;
    const temporal =
      /^(?:(?:as?|hoje|amanha|depois de amanha|dia|na|no|em|proxima?|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b|\d)/.test(
        answer,
      );
    if (previous.missing === "date" && !temporal)
      return { reply: previous.question, activeProperty: true, persisted: false };
    if (
      previous.missing === "title" &&
      (/^(?:sim|ok|confirmar|confirmo)[.! ]*$/.test(answer) || input.text.length > 200)
    )
      return { reply: previous.question, activeProperty: true, persisted: false };
    const lastPrompt = input.history?.at(-1);
    if (lastPrompt?.role === "assistant" && !lastPrompt.content.includes(previous.question))
      return { reply: null, activeProperty: true, persisted: false, conversational: true };
    rest =
      previous.missing === "record"
        ? compoundRestAnswer(previous.rest, input.text, new Date(previous.sourceAt))
        : previous.rest;
    texts = [...previous.taskTexts];
    const old = texts[previous.missingIndex];
    const hasClock = taskClocks(answer).length > 0;
    const hasDay = !!answer.match(dayPattern);
    if (previous.missing !== "record")
      texts[previous.missingIndex] =
        previous.missing === "title"
          ? `${old} para ${input.text}`
          : (hasClock
              ? removeTaskClocks(hasDay ? old.replace(dayPattern, " ") : old)
              : hasDay
                ? old.replace(dayPattern, " ")
                : old) + ` ${answer}`;
    sourceMessageId = previous.sourceMessageId;
    sourceAt = previous.sourceAt;
    reference = new Date(previous.sourceAt);
  } else {
    rest = input.text
      .slice(0, matches[0].index)
      .replace(/[,.;!\s]+(?:e\s*)?$/i, "")
      .trim();
    texts = matches.map((m, i) =>
      input.text
        .slice(m.index! + m[0].length, matches[i + 1]?.index)
        .replace(/[,.;!\s]+(?:e\s*)?$/i, "")
        .trim(),
    );
    // Explicit commands after the reminder are separate objectives, not part of its title.
    texts = texts.map((text) => {
      const split = text.search(
        /\s+e\s+(?=(?:adicione|registre|anote|nasceram|nasceu|comprei|compramos|paguei|recebi|despesa|receita)\b)/i,
      );
      if (split < 0) return text;
      rest += "; " + text.slice(split).replace(/^\s+e\s+/i, "");
      return text.slice(0, split);
    });
    // Enumerated tasks may share one creation verb; split only where each side has its own clock.
    texts = texts.flatMap((text) => splitTimedTasks(text));
    // A task after a herd or finance clause is supported. Unparsed commands stay pending, never silently disappear.
  }
  if (recovered) {
    const already = (snapshot.active?.book.operations?.movements ?? []).filter(
      (m) => m.source.messageId === sourceMessageId,
    );
    if (!already.length || !(await store.receipt(input.phone, sourceMessageId)))
      return {
        reply:
          "Não consegui confirmar os registros anteriores. Não repeti a entrada; confira a fazenda antes de retomar a tarefa.",
        activeProperty: true,
        persisted: false,
      };
    rest = "";
  }
  if (/\b(?:exclua|apague|remova|cancele)\b/i.test(rest))
    return {
      reply:
        "Esse pedido inclui uma alteração que precisa ser conferida separadamente. Nenhum item foi salvo; informe a alteração com o registro correspondente.",
      activeProperty: true,
      persisted: false,
    };
  let recordQuestion: string | undefined;
  let observation = automaticFarmEvent({ text: rest, at: reference }, snapshot);
  if (observation.status === "pending") {
    if (observation.reason === "ambiguous_property")
      return {
        reply: "De qual fazenda são estes pedidos? Nenhum item foi salvo em propriedade incerta.",
        activeProperty: true,
        persisted: false,
      };
    recordQuestion =
      observation.reply ?? "Qual é a quantidade e a data do acontecimento que ficou pendente?";
  }
  if (observation.status === "none" && rest) {
    const dialogue = recordDialogue(rest, reference);
    const records = dialogue.kind === "slots" ? recordActions(dialogue.slots) : null;
    if (records?.length)
      observation =
        records.length === 1
          ? { status: "action", action: records[0] }
          : { status: "batch", actions: records };
    const parsed =
      observation.status === "none" ? parseGuardianRequest(rest, snapshot, reference) : null;
    if (
      parsed?.kind === "action" &&
      ["ledger", "record", "animal", "move", "weighing"].includes(parsed.action.kind)
    )
      observation = { status: "action", action: parsed.action };
  }
  const extra = complementaryFarmGoals(
    rest,
    observation.status === "batch"
      ? observation.actions
      : observation.status === "action"
        ? [observation.action]
        : [],
    snapshot,
    input.phone,
    reference,
  );
  if (extra.actions.length)
    observation =
      extra.actions.length === 1
        ? { status: "action", action: extra.actions[0] }
        : { status: "batch", actions: extra.actions };
  if (extra.question) recordQuestion = extra.question;
  const selectionOnly =
    fold(rest)
      .replace(/^(?:selecione|selecionar|usar|use)\s+(?:a\s+)?fazenda\s+/, "")
      .replace(/[.! ]+$/, "") === fold(farmName(active.book));
  if (
    rest &&
    observation.status === "none" &&
    !selectionOnly &&
    !recordQuestion &&
    !/^(?:bom dia|boa tarde|boa noite|olha|seguinte|por favor)[,.! ]*$/i.test(rest)
  )
    recordQuestion = /\b(?:galgos?|cavalos?|cachorros?|porcos?)\b/i.test(rest)
      ? "A entrada citada é de bovinos? A transcrição mencionou outro animal. Confirme só a espécie ou corrija esse trecho; não alterei o rebanho."
      : "Ficou pendente o outro registro. Informe só o acontecimento com a quantidade ou valor que falta; não precisa repetir a tarefa já salva.";
  const actions: GuardianAction[] =
    observation.status === "batch"
      ? [...observation.actions]
      : observation.status === "action"
        ? [observation.action]
        : [];
  if (additional) actions.unshift(...additional.actions);
  if (recovered) {
    const clocks = taskClocks(incomingText);
    if (clocks.length === 1 && texts.length === 1) {
      const originalClock = taskClocks(texts[0])[0],
        correction = clocks[0];
      if (
        !correction.ambiguous ||
        !originalClock ||
        originalClock.hour % 12 !== correction.hour % 12 ||
        originalClock.minute !== correction.minute
      )
        texts[0] = removeTaskClocks(texts[0]) + " " + correction.text;
    }
  }
  for (const [index, text] of texts.entries()) {
    if (previous?.completedTasks?.includes(text)) continue;
    const parsed = task(text, reference, now, snapshot.preferences.timeZone);
    if (!parsed.action) {
      const question = `${parsed.question} Mantive os outros dados; nenhum item deste pedido foi salvo ainda.`;
      const pending: TaskBatchDraft = {
        kind: "task_batch",
        propertyId: active.id,
        createdAt: previous?.createdAt ?? now.toISOString(),
        expiresAt: previous?.expiresAt ?? new Date(now.getTime() + 30 * 60000).toISOString(),
        sourceMessageId,
        sourceAt,
        rest,
        taskTexts: texts,
        missingIndex: index,
        missing: parsed.missing!,
        question,
      };
      const result = await store.commit({
        phone: input.phone,
        messageId: input.messageId,
        accountVersion: snapshot.accountVersion,
        propertyId: active.id,
        propertyVersion: active.version,
        operation: "pending",
        pending,
        reply: question,
      });
      if (result === "conflict") return result;
      if (result !== "committed" && !result.startsWith("replay:"))
        throw Error("guardian_commit_unconfirmed");
      return {
        reply: result.startsWith("replay:") ? result.slice(7) : question,
        activeProperty: true,
        persisted: false,
      };
    }
    actions.push(parsed.action);
  }
  if (!actions.length)
    return {
      reply:
        recordQuestion ??
        "Os pedidos já estão nos registros desta fazenda. Não dupliquei a entrada nem a tarefa.",
      activeProperty: true,
      persisted: false,
    };
  if (!actions.every((a) => canEdit(active.role, a)))
    return {
      reply: "Seu perfil não permite todos estes registros. Nenhum item foi salvo.",
      activeProperty: true,
      persisted: false,
    };
  // A confirmation/rephrasing of an already saved batch must not replay cattle or tasks.
  const recent = (s: { at: string }) => now.getTime() - Date.parse(s.at) < 30 * 60000;
  const repeatedHerd = actions.some(
    (a) =>
      a.kind === "herd_event" &&
      active.book.operations?.movements.some(
        (m) =>
          m.type === a.type &&
          m.count === a.count &&
          m.date === a.date &&
          m.lot === a.lot &&
          recent(m.source),
      ),
  );
  if (
    repeatedHerd &&
    !/\b(?:outra compra|outro nascimento|outro acontecimento|nova compra|novos nascimentos)\b/i.test(
      input.text,
    )
  )
    return {
      reply:
        "Já há uma entrada recente com essa quantidade e data nesta fazenda. Nenhum item deste pedido foi repetido. Se for outro acontecimento, informe “outra compra” ou “outro nascimento” com os dados e o lembrete.",
      activeProperty: true,
      persisted: false,
    };
  const taskAlreadySaved = (a: GuardianAction) =>
    a.kind === "task_create" &&
    active.book.tasks.some(
      (t) => t.status === "open" && t.dueAt === a.dueAt && fold(t.title) === fold(a.title),
    );
  const duplicate = actions.every(
    (a) =>
      taskAlreadySaved(a) ||
      (a.kind === "herd_event" &&
        active.book.operations?.movements.some(
          (m) =>
            m.type === a.type &&
            m.count === a.count &&
            m.date === a.date &&
            m.lot === a.lot &&
            recent(m.source),
        )),
  );
  if (duplicate)
    return {
      reply:
        "Esses animais e tarefas já constam nos registros recentes desta fazenda. Não dupliquei os pedidos. Se for outra compra ou nascimento, informe que é outro acontecimento.",
      activeProperty: true,
      persisted: false,
    };
  const newActions = actions.filter((a) => !taskAlreadySaved(a));
  actions.splice(0, actions.length, ...newActions);
  const id = createHash("sha256")
    .update(input.phone + ":" + input.messageId)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  let book = active.book;
  const events: ReturnType<typeof applyFarmAction>["events"] = [];
  try {
    for (const [i, action] of actions.entries()) {
      const applied = applyFarmAction(
        book,
        action,
        active.role,
        {
          actor: input.phone,
          messageId: sourceMessageId,
          sourceAt,
          at: now.toISOString(),
          confirmed: true,
        },
        `${id}-${i + 1}`,
      );
      book = applied.book;
      events.push(...applied.events);
    }
  } catch {
    return {
      reply:
        "Não consegui aplicar todos os pedidos com segurança. Nenhum item foi salvo; confira os registros e a data da tarefa.",
      activeProperty: true,
      persisted: false,
    };
  }
  const identification = recovered
    ? snapshot.pending
    : (identificationAfterEntry(
        actions,
        book,
        null,
        active.id,
        sourceMessageId,
        now.toISOString(),
      ) ??
      additional?.pending ??
      null);
  const pending: GuardianSnapshot["pending"] = recordQuestion
    ? {
        kind: "task_batch",
        propertyId: active.id,
        createdAt: previous?.createdAt ?? now.toISOString(),
        expiresAt: previous?.expiresAt ?? new Date(now.getTime() + 30 * 60000).toISOString(),
        sourceMessageId,
        sourceAt,
        rest,
        taskTexts: texts,
        missingIndex: 0,
        missing: "record",
        question: recordQuestion,
        completedTasks: texts,
      }
    : identification;
  const stock = book.operations
    ? stockAt(book.operations, localDateForTimeZone(now, snapshot.preferences.timeZone)).count
    : null;
  const reply =
    `Registros salvos em ${farmName(book)}:\n` +
    actions
      .map((a) =>
        a.kind === "task_update" && a.status === "done"
          ? `• Tarefa concluída: ${book.tasks.find((t) => t.id === a.task)?.title ?? "atividade informada"}.`
          : `• ${describeAction(a)}`,
      )
      .join("\n") +
    (actions.some((a) => a.kind === "herd_event")
      ? stock === null
        ? "\nEntrada salva; o saldo total depende da contagem inicial."
        : `\nRebanho calculado: ${stock} animais.`
      : "") +
    (!snapshot.preferences.enabled
      ? "\nA tarefa está no painel. Os avisos no WhatsApp dependem de ativar os avisos da Guardiã."
      : "") +
    (recordQuestion ? `\n\nPendente: ${recordQuestion}` : "") +
    (pending?.kind === "herd_identification" && !recovered
      ? `\n\n${identificationQuestion(pending)}`
      : "");
  const result = await store.commit({
    phone: input.phone,
    messageId: input.messageId,
    accountVersion: snapshot.accountVersion,
    propertyId: active.id,
    propertyVersion: active.version,
    operation: "update",
    book,
    pending,
    events,
    reply,
    details: {
      kind: actions[0].kind,
      ...(additional?.replyToEventId ? { replyToEventId: additional.replyToEventId } : {}),
      batch: true,
      sourceMessageId,
      sourceAt,
      ...(sourceMessageId !== input.messageId
        ? { confirmedBy: input.messageId, resumedTask: true }
        : {}),
      events: actions,
    },
  });
  if (result === "conflict") return result;
  if (result !== "committed" && !result.startsWith("replay:"))
    throw Error("guardian_commit_unconfirmed");
  return {
    reply: result.startsWith("replay:") ? result.slice(7) : reply,
    activeProperty: true,
    persisted: true,
  };
}
