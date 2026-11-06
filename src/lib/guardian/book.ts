import {
  ManagementActionSchema,
  applyManagement,
  describeManagement,
  managementReport,
} from "./management.ts";
import { taskDisplayDueAt, isTaskOccurrence, taskOccurrenceOn } from "./task-recurrence.ts";
import { SupplyActionSchema, applySupply, describeSupply } from "./supplies.ts";
import { FuelActionSchema, applyFuel, describeFuel } from "./fuel.ts";
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
import {
  animalFieldLabels,
  sameAnimalRegistry,
  animalFieldValue,
  animalClearableFields,
  pedigreeLabel,
  type AnimalProfile,
} from "./animal-profile.ts";

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
  const management = ManagementActionSchema.safeParse(a);
  if (management.success) return describeManagement(management.data);
  const supply = SupplyActionSchema.safeParse(a);
  if (supply.success) return describeSupply(supply.data);
  const fuel = FuelActionSchema.safeParse(a);
  if (fuel.success) return describeFuel(fuel.data);
  const operational = OperationsActionSchema.safeParse(a);
  if (operational.success) return describeOperations(operational.data);
  switch (a.kind) {
    case "employee_save":
      return `Cadastro de ${a.name}: ${a.job}, ${a.active ? "ativo" : "inativo"}. Este cadastro não concede acesso.`;
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
      return `Agendar “${a.title}”${a.recurrence === "daily" ? " todos os dias, a partir de" : " para"} ${new Date(a.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)${a.lot ? `, lote ${a.lot}` : ""}.`;
    case "task_update":
      return `Alterar a tarefa ${a.task}: ${a.status === "done" ? "concluir" : a.status === "cancelled" ? "cancelar" : ""}${a.dueAt ? ` reagendar para ${new Date(a.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}${a.title ? ` título: ${a.title}` : ""}${a.recurrence === "daily" ? " repetir todos os dias" : ""}${a.status === "done" ? " (se diária, conclui só a ocorrência e mantém os próximos dias)" : ""}.`;
    case "ledger":
      return `${a.direction === "expense" ? "Despesa" : "Receita"} de ${money(a.amountCents)} em ${ledgerPeriod(a)}: ${a.description}${a.lot ? `, lote ${a.lot}` : ""}${a.recurrence ? " (valor mensal informado)" : ""}.`;
    case "edit_record":
      return `Atualizar ${a.section === "ledger" ? "o lançamento financeiro" : "a anotação"} ${a.id}: ${Object.entries(
        a.changes,
      )
        .map(
          ([key, value]) =>
            `${({ description: "descrição", date: "data", lot: "lote", amountCents: "valor", direction: "tipo" } as Record<string, string>)[key]}: ${key === "amountCents" ? money(Number(value)) : key === "direction" ? (value === "expense" ? "despesa" : "receita") : value}`,
        )
        .join("; ")}.`;
    case "record":
      return `Anotar em ${a.date}: ${a.description}${a.count ? ` (quantidade informada: ${a.count})` : ""}${a.lot ? `, lote ${a.lot}` : ""}.`;
    case "animal": {
      const details = Object.entries(a)
        .filter(([key, value]) => !["kind", "code", "clear"].includes(key) && value !== undefined)
        .map(
          ([key, value]) =>
            `${animalFieldLabels[key as keyof AnimalProfile]}: ${key === "pedigree" ? a.pedigree?.map((node) => `${pedigreeLabel(node.relation)}: ${node.code}${node.name ? ` · ${node.name}` : ""}`).join("; ") : animalFieldValue(key as keyof AnimalProfile, value)}`,
        )
        .join("; ");
      return `Cadastrar/atualizar o animal ${a.code}${details ? ": " + details : ""}${a.clear?.length ? "; limpar os campos: " + a.clear.map((key) => animalFieldLabels[key]).join(", ") : ""}. Os valores de compra/venda ficam na ficha; lançamentos financeiros e movimentações do rebanho são registrados separadamente.`;
    }
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
  const management = ManagementActionSchema.safeParse(action);
  if (management.success) {
    applyManagement(book, management.data, source, id);
    return { book, events, result: describeManagement(management.data) + " Salvo na fazenda." };
  }
  const supply = SupplyActionSchema.safeParse(action);
  if (supply.success) {
    applySupply(book, supply.data, source, id);
    return { book, events, result: describeSupply(supply.data) };
  }
  const fuel = FuelActionSchema.safeParse(action);
  if (fuel.success) {
    applyFuel(book, fuel.data, source, id);
    return {
      book,
      events,
      result: `Combustível salvo. ${describeFuel(fuel.data)}`,
    };
  }
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
    case "employee_save": {
      const { kind: _kind, ...employee } = action;
      book.employees ??= [];
      const index = book.employees.findIndex((e) => e.id === employee.id);
      if (index >= 0) book.employees[index] = employee;
      else book.employees.push(employee);
      result = `Cadastro de ${employee.name} salvo. Nenhum acesso foi concedido por este cadastro.`;
      break;
    }
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
        ...(action.recurrence ? { recurrence: action.recurrence } : {}),
        status: "open",
        lot: action.lot,
        responsiblePhone: action.responsiblePhone ?? source.actor,
        source,
        updatedAt: source.at,
      });
      result = `Tarefa “${action.title}” criada${action.recurrence === "daily" ? " para repetir todos os dias, no horário de Brasília" : ""}. Quando terminar, diga “já concluí essa tarefa” ou descreva o que fez.`;
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
      if (
        (action.dueAt || action.status === "done" || action.recurrence !== undefined) &&
        task.status !== "open"
      )
        throw new Error("Essa tarefa já foi encerrada. Crie uma nova tarefa para outro manejo.");
      if (action.status === "done" && task.recurrence === "daily") {
        const due = action.occurrenceAt ?? taskOccurrenceOn(task, localDay);
        if (!isTaskOccurrence(task, due) || localDateForTimeZone(new Date(due)) > localDay)
          throw new Error("Não é possível concluir essa ocorrência da tarefa diária.");
        if (task.completedThrough && Date.parse(due) <= Date.parse(task.completedThrough))
          throw new Error(
            "Essa ocorrência já está concluída. O lembrete dos próximos dias continua ativo.",
          );
        task.completedThrough = due;
      } else if (action.status) task.status = action.status;
      if (action.recurrence === "daily") task.recurrence = "daily";
      if (action.dueAt) {
        task.dueAt = action.dueAt;
        delete task.completedThrough;
      }
      if (action.title) task.title = action.title;
      task.updatedAt = source.at;
      result =
        action.status === "done" && task.recurrence === "daily"
          ? `Ocorrência de “${task.title}” concluída e salva. O lembrete continua todos os dias; próximo horário: ${new Date(taskDisplayDueAt(task, new Date(source.at))).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília).`
          : task.status === "done"
            ? `Tarefa “${task.title}” concluída e salva.${/pesar|pesagem/i.test(task.title) ? " Quer registrar os novos pesos? Envie o código de cada animal e o peso em kg." : ""}`
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
    case "edit_record": {
      const row = book[action.section].find((r) => r.id === action.id);
      if (!row) throw new Error("Não encontrei o registro nesta fazenda. Nada foi alterado.");
      if (action.changes.date && action.changes.date > localDay)
        throw new Error("A data de um registro realizado não pode estar no futuro.");
      if (action.section === "ledger") {
        const entry = book.ledger.find((r) => r.id === action.id)!;
        if (
          entry.periodMonth &&
          action.changes.date &&
          entry.periodMonth > action.changes.date.slice(0, 7)
        )
          throw new Error("A data não pode ser anterior ao mês do total financeiro.");
      }
      if (
        Object.entries(action.changes).every(
          ([key, value]) => row[key as keyof typeof row] === value,
        )
      ) {
        result = `O registro ${row.id} já está com esses dados.`;
        break;
      }
      const revisions = (row.revisions ??= []);
      if (revisions.length >= 1000)
        throw new Error("O registro atingiu o limite técnico de revisões.");
      revisions.push({
        source,
        before: {
          description: row.description,
          date: row.date,
          ...(row.lot ? { lot: row.lot } : {}),
          ...("amountCents" in row
            ? { amountCents: row.amountCents, direction: row.direction }
            : {}),
        },
      });
      Object.assign(row, action.changes);
      result = `Registro ${row.id} atualizado no ${action.section === "ledger" ? "financeiro" : "caderno de campo"}.`;
      break;
    }
    case "animal": {
      const { kind: _kind, clear = [], ...attrs } = action;
      const prior = book.animals.find((a) => fold(a.code) === fold(action.code));
      const candidate = { ...prior, ...attrs };
      if (book.animals.some((a) => a !== prior && sameAnimalRegistry(a, candidate)))
        throw new Error(
          "Esse registro ABCZ já pertence a outra ficha da fazenda. Carregue a ficha existente para atualizar sem duplicar.",
        );
      if (clear.some((key) => !animalClearableFields.includes(key) || attrs[key] !== undefined))
        throw new Error("Confira os campos: não é possível limpar e preencher o mesmo dado.");
      if (action.birthDate && action.birthDate > localDay)
        throw new Error("O nascimento informado está no futuro.");
      if ([action.entryDate, action.weaningDate].some((date) => date && date > localDay))
        throw new Error("Datas de entrada e desmame realizados não podem estar no futuro.");
      const birthDate = clear.includes("birthDate")
        ? undefined
        : (action.birthDate ?? prior?.birthDate);
      const weaningDate = clear.includes("weaningDate")
        ? undefined
        : (action.weaningDate ?? prior?.weaningDate);
      if (birthDate && weaningDate && weaningDate < birthDate)
        throw new Error("O desmame não pode ser anterior ao nascimento.");
      const oldWeight = prior?.weights.at(-1)?.weightKg;
      if (prior) for (const key of clear) delete prior[key];
      if (prior) Object.assign(prior, attrs, { source });
      else book.animals.push({ sex: "unknown", ...attrs, weights: [], source });
      if (action.currentWeightKg !== undefined && action.currentWeightKg !== oldWeight) {
        const animal = prior ?? book.animals.at(-1)!;
        const sameDay = animal.weights.find((weight) => weight.date === localDay);
        if (sameDay) {
          sameDay.corrections.push({
            weightKg: sameDay.weightKg,
            estimated: sameDay.estimated,
            previousSource: {
              actor: sameDay.actor,
              at: sameDay.at,
              messageId: sameDay.messageId,
              confirmed: true,
            },
            at: source.at,
            messageId: source.messageId,
          });
          Object.assign(sameDay, source, { weightKg: action.currentWeightKg, estimated: false });
        } else
          animal.weights.push({
            ...source,
            date: localDay,
            weightKg: action.currentWeightKg,
            estimated: false,
            corrections: [],
          });
        animal.weights.sort((a, b) => a.date.localeCompare(b.date));
      }
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
        Object.assign(existing, source, {
          weightKg: action.weightKg,
          estimated: action.estimated,
        });
      } else
        animal.weights.push({
          ...source,
          date: action.date,
          weightKg: action.weightKg,
          estimated: action.estimated,
          corrections: [],
        });
      animal.weights.sort((a, b) => a.date.localeCompare(b.date));
      animal.currentWeightKg = animal.weights.at(-1)?.weightKg;
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
      if (animal.status && animal.status !== "active")
        throw new Error(`O animal ${animal.code} não está ativo nesta fazenda.`);
      const previous = animal.lot;
      if (fold(previous ?? "") === fold(action.lot)) {
        result = `${animal.code} já está no lote ${action.lot}.`;
        break;
      }
      animal.lot = action.lot;
      if (book.operations && !book.operations.lots.some((l) => fold(l.name) === fold(action.lot)))
        book.operations.lots.push({ name: action.lot });
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
    if (
      before?.status === "open" &&
      before.dueAt === task.dueAt &&
      before.title === task.title &&
      before.recurrence === task.recurrence &&
      before.completedThrough === task.completedThrough
    )
      continue;
    const due = taskDisplayDueAt(task, new Date(source.at));
    events.push({
      type: "task_due",
      topic: "tasks",
      key: `task:${task.id}:${task.updatedAt}${task.recurrence === "daily" ? `:${Date.parse(due)}` : ""}`,
      recipient: task.responsiblePhone ?? source.actor,
      notBefore: due,
      expiresAt: new Date(Date.parse(due) + 86400000).toISOString(),
      priority: 3,
      evidence: {
        taskId: task.id,
        dueAt: due,
        updatedAt: task.updatedAt,
        sourceMessageId: source.messageId,
        requestedBy: source.actor,
      },
      message: `${farmName(book)}: a tarefa “${task.title}” está prevista para ${new Date(due).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)${task.recurrence === "daily" ? "; repete todos os dias" : ""}. Você já concluiu? Pode responder “já fiz” ou dizer qual atividade terminou.`,
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
  const management = (book.management?.entries ?? []).filter(
    (e) => !e.removed && (!e.values.date || inPeriod(e.values.date)) && inLot(e.values.lot),
  );
  if (management.length)
    sections.push(
      "Gestão da fazenda:\n" + managementReport({ ...book, management: { entries: management } }),
    );
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
        : `Estoque agregado calculado: ${stock.count} ${indicators.stocksBySpecies.some((s) => s.species !== "cattle") ? "bovinos" : "cabeças"} em ${end}, a partir da contagem de ${stock.baseline!.date} e ${stock.included.length} movimentações posteriores. Fórmula: última contagem + entradas posteriores − saídas posteriores.`,
    );
    if (indicators.evolution && !input.lot)
      sections.push(
        `Contagens declaradas: ${indicators.evolution.initial} (${indicators.evolution.from}) → ${indicators.evolution.final} (${indicators.evolution.to}), diferença ${indicators.evolution.change}${indicators.evolution.percent !== null ? ` (${num(indicators.evolution.percent)}%)` : ""}. A variação não comprova compra, nascimento ou outra causa.`,
      );
    const inventory = book.operations?.inventories
      ?.filter((i) => i.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))
      .at(-1);
    if (inventory && !input.lot) {
      sections.push(
        `Rebanho por grupos (${inventory.date}; ${inventory.complete ? "censo declarado" : "levantamento parcial"}):`,
      );
      for (const g of inventory.groups) sections.push(`${g.count} ${g.name}: ${g.description}`);
      sections.push(
        "Subgrupos incluídos nos grupos principais; identificações individuais podem ser completadas depois.",
      );
    }
    for (const item of indicators.stocksBySpecies)
      if (item.species !== "cattle")
        sections.push(
          `${item.label}: ${item.count} animais contabilizados separadamente dos bovinos.`,
        );
    const animals = book.animals.filter((a) => inLot(a.lot));
    sections.push(
      `Fichas individuais cadastradas: ${animals.length} animais; ${animals.filter((a) => a.sex === "female").length} fêmeas; ${animals.filter((a) => a.sex === "male").length} machos. Cadastro não equivale a censo completo da fazenda.`,
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
        .map((t) => ({ ...t, dueAt: taskDisplayDueAt(t) }))
        .filter((t) => inLot(t.lot) && inPeriod(t.dueAt.slice(0, 10)))
        .map(
          (t) =>
            `• ${t.title} — ${t.status === "open" ? "pendente" : t.status === "done" ? "concluída" : "cancelada"} — ${new Date(t.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${t.recurrence === "daily" ? " — todos os dias" : ""}`,
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
