import { useState } from "react";
import { ActionSchema, type GuardianAction } from "@/lib/guardian/schema";

type FormKind =
  | "feed_consumption"
  | "alert_rules"
  | "herd_count"
  | "herd_event"
  | "lot_transfer"
  | "lot_update"
  | "property_update"
  | "property_create"
  | "task_create"
  | "expense"
  | "income"
  | "record"
  | "animal"
  | "weighing"
  | "invite"
  | "profile";
const names: Record<FormKind, string> = {
  feed_consumption: "Consumo de alimentos / suplementos",
  alert_rules: "Regras dos alertas",
  herd_count: "Informar contagem do rebanho",
  herd_event: "Movimentação do rebanho",
  lot_transfer: "Transferir entre lotes",
  lot_update: "Lotes e piquetes",
  property_update: "Dados da propriedade",
  property_create: "Nova propriedade",
  task_create: "Nova tarefa",
  expense: "Registrar despesa",
  income: "Registrar receita",
  record: "Caderno de campo",
  animal: "Cadastrar animal",
  weighing: "Registrar pesagem",
  invite: "Convidar integrante",
  profile: "Perfil da fazenda",
};
export function GuardianActionForm({
  hasProperty,
  busy,
  onPropose,
  allowedKinds,
  initialKind,
}: {
  initialKind?: FormKind;
  allowedKinds?: string[];
  hasProperty: boolean;
  busy: boolean;
  onPropose: (action: GuardianAction) => Promise<void>;
}) {
  const [kind, setKind] = useState<FormKind>(
      (() => {
        const preferred = initialKind ?? (hasProperty ? "task_create" : "property_create");
        return allowedKinds && !allowedKinds.includes(preferred)
          ? ((allowedKinds.find((k) => k in names) as FormKind | undefined) ?? preferred)
          : preferred;
      })(),
    ),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const field = (key: string, label: string, type = "text", required = true) => (
    <label className="block text-sm font-medium" key={key}>
      {label}
      <input
        type={type}
        required={required}
        value={values[key] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        maxLength={type === "text" ? 160 : undefined}
        step={type === "number" ? "any" : undefined}
        className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2.5"
      />
    </label>
  );
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  async function submit() {
    setError("");
    let input: unknown;
    switch (kind) {
      case "feed_consumption":
        input = {
          kind,
          feed: values.feed,
          kg: Number(values.kg),
          basis: values.basis || "measured",
          date: values.date || today(),
          ...(values.lot ? { lot: values.lot } : {}),
        };
        break;
      case "alert_rules":
        input = {
          kind,
          enabled: values.enabled === "true",
          ...(values.minGmd ? { minGmd: Number(values.minGmd) } : {}),
          ...(values.staleDays ? { staleDays: Number(values.staleDays) } : {}),
          ...(values.mortalityCount ? { mortalityCount: Number(values.mortalityCount) } : {}),
          mortalityWindowDays: values.mortalityWindowDays ? Number(values.mortalityWindowDays) : 7,
        };
        break;
      case "herd_count":
        input = {
          kind,
          count: Number(values.count),
          date: values.date || today(),
          ...(values.lot ? { lot: values.lot } : {}),
        };
        break;
      case "herd_event":
        input = {
          kind,
          type: values.movementType || "birth",
          count: Number(values.count),
          date: values.date || today(),
          description: values.description,
          ...(values.lot ? { lot: values.lot } : {}),
          ...(values.replaces ? { replaces: values.replaces } : {}),
        };
        break;
      case "lot_transfer":
        input = {
          kind,
          from: values.from,
          to: values.to,
          count: Number(values.count),
          date: values.date || today(),
        };
        break;
      case "lot_update":
        input = {
          kind,
          lot: values.lot,
          ...(values.pasture ? { pasture: values.pasture } : {}),
          ...(values.areaHa ? { areaHa: Number(values.areaHa) } : {}),
        };
        break;
      case "property_update":
        input = {
          kind,
          ...Object.fromEntries(
            Object.entries(values)
              .filter(([, v]) => v)
              .map(([k, v]) => [
                k,
                ["areaHa", "pastureHa", "latitude", "longitude"].includes(k)
                  ? Number(v)
                  : k === "uf"
                    ? v.toUpperCase()
                    : v,
              ]),
          ),
        };
        break;
      case "property_create":
        input = { kind, name: values.name, city: values.city, uf: values.uf?.toUpperCase() };
        break;
      case "task_create":
        input = {
          kind,
          title: values.title,
          dueAt: values.dueAt ? new Date(values.dueAt + ":00-03:00").toISOString() : "",
          ...(values.lot ? { lot: values.lot } : {}),
          ...(values.responsiblePhone
            ? { responsiblePhone: values.responsiblePhone.replace(/\D/g, "") }
            : {}),
        };
        break;
      case "expense":
      case "income":
        input = {
          kind: "ledger",
          direction: kind === "expense" ? "expense" : "income",
          amountCents: Math.round(Number(values.amount) * 100),
          description: values.description,
          date: values.date || today(),
          ...(values.lot ? { lot: values.lot } : {}),
        };
        break;
      case "record":
        input = {
          kind: "record",
          type: values.type || "management",
          description: values.description,
          date: values.date || today(),
          ...(values.lot ? { lot: values.lot } : {}),
          ...(values.count ? { count: Number(values.count) } : {}),
        };
        break;
      case "animal":
        input = {
          kind,
          code: values.code,
          ...Object.fromEntries(
            ["name", "rgn", "rgd", "category", "sire", "dam", "status"].flatMap((key) =>
              values[key] ? [[key, values[key]]] : [],
            ),
          ),
          sex: values.sex || "unknown",
          ...(values.breed ? { breed: values.breed } : {}),
          ...(values.lot ? { lot: values.lot } : {}),
          ...(values.birthDate ? { birthDate: values.birthDate } : {}),
        };
        break;
      case "weighing":
        input = {
          kind,
          code: values.code,
          weightKg: Number(values.weightKg),
          date: values.date || today(),
          estimated: values.estimated === "true",
          correction: values.correction === "true",
        };
        break;
      case "invite":
        input = { kind, phone: values.phone?.replace(/\D/g, ""), role: values.role || "worker" };
        break;
      case "profile":
        input = { kind, ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)) };
        break;
    }
    const result = ActionSchema.safeParse(input);
    if (!result.success) {
      setError(
        "Confira os campos. Informe os dados obrigatórios e valores/datas válidos antes de revisar.",
      );
      return;
    }
    await onPropose(result.data);
  }
  const select = (key: string, label: string, options: Array<[string, string]>) => (
    <label key={key} className="block text-sm font-medium">
      {label}
      <select
        aria-label={label}
        value={values[key] ?? options[0][0]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2.5"
      >
        {options.map(([value, title]) => (
          <option key={value} value={value}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit().catch(() =>
          setError("Não foi possível preparar a proposta. Confira os dados e tente novamente."),
        );
      }}
    >
      <h2 className="text-lg font-semibold">Novo registro</h2>
      <label className="block text-sm font-medium">
        O que deseja fazer?
        <select
          aria-label="O que deseja fazer?"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as FormKind);
            setValues({});
            setError("");
          }}
          className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2.5"
        >
          {Object.entries(names)
            .filter(
              ([k]) =>
                (hasProperty || k === "property_create") &&
                (!allowedKinds || allowedKinds.includes(k)),
            )
            .map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "feed_consumption" && (
          <>
            {field("feed", "Alimento ou suplemento informado")}
            {field("kg", "Quantidade fornecida (kg)", "number")}
            {field("date", "Data do consumo", "date")}
            {field("lot", "Lote (opcional)", "text", false)}
            {select("basis", "Origem da quantidade", [
              ["measured", "Medida / registrada pelo produtor"],
              ["estimated", "Estimativa declarada"],
            ])}
          </>
        )}
        {kind === "alert_rules" && (
          <>
            {select("enabled", "Analisar regras desta fazenda", [
              ["false", "Pausado"],
              ["true", "Ativo (envio depende do consentimento no WhatsApp)"],
            ])}
            {field("minGmd", "Alertar GMD abaixo de (kg/dia)", "number", false)}
            {field("staleDays", "Alertar contagem desatualizada após (dias)", "number", false)}
            {field(
              "mortalityCount",
              "Alertar a partir de quantas mortes registradas",
              "number",
              false,
            )}
            {field(
              "mortalityWindowDays",
              "Período dessas mortes (dias, padrão 7)",
              "number",
              false,
            )}
          </>
        )}
        {kind === "property_update" && (
          <>
            {field("name", "Nome oficial (se informado)", "text", false)}
            {field("responsibleName", "Responsável declarado", "text", false)}
            {field("address", "Endereço informado", "text", false)}
            {field("latitude", "Latitude informada", "number", false)}
            {field("longitude", "Longitude informada", "number", false)}
            {field("city", "Município", "text", false)}
            {field("uf", "UF", "text", false)}
            {field("areaHa", "Área total (ha)", "number", false)}
            {field("pastureHa", "Área de pastagem (ha)", "number", false)}
          </>
        )}
        {(kind === "herd_count" || kind === "herd_event" || kind === "lot_transfer") && (
          <>
            {kind === "herd_event" && (
              <>
                {select("movementType", "Tipo de movimentação", [
                  ["birth", "Nascimento"],
                  ["death", "Morte"],
                  ["purchase", "Compra"],
                  ["sale", "Venda"],
                ])}
                {field("description", "Descrição do acontecimento")}
                {field("replaces", "Código do evento a corrigir (opcional)", "text", false)}
              </>
            )}
            {field("count", "Quantidade de animais", "number")}
            {field("date", "Data do fato (contagem: fim do dia)", "date")}
            {kind === "lot_transfer" ? (
              <>
                {field("from", "Lote de origem")}
                {field("to", "Lote de destino")}
              </>
            ) : (
              field("lot", "Lote (vazio: rebanho da fazenda)", "text", false)
            )}
          </>
        )}
        {kind === "lot_update" && (
          <>
            {field("lot", "Nome do lote")}
            {field("pasture", "Piquete / pastagem (opcional)", "text", false)}
            {field("areaHa", "Área do piquete (ha, opcional)", "number", false)}
          </>
        )}
        {kind === "property_create" && (
          <>
            {field("name", "Nome da propriedade")}
            {field("city", "Município")}
            {field("uf", "UF (ex.: SP)")}
          </>
        )}
        {kind === "task_create" && (
          <>
            {field("title", "Atividade")}
            {field("dueAt", "Data e horário (Brasília)", "datetime-local")}
            {field("lot", "Lote (opcional)", "text", false)}
            {field("responsiblePhone", "WhatsApp do responsável (opcional)", "tel", false)}
          </>
        )}
        {(kind === "expense" || kind === "income") && (
          <>
            {field("amount", "Valor (R$)", "number")}
            {field("description", "Descrição")}
            {field("date", "Data (opcional; padrão hoje)", "date", false)}
            {field("lot", "Lote (opcional)", "text", false)}
          </>
        )}
        {kind === "record" && (
          <>
            {select("type", "Tipo", [
              ["management", "Manejo"],
              ["birth", "Nascimento"],
              ["health", "Ocorrência sanitária"],
              ["purchase", "Compra"],
              ["movement", "Movimentação"],
            ])}
            {field("description", "O que aconteceu?")}
            {field("date", "Data (opcional; padrão hoje)", "date", false)}
            {field("lot", "Lote (opcional)", "text", false)}
            {field("count", "Quantidade (opcional)", "number", false)}
          </>
        )}
        {kind === "animal" && (
          <>
            {field("code", "Identificação do animal")}
            {field("name", "Nome do animal (opcional)", "text", false)}
            {field("rgn", "RGN informado (opcional)", "text", false)}
            {field("rgd", "RGD informado (opcional)", "text", false)}
            {field("category", "Categoria (opcional)", "text", false)}
            {field("sire", "Pai informado (opcional)", "text", false)}
            {field("dam", "Mãe informada (opcional)", "text", false)}
            {select("sex", "Sexo", [
              ["unknown", "Não informado"],
              ["female", "Fêmea"],
              ["male", "Macho"],
            ])}
            {field("breed", "Raça (opcional)", "text", false)}
            {field("lot", "Lote (opcional)", "text", false)}
            {field("birthDate", "Nascimento (opcional)", "date", false)}
          </>
        )}
        {kind === "weighing" && (
          <>
            {field("code", "Código do animal cadastrado")}
            {field("weightKg", "Peso (kg)", "number")}
            {field("date", "Data (opcional; padrão hoje)", "date", false)}
            {select("estimated", "Origem do peso", [
              ["false", "Informado / medido"],
              ["true", "Estimativa"],
            ])}
            {select("correction", "Correção de peso já lançado?", [
              ["false", "Não, nova pesagem"],
              ["true", "Sim, corrigir essa data"],
            ])}
          </>
        )}
        {kind === "invite" && (
          <>
            {field("phone", "WhatsApp com DDI e DDD", "tel")}
            {select("role", "Permissão", [
              ["worker", "Funcionário"],
              ["manager", "Gerente"],
              ["technician", "Responsável técnico"],
            ])}
          </>
        )}
        {kind === "profile" && (
          <>
            {field("activity", "Atividade principal", "text", false)}
            {field("feeding", "Alimentação atual", "text", false)}
            {field("pastures", "Pastagens", "text", false)}
            {field("goals", "Objetivos", "text", false)}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
      >
        {busy ? "Preparando…" : "Revisar antes de salvar"}
      </button>
    </form>
  );
}
