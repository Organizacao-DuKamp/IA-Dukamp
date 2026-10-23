import { useState } from "react";
import { ActionSchema, type GuardianAction } from "@/lib/guardian/schema";

type FormKind =
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
}: {
  hasProperty: boolean;
  busy: boolean;
  onPropose: (action: GuardianAction) => Promise<void>;
}) {
  const [kind, setKind] = useState<FormKind>(hasProperty ? "task_create" : "property_create"),
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
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as FormKind);
            setValues({});
            setError("");
          }}
          className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2.5"
        >
          {Object.entries(names)
            .filter(([k]) => hasProperty || k === "property_create")
            .map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
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
      <p className="text-xs text-muted-foreground">
        Você confirma a proposta na próxima etapa. Nenhum aviso é ativado por este formulário.
      </p>
    </form>
  );
}
