import { createHash } from "node:crypto";
import { farmName, type FarmBook, type GuardianEvent } from "./schema.ts";
import { farmIndicators } from "./operations.ts";
import { localDay } from "../chat/context/recall.ts";

export function farmRuleEvents(
  book: FarmBook,
  version: number,
  recipient: string,
  now = new Date(),
): GuardianEvent[] {
  const rules = book.operations?.alertRules;
  if (!rules?.enabled) return [];
  const today = localDay(now),
    start = new Date(Date.parse(today + "T12:00:00Z") - (rules.mortalityWindowDays - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
  const data = farmIndicators(book, start, today),
    events: GuardianEvent[] = [];
  const add = (
    rule: string,
    topic: "health" | "performance",
    key: string,
    message: string,
    evidence: Record<string, unknown>,
  ) => {
    events.push({
      type: topic === "health" ? "health_followup" : "performance_change",
      topic,
      key: `rule:${rule}:${createHash("sha256").update(key).digest("hex").slice(0, 32)}`,
      recipient,
      notBefore: now.toISOString(),
      expiresAt: new Date(now.getTime() + 6 * 3600000).toISOString(),
      priority: 3,
      message: `${farmName(book)}: ${message}`,
      evidence: { ruleVersion: "guardian-rules-v1", sourceVersion: version, rule, ...evidence },
    });
  };
  if (rules.minGmd !== undefined) {
    const below: Array<{
      animal: string;
      initialKg: number;
      finalKg: number;
      from: string;
      to: string;
      value: number;
    }> = [];
    for (const animal of book.animals) {
      const measured = animal.weights.filter((w) => !w.estimated && w.date <= today).slice(-2);
      const [first, last] = measured;
      if (
        !first ||
        !last ||
        first.date === last.date ||
        Date.parse(today) - Date.parse(last.date) > 30 * 86400000
      )
        continue;
      const value =
        (last.weightKg - first.weightKg) /
        ((Date.parse(last.date) - Date.parse(first.date)) / 86400000);
      if (value < rules.minGmd)
        below.push({
          animal: animal.code,
          initialKg: first.weightKg,
          finalKg: last.weightKg,
          from: first.date,
          to: last.date,
          value,
        });
    }
    if (below.length)
      add(
        "gmd",
        "performance",
        JSON.stringify(below) + ":" + rules.minGmd,
        `${below.length} animais com pesagens informadas têm GMD abaixo do limite de ${rules.minGmd} kg/dia que você configurou. ${below
          .slice(0, 3)
          .map(
            (g) =>
              `Animal ${g.animal}: ${g.value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg/dia (${g.from} a ${g.to})`,
          )
          .join(
            "; ",
          )}. Confira os dados, alimentação e manejo no painel; isso não estabelece diagnóstico.`,
        {
          affectedCount: below.length,
          examples: below.slice(0, 10),
          examplesPartial: below.length > 10,
          threshold: rules.minGmd,
        },
      );
  }
  if (
    rules.staleDays &&
    data.stock.baseline &&
    Date.parse(today) - Date.parse(data.stock.baseline.date) >= rules.staleDays * 86400000
  )
    add(
      "stale_count",
      "performance",
      `${data.stock.baseline.id}:${Math.floor(Date.parse(today) / (7 * 86400000))}`,
      `a última contagem declarada é de ${data.stock.baseline.date}. Quer conferir a quantidade atual? O limite de atualização configurado é de ${rules.staleDays} dias.`,
      {
        baselineId: data.stock.baseline.id,
        date: data.stock.baseline.date,
        thresholdDays: rules.staleDays,
      },
    );
  if (rules.mortalityCount && data.deaths >= rules.mortalityCount) {
    const ids = book
      .operations!.movements.filter((m) => m.type === "death" && m.date >= start && m.date <= today)
      .map((m) => m.id)
      .sort()
      .join(":");
    add(
      "mortality_count",
      "health",
      ids,
      `há ${data.deaths} mortes registradas de ${start} a ${today}, atingindo o limite de ${rules.mortalityCount} que você configurou. Confira os relatos e procure avaliação veterinária se houver sinais de doença ou novas ocorrências. Sem censo completo, isso não é uma taxa de mortalidade.`,
      { count: data.deaths, from: start, to: today, threshold: rules.mortalityCount },
    );
  }
  return events.slice(0, 20);
}
