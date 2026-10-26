import { z } from "zod";
import type { FarmBook, Provenance } from "./schema.ts";

const label = z.string().trim().min(1).max(160);
const count = z.number().int().min(0).max(1e7);
const day = z.iso.date();
export const movementTypes = [
  "birth",
  "death",
  "purchase",
  "sale",
  "transfer_in",
  "transfer_out",
] as const;
export const AlertRulesSchema = z
  .object({
    enabled: z.boolean(),
    minGmd: z.number().finite().min(-10).max(10).optional(),
    staleDays: z.number().int().min(1).max(3650).optional(),
    mortalityCount: z.number().int().min(1).max(100000).optional(),
    mortalityWindowDays: z.number().int().min(1).max(90).default(7),
  })
  .strict();
export const OperationsActionSchemas = [
  z
    .object({
      kind: z.literal("property_transfer"),
      toPropertyId: z.uuid(),
      count: count.min(1),
      date: day,
      fromLot: label.optional(),
      toLot: label.optional(),
    })
    .strict(),
  AlertRulesSchema.extend({ kind: z.literal("alert_rules") }).strict(),
  z
    .object({
      kind: z.literal("feed_consumption"),
      feed: label,
      kg: z.number().finite().positive().max(1e9),
      basis: z.enum(["measured", "estimated"]),
      date: day,
      lot: label.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("herd_count"), count, date: day, lot: label.optional() }).strict(),
  z
    .object({
      kind: z.literal("herd_event"),
      type: z.enum(movementTypes),
      count: count.min(1),
      date: day,
      lot: label.optional(),
      description: label,
      replaces: label.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("lot_transfer"),
      from: label,
      to: label,
      count: count.min(1),
      date: day,
    })
    .strict(),
  z
    .object({
      kind: z.literal("lot_update"),
      lot: label,
      pasture: label.optional(),
      areaHa: z.number().positive().max(1e7).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("property_update"),
      name: label.optional(),
      aliases: z.array(label).max(20).optional(),
      responsibleName: label.optional(),
      address: label.optional(),
      latitude: z.number().finite().min(-90).max(90).optional(),
      longitude: z.number().finite().min(-180).max(180).optional(),
      city: label.optional(),
      uf: z
        .string()
        .regex(
          /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
        )
        .optional(),
      areaHa: z.number().positive().max(1e7).optional(),
      pastureHa: z.number().positive().max(1e7).optional(),
      production: z.enum(["beef", "milk", "mixed"]).optional(),
    })
    .strict(),
] as const;
export const OperationsActionSchema = z.discriminatedUnion("kind", OperationsActionSchemas);
export type OperationsAction = z.infer<typeof OperationsActionSchema>;
export function describeOperations(action: OperationsAction): string {
  const lot = (value?: string) => (value ? `, lote ${value}` : ", rebanho da fazenda");
  switch (action.kind) {
    case "property_transfer":
      return `Transferir ${action.count} animais da fazenda selecionada${action.fromLot ? `, lote ${action.fromLot}` : ""} para a propriedade ${action.toPropertyId}${action.toLot ? `, lote ${action.toLot}` : ""} em ${action.date}. As duas fazendas serão atualizadas juntas, após conferir acesso e saldo.`;
    case "herd_count":
      return `Informar ${action.count} cabeças no fim do dia ${action.date}${lot(action.lot)}. A contagem anterior fica no histórico; não cria fichas individuais.`;
    case "herd_event":
      return `Registrar ${{ birth: "nascimento", death: "morte", purchase: "compra", sale: "venda", transfer_in: "entrada", transfer_out: "saída" }[action.type]} de ${action.count} animais em ${action.date}${lot(action.lot)}: ${action.description}.${action.replaces ? ` Corrige o evento ${action.replaces}, preservando o original.` : ""}`;
    case "lot_transfer":
      return `Transferir ${action.count} animais do lote ${action.from} para o lote ${action.to} em ${action.date}. O total da fazenda permanece igual.`;
    case "lot_update":
      return `Atualizar o lote ${action.lot}${action.pasture ? `, pastagem ${action.pasture}` : ""}${action.areaHa ? `, área ${action.areaHa} ha` : ""}.`;
    case "feed_consumption":
      return `Registrar consumo ${action.basis === "measured" ? "informado como medido" : "estimado"} de ${action.kg} kg de ${action.feed} em ${action.date}${lot(action.lot)}. Não é uma recomendação de alimentação.`;
    case "property_update": {
      const labels: Record<string, string> = {
        name: "Nome",
        city: "Município",
        uf: "UF",
        aliases: "Apelidos",
        responsibleName: "Responsável declarado",
        address: "Endereço",
        latitude: "Latitude",
        longitude: "Longitude",
        areaHa: "Área total (ha)",
        pastureHa: "Área de pastagem (ha)",
        production: "Produção",
      };
      return (
        "Atualizar os dados informados da fazenda:\n" +
        Object.entries(action)
          .filter(([key]) => key !== "kind")
          .map(
            ([key, value]) =>
              `${labels[key]}: ${Array.isArray(value) ? value.join(", ") : key === "production" ? ({ beef: "Corte", milk: "Leite", mixed: "Misto" } as Record<string, string>)[String(value)] : value}`,
          )
          .join("\n")
      );
    }
    case "alert_rules":
      return `${action.enabled ? "Ativar" : "Pausar"} a análise de regras da fazenda.${action.minGmd !== undefined ? ` Avisar GMD abaixo de ${action.minGmd} kg/dia.` : ""}${action.staleDays ? ` Pedir atualização da contagem após ${action.staleDays} dias.` : ""}${action.mortalityCount ? ` Avisar a partir de ${action.mortalityCount} mortes registradas em ${action.mortalityWindowDays} dias.` : ""} O envio depende das preferências e do consentimento que você autorizou no WhatsApp.`;
  }
}
const source = z
  .object({
    actor: z.string(),
    messageId: z.string(),
    at: z.iso.datetime(),
    sourceAt: z.iso.datetime().optional(),
    confirmed: z.literal(true),
  })
  .strict();
export const OperationsSchema = z
  .object({
    categoryCounts: z
      .array(
        z
          .object({
            id: label,
            category: z.enum(["cows", "oxen", "calves", "heifers"]),
            count,
            date: day,
            source,
          })
          .strict(),
      )
      .max(10000)
      .optional(),
    alertRules: AlertRulesSchema.optional(),
    feed: z
      .array(
        z
          .object({
            id: label,
            feed: label,
            kg: z.number().finite().positive().max(1e9),
            basis: z.enum(["measured", "estimated"]),
            date: day,
            lot: label.optional(),
            source,
          })
          .strict(),
      )
      .max(10000)
      .optional(),
    counts: z
      .array(z.object({ id: label, count, date: day, lot: label.optional(), source }).strict())
      .max(10000)
      .default([]),
    movements: z
      .array(
        z
          .object({
            id: label,
            type: z.enum(movementTypes),
            count: count.min(1),
            date: day,
            lot: label.optional(),
            description: label,
            replaces: label.optional(),
            source,
          })
          .strict(),
      )
      .max(10000)
      .default([]),
    lots: z
      .array(
        z
          .object({
            name: label,
            pasture: label.optional(),
            areaHa: z.number().positive().max(1e7).optional(),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
    aliases: z.array(label).max(20).optional(),
    responsibleName: label.optional(),
    address: label.optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    areaHa: z.number().positive().max(1e7).optional(),
    pastureHa: z.number().positive().max(1e7).optional(),
    production: z.enum(["beef", "milk", "mixed"]).optional(),
  })
  .strict();
export type Operations = z.infer<typeof OperationsSchema>;
export const emptyOperations = (): Operations => ({ counts: [], movements: [], lots: [] });
const incoming = (type: string) => ["birth", "purchase", "transfer_in"].includes(type);
export function stockAt(operations: Operations, date: string, lot?: string) {
  const baseline = operations.counts
    .filter((c) => c.date <= date && c.lot === lot)
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))
    .at(-1);
  if (!baseline) return { count: null, baseline: null, included: [] as string[] };
  const replaced = new Set(operations.movements.map((m) => m.replaces).filter(Boolean));
  // A headcount is an end-of-day snapshot; same-day movements are already included.
  const included = operations.movements.filter(
    (m) =>
      !replaced.has(m.id) && m.date > baseline.date && m.date <= date && (!lot || m.lot === lot),
  );
  return {
    count:
      baseline.count + included.reduce((n, m) => n + (incoming(m.type) ? m.count : -m.count), 0),
    baseline,
    included: included.map((m) => m.id),
  };
}
export function applyOperations(
  book: FarmBook,
  action: OperationsAction,
  provenance: Provenance,
  id: string,
) {
  if (action.kind === "property_transfer")
    throw new Error(
      "Transferências entre propriedades exigem autorização e atualização conjunta das duas fazendas pelo WhatsApp.",
    );
  const operations = (book.operations ??= emptyOperations());
  if (action.kind === "alert_rules") {
    const { kind: _, ...rules } = action;
    operations.alertRules = rules;
    return;
  }
  if (action.kind === "property_update") {
    const { kind: _, name, city, uf, ...attributes } = action;
    if (name !== undefined) book.name = name;
    if (city !== undefined) book.city = city;
    if (uf !== undefined) book.uf = uf;
    Object.assign(operations, attributes);
    if ((operations.latitude === undefined) !== (operations.longitude === undefined))
      throw new Error("Informe latitude e longitude juntas, sem deduzir coordenadas pela cidade.");
    if (operations.areaHa && operations.pastureHa && operations.pastureHa > operations.areaHa)
      throw new Error("A área de pastagem não pode superar a área total.");
    return;
  }
  if (action.kind === "lot_update") {
    const prior = operations.lots.find((l) => l.name === action.lot);
    if (prior)
      Object.assign(prior, {
        ...(action.pasture ? { pasture: action.pasture } : {}),
        ...(action.areaHa ? { areaHa: action.areaHa } : {}),
      });
    else {
      if (operations.lots.length >= 1000)
        throw new Error("O volume atingiu o limite técnico de lotes.");
      operations.lots.push({ name: action.lot, pasture: action.pasture, areaHa: action.areaHa });
    }
    return;
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(provenance.at),
  );
  if (action.date > today)
    throw new Error("A data de um evento realizado não pode estar no futuro.");
  if (action.kind === "feed_consumption") {
    const { kind: _, ...entry } = action;
    const feed = (operations.feed ??= []);
    if (feed.length >= 10000)
      throw new Error("O volume atingiu o limite técnico dos registros de consumo.");
    feed.push({ ...entry, id, source: provenance });
    return;
  }
  if (action.kind === "herd_count") {
    operations.counts.push({
      id,
      count: action.count,
      date: action.date,
      lot: action.lot,
      source: provenance,
    });
  } else if (action.kind === "lot_transfer") {
    if (action.from === action.to)
      throw new Error("Escolha lotes diferentes para a transferência.");
    const origin = stockAt(operations, action.date, action.from);
    const destination = stockAt(operations, action.date, action.to);
    if (
      !origin.baseline ||
      !destination.baseline ||
      action.date <= origin.baseline.date ||
      action.date <= destination.baseline.date
    )
      throw new Error(
        "Informe a contagem de ambos os lotes no fim de um dia anterior à transferência.",
      );
    const available = origin.count;
    if (available === null || available < action.count)
      throw new Error(
        "Não há saldo conhecido suficiente no lote de origem. Confira a contagem e a data.",
      );
    for (const [suffix, type, lot] of [
      ["out", "transfer_out", action.from],
      ["in", "transfer_in", action.to],
    ] as const)
      operations.movements.push({
        id: id + "-" + suffix,
        type,
        count: action.count,
        date: action.date,
        lot,
        description: "Transferência entre lotes",
        source: provenance,
      });
  } else {
    if (action.replaces) {
      const prior = operations.movements.find((m) => m.id === action.replaces);
      if (!prior || operations.movements.some((m) => m.replaces === action.replaces))
        throw new Error("Não encontrei um evento disponível para correção nesta fazenda.");
      if (prior.type.startsWith("transfer_"))
        throw new Error(
          "Uma transferência entre lotes precisa ser corrigida como uma operação completa.",
        );
    }
    const { kind: _, ...event } = action;
    operations.movements.push({ ...event, id, source: provenance });
  }
  if (action.kind === "herd_event") {
    const baseline = stockAt(operations, action.date, action.lot).baseline;
    if (baseline && baseline.date === action.date)
      throw new Error(
        "A contagem representa o fim desse dia. Informe a data correta ou revise a contagem antes de lançar um movimento no mesmo dia.",
      );
    if (!incoming(action.type) && !baseline)
      throw new Error("Informe uma contagem anterior para conferir o saldo antes desta saída.");
  }
  // One chronological sweep per scope, not repeated scans for every event/date.
  const replaced = new Set(operations.movements.map((m) => m.replaces).filter(Boolean));
  const scopes = new Map<
    string,
    Array<{ date: string; at: string; count: number; snapshot: boolean }>
  >();
  const add = (
    scope: string,
    row: { date: string; at: string; count: number; snapshot: boolean },
  ) => {
    const entries = scopes.get(scope) ?? [];
    entries.push(row);
    scopes.set(scope, entries);
  };
  for (const c of operations.counts)
    add(c.lot ?? "", { date: c.date, at: c.source.at, count: c.count, snapshot: true });
  for (const m of operations.movements) {
    if (replaced.has(m.id)) continue;
    const row = {
      date: m.date,
      at: m.source.at,
      count: (incoming(m.type) ? 1 : -1) * m.count,
      snapshot: false,
    };
    add("", row);
    if (m.lot) add(m.lot, row);
  }
  for (const entries of scopes.values()) {
    let balance: number | null = null;
    const days = new Map<string, typeof entries>();
    for (const row of entries) {
      const group = days.get(row.date) ?? [];
      group.push(row);
      days.set(row.date, group);
    }
    for (const date of [...days.keys()].sort()) {
      const group = days.get(date)!;
      const snapshot = group
        .filter((e) => e.snapshot)
        .sort((a, b) => a.at.localeCompare(b.at))
        .at(-1);
      if (snapshot) balance = snapshot.count;
      else if (balance !== null)
        balance += group.filter((e) => !e.snapshot).reduce((n, e) => n + e.count, 0);
      if (balance !== null && balance < 0)
        throw new Error(
          "A movimentação produziria saldo negativo. Confira quantidade, fazenda e data antes de salvar.",
        );
    }
  }
  if (
    operations.counts.length > 10000 ||
    operations.movements.length > 10000 ||
    operations.lots.length > 1000
  )
    throw new Error(
      "O volume atingiu o limite técnico deste caderno. Exporte os registros e contate o suporte.",
    );
}

export function farmIndicators(book: FarmBook, start: string, end: string) {
  const operations = book.operations ?? emptyOperations();
  const stock = stockAt(operations, end);
  const replaced = new Set(operations.movements.map((m) => m.replaces).filter(Boolean));
  const movements = operations.movements.filter(
    (m) => !replaced.has(m.id) && m.date >= start && m.date <= end,
  );
  const expenses = book.ledger
    .filter((l) => l.date >= start && l.date <= end && l.direction === "expense")
    .reduce((n, l) => n + l.amountCents, 0);
  const income = book.ledger
    .filter((l) => l.date >= start && l.date <= end && l.direction === "income")
    .reduce((n, l) => n + l.amountCents, 0);
  const history = operations.counts
    .filter((c) => !c.lot && c.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at));
  const firstCount = history.find((c) => c.date >= start) ?? history[0];
  const lastCount = history.at(-1);
  const evolution =
    firstCount && lastCount && firstCount.id !== lastCount.id
      ? {
          initial: firstCount.count,
          final: lastCount.count,
          from: firstCount.date,
          to: lastCount.date,
          change: lastCount.count - firstCount.count,
          percent:
            firstCount.count > 0
              ? ((lastCount.count - firstCount.count) / firstCount.count) * 100
              : null,
          formula:
            "(quantidade final − inicial) / inicial × 100; variação declarada, sem causa presumida",
        }
      : null;
  const categories: Record<string, NonNullable<Operations["categoryCounts"]>[number]> = {};
  for (const category of ["cows", "oxen", "calves", "heifers"] as const) {
    const latest = operations.categoryCounts
      ?.filter((c) => c.category === category && c.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))
      .at(-1);
    if (latest) categories[category] = latest;
  }
  const gmd = book.animals.flatMap((a) => {
    const weights = a.weights.filter((w) => !w.estimated && w.date >= start && w.date <= end);
    const first = weights[0],
      last = weights.at(-1);
    if (!first || !last || first.date === last.date) return [];
    return [
      {
        animal: a.code,
        value:
          (last.weightKg - first.weightKg) /
          ((Date.parse(last.date) - Date.parse(first.date)) / 86400000),
        start: first.date,
        end: last.date,
        initialKg: first.weightKg,
        finalKg: last.weightKg,
      },
    ];
  });
  return {
    ruleVersion: "guardian-operations-v1",
    start,
    end,
    stock: {
      ...stock,
      formula: "última contagem ao fim do dia + entradas posteriores − saídas posteriores",
      status: stock.count === null ? "missing_baseline" : "calculated_from_declarations",
    },
    births: movements.filter((m) => m.type === "birth").reduce((n, m) => n + m.count, 0),
    deaths: movements.filter((m) => m.type === "death").reduce((n, m) => n + m.count, 0),
    consumption: {
      measuredKg: (operations.feed ?? [])
        .filter((f) => f.date >= start && f.date <= end && f.basis === "measured")
        .reduce((n, f) => n + f.kg, 0),
      estimatedKg: (operations.feed ?? [])
        .filter((f) => f.date >= start && f.date <= end && f.basis === "estimated")
        .reduce((n, f) => n + f.kg, 0),
      formula:
        "Soma dos kg informados no período, mantendo medidos e estimados separados; sem conversão implícita para matéria seca.",
    },
    categories,
    evolution,
    countHistory: history.slice(-8),
    gmd,
    gmdFormula: "(peso final − peso inicial) / dias; apenas pesagens não estimadas do mesmo animal",
    finances: {
      incomeCents: income,
      expenseCents: expenses,
      balanceCents: income - expenses,
      formula: "receitas registradas − despesas registradas; não representa lucro líquido",
    },
    missing: [
      "Taxas reprodutivas e de mortalidade exigem população exposta e cobertura completa do período.",
      "Produtividade por hectare exige produção medida no mesmo período e área produtiva correspondente.",
    ],
  };
}
