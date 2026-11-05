import { useEffect, useState } from "react";
import { AlarmClock, Bell, Check, RefreshCw, Smartphone } from "lucide-react";
import {
  androidCommand,
  nativeAndroid,
  type AndroidReminderStatus,
} from "@/lib/guardian/android-bridge";

export function AndroidReminders() {
  const [native, setNative] = useState(false),
    [status, setStatus] = useState<AndroidReminderStatus | null>(null),
    [mode, setMode] = useState<"notification" | "alarm">("alarm"),
    [waiting, setWaiting] = useState(false),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    setNative(nativeAndroid());
    const receive = (event: Event) => {
      const next = (event as CustomEvent<AndroidReminderStatus>).detail;
      if (!next || typeof next.enabled !== "boolean") return;
      setStatus(next);
      setWaiting(false);
      if (next.enabled) setMode(next.mode);
    };
    const refresh = () => {
      if (!document.hidden) androidCommand({ type: "status" });
    };
    window.addEventListener("tpec:android", receive);
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      window.removeEventListener("tpec:android", receive);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      setWaiting(false);
      setFeedback("A atualização está demorando. Confira a conexão e tente novamente.");
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  function act(type: "connect" | "sync" | "disconnect" | "test") {
    setFeedback(
      type === "test"
        ? "O teste está marcado para daqui a 5 segundos. Confira o volume de alarme do celular."
        : "",
    );
    if (type === "connect" || type === "sync") setWaiting(true);
    androidCommand(type === "connect" ? { type, mode } : { type });
  }
  if (!native)
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <Smartphone size={24} className="shrink-0 text-emerald-800" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Lembretes no celular</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              No aplicativo Android, você pode ativar notificações e alarmes para suas tarefas,
              mesmo com o app fechado. Seus lembretes pelo WhatsApp continuam disponíveis.
            </p>
          </div>
        </div>
      </section>
    );
  const checks: [string, boolean, "notifications" | "exact" | "fullscreen" | "sound"][] = [
    ["Notificações permitidas", status?.notifications ?? false, "notifications"],
    ["Horários exatos permitidos", status?.exactAlarms ?? false, "exact"],
    ...(mode === "alarm"
      ? [
          ["Alarme na tela bloqueada", status?.fullScreen ?? false, "fullscreen"] as [
            string,
            boolean,
            "fullscreen",
          ],
          ...(status?.alarmVolume !== undefined
            ? [
                ["Volume do alarme ligado", status.alarmVolume > 0, "sound"] as [
                  string,
                  boolean,
                  "sound",
                ],
              ]
            : []),
        ]
      : []),
  ];
  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-white p-5"
      aria-labelledby="android-reminders-title"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-amber-100 p-3 text-amber-900">
          <AlarmClock size={25} aria-hidden="true" />
        </span>
        <div>
          <h2 id="android-reminders-title" className="text-lg font-semibold">
            Não perca a hora
          </h2>
          <p className="mt-1 text-sm text-slate-500">Seus lembretes, também neste celular.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {(
          [
            ["notification", "Notificação", "Aviso com som curto", Bell],
            ["alarm", "Notificação e alarme", "Toca até você parar", AlarmClock],
          ] as const
        ).map(([value, label, text, Icon]) => (
          <button
            key={value}
            disabled={waiting}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-xl border-2 p-3 text-left ${mode === value ? "border-emerald-800 bg-emerald-50" : "border-slate-200"}`}
          >
            <Icon size={22} aria-hidden="true" />
            <strong className="mt-2 block text-sm">{label}</strong>
            <span className="mt-1 block text-xs text-slate-500">{text}</span>
          </button>
        ))}
      </div>
      <button
        disabled={waiting || !status}
        onClick={() => act("connect")}
        className="mt-4 w-full rounded-xl bg-emerald-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {waiting
          ? "Atualizando lembretes…"
          : status?.enabled
            ? "Salvar preferência"
            : "Ativar lembretes neste celular"}
      </button>
      {status && (
        <>
          <ul className="mt-5 space-y-2">
            {checks.map(([label, ok, permission]) => (
              <li key={permission} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  {ok ? (
                    <Check size={18} className="text-emerald-700" aria-hidden="true" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                  )}
                  {label}
                </span>
                {!ok && (
                  <button
                    onClick={() => androidCommand({ type: "permission", permission })}
                    className="rounded-lg border px-3 py-2 font-semibold text-emerald-800"
                  >
                    {permission === "sound" ? "Ajustar" : "Permitir"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!status.exactAlarms && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              Permita os horários exatos para o aviso tocar na hora marcada. Sem essa permissão, o
              Android pode atrasar o lembrete.
            </p>
          )}
          {status.enabled && (status.backgroundRestricted || status.batteryOptimized) && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              <p>
                {status.backgroundRestricted
                  ? "O Android está restringindo este app em segundo plano. Isso pode impedir a atualização dos alarmes."
                  : "A economia de bateria pode atrasar os novos horários enviados pelo WhatsApp com o app fechado."}{" "}
                Nas configurações da TPEC-IA, permita o uso da bateria em segundo plano.
              </p>
              <button
                onClick={() => androidCommand({ type: "permission", permission: "battery" })}
                className="mt-2 rounded-lg border border-amber-300 px-3 py-2 font-semibold"
              >
                Configurar bateria
              </button>
            </div>
          )}
          {status.enabled && (
            <div className="mt-5 border-t pt-4">
              <p className="font-medium">
                {status.scheduled} {status.scheduled === 1 ? "lembrete salvo" : "lembretes salvos"}{" "}
                no celular
              </p>
              {status.hasMore && (
                <p className="mt-2 text-xs text-amber-900">
                  Os próximos 128 lembretes são salvos por vez. A sincronização renova a lista.
                </p>
              )}
              {(!status.pushAvailable || !status.pushConfigured) && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                  A atualização com o app fechado ainda não está disponível neste aparelho. Abra o
                  app após criar, alterar ou cancelar uma tarefa pelo WhatsApp para atualizar os
                  horários.
                </p>
              )}
              {status.lastSync && (
                <p className="mt-2 text-xs text-slate-500">
                  Atualizado em{" "}
                  {new Date(status.lastSync).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}{" "}
                  · Brasília
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={waiting}
                  onClick={() => act("sync")}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Atualizar
                </button>
                <button
                  disabled={waiting || !status.notifications || !status.exactAlarms}
                  onClick={() => act("test")}
                  className="rounded-xl border px-3 py-3 text-sm font-medium"
                >
                  Testar em 5 segundos
                </button>
                <button
                  disabled={waiting}
                  onClick={() => act("disconnect")}
                  className="rounded-xl px-3 py-3 text-sm text-rose-700"
                >
                  Desativar neste celular
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {(status?.error || feedback) && (
        <p role="status" className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">
          {status?.error || feedback}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Os horários salvos funcionam sem internet. Para receber alterações, o celular precisa se
        conectar. O alarme usa o volume de alarme do aparelho, para sozinho após 5 minutos e pode
        ser adiado por 10 minutos. Parar o alarme não conclui a tarefa.
      </p>
    </section>
  );
}
