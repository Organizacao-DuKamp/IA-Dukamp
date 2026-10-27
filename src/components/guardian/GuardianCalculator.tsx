import { useState } from "react";
import { Calculator } from "lucide-react";
import { calculate, renderCalculation, type Calculation } from "@/lib/guardian/calculators";

const definitions: Record<Calculation["kind"], { name: string; fields: Array<[string, string]> }> =
  {
    mortality_rate: {
      name: "Taxa de mortalidade",
      fields: [
        ["events", "Mortes no período"],
        ["eligible", "Animais expostos no mesmo período"],
        ["start", "Início do período"],
        ["end", "Fim do período"],
      ],
    },
    birth_rate: {
      name: "Taxa de natalidade",
      fields: [
        ["events", "Nascidos vivos no período"],
        ["eligible", "Fêmeas expostas no mesmo período"],
        ["start", "Início do período"],
        ["end", "Fim do período"],
      ],
    },
    weaning_rate: {
      name: "Taxa de desmame",
      fields: [
        ["events", "Desmamados da mesma safra"],
        ["eligible", "Nascidos vivos na safra"],
        ["start", "Início do período"],
        ["end", "Fim do período"],
      ],
    },
    pregnancy_rate: {
      name: "Taxa de prenhez",
      fields: [
        ["events", "Fêmeas com diagnóstico positivo"],
        ["eligible", "Fêmeas examinadas no mesmo lote/período"],
        ["start", "Início do período"],
        ["end", "Fim do período"],
      ],
    },
    productivity: {
      name: "Produtividade por hectare",
      fields: [
        ["producedKg", "Produção medida (kg no período)"],
        ["productiveHa", "Área produtiva correspondente (ha)"],
        ["start", "Início do período"],
        ["end", "Fim do período"],
      ],
    },
    gmd: {
      name: "Ganho médio diário",
      fields: [
        ["initialKg", "Peso inicial (kg)"],
        ["finalKg", "Peso final (kg)"],
        ["days", "Dias entre pesagens"],
      ],
    },
    dry_matter: {
      name: "Matéria seca e matéria natural",
      fields: [
        ["liveWeightKg", "Peso vivo (kg)"],
        ["intakePercent", "Consumo informado (% do peso vivo)"],
        ["feedDryMatterPercent", "Matéria seca do alimento (%)"],
      ],
    },
    feeding: {
      name: "Custo de alimentação",
      fields: [
        ["heads", "Quantidade de animais"],
        ["kgPerHeadDay", "Consumo informado (kg/cabeça/dia)"],
        ["days", "Duração (dias)"],
        ["pricePerKg", "Preço informado (R$/kg)"],
      ],
    },
    conversion: {
      name: "Conversão alimentar",
      fields: [
        ["consumedDryMatterKg", "Matéria seca consumida no período (kg)"],
        ["gainedLiveKg", "Ganho total de peso vivo no período (kg)"],
      ],
    },
    cost_per_kg: {
      name: "Custo por kg produzido",
      fields: [
        ["totalCost", "Custos informados (R$)"],
        ["gainedLiveKg", "Ganho de peso vivo (kg)"],
      ],
    },
    cost_per_head: {
      name: "Custo por cabeça",
      fields: [
        ["totalCost", "Custos informados (R$)"],
        ["heads", "Quantidade de animais"],
      ],
    },
    margin: {
      name: "Saldo e margem dos lançamentos",
      fields: [
        ["revenue", "Receitas registradas (R$)"],
        ["recordedExpenses", "Despesas registradas (R$)"],
      ],
    },
    scenario: {
      name: "Simulador de preço de venda",
      fields: [
        ["heads", "Quantidade de animais"],
        ["saleKgPerHead", "Peso de venda por cabeça (kg, na mesma base do preço)"],
        ["pricePerKg", "Preço de venda (R$/kg)"],
        ["totalCost", "Custos totais do cenário (R$)"],
        ["priceChangePercent", "Variação de preço no cenário (%; pode ser negativa)"],
      ],
    },
  };
export function GuardianCalculator() {
  const [kind, setKind] = useState<Calculation["kind"]>("gmd"),
    [values, setValues] = useState<Record<string, string>>({}),
    [result, setResult] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-xl bg-emerald-100 p-3 text-emerald-900">
          <Calculator size={22} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Calculadoras e cenários</h2>
          <p className="text-sm text-muted-foreground">
            Fórmulas verificáveis, com suas entradas e premissas.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            const input = {
              kind,
              ...Object.fromEntries(
                Object.entries(values).map(([k, v]) => [
                  k,
                  ["start", "end"].includes(k) ? v : Number(v),
                ]),
              ),
              ...(kind === "margin" ? { completeCosts: false } : {}),
            };
            setResult(renderCalculation(calculate(input)));
          } catch {
            setResult("");
            setError(
              "Confira os campos. Use valores válidos e positivos para pesos, quantidades e duração. Ganho e receita não podem ser usados como divisor quando forem zero.",
            );
          }
        }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium">
          Ferramenta
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Calculation["kind"]);
              setValues({});
              setResult("");
              setError("");
            }}
            className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2.5"
          >
            {Object.entries(definitions).map(([key, d]) => (
              <option key={key} value={key}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {definitions[kind].fields.map(([key, label]) => (
            <label key={key} className="block text-sm font-medium">
              {label}
              <input
                required
                type={["start", "end"].includes(key) ? "date" : "number"}
                step="any"
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2.5"
              />
            </label>
          ))}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          Calcular
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <pre
          aria-live="polite"
          className="mt-5 whitespace-pre-wrap rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4 font-sans text-sm leading-relaxed"
        >
          {result}
        </pre>
      )}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        O cálculo de matéria seca usa o percentual que você informar. Não formula dieta nem estima
        exigências nutricionais. Resultados econômicos dependem da cobertura dos custos; cenários
        não são previsões garantidas.
      </p>
    </section>
  );
}
