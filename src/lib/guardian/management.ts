import { z } from "zod";
import type { FarmBook, Provenance } from "./schema.ts";

const text = z.string().trim().min(1).max(160);
const number = z.number().finite().nonnegative().max(1e9);
export const ManagementValuesSchema = z
  .object({
    name: text.optional(),
    date: z.iso.date().optional(),
    notes: z.string().trim().max(1500).optional(),
    animal: text.optional(),
    lot: text.optional(),
    location: text.optional(),
    responsible: text.optional(),
    areaHa: number.optional(),
    capacity: number.int().optional(),
    forage: text.optional(),
    method: text.optional(),
    medicine: text.optional(),
    dose: text.optional(),
    result: text.optional(),
    expectedDate: z.iso.date().optional(),
    sire: text.optional(),
    score: z.number().min(1).max(5).optional(),
    appearance: text.optional(),
    ph: z.number().min(0).max(14).optional(),
    nitrogen: number.optional(),
    phosphorus: number.optional(),
    potassium: number.optional(),
    organicMatter: z.number().min(0).max(100).optional(),
    depthCm: number.optional(),
    restDays: number.int().optional(),
    heightCm: number.optional(),
    amountCents: z.number().int().positive().max(1e12).optional(),
    dueDate: z.iso.date().optional(),
    counterparty: text.optional(),
    category: text.optional(),
    unit: z.enum(["kg", "L", "un", "saco"]).optional(),
    minimumQty: number.optional(),
    quantity: z.number().positive().max(1e9).optional(),
    formula: text.optional(),
    ingredients: z
      .array(
        z
          .object({
            product: text,
            quantity: z.number().positive().max(1e9),
            unit: z.enum(["kg", "L", "un", "saco"]),
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .optional(),
    vehicle: text.optional(),
    vehicleType: text.optional(),
    plate: text.optional(),
    fuel: text.optional(),
    meterKm: number.optional(),
    meterHours: number.optional(),
    nextDate: z.iso.date().optional(),
    status: z.enum(["open", "in_progress", "done", "cancelled", "active", "inactive"]).optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
    action: z.string().trim().max(1500).optional(),
  })
  .strict();
export type ManagementValues = z.infer<typeof ManagementValuesSchema>;
type Field = keyof ManagementValues;
type Definition = {
  label: string;
  area: "herd" | "finance" | "fuel" | "supplies" | "records";
  fields: Field[];
  required: Field[];
  event?: boolean;
};
export const managementSections = {
  pasture: {
    label: "Pastos, piquetes e currais",
    area: "herd",
    fields: ["name", "areaHa", "capacity", "forage", "location", "notes"],
    required: ["name"],
  },
  pasture_management: {
    label: "Manejo de pastagem",
    area: "herd",
    fields: ["name", "date", "location", "method", "heightCm", "restDays", "notes"],
    required: ["name", "date", "location", "method"],
    event: true,
  },
  soil_analysis: {
    label: "Análises de solo",
    area: "herd",
    fields: [
      "name",
      "date",
      "location",
      "depthCm",
      "ph",
      "nitrogen",
      "phosphorus",
      "potassium",
      "organicMatter",
      "notes",
    ],
    required: ["name", "date", "location"],
    event: true,
  },
  health: {
    label: "Medicações e vacinas aplicadas",
    area: "herd",
    fields: [
      "name",
      "date",
      "animal",
      "lot",
      "medicine",
      "dose",
      "responsible",
      "amountCents",
      "notes",
    ],
    required: ["name", "date", "medicine"],
    event: true,
  },
  exam: {
    label: "Exames",
    area: "herd",
    fields: ["name", "date", "animal", "lot", "method", "result", "responsible", "notes"],
    required: ["name", "date"],
    event: true,
  },
  insemination: {
    label: "Inseminações e coberturas",
    area: "herd",
    fields: ["name", "date", "animal", "lot", "method", "sire", "responsible", "notes"],
    required: ["name", "date", "method"],
    event: true,
  },
  pregnancy: {
    label: "Diagnósticos de gestação",
    area: "herd",
    fields: ["name", "date", "animal", "lot", "result", "expectedDate", "responsible", "notes"],
    required: ["name", "date", "result"],
    event: true,
  },
  calving: {
    label: "Detalhes dos partos",
    area: "herd",
    fields: ["name", "date", "animal", "lot", "sire", "result", "responsible", "notes"],
    required: ["name", "date"],
    event: true,
  },
  fecal: {
    label: "Avaliação fecal",
    area: "herd",
    fields: ["name", "date", "animal", "lot", "score", "appearance", "responsible", "notes"],
    required: ["name", "date", "score"],
    event: true,
  },
  payable: {
    label: "Contas a pagar",
    area: "finance",
    fields: ["name", "amountCents", "dueDate", "counterparty", "category", "notes"],
    required: ["name", "amountCents", "dueDate"],
  },
  receivable: {
    label: "Contas a receber",
    area: "finance",
    fields: ["name", "amountCents", "dueDate", "counterparty", "category", "notes"],
    required: ["name", "amountCents", "dueDate"],
  },
  product: {
    label: "Produtos e matérias-primas",
    area: "supplies",
    fields: ["name", "unit", "minimumQty", "notes"],
    required: ["name", "unit"],
  },
  storage: {
    label: "Locais de estoque",
    area: "supplies",
    fields: ["name", "location", "notes"],
    required: ["name"],
  },
  formula: {
    label: "Fórmulas e dietas",
    area: "supplies",
    fields: ["name", "ingredients", "responsible", "notes"],
    required: ["name", "ingredients"],
  },
  feeding: {
    label: "Fornecimento nutricional",
    area: "herd",
    fields: ["name", "date", "formula", "quantity", "unit", "lot", "location", "notes"],
    required: ["name", "date", "formula", "quantity", "unit"],
    event: true,
  },
  vehicle: {
    label: "Veículos e máquinas",
    area: "fuel",
    fields: [
      "name",
      "vehicleType",
      "plate",
      "fuel",
      "meterKm",
      "meterHours",
      "nextDate",
      "status",
      "notes",
    ],
    required: ["name", "vehicleType"],
  },
  maintenance: {
    label: "Ordens de serviço",
    area: "fuel",
    fields: [
      "name",
      "date",
      "vehicle",
      "method",
      "status",
      "responsible",
      "meterKm",
      "meterHours",
      "nextDate",
      "amountCents",
      "notes",
    ],
    required: ["name", "date", "vehicle", "status"],
  },
  vehicle_cost: {
    label: "Custos de veículos",
    area: "fuel",
    fields: ["name", "date", "vehicle", "category", "amountCents", "notes"],
    required: ["name", "date", "vehicle", "amountCents"],
    event: true,
  },
  occurrence: {
    label: "Ocorrências",
    area: "records",
    fields: [
      "name",
      "date",
      "category",
      "severity",
      "status",
      "location",
      "responsible",
      "action",
      "notes",
    ],
    required: ["name", "date", "status"],
  },
  round: {
    label: "Rondas da fazenda",
    area: "records",
    fields: ["name", "date", "location", "responsible", "notes"],
    required: ["name", "date"],
    event: true,
  },
} as const satisfies Record<string, Definition>;
export const ManagementSectionSchema = z.enum(
  Object.keys(managementSections) as [
    keyof typeof managementSections,
    ...(keyof typeof managementSections)[],
  ],
);
export type ManagementSection = z.infer<typeof ManagementSectionSchema>;
export const managementFieldLabels: Record<Field, string> = {
  name: "Nome ou descrição",
  date: "Data",
  notes: "Observações",
  animal: "Animal (brinco ou nome)",
  lot: "Lote",
  location: "Local",
  responsible: "Responsável",
  areaHa: "Área (ha)",
  capacity: "Capacidade de animais",
  forage: "Pastagem",
  method: "Tipo ou método",
  medicine: "Medicamento ou vacina",
  dose: "Dose aplicada informada",
  result: "Resultado ou situação",
  expectedDate: "Previsão de parto",
  sire: "Pai ou material genético informado",
  score: "Escore (1 a 5)",
  appearance: "Aspecto e achados",
  ph: "pH",
  nitrogen: "Nitrogênio (kg/ha)",
  phosphorus: "Fósforo (mg/dm³)",
  potassium: "Potássio (mg/dm³)",
  organicMatter: "Matéria orgânica (%)",
  depthCm: "Profundidade (cm)",
  restDays: "Vedação (dias)",
  heightCm: "Altura (cm)",
  amountCents: "Valor (R$)",
  dueDate: "Vencimento",
  counterparty: "Fornecedor ou cliente",
  category: "Categoria",
  unit: "Unidade",
  minimumQty: "Estoque mínimo",
  quantity: "Quantidade",
  formula: "Fórmula ou dieta",
  ingredients: "Ingredientes",
  vehicle: "Veículo ou máquina",
  vehicleType: "Tipo de veículo",
  plate: "Placa",
  fuel: "Combustível",
  meterKm: "Hodômetro (km)",
  meterHours: "Horímetro (h)",
  nextDate: "Próxima manutenção",
  status: "Situação",
  severity: "Severidade",
  action: "Ação tomada",
};
export const managementNumericFields: Field[] = [
  "areaHa",
  "capacity",
  "score",
  "ph",
  "nitrogen",
  "phosphorus",
  "potassium",
  "organicMatter",
  "depthCm",
  "restDays",
  "heightCm",
  "amountCents",
  "minimumQty",
  "quantity",
  "meterKm",
  "meterHours",
];
const provenance = z
  .object({
    messageId: text,
    actor: z.string().regex(/^\d{6,20}$/),
    at: z.iso.datetime(),
    confirmed: z.literal(true),
    sourceAt: z.iso.datetime().optional(),
  })
  .strict();
export const ManagementBookSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            id: text,
            section: ManagementSectionSchema,
            values: ManagementValuesSchema,
            source: provenance,
            revisions: z
              .array(z.object({ values: ManagementValuesSchema, source: provenance }).strict())
              .max(500),
            removed: z.object({ reason: text, source: provenance }).strict().optional(),
            settlementHistory: z
              .array(
                z
                  .object({
                    date: z.iso.date(),
                    ledgerId: text,
                    source: provenance,
                    reason: text,
                    reversedBy: provenance,
                  })
                  .strict(),
              )
              .max(500)
              .optional(),
            settlement: z
              .object({ date: z.iso.date(), ledgerId: text, source: provenance })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(5000),
  })
  .strict();
export type ManagementBook = z.infer<typeof ManagementBookSchema>;
export const ManagementActionSchemas = [
  z
    .object({
      kind: z.literal("management_unsettle"),
      section: z.enum(["payable", "receivable"]),
      reference: text,
      reason: text,
    })
    .strict(),
  z
    .object({
      kind: z.literal("management_save"),
      section: ManagementSectionSchema,
      reference: text.optional(),
      values: ManagementValuesSchema,
      clear: z.array(ManagementValuesSchema.keyof()).max(40).optional(),
    })
    .strict()
    .refine((a) => Object.keys(a.values).length > 0 || !!a.clear?.length, "Informe a alteração."),
  z
    .object({
      kind: z.literal("management_remove"),
      section: ManagementSectionSchema,
      reference: text,
      reason: text,
    })
    .strict(),
  z
    .object({
      kind: z.literal("management_settle"),
      section: z.enum(["payable", "receivable"]),
      reference: text,
      date: z.iso.date(),
    })
    .strict(),
] as const;
export const ManagementActionSchema = z.discriminatedUnion("kind", ManagementActionSchemas);
export type ManagementAction = z.infer<typeof ManagementActionSchema>;
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function managementEntries(book: Pick<FarmBook, "management">, section?: ManagementSection) {
  return (book.management?.entries ?? []).filter(
    (e) => !e.removed && (!section || e.section === section),
  );
}
function resolveEntry(book: FarmBook, section: ManagementSection, reference: string) {
  const rows = managementEntries(book, section);
  const exact = rows.filter((e) => e.id === reference);
  const matches = exact.length
    ? exact
    : rows.filter((e) => key(e.values.name ?? "") === key(reference));
  if (matches.length !== 1)
    throw Error(
      matches.length
        ? "Há registros com o mesmo nome. Informe a data ou o código do registro correto."
        : "Não encontrei esse registro nesta fazenda. Confira o nome antes de alterar.",
    );
  return matches[0];
}
export function managementValueText(field: string, value: unknown): string {
  if (field === "amountCents")
    return (Number(value) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (Array.isArray(value))
    return value.map((i) => `${i.product}: ${i.quantity} ${i.unit}`).join("; ");
  const states: Record<string, string> = {
    open: "pendente",
    in_progress: "em andamento",
    done: "concluído",
    cancelled: "cancelado",
    active: "ativo",
    inactive: "inativo",
    low: "baixa",
    medium: "média",
    high: "alta",
  };
  return ["status", "severity"].includes(field)
    ? (states[String(value)] ?? String(value))
    : String(value);
}
export function describeManagement(a: ManagementAction) {
  const label = managementSections[a.section].label;
  if (a.kind === "management_unsettle")
    return `Estornar a quitação de ${a.reference}: ${a.reason}. O histórico será preservado e a conta voltará a ficar pendente.`;
  if (a.kind === "management_remove")
    return `Remover de ${label}: ${a.reference}. Motivo: ${a.reason}. O histórico fica preservado.`;
  if (a.kind === "management_settle")
    return `Registrar ${a.section === "payable" ? "pagamento" : "recebimento"} de ${a.reference} em ${a.date}, uma única vez no financeiro.`;
  return `${a.reference ? "Alterar" : "Adicionar"} em ${label}: ${Object.entries(a.values)
    .map(([k, v]) => `${managementFieldLabels[k as Field]}: ${managementValueText(k, v)}`)
    .join(
      "; ",
    )}${a.clear?.length ? "; limpar: " + a.clear.map((k) => managementFieldLabels[k]).join(", ") : ""}.`;
}
export function applyManagement(
  book: FarmBook,
  action: ManagementAction,
  source: Provenance,
  id: string,
) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(source.at),
  );
  if (action.kind !== "management_save") {
    const row = resolveEntry(book, action.section, action.reference);
    if (action.kind === "management_settle") {
      if (action.date > today) throw Error("Pagamento realizado não pode estar no futuro.");
      if (row.settlement) throw Error("Essa conta já foi quitada. Nenhum valor foi duplicado.");
      const ledgerId = `account:${row.id}:${row.settlementHistory?.length ?? 0}`;
      if (book.ledger.some((e) => e.id === ledgerId))
        throw Error("Já existe o lançamento dessa conta.");
      book.ledger.push({
        id: ledgerId,
        direction: action.section === "payable" ? "expense" : "income",
        amountCents: row.values.amountCents!,
        description: row.values.name!,
        date: action.date,
        category: row.values.category,
        source,
      });
      row.settlement = { date: action.date, ledgerId, source };
    } else if (action.kind === "management_unsettle") {
      if (!row.settlement) throw Error("Essa conta não tem quitação ativa para estornar.");
      const ledger = book.ledger.find((e) => e.id === row.settlement!.ledgerId);
      if (!ledger || ledger.voided)
        throw Error("Não encontrei o lançamento ativo da quitação. Confira o financeiro.");
      const history = (row.settlementHistory ??= []);
      if (history.length >= 500) throw Error("Limite de estornos atingido.");
      history.push({ ...row.settlement, reason: action.reason, reversedBy: source });
      ledger.voided = { reason: action.reason, source };
      delete row.settlement;
    } else {
      // Archiving an account keeps the actual payment in the ledger. A payment
      // is a historical fact; removal of a reminder must never erase cash flow.
      row.removed = { reason: action.reason, source };
    }
    return;
  }
  const def: Definition = managementSections[action.section];
  for (const field of [...Object.keys(action.values), ...(action.clear ?? [])] as Field[])
    if (!def.fields.includes(field))
      throw Error(`O campo ${managementFieldLabels[field]} não pertence a ${def.label}.`);
  const prior = action.reference ? resolveEntry(book, action.section, action.reference) : undefined;
  if (prior?.settlement)
    throw Error("Essa conta foi quitada; estorne a quitação antes de alterar a conta.");
  const values = ManagementValuesSchema.parse({ ...prior?.values, ...action.values });
  if (action.clear?.length && !prior)
    throw Error("Só é possível limpar campos de um registro existente.");
  for (const field of action.clear ?? []) delete values[field];
  if (
    values.status &&
    (action.section === "vehicle"
      ? !["active", "inactive"].includes(values.status)
      : !["open", "in_progress", "done", "cancelled"].includes(values.status))
  )
    throw Error("Situação inválida para essa função.");
  for (const field of def.required)
    if (values[field] === undefined || values[field] === "")
      throw Error(`Falta informar ${managementFieldLabels[field]} para ${def.label}.`);
  if (def.event && values.date! > today)
    throw Error(
      "Evento realizado não pode ter data futura. Agende uma tarefa para o planejamento.",
    );
  if (values.animal) {
    const matches = book.animals.filter(
      (a) => key(a.code) === key(values.animal!) || key(a.name ?? "") === key(values.animal!),
    );
    if (matches.length !== 1)
      throw Error(
        "Não encontrei um único animal com essa identificação nesta fazenda. Informe o brinco ou registre por lote.",
      );
    values.animal = matches[0].code;
  }
  for (const [field, section] of [
    ["formula", "formula"],
    ["vehicle", "vehicle"],
  ] as const)
    if (values[field]) values[field] = resolveEntry(book, section, values[field]!).values.name!;
  if (values.vehicle && action.section === "maintenance" && values.status === "done") {
    const vehicle = resolveEntry(book, "vehicle", values.vehicle);
    if (vehicle.revisions.length >= 500) throw Error("Limite de alterações do veículo atingido.");
    vehicle.revisions.push({ values: structuredClone(vehicle.values), source });
    if (values.nextDate) vehicle.values.nextDate = values.nextDate;
    if (values.meterKm !== undefined)
      vehicle.values.meterKm = Math.max(vehicle.values.meterKm ?? 0, values.meterKm);
    if (values.meterHours !== undefined)
      vehicle.values.meterHours = Math.max(vehicle.values.meterHours ?? 0, values.meterHours);
  }
  if (prior) {
    if (prior.revisions.length >= 500) throw Error("Limite de alterações do registro atingido.");
    // Names used as foreign references stay stable; renaming would orphan history.
    if (
      ["formula", "vehicle"].includes(action.section) &&
      prior.values.name !== values.name &&
      managementEntries(book).some(
        (e) => e.values.formula === prior.values.name || e.values.vehicle === prior.values.name,
      )
    )
      throw Error(
        "Esse nome está vinculado a outros registros. Preserve o nome ou remova os vínculos antes de renomear.",
      );
    prior.revisions.push({ values: structuredClone(prior.values), source });
    prior.values = values;
  } else {
    if (
      managementEntries(book, action.section).some(
        (e) =>
          key(e.values.name!) === key(values.name!) &&
          (!values.date || e.values.date === values.date),
      )
    )
      throw Error(
        "Já existe um registro com esse nome e data. Peça para alterar o existente ou use uma descrição distinta.",
      );
    const management = (book.management ??= { entries: [] });
    if (management.entries.length >= 5000) throw Error("Limite técnico de registros atingido.");
    management.entries.push({ id, section: action.section, values, source, revisions: [] });
  }
}
export function managementReport(book: FarmBook, section?: ManagementSection, reference?: string) {
  const rows = managementEntries(book, section).filter(
    (e) => !reference || key(e.values.name ?? "").includes(key(reference)) || e.id === reference,
  );
  return rows.length
    ? rows
        .slice(-40)
        .map(
          (e) =>
            `${managementSections[e.section].label}: ${Object.entries(e.values)
              .map(([k, v]) => `${managementFieldLabels[k as Field]}: ${managementValueText(k, v)}`)
              .join(
                "; ",
              )}${e.settlement ? `; quitada em ${e.settlement.date}` : ["payable", "receivable"].includes(e.section) ? "; pendente" : ""} [${e.id}]`,
        )
        .join("\n") +
        (rows.length > 40 ? `\nMostrando 40 de ${rows.length} registros; refine a consulta.` : "")
    : "Nenhum registro encontrado nessa consulta da fazenda.";
}
export const MANAGEMENT_DIRECTIVE = `Gestão ampliada: use management_save para adicionar/alterar, management_remove para remover com motivo e histórico, management_settle para quitar contas (date do pagamento/recebimento real). Para corrigir quitação use management_unsettle com reference/reason; depois pode editar a conta e quitar novamente, preservando estorno. Limpar campo opcional usa clear com nomes de campos; nunca limpar campo obrigatório. Na alteração forneça reference do registro REAL (id ou nome exato) e apenas values alterados; não recrie nem complete campos não informados. Em remoção informe referência inequívoca; duplicidade de nomes exige esclarecer. Nunca invente um ID. Consulta usa intent inspect, inspection {kind:'management',section opcional,reference opcional}, entries vazio; servidor lê o livro completo. Livros parciais não autorizam presumir ausência de registros. Nome de registro novo deve resumir a descrição do produtor, não inventar fatos. Dinheiro em amountCents. Não registre planos como procedimentos realizados. Contas futuras usam payable/receivable e dueDate, nunca ledger até a quitação real. Quitar gera receita/despesa uma vez. Não registre ledger junto de management_settle. Valores de procedimentos/OS são informativos; registrar despesa exige ledger explícito no mesmo lote. Ficha de parto complementa o evento herd_event birth; quando o produtor relata nascimento, preserve o evento que atualiza a contagem e não o substitua somente por calving. Não duplique nascimentos antigos. Fórmulas usam ingredients [{product,quantity,unit}] com unidades explícitas. Fornecimento feeding registra consumo informado, sem prescrever dose, converter sacos, inferir baixa de estoque ou pagamento. Dose, resultados de exame e gestação são exclusivamente os relatados pelo produtor. Evento por lote não exige brincos individuais. Rondas e ocorrências podem acompanhar task_create quando o produtor pede uma tarefa com data/hora. Use as ações atuais de pesagem, movimentação de rebanho, estoque, combustível e tarefas para seus saldos reais. Campos permitidos e obrigatórios por seção: ${JSON.stringify(managementSections)}. Estados: open pendente/aberta; in_progress em andamento; done concluída; cancelled cancelada; active ativo; inactive inativo. Severidade low baixa, medium média, high alta. Estoque usa supply_movement com location opcional e supply_transfer entre from/to com item/unit/quantity/date. Contagem inicial por local (balance) exige quantidade relatada, inclusive zero: não invente contagem. Correção de movimento real usa supply_edit id/quantity/date; cancelamento usa supply_void id/reason e cancela as duas pontas da transferência. Agenda tem prioridade sobre alimentação quando o pedido é um lembrete: “amanhã às 8h me lembre de dar ração” é somente task_create, intent apply, com a primeira data/hora informadas. Isso não é feeding nem um evento realizado. Para ordem direta de nova tarefa com data/hora explícitas, não peça conferência: use apply, inclusive lembrete único; propose só quando faltar uma informação e for preciso sugerir um padrão. Não use management para alterar contas, acessos ou permissões do sistema.`;
