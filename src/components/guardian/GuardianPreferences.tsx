import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { guardianUpdatePreferences } from "@/lib/guardian.functions";
import { PreferencesSchema, type GuardianPreferences as Preferences } from "@/lib/guardian/schema";

export function GuardianPreferences({
  value,
  disabled,
  onSaved,
}: {
  value: unknown;
  disabled: boolean;
  onSaved: (message: string) => Promise<void>;
}) {
  const initial = PreferencesSchema.safeParse(value),
    [preferences, setPreferences] = useState<Preferences>(
      initial.success ? initial.data : PreferencesSchema.parse({}),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = useServerFn(guardianUpdatePreferences);
  const topics: Array<[Preferences["topics"][number], string]> = [
    ["tasks", "Tarefas"],
    ["weather", "Clima"],
    ["health", "Sanidade"],
    ["performance", "Desempenho"],
    ["finance", "Financeiro"],
    ["reports", "Relatórios"],
  ];
  return (
    <form
      className="rounded-2xl border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        void save({
          data: {
            requestId: crypto.randomUUID(),
            enabled: preferences.enabled,
            startHour: preferences.startHour,
            endHour: preferences.endHour,
            maxPerDay: preferences.maxPerDay,
            topics: preferences.topics,
            reportCadence: preferences.reportCadence,
          },
        })
          .then((r) => onSaved(r.reply))
          .catch((e) =>
            setError(e instanceof Error ? e.message : "Não foi possível salvar suas preferências."),
          )
          .finally(() => setBusy(false));
      }}
    >
      <h2 className="text-lg font-semibold">Meus avisos pelo WhatsApp</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Os avisos são gratuitos e dependem de eventos válidos. Sem fonte ou dados suficientes, a
        Guardiã não cria alertas. Você pode interromper a qualquer momento.
      </p>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
        <input
          type="checkbox"
          checked={preferences.enabled}
          disabled={disabled || busy}
          onChange={(e) => setPreferences((p) => ({ ...p, enabled: e.target.checked }))}
          className="mt-1"
        />
        <span>
          Autorizo receber os avisos selecionados no meu WhatsApp vinculado. Ao desmarcar e salvar,
          os envios pendentes serão cancelados.
        </span>
      </label>
      <fieldset disabled={disabled || busy} className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          A partir de (hora local)
          <input
            type="number"
            min={0}
            max={23}
            value={preferences.startHour}
            onChange={(e) => setPreferences((p) => ({ ...p, startHour: Number(e.target.value) }))}
            className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
          />
        </label>
        <label className="text-sm">
          Até (hora local)
          <input
            type="number"
            min={1}
            max={24}
            value={preferences.endHour}
            onChange={(e) => setPreferences((p) => ({ ...p, endHour: Number(e.target.value) }))}
            className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
          />
        </label>
        <label className="text-sm">
          Máximo por dia
          <input
            type="number"
            min={1}
            max={10}
            value={preferences.maxPerDay}
            onChange={(e) => setPreferences((p) => ({ ...p, maxPerDay: Number(e.target.value) }))}
            className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
          />
        </label>
      </fieldset>
      <p className="mt-2 text-xs text-muted-foreground">
        Fuso: {preferences.timeZone}. Intervalo mínimo entre avisos:{" "}
        {preferences.minIntervalMinutes} minutos. Limites técnicos não são cobrança nem assinatura.
      </p>
      <fieldset disabled={disabled || busy} className="mt-4 flex flex-wrap gap-4">
        <legend className="mb-2 text-sm font-medium">Temas que desejo acompanhar</legend>
        {topics.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.topics.includes(key)}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  topics: e.target.checked ? [...p.topics, key] : p.topics.filter((t) => t !== key),
                }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block text-sm font-medium">
        Relatório da fazenda selecionada
        <select
          disabled={disabled || busy}
          value={preferences.reportCadence}
          onChange={(e) =>
            setPreferences((p) => ({
              ...p,
              reportCadence: e.target.value as Preferences["reportCadence"],
              topics:
                e.target.value !== "none"
                  ? [...new Set([...p.topics, "reports" as const])]
                  : p.topics,
            }))
          }
          className="mt-1 block w-full rounded-lg border border-input bg-background p-2"
        >
          <option value="none">Não receber automaticamente</option>
          <option value="daily">Diário</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        disabled={disabled || busy}
        className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Salvar preferências"}
      </button>
    </form>
  );
}
