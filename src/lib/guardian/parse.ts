import type { ChatMessage } from "../chat/types.ts";
import { localDateForTimeZone, localDateTimeToUtc } from "../whatsapp/proactive.ts";
import { recallPeriod } from "../chat/context/recall.ts";
import { ActionSchema, type GuardianAction, type GuardianSnapshot } from "./schema.ts";
import { fold } from "./book.ts";
import type { Calculation } from "./calculators.ts";
import { parseCalculation } from "./calculation-intent.ts";
import { parseFollowupPreference } from "../whatsapp/proactive.ts";

export type GuardianRequest =
  | { kind: "action"; action: GuardianAction }
  | { kind: "confirm" | "cancel" | "help" | "properties" | "export" | "legacy" }
  | { kind: "select"; property: string }
  | { kind: "accept"; token: string }
  | {
      kind: "preferences";
      enabled?: boolean;
      startHour?: number;
      endHour?: number;
      maxPerDay?: number;
      topics?: Array<"tasks" | "weather" | "health" | "finance" | "performance" | "reports">;
      reportCadence?: "none" | "daily" | "weekly" | "monthly";
    }
  | {
      kind: "query";
      section: "all" | "herd" | "tasks" | "finance" | "records";
      start?: string;
      end?: string;
      lot?: string;
    }
  | { kind: "calculation"; calculation: Calculation }
  | { kind: "clarify"; reply: string }
  | { kind: "extract" };

export const TASK_DATE_QUESTION =
  "Qual o dia e horário da tarefa? Exemplo: me lembra de pesar o lote 2 na sexta às 8h. Uso 8h (Brasília) se você informar só o dia, e mostro a data antes de salvar.";

// Only resume the immediately preceding clarification, never a recalled old task.
export function taskContinuation(text: string, history: ChatMessage[] = []): string | null {
  const answer = fold(text).trim();
  if (
    !/^(?:hoje|amanha|depois de amanha|(?:proxim[ao] )?(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?|(?:dia )?\d{1,2}\/\d{1,2}(?:\/20\d{2})?|20\d{2}-\d{2}-\d{2}|as \d{1,2})(?:[\d\s:ha.,/-]|da noite|da tarde|da manha|as)*$/.test(
      answer,
    )
  )
    return null;
  const question = history.at(-1),
    original = history.at(-2);
  if (
    question?.role !== "assistant" ||
    question.content !== TASK_DATE_QUESTION ||
    original?.role !== "user"
  )
    return null;
  if (
    !/^(?:me lembr[ae]|criar tarefa|crie uma tarefa|agende|agendar)\b/.test(fold(original.content))
  )
    return null;
  const prior = /\b(?:as|a partir das)\s*\d/.test(answer)
    ? original.content.replace(
        /\s+(?:às|as)\s*\d{1,2}(?::\d{2}|h\d{0,2})?(?:\s+da (?:noite|tarde|manhã|manha))?\s*$/i,
        "",
      )
    : original.content;
  return prior + " " + text;
}

export function brazilNumber(value: string): number {
  const text = value.trim();
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,4})?$|^\d+\.\d{1,2}$/.test(text)) return NaN;
  return Number(
    text.includes(",")
      ? text.replace(/\./g, "").replace(",", ".")
      : /^\d{1,3}(?:\.\d{3})+$/.test(text)
        ? text.replace(/\./g, "")
        : text,
  );
}
function dayAdd(day: string, count: number): string {
  return new Date(Date.parse(day + "T12:00:00Z") + count * 86400000).toISOString().slice(0, 10);
}
export function parseDueDate(
  text: string,
  now: Date,
  timeZone = "America/Sao_Paulo",
): string | null {
  const t = fold(text),
    today = localDateForTimeZone(now, timeZone);
  let day: string | null = null;
  const iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const br = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (iso) day = iso[1];
  else if (br)
    day = `${br[3] ?? today.slice(0, 4)}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  else if (/\bdepois de amanha\b/.test(t)) day = dayAdd(today, 2);
  else if (/\bamanha\b/.test(t)) day = dayAdd(today, 1);
  else if (/\bhoje\b/.test(t)) day = today;
  else {
    const inDays = t.match(/\b(?:daqui a|em) (\d{1,3}) dias?\b/);
    if (inDays) day = dayAdd(today, Number(inDays[1]));
    else {
      const weekdays = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
      const target = weekdays.findIndex((d) => new RegExp(`\\b${d}(?:-feira)?\\b`).test(t));
      if (target >= 0) {
        let delta = (target - new Date(today + "T12:00:00Z").getUTCDay() + 7) % 7;
        if (/\bproxim[ao]\b/.test(t) && delta === 0) delta = 7;
        day = dayAdd(today, delta);
      }
    }
  }
  if (
    !day ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day + "T12:00:00Z")) ||
    new Date(day + "T12:00:00Z").toISOString().slice(0, 10) !== day
  )
    return null;
  const hour = t.match(/\b(?:as|a partir das)\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)?\b/);
  const h = hour ? Number(hour[1]) : 8,
    m = Number(hour?.[2] ?? hour?.[3] ?? 0);
  if (h > 23 || m > 59) return null;
  let due = localDateTimeToUtc(day, h * 60 + m, timeZone);
  if (due <= now && /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/.test(t) && !iso && !br)
    due = localDateTimeToUtc(dayAdd(day, 7), h * 60 + m, timeZone);
  return due > now ? due.toISOString() : null;
}
export function guardianCandidate(text: string, snapshot?: GuardianSnapshot | null): boolean {
  const t = fold(text);
  return (
    (!!snapshot?.pending && /^(sim|confirmo|confirmar|pode salvar|nao|cancelar)[.! ]*$/.test(t)) ||
    /\b(guardia|caderno de campo|cadastrar fazenda|criar fazenda|minhas fazendas|usar fazenda|selecionar fazenda|aceitar convite|convidar|revogar acesso|ativar avisos|parar mensagens|parar avisos|pausar avisos|desativar avisos|horario dos avisos|avisos por dia|temas dos avisos|exportar dados|excluir fazenda)\b/.test(
      t,
    ) ||
    /\b(me lembr[ae]|crie? uma tarefa|criar tarefa|agende|agendar|concluir tarefa|cancelar tarefa|reagendar tarefa|minhas tarefas|tarefas pendentes|registrar despesa|registrar receita|despesa|receita|anote|anotar|registre|registrar|comprei|nasceram|transferimos|vacinamos|vacinacao do lote|hoje pesei|cadastre o animal|cadastrar animal|pesagem do animal|peso do animal|corrija o peso)\b/.test(
      t,
    ) ||
    /\b(gmd|ganho medio diario|conversao alimentar|custo por kg|simular alimentacao|calcular materia seca)\b/.test(
      t,
    ) ||
    (!!snapshot?.active &&
      /^(sim|ja|ja conclui|feito)[.! ]*$/.test(t) &&
      !!snapshot.lastNotification?.taskId) ||
    (!!snapshot?.active &&
      /\b(quantas vacas|quantos animais|qual animal ganhou|historico do lote|resumo da fazenda|relatorio da fazenda|resumo financeiro|relatorio financeiro|quantos bezerros nasceram|historico d[oa] animal)\b/.test(
        t,
      ))
  );
}
export function parseGuardianRequest(
  text: string,
  snapshot: GuardianSnapshot | null,
  now: Date,
): GuardianRequest | null {
  const t = fold(text),
    day = localDateForTimeZone(now),
    lot = text.match(/\blote\s+([\p{L}\d_-]+)/iu)?.[1];
  const period = recallPeriod(text, now);
  const explicitDay = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const reportedDay =
    explicitDay ??
    (period && Date.parse(period.endDay) - Date.parse(period.startDay) === 86400000
      ? period.startDay
      : day);
  const ambiguousRecordDate =
    !!period && Date.parse(period.endDay) - Date.parse(period.startDay) !== 86400000;
  if (
    /^como (?:ativar|registrar|cadastrar|usar).*(?:avisos|tarefas|fazenda|guardia|caderno)/.test(t)
  )
    return { kind: "help" };
  if (
    /^(?:o que e|o que significa|como calcular|explique|qual a formula).*(?:gmd|ganho medio diario)/.test(
      t,
    )
  )
    return null;
  const calculation = parseCalculation(text, snapshot?.lastCalculation ?? undefined);
  if (calculation) return { kind: "calculation", calculation };
  const corrected = t.match(
    /^(?:era|e|corrija para|o peso certo e)\s*([\d.,]+)\s*kg(?:[, ]*nao\s*([\d.,]+)\s*(?:kg)?)?[.! ]*$/,
  );
  if (
    corrected &&
    snapshot?.pending &&
    snapshot.pending.kind !== "herd_identification" &&
    snapshot.pending.kind !== "herd_registration" &&
    snapshot.pending.kind !== "record_draft" &&
    snapshot.pending.kind !== "management_draft" &&
    snapshot.pending.action.kind === "weighing"
  ) {
    const action = ActionSchema.safeParse({
      ...snapshot.pending.action,
      weightKg: brazilNumber(corrected[1]),
    });
    return action.success
      ? { kind: "action", action: action.data }
      : {
          kind: "clarify",
          reply:
            "Qual o peso correto, em kg? Confira o código do animal na proposta antes de confirmar.",
        };
  }
  if (/^(sim|confirmo|confirmar|pode salvar)[.! ]*$/.test(t) && snapshot?.pending)
    return { kind: "confirm" };
  if (/^(nao|cancelar)[.! ]*$/.test(t) && snapshot?.pending) return { kind: "cancel" };
  if (
    /^(sim|ja|ja conclui|feito)[.! ]*$/.test(t) &&
    snapshot?.lastNotification?.taskId &&
    Date.parse(snapshot.lastNotification.sentAt) > now.getTime() - 86400000
  )
    return {
      kind: "action",
      action: { kind: "task_update", task: snapshot.lastNotification.taskId, status: "done" },
    };
  if (
    /^(?:ajuda |ativar |abrir )?(?:a )?guardia(?: da fazenda)?[.!? ]*$/.test(t) ||
    /como (?:usar|funciona).*guardia/.test(t)
  )
    return { kind: "help" };
  if (/\bminhas fazendas|listar fazendas\b/.test(t)) return { kind: "properties" };
  if (/^usar anotacoes anteriores[.! ]*$/.test(t)) return { kind: "legacy" };
  if (/\bexportar (?:meus )?dados\b/.test(t)) return { kind: "export" };
  const accept = t.match(/^aceitar convite\s+([a-f0-9]{32})[.! ]*$/);
  if (accept) return { kind: "accept", token: accept[1] };
  const transfer = t.match(
    /^transferir\s+(\d{1,6})\s+(?:animais|cabecas|bovinos)(?:\s+do lote\s+([\p{L}\d_-]+))?\s+para\s+(?:a\s+)?fazenda\s+(.+?)(?:\s+no lote\s+([\p{L}\d_-]+))?(?:\s+(?:em\s+)?(?:20\d{2}-\d{2}-\d{2}|hoje|ontem))?[.! ]*$/u,
  );
  if (transfer && snapshot?.active) {
    const targets = snapshot.properties.filter(
      (p) => p.id === transfer[3] || fold(p.name) === transfer[3],
    );
    if (targets.length !== 1 || targets[0].id === snapshot.active.id)
      return {
        kind: "clarify",
        reply:
          "Escolha outra fazenda autorizada para receber os animais. Consulte “minhas fazendas” para obter o código correto.",
      };
    return {
      kind: "action",
      action: {
        kind: "property_transfer",
        count: Number(transfer[1]),
        date: reportedDay,
        toPropertyId: targets[0].id,
        ...(transfer[2] ? { fromLot: transfer[2] } : {}),
        ...(transfer[4] ? { toLot: transfer[4] } : {}),
      },
    };
  }
  const select = text.match(/^(?:usar|selecionar) fazenda\s+(.+)$/i);
  if (select) return { kind: "select", property: select[1].trim() };
  const property = text.match(
    /^(?:cadastrar|criar) fazenda\s+(.+?)\s+em\s+(.+?)[/,-]\s*([A-Z]{2})[.! ]*$/i,
  );
  if (property) {
    const parsed = ActionSchema.safeParse({
      kind: "property_create",
      name: property[1],
      city: property[2],
      uf: property[3].toUpperCase(),
    });
    return parsed.success
      ? { kind: "action", action: parsed.data }
      : {
          kind: "clarify",
          reply:
            "Informe o nome, município e UF válidos. Exemplo: cadastrar fazenda Boa Vista em Monte Aprazível/SP.",
        };
  }
  if (
    /^(?:sair|stop)[.! ]*$/.test(t) ||
    parseFollowupPreference(text) === "disable" ||
    /^(?:parar|pare|pausar|desativar|cancelar)\s+(?:as? |os? )?(?:mensagens|avisos|alertas|lembretes|acompanhamento)(?: da guardia)?[.! ]*$/.test(
      t,
    )
  )
    return { kind: "preferences", enabled: false };
  if (
    /^(?:(?:eu )?quero |pode )?(?:ativar|ative|reativar|retomar|retome)\s+(?:as? |os? )?(?:avisos|alertas|mensagens|acompanhamento|lembretes)(?: da guardia)?(?: pra mim)?[.! ]*$/.test(
      t,
    ) ||
    /^pode voltar a me (?:mandar|enviar) (?:os |as )?(?:avisos|lembretes|mensagens)[.! ]*$/.test(t)
  )
    return { kind: "preferences", enabled: true };
  const hours = t.match(
    /^horario dos avisos (?:das )?(\d{1,2})(?:h)? (?:as|ate) (\d{1,2})(?:h)?[.! ]*$/,
  );
  if (hours) return { kind: "preferences", startHour: Number(hours[1]), endHour: Number(hours[2]) };
  const frequency = t.match(/^(\d{1,2}) avisos por dia[.! ]*$/);
  if (frequency) return { kind: "preferences", maxPerDay: Number(frequency[1]) };
  const reports = t.match(/^(?:quero |ativar |receber )?relatorio (diario|semanal|mensal)[.! ]*$/);
  if (reports)
    return {
      kind: "preferences",
      reportCadence:
        reports[1] === "diario" ? "daily" : reports[1] === "semanal" ? "weekly" : "monthly",
      topics: [...new Set([...(snapshot?.preferences.topics ?? []), "reports" as const])],
    };
  if (/^parar relatorios[.! ]*$/.test(t)) return { kind: "preferences", reportCadence: "none" };
  if (/^temas dos avisos\s+/.test(t)) {
    const names: Record<
      string,
      "tasks" | "weather" | "health" | "finance" | "performance" | "reports"
    > = {
      tarefas: "tasks",
      clima: "weather",
      sanidade: "health",
      financeiro: "finance",
      desempenho: "performance",
      relatorios: "reports",
    };
    const topics = t
      .replace(/^temas dos avisos\s+/, "")
      .split(/[,;]| e /)
      .map((v) => names[v.trim()]);
    return topics.every(Boolean)
      ? { kind: "preferences", topics: [...new Set(topics)] }
      : {
          kind: "clarify",
          reply: "Escolha temas: tarefas, clima, sanidade, financeiro, desempenho e relatórios.",
        };
  }
  const remove = text.match(/^excluir fazenda\s+(.+)$/i);
  if (remove)
    return { kind: "action", action: { kind: "property_delete", name: remove[1].trim() } };
  const invite = t.match(
    /^convidar\s+(\+?[\d ()-]{10,24})\s+como\s+(gerente|funcionario|responsavel tecnico)[.! ]*$/,
  );
  if (invite)
    return {
      kind: "action",
      action: {
        kind: "invite",
        phone: invite[1].replace(/\D/g, ""),
        role:
          invite[2] === "gerente"
            ? "manager"
            : invite[2] === "funcionario"
              ? "worker"
              : "technician",
      },
    };
  const revoke = t.match(/^revogar acesso\s+(\+?[\d ()-]{10,24})[.! ]*$/);
  if (revoke)
    return { kind: "action", action: { kind: "revoke", phone: revoke[1].replace(/\D/g, "") } };
  const taskUpdate = text.match(
    /^(concluir|cancelar|reagendar) tarefa\s+(.+?)(?:\s+para\s+(.+))?$/i,
  );
  if (taskUpdate) {
    if (fold(taskUpdate[1]) === "reagendar") {
      const due = parseDueDate(taskUpdate[3] ?? "", now, snapshot?.preferences.timeZone);
      return due
        ? { kind: "action", action: { kind: "task_update", task: taskUpdate[2], dueAt: due } }
        : {
            kind: "clarify",
            reply:
              "Para quando deseja reagendar? Informe o código da tarefa, dia e horário: reagendar tarefa ABC para 30/10/2026 às 8h.",
          };
    }
    return {
      kind: "action",
      action: {
        kind: "task_update",
        task: taskUpdate[2],
        status: fold(taskUpdate[1]) === "concluir" ? "done" : "cancelled",
      },
    };
  }
  if (/\b(me lembr[ae]|criar tarefa|crie uma tarefa|agende|agendar)\b/.test(t)) {
    const due = parseDueDate(text, now, snapshot?.preferences.timeZone);
    if (!due)
      return {
        kind: "clarify",
        reply: TASK_DATE_QUESTION,
      };
    const title = text
      .replace(
        /^(?:me lembr[ae](?: de)?|criar tarefa|crie uma tarefa(?: para)?|agende|agendar)\s+/i,
        "",
      )
      .replace(
        /\s+(?:na |no |em |dia )?(?:hoje|amanh[ãa]|depois de amanh[ãa]|(?:pr[oó]xima? )?(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?|\d{1,2}\/\d{1,2}(?:\/20\d{2})?|20\d{2}-\d{2}-\d{2}).*$/i,
        "",
      )
      .replace(
        /\s+(?:às|as)\s*\d{1,2}(?::\d{2}|h\d{0,2})?(?:\s+da (?:noite|tarde|manhã|manha))?\s*$/i,
        "",
      )
      .trim();
    return {
      kind: "action",
      action: { kind: "task_create", title, dueAt: due, ...(lot ? { lot } : {}) },
    };
  }
  const finance = text.match(
    /^(?:registrar?\s+)?(despesa|receita)(?:\s+de)?\s*(?:R\$\s*)?([\d.,]+)\s*(?:com|de|por|[-–:])?\s*(.+)$/i,
  );
  if (finance) {
    if (ambiguousRecordDate)
      return {
        kind: "clarify",
        reply:
          "Qual foi o dia desse lançamento? Preciso de uma data, não apenas de um mês ou semana, para salvar o financeiro corretamente.",
      };
    const amount = brazilNumber(finance[2]);
    const a = ActionSchema.safeParse({
      kind: "ledger",
      direction: fold(finance[1]) === "despesa" ? "expense" : "income",
      amountCents: Math.round(amount * 100),
      description: finance[3].trim(),
      date: reportedDay,
      ...(lot ? { lot } : {}),
    });
    return a.success
      ? { kind: "action", action: a.data }
      : {
          kind: "clarify",
          reply:
            "Informe um valor positivo em reais e a descrição, como: despesa R$ 150,50 com ração.",
        };
  }
  const animal = text.match(
    /^(?:cadastrar|cadastre|registrar|registre) (?:o )?animal\s+([\p{L}\d_-]+)(?:\s+(.+))?$/iu,
  );
  if (animal) {
    const sex = /\bfemea\b/.test(t) ? "female" : /\bmacho\b/.test(t) ? "male" : undefined;
    const breed = animal[2]?.match(/\bra[cç]a\s+(.+?)(?=\s+(?:lote|nascimento)|$)/i)?.[1];
    const birth = animal[2]?.match(/\bnascimento\s+(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    return {
      kind: "action",
      action: {
        kind: "animal",
        code: animal[1],
        ...(sex ? { sex } : {}),
        ...(breed ? { breed } : {}),
        ...(birth ? { birthDate: birth } : {}),
        ...(lot ? { lot } : {}),
      },
    };
  }
  const weight = text.match(
    /^(?:(corrija|corrigir) (?:o )?)?(?:pesagem|peso) (?:do |da )?animal\s+([\p{L}\d_-]+)\s*(?::|para|e|é|de)?\s*([\d.,]+)\s*kg(?:\s+(?:em|dia)\s+(20\d{2}-\d{2}-\d{2}))?[.! ]*$/iu,
  );
  if (weight) {
    const a = ActionSchema.safeParse({
      kind: "weighing",
      code: weight[2],
      weightKg: brazilNumber(weight[3]),
      date: weight[4] ?? day,
      estimated: false,
      correction: !!weight[1],
    });
    return a.success
      ? { kind: "action", action: a.data }
      : {
          kind: "clarify",
          reply:
            "Informe código, peso positivo em kg (até 2.000 kg) e uma data válida. Exemplo: peso do animal 10 450 kg.",
        };
  }
  if (
    /\b(minhas tarefas|tarefas pendentes|resumo financeiro|relatorio financeiro|quantas vacas|quantos animais|qual animal ganhou|historico do lote|historico d[oa] animal|resumo da fazenda|relatorio da fazenda|quantos bezerros nasceram|caderno de campo)\b/.test(
      t,
    )
  )
    return {
      kind: "query",
      section: /tarefas/.test(t)
        ? "tasks"
        : /financeiro/.test(t)
          ? "finance"
          : /nasceram|caderno/.test(t)
            ? "records"
            : /animais|animal|vacas|lote/.test(t)
              ? "herd"
              : "all",
      ...(period ? { start: period.startDay, end: period.endDay } : {}),
      ...(lot ? { lot } : {}),
    };
  const birth = t.match(/\bnasceram (\d+) bezerros?\b/);
  if (
    ambiguousRecordDate &&
    (birth ||
      /^(?:anote|anotar|registre|registrar|hoje pesei|transferimos|vacinamos|fizemos a vacinacao)\b/.test(
        t,
      ))
  )
    return {
      kind: "clarify",
      reply:
        "Em qual dia isso aconteceu? Preciso da data do registro; um mês ou semana ainda deixa o dia indefinido.",
    };
  if (birth)
    return {
      kind: "action",
      action: {
        kind: "record",
        type: "birth",
        description: text,
        date: reportedDay,
        count: Number(birth[1]),
        ...(lot ? { lot } : {}),
      },
    };
  if (
    /^(?:anote|anotar|registre|registrar|hoje pesei|transferimos|vacinamos|fizemos a vacinacao)\b/.test(
      t,
    )
  )
    return {
      kind: "action",
      action: {
        kind: "record",
        type: /vacin|sintoma|doente/.test(t)
          ? "health"
          : /transfer|mudamos/.test(t)
            ? "movement"
            : "management",
        description: text,
        date: reportedDay,
        ...(lot ? { lot } : {}),
      },
    };
  return guardianCandidate(text, snapshot) ? { kind: "extract" } : null;
}
