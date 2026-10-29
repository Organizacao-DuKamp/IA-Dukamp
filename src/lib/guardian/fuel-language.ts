import { FuelActionSchema, type FuelAction, type FuelType } from "./fuel.ts";
import { amountIn, moneyValue } from "./record-dialogue.ts";
import { eventDay } from "./herd-event-language.ts";
import { localDay } from "../chat/context/recall.ts";

export const fuelFold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
export const fuelTopic = (s: string) =>
  /\b(?:diesel|gasolina|etanol|combustive(?:l|is)|alcool)\b/.test(fuelFold(s));
export function fuelClauses(text: string) {
  return text
    .split(
      /[;\n]+|(?<=[.!?])\s+(?=[A-Za-zÀ-ÖØ-öø-ÿ])|[,\s]+e\s+(?=(?:hoje\s+|ontem\s+)?(?:entrou|entraram|saiu|sa[ií]ram|coloquei|abasteci|paguei|gastei|tirei|retirei|recebi|comprei|nasceram|anote|registre|me lembra)\b)|,\s*(?=(?:paguei|gastei)\b)/i,
    )
    .map((x) => x.trim())
    .filter(Boolean);
}
export function fuelPeriod(text: string, at: Date) {
  const t = fuelFold(text),
    day = localDay(at),
    d = new Date(day + "T12:00:00Z");
  const relative =
    /\b(?:(?:esse|este|nesse|neste) mes|mes (?:atual|passado)|mensal|total (?:do|no) mes)\b/.test(
      t,
    );
  const numeric = t.match(/(?<![\d/])(?:mes\s+)?(0[1-9]|1[0-2])\/(20\d{2})\b/);
  const names = [
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const named = names.findIndex((n) => new RegExp("\\b(?:em|de|mes de) " + n + "\\b").test(t));
  if (/mes passado/.test(t)) d.setUTCMonth(d.getUTCMonth() - 1, 1);
  if (numeric) return `${numeric[2]}-${numeric[1]}`;
  if (named >= 0)
    return `${t.match(/\b20\d{2}\b/)?.[0] ?? day.slice(0, 4)}-${String(named + 1).padStart(2, "0")}`;
  return relative ? d.toISOString().slice(0, 7) : undefined;
}
export type FuelObservation =
  | { status: "none" | "ignored"; residual: string }
  | { status: "query"; month?: string; compare: boolean; residual: string }
  | { status: "pending"; question: string; residual: string }
  | { status: "actions"; actions: FuelAction[]; residual: string };
export function fuelObservation(text: string, at: Date): FuelObservation {
  if (!fuelTopic(text)) return { status: "none", residual: text };
  const t = fuelFold(text);
  if (/\b(?:na verdade|corrigir|corrija|errei)\b/.test(t) && !fuelPeriod(text, at))
    return { status: "ignored", residual: text };
  if (
    /\b(?:nao|vou|vamos|irei|pretendo|talvez|se eu|vizinh[oa]|disse|falou|simul\w*|orcamento|previsao)\b|["“”]|```|(?:^|\n)\s*>/.test(
      t,
    )
  )
    return { status: "ignored", residual: text };
  const month =
    /compar/.test(t) && /com (?:o )?mes passado/.test(t) ? undefined : fuelPeriod(text, at);
  if (
    /\b(?:quanto|quantos|quantas|qual|saldo|resumo|comparar|compare|mostr[ae]|consultar|relatorio)\b/.test(
      t,
    ) &&
    !/\b(?:registre|registra|anote|anota|lance|salve|informar)\b/.test(t)
  )
    return { status: "query", month, compare: /compar/.test(t), residual: "" };
  const actions: FuelAction[] = [],
    rest: string[] = [];
  for (const raw of fuelClauses(text)) {
    let clause = raw;
    if (
      !fuelTopic(clause) &&
      /\b(?:entrou|entraram|saiu|saíram|sairam|tirei|retirei|coloquei|abasteci)\b.*\b(?:litros?|l)\b/i.test(
        clause,
      )
    ) {
      const types = [...new Set(actions.filter((a) => a.kind !== "fuel_void").map((a) => a.fuel))];
      const prior = actions.at(-1);
      if (types.length === 1 && prior?.kind === "fuel_movement")
        clause = `${prior.fuel === "gasoline" ? "gasolina" : prior.fuel === "ethanol" ? "etanol" : "diesel"} no tanque ${prior.tank}: ${clause}`;
      else if (types.length > 1)
        return {
          status: "pending",
          question:
            "Essa movimentação foi de diesel, gasolina ou etanol? Preciso manter os combustíveis separados.",
          residual: text,
        };
    }
    if (!fuelTopic(clause)) {
      const prior = actions.at(-1),
        paid = amountIn(clause)?.amount;
      if (
        prior?.kind === "fuel_movement" &&
        prior.type === "in" &&
        !prior.amountCents &&
        paid &&
        /^(?:paguei|gastei)\s+(?:r\$\s*)?[\d., ]+(?:reais)?[.! ]*$/i.test(clause)
      ) {
        prior.amountCents = paid;
        continue;
      }
      rest.push(clause);
      continue;
    }
    const c = fuelFold(clause);
    if (/(?:^|\s)-\s*\d|\bmenos\s+\d/.test(c))
      return {
        status: "pending",
        question: "Confira o valor: litros e gastos não podem ser negativos.",
        residual: text,
      };
    const fuel: FuelType = /\bdiesel\b/.test(c)
      ? "diesel"
      : /\bgasolina\b/.test(c)
        ? "gasoline"
        : /\b(?:etanol|alcool)\b/.test(c)
          ? "ethanol"
          : "unspecified";
    if ([/\bdiesel\b/, /\bgasolina\b/, /\b(?:etanol|alcool)\b/].filter((r) => r.test(c)).length > 1)
      return {
        status: "pending",
        question:
          "Qual foi a quantidade ou o valor de cada combustível? Informe diesel e gasolina separadamente para eu não misturar os tanques.",
        residual: text,
      };
    const period = fuelPeriod(clause, at),
      date = eventDay(clause, at);
    if (
      date.invalid ||
      (date.ambiguous && !period) ||
      (/\b(?:hoje|ontem|anteontem)\b/.test(c) && period)
    )
      return {
        status: "pending",
        question:
          "Qual é a data desse registro de combustível? Informe uma única data, ou o mês se for um total financeiro.",
        residual: text,
      };
    if ([...clause.matchAll(/\d+(?:[.,]\d+)?\s*(?:litros?|l)\b/gi)].length > 1)
      return {
        status: "pending",
        question:
          "Há mais de uma quantidade de combustível nesse trecho. Informe os litros de cada entrada ou destino para eu registrar todos corretamente.",
        residual: text,
      };
    if ([...clause.matchAll(/r\$/gi)].length > 1)
      return {
        status: "pending",
        question:
          "Há mais de um valor em reais nesse trecho. Informe a que se refere cada valor para eu não somar uma compra duas vezes.",
        residual: text,
      };
    const volume = clause.match(
      /(\d{1,3}(?:\.\d{3})+(?:,\d{1,3})?|\d+(?:[.,]\d{1,3})?)\s*(?:litros?|l)\b/i,
    );
    let liters = volume
      ? Number(
          volume[1].includes(",") || /\.\d{3}$/.test(volume[1])
            ? volume[1].replace(/\./g, "").replace(",", ".")
            : volume[1],
        )
      : undefined;
    if (liters === undefined) {
      const words = clause
        .match(/([\p{L} ]{1,65})\s+litros?\b/iu)?.[1]
        ?.trim()
        .split(/\s+/);
      if (words)
        for (let n = 1; n <= Math.min(7, words.length); n++) {
          const v = moneyValue(words.slice(-n).join(" "));
          if (v !== null) liters = v / 100;
        }
    }
    let money = amountIn(clause)?.amount ?? undefined;
    if (money === undefined) {
      const raw = clause.match(
        /\b(?:custou|custo|gasto|gastei|paguei|deu|foi|fechou)\s+(?:de\s+)?(.+?)(?=\s+(?:com|de)\s+(?:gasolina|diesel|etanol|combustivel)|[.!;]|$)/i,
      )?.[1];
      if (raw) money = moneyValue(raw) ?? undefined;
    }
    const perLiter = /\bpor litro\b|\/\s*(?:l|litro)\b|\b(?:o|cada) litro\b/.test(c);
    const unitPriceCents = perLiter ? money : undefined;
    if (perLiter && liters === undefined)
      return {
        status: "pending",
        question:
          "Quantos litros foram comprados? Esse valor é por litro; preciso da quantidade para calcular o custo total.",
        residual: text,
      };
    if (perLiter && money && liters !== undefined) money = Math.round(money * liters);
    const balance =
      /\b(?:tem|tenho|ha|restam|restou|sobrou|saldo|estoque|esta com|ficou com|tanque esta|tanque tem|informar saldo)\b/.test(
        c,
      );
    const outgoing =
      /\b(?:saiu|sairam|tirei|tiramos|retirei|retiramos|consumi|consumimos|saida|retirada|consumo|usei|usamos|gastei|abasteci|abastecemos|destinei|foi para|foram para)\b/.test(
        c,
      );
    const incoming =
      /\b(?:entrou|entraram|recebi|recebemos|comprei|compramos|coloquei|colocamos|botei|pus|reabasteci|completei|entrada)\b/.test(
        c,
      );
    const movement = liters !== undefined || (!money && (balance || incoming || outgoing));
    if (movement) {
      if (fuel === "unspecified")
        return {
          status: "pending",
          question:
            "É diesel, gasolina ou etanol? Preciso identificar o combustível para atualizar o tanque certo.",
          residual: text,
        };
      if (period)
        return {
          status: "pending",
          question:
            "Em qual dia ocorreu essa movimentação em litros? Para um total de gastos do mês, informe o valor em reais.",
          residual: text,
        };
      if (liters === undefined)
        return {
          status: "pending",
          question: "Quantos litros de combustível foram movimentados?",
          residual: text,
        };
      const vehicle =
        /\b(?:trator|caminh[aã]o|caminhonete|gerador|colheitadeira|carro|moto)\b/i.test(clause);
      const tankFill = /\b(?:abasteci|abastecemos|completei)\s+(?:o\s+)?tanque\b/.test(c);
      const vehicleFill = /\b(?:coloquei|botei|pus)\b/.test(c) && vehicle;
      const type = balance
        ? "balance"
        : tankFill
          ? "in"
          : outgoing || vehicleFill
            ? "out"
            : incoming
              ? "in"
              : undefined;
      if (!type)
        return {
          status: "pending",
          question: "Esses litros são uma entrada, uma saída ou o saldo que há no tanque?",
          residual: text,
        };
      const tank = clause.match(
        /\btanque\s+(?:de\s+(?:diesel|gasolina|etanol)\s+)?(?:chamado\s+)?([\p{L}\d_-]+)(?!\p{L})/iu,
      )?.[1];
      const tankName =
        tank &&
        !/^(?:da|de|do|tem|esta|principalmente|hoje|ontem|diesel|gasolina|etanol)$/i.test(tank)
          ? tank
          : undefined;
      const dest =
        type === "out"
          ? (
              clause.match(
                /\b(?:para|pro|pra|no|na|o|a)\s+(?:(?:o|a)\s+)?((?:trator|caminh[aã]o|caminhonete|moto|carro|gerador|colheitadeira|pulverizador)[\p{L}\d _-]*?)(?=\s+(?:hoje|ontem|em|por|com|e paguei|do tanque)|[,;.!]|$)/iu,
              )?.[1] ??
              clause.match(
                /\b(?:para|pro|pra|destino)\s+(?:(?:o|a)\s+)?(.{1,80}?)(?=\s+(?:hoje|ontem|em \d|do tanque)|[,;.!]|$)/i,
              )?.[1]
            )?.trim()
          : undefined;
      if (type === "out" && !dest)
        return {
          status: "pending",
          question: "Para onde foi esse combustível? Pode dizer trator, caminhão ou outro destino.",
          residual: text,
        };
      if (type !== "in" && money && !/ja incluido|incluso|nova despesa/.test(c))
        return {
          status: "pending",
          question:
            "O valor em reais é uma nova despesa de combustível ou já faz parte da compra registrada? Preciso esclarecer isso para não somar o mesmo gasto duas vezes.",
          residual: text,
        };
      const parsed = FuelActionSchema.safeParse({
        kind: "fuel_movement",
        fuel,
        tank: tankName ?? "Principal",
        type,
        liters,
        date: date.day ?? localDay(at),
        ...(dest ? { destination: dest } : {}),
        ...(money && type === "in" ? { amountCents: money } : {}),
        ...(unitPriceCents && type === "in" ? { unitPriceCents } : {}),
      });
      if (!parsed.success)
        return {
          status: "pending",
          question:
            "Confira os litros e a data da movimentação de combustível. O saldo pode ser zero; entradas e saídas precisam ser maiores que zero.",
          residual: text,
        };
      actions.push(parsed.data);
      if (type !== "in" && money && /nova despesa/.test(c))
        actions.push({
          kind: "fuel_expense",
          fuel,
          amountCents: money,
          date: date.day ?? localDay(at),
        });
    } else {
      if (!money)
        return {
          status: "pending",
          question: "Qual foi o valor gasto com combustível, em reais?",
          residual: text,
        };
      if (/[?]/.test(clause) && !/\b(?:pode|registre|anote|lance|salve)\b/.test(c))
        return { status: "ignored", residual: text };
      const parsed = FuelActionSchema.safeParse({
        kind: "fuel_expense",
        fuel,
        amountCents: money,
        date: date.day ?? localDay(at),
        ...(period ? { periodMonth: period } : {}),
        ...(/\b(?:ja incluido|incluso|incluido|dentro do total)\b/.test(c)
          ? { totalRelation: "included" }
          : /\b(?:adicional|por fora|somar ao total)\b/.test(c)
            ? { totalRelation: "additional" }
            : {}),
      });
      if (!parsed.success)
        return {
          status: "pending",
          question: "Confira o valor e o mês desse gasto de combustível.",
          residual: text,
        };
      const prior = actions.at(-1);
      if (
        prior?.kind === "fuel_movement" &&
        prior.type === "in" &&
        prior.fuel === fuel &&
        !prior.amountCents &&
        /\b(?:paguei|gastei)\b/.test(c)
      )
        prior.amountCents = money;
      else actions.push(parsed.data);
    }
  }
  return actions.length
    ? { status: "actions", actions, residual: rest.join("; ") }
    : { status: "none", residual: text };
}
