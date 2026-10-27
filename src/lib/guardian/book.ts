import {
  OperationsActionSchema,
  applyOperations,
  describeOperations,
  farmIndicators,
  stockAt,
} from "./operations.ts";
import { calculate, renderCalculation } from "./calculators.ts";
import {
  canEdit,
  farmName,
  type FarmBook,
  type GuardianAction,
  type GuardianEvent,
  type GuardianRole,
  type Provenance,
} from "./schema.ts";
import { localDateForTimeZone } from "../whatsapp/proactive.ts";
import { ledgerForTotals, ledgerPeriod } from "./finance.ts";

export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function describeAction(a: GuardianAction): string {
  const operational = OperationsActionSchema.safeParse(a);
  if (operational.success) return describeOperations(operational.data);
  switch (a.kind) {
    case "property_create":
      return `Criar a fazenda ${a.name}, em ${a.city}/${a.uf}.`;
    case "profile":
      return `Atualizar o perfil com: ${Object.entries(a)
        .filter(([k]) => k !== "kind")
        .map(
          ([k, v]) =>
            `${({ activity: "atividade", species: "espécies", breeds: "raças", feeding: "alimentação", pastures: "pastagens", goals: "objetivos" } as Record<string, string>)[k]}: ${Array.isArray(v) ? v.join(", ") : v}`,
        )
        .join("; ")}.`;
    case "task_create":
      return `Agendar “${a.title}” para ${new Date(a.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)${a.lot ? `, lote ${a.lot}` : ""}.`;
    case "task_update":
      return `Alterar a tarefa ${a.task}: ${a.status === "done" ? "concluir" : a.status === "cancelled" ? "cancelar" : ""}${a.dueAt ? ` reagendar para ${new Date(a.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}${a.title ? ` título: ${a.title}` : ""}.`;
    case "ledger":
      return `${a.direction === "expense" ? "Despesa" : "Receita"} de ${money(a.amountCents)} em ${ledgerPeriod(a)}: ${a.description}${a.lot ? `, lote ${a.lot}` : ""}.`;
    case "record":
      return `Anotar em ${a.date}: ${a.description}${a.count ? ` (quantidade informada: ${a.count})` : ""}${a.lot ? `, lote ${a.lot}` : ""}.`;
    case "animal":
      return `Cadastrar/atualizar o animal ${a.code}${a.sex ? `, sexo: ${{ male: "macho", female: "fêmea", unknown: "não informado" }[a.sex]}` : ""}${a.breed ? `, raça: ${a.breed}` : ""}${a.birthDate ? `, nascimento: ${a.birthDate}` : ""}${a.lot ? `, lote ${a.lot}` : ""}.`;
    case "weighing":
      return `${a.correction ? "Corrigir" : "Registrar"} peso do animal ${a.code}: ${num(a.weightKg)} kg em ${a.date}${a.estimated ? " (estimado)" : " (informado por você)"}.`;
    case "move":
      return `Mover o animal ${a.code} para o lote ${a.lot}.`;
    case "delete_record":
      return `Excluir o lançamento ${a.id} da seção ${a.section === "ledger" ? "financeiro" : "caderno de campo"}.`;
    case "invite":
      return `Criar convite para o WhatsApp ${a.phone}, com permissão de ${{ manager: "gerente", worker: "funcionário", technician: "responsável técnico" }[a.role]}. O acesso depende da aceitação pelo número convidado.`;
    case "revoke":
      return `Revogar o acesso de ${a.phone} a esta fazenda.`;
    case "property_delete":
      return `EXCLUIR definitivamente a fazenda ${a.name}, seus registros, convites e alertas. Os integrantes perderão o acesso.`;
  }
  throw new Error("Ação desconhecida.");
}
export function applyFarmAction(
  original: FarmBook,
  action: GuardianAction,
  role: GuardianRole,
  source: Provenance,
  id: string,
): { book: FarmBook; events: GuardianEvent[]; result: string } {
  if (!canEdit(role, action)) throw new Error("Seu perfil não permite esta alteração.");
  const book = structuredClone(original);
  const localDay = localDateForTimeZone(new Date(source.at));
  const events: GuardianEvent[] = [];
  const findAnimal = (code: string) => {
    const animal = book.animals.find((a) => fold(a.code) === fold(code));
    if (!animal)
      throw new Error(
        `Não encontrei o animal ${code} nesta fazenda. Cadastre o código antes de lançar pesagens.`,
      );
    return animal;
  };
  const operational = OperationsActionSchema.safeParse(action);
  if (operational.success) {
    applyOperations(book, operational.data, source, id);
    return {
      book,
      events,
      result: "Registro salvo na gestão da fazenda, com origem e histórico preservados.",
    };
  }
  let result = "Registro confirmado e salvo.";
  switch (action.kind) {
    case "profile": {
      const { kind: _kind, ...profile } = action;
      Object.assign(book.profile, profile);
      break;
    }
    case "task_create":
      if (Date.parse(action.dueAt) <= Date.parse(source.at))
        throw new Error("Escolha uma data e horário futuros para a tarefa.");
      book.tasks.push({
        id,
        title: action.title,
        dueAt: action.dueAt,
        status: "open",
        lot: action.lot,
        responsiblePhone: action.responsiblePhone ?? source.actor,
        source,
        updatedAt: source.at,
      });
      result = `Tarefa ${id} criada: ${action.title}. Para concluir, diga “concluir tarefa ${id}”.`;
      break;
    case "task_update": {
      const task = book.tasks.find(
        (t) => t.id === action.task || fold(t.title) === fold(action.task),
      );
      if (!task)
        throw new Error(
          "Não encontrei essa tarefa nesta fazenda. Diga “minhas tarefas” para consultar os códigos.",
        );
      if (action.dueAt && Date.parse(action.dueAt) <= Date.parse(source.at))
        throw new Error("O novo horário deve ser futuro.");
      if (action.dueAt && task.status !== "open")
        throw new Error("Essa tarefa já foi encerrada. Crie uma nova tarefa para outro manejo.");
      if (action.status) task.status = action.status;
      if (action.dueAt) task.dueAt = action.dueAt;
      if (action.title) task.title = action.title;
      task.updatedAt = source.at;
      result =
        task.status === "done"
          ? `Tarefa ${task.id} concluída e salva.${/pesar|pesagem/i.test(task.title) ? " Quer registrar os novos pesos? Envie o código de cada animal e o peso em kg." : ""}`
          : `Tarefa ${task.id} atualizada e salva.`;
      break;
    }
    case "ledger": {
      if (action.periodMonth && action.periodMonth > action.date.slice(0, 7))
        throw new Error("O total mensal informado não pode se referir a um mês futuro.");
      if (action.date > localDay)
        throw new Error(
          "A data de um lançamento realizado não pode estar no futuro. Use uma tarefa para programar uma atividade futura.",
        );
      const { kind: _kind, ...entry } = action;
      book.ledger.push({ ...entry, id, source });
      result = `Lançamento ${id} salvo: ${action.direction === "expense" ? "despesa" : "receita"} de ${money(action.amountCents)}.`;
      break;
    }
    case "record": {
      if (action.date > localDay)
        throw new Error(
          "A data de um registro realizado não pode estar no futuro. Use uma tarefa para programar uma atividade futura.",
        );
      const { kind: _kind, ...entry } = action;
      book.records.push({ ...entry, id, source });
      result = `Anotação ${id} salva no caderno de campo.`;
      break;
    }
    case "animal": {
      const { kind: _kind, ...attrs } = action;
      if (action.birthDate && action.birthDate > localDay)
        throw new Error("O nascimento informado está no futuro.");
      const prior = book.animals.find((a) => fold(a.code) === fold(action.code));
      if (prior) Object.assign(prior, attrs, { source });
      else book.animals.push({ sex: "unknown", ...attrs, weights: [], source });
      result = `Animal ${action.code} salvo nesta fazenda.`;
      break;
    }
    case "weighing": {
      if (action.date > localDay)
        throw new Error("Uma pesagem realizada não pode ter data futura.");
      const animal = findAnimal(action.code);
      const existing = animal.weights.find((w) => w.date === action.date);
      if (existing && !action.correction)
        throw new Error(
          "Já há uma pesagem nessa data. Peça explicitamente para corrigir o peso; o valor anterior será preservado no histórico de correções.",
        );
      if (existing) {
        existing.corrections.push({
          weightKg: existing.weightKg,
          estimated: existing.estimated,
          previousSource: {
            actor: existing.actor,
            at: existing.at,
            messageId: existing.messageId,
            confirmed: true,
          },
          at: source.at,
          messageId: source.messageId,
        });
        Object.assign(existing, source, { weightKg: action.weightKg, estimated: action.estimated });
      } else
        animal.weights.push({
          ...source,
          date: action.date,
          weightKg: action.weightKg,
          estimated: action.estimated,
          corrections: [],
        });
      animal.weights.sort((a, b) => a.date.localeCompare(b.date));
      result = `Pesagem de ${animal.code} salva: ${num(action.weightKg)} kg em ${action.date}${action.estimated ? " (estimativa)" : ""}.`;
      const measured = animal.weights.filter((w) => !w.estimated);
      if (measured.length >= 2 && !action.estimated) {
        const end = measured.at(-1)!,
          start = measured.at(-2)!;
        const days = (Date.parse(end.date) - Date.parse(start.date)) / 86400000;
        const gmd = calculate({
          kind: "gmd",
          initialKg: start.weightKg,
          finalKg: end.weightKg,
          days,
        });
        result += `\nGMD entre ${start.date} e ${end.date}: ${num(gmd.values.gmd!)} kg/dia (pesos informados, não previsão).`;
      }
      break;
    }
    case "move": {
      const animal = findAnimal(action.code);
      const previous = animal.lot;
      animal.lot = action.lot;
      book.records.push({
        id,
        type: "movement",
        date: localDay,
        lot: action.lot,
        description: `${animal.code}: ${previous ?? "lote não informado"} → ${action.lot}`,
        source,
      });
      break;
    }
    case "delete_record": {
      const index = book[action.section].findIndex((e) => e.id === action.id);
      if (index < 0) throw new Error("Não encontrei o lançamento nesta fazenda.");
      book[action.section].splice(index, 1);
      result = `Lançamento ${action.id} excluído. A alteração foi registrada na auditoria.`;
      break;
    }
    default:
      throw new Error("Esta ação exige uma operação de acesso à propriedade.");
  }
  // Transparent technical caps bound snapshot size and serverless work, never commercial limits.
  if (
    book.animals.length > 2000 ||
    book.tasks.length > 5000 ||
    book.ledger.length > 20000 ||
    book.records.length > 20000 ||
    book.animals.some((a) => a.weights.length > 5000) ||
    JSON.stringify(book).length > 8_000_000
  )
    throw new Error(
      "O volume atingiu o limite técnico de processamento deste caderno. Exporte os dados e contate o suporte para ampliar a capacidade, gratuitamente.",
    );
  for (const task of book.tasks) {
    if (task.status !== "open") continue;
    const before = original.tasks.find((t) => t.id === task.id);
    if (before?.status === "open" && before.dueAt === task.dueAt && before.title === task.title)
      continue;
    events.push({
      type: "task_due",
      topic: "tasks",
      key: `task:${task.id}:${task.updatedAt}`,
      recipient: task.responsiblePhone ?? source.actor,
      notBefore: task.dueAt,
      expiresAt: new Date(Date.parse(task.dueAt) + 86400000).toISOString(),
      priority: 3,
      evidence: {
        taskId: task.id,
        dueAt: task.dueAt,
        updatedAt: task.updatedAt,
        sourceMessageId: source.messageId,
      },
      message: `${farmName(book)}: a tarefa “${task.title}” está prevista para ${new Date(task.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Você já concluiu? Se sim, responda “concluir tarefa ${task.id}”.`,
    });
  }
  return { book, events, result };
}

export function farmReport(
  book: FarmBook,
  input: {
    section?: "all" | "herd" | "tasks" | "finance" | "records";
    maxChars?: number;
    start?: string;
    end?: string;
    lot?: string;
  } = {},
): string {
  const inPeriod = (day: string) =>
    (!input.start || day >= input.start) && (!input.end || day < input.end);
  const inLot = (lot?: string) => !input.lot || fold(lot ?? "") === fold(input.lot);
  const sections = [
    farmName(book) +
      ` — ${[book.city, book.uf].filter(Boolean).join("/") || "localização não informada"}`,
    input.start || input.end
      ? `Período: ${input.start ?? "início"} até ${input.end ?? "hoje"} (fim exclusivo).`
      : "Dados confirmados desta propriedade.",
  ];
  const all = !input.section || input.section === "all";
  if (all || input.section === "herd") {
    const today = localDateForTimeZone(new Date());
    const end = input.end
      ? new Date(Date.parse(input.end + "T12:00:00Z") - 86400000).toISOString().slice(0, 10)
      : today;
    const indicators = farmIndicators(book, input.start ?? "1900-01-01", end);
    const stock =
      input.lot && book.operations ? stockAt(book.operations!, end, input.lot) : indicators.stock;
    sections.push(
      stock.count === null
        ? "Estoque agregado: ainda sem contagem inicial declarada."
        : `Estoque agregado calculado: ${stock.count} cabeças em ${end}, a partir da contagem de ${stock.baseline!.date} e ${stock.included.length} movimentações posteriores. Fórmula: última contagem + entradas posteriores − saídas posteriores.`,
    );
    if (indicators.evolution && !input.lot)
      sections.push(
        `Contagens declaradas: ${indicators.evolution.initial} (${indicators.evolution.from}) → ${indicators.evolution.final} (${indicators.evolution.to}), diferença ${indicators.evolution.change}${indicators.evolution.percent !== null ? ` (${num(indicators.evolution.percent)}%)` : ""}. A variação não comprova compra, nascimento ou outra causa.`,
      );
    const animals = book.animals.filter((a) => inLot(a.lot));
    sections.push(
      `Rebanho cadastrado: ${animals.length} animais; ${animals.filter((a) => a.sex === "female").length} fêmeas; ${animals.filter((a) => a.sex === "male").length} machos. Cadastro não equivale a censo completo da fazenda.`,
    );
    for (const a of animals) {
      const weights = a.weights.filter((w) => inPeriod(w.date));
      sections.push(
        `${a.code} — lote ${a.lot ?? "não informado"} — ${weights.length ? weights.map((w) => `${w.date}: ${num(w.weightKg)} kg${w.estimated ? " (estimado)" : ""}`).join("; ") : "sem pesagem no período"}`,
      );
    }
    const gains = animals
      .flatMap((a) => {
        const w = a.weights.filter((w) => !w.estimated && inPeriod(w.date));
        if (w.length < 2) return [];
        const first = w[0],
          last = w.at(-1)!;
        const days = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
        return days > 0
          ? [
              {
                code: a.code,
                gain: last.weightKg - first.weightKg,
                gmd: (last.weightKg - first.weightKg) / days,
                start: first.date,
                end: last.date,
              },
            ]
          : [];
      })
      .sort((a, b) => b.gain - a.gain);
    if (gains.length)
      sections.push(
        `Maior ganho entre animais com pelo menos duas pesagens informadas: ${gains[0].code}, ${num(gains[0].gain)} kg, GMD ${num(gains[0].gmd)} kg/dia (${gains[0].start} a ${gains[0].end}). Períodos de outros animais podem diferir.`,
      );
  }
  if (all || input.section === "tasks")
    sections.push(
      "Tarefas:",
      ...book.tasks
        .filter((t) => inLot(t.lot) && inPeriod(t.dueAt.slice(0, 10)))
        .map(
          (t) =>
            `${t.id} — ${t.title} — ${t.status === "open" ? "pendente" : t.status === "done" ? "concluída" : "cancelada"} — ${new Date(t.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        ),
    );
  if (all || input.section === "finance") {
    const endDay = input.end
      ? new Date(Date.parse(input.end + "T12:00:00Z") - 86400000).toISOString().slice(0, 10)
      : undefined;
    const ledger = ledgerForTotals(
      book.ledger.filter((e) => inLot(e.lot)),
      input.start,
      endDay,
    );
    const income = ledger
        .filter((e) => e.direction === "income")
        .reduce((s, e) => s + e.amountCents, 0),
      expenses = ledger
        .filter((e) => e.direction === "expense")
        .reduce((s, e) => s + e.amountCents, 0);
    sections.push(
      `Receitas registradas: ${money(income)}; despesas registradas: ${money(expenses)}.`,
      renderCalculation(
        calculate({
          kind: "margin",
          revenue: income / 100,
          recordedExpenses: expenses / 100,
          completeCosts: false,
        }),
      ),
      ...ledger.map(
        (e) =>
          `${e.id} — ${ledgerPeriod(e)} — ${e.direction === "expense" ? "despesa" : "receita"} ${money(e.amountCents)} — ${e.description}`,
      ),
    );
  }
  if (all || input.section === "records") {
    const records = book.records.filter((r) => inPeriod(r.date) && inLot(r.lot));
    sections.push(
      `Nascimentos informados no período: ${records.filter((r) => r.type === "birth").reduce((s, r) => s + (r.count ?? 0), 0)} (somente registros com quantidade).`,
      ...records.map(
        (r) => `${r.id} — ${r.date} — ${r.description}${r.lot ? ` — lote ${r.lot}` : ""}`,
      ),
    );
  }
  const full = sections.join("\n");
  const cap = input.maxChars ?? 110_000;
  return full.length <= cap
    ? full
    : full.slice(0, Math.max(0, cap - 2000)) +
        "\nRelatório PARCIAL por limite de mensagem. Peça por período/lote ou exporte os dados completos no painel autorizado.";
}
