import type { LucideIcon } from "lucide-react";
export function PanelMetric({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "neutral" | "positive" | "negative" | "warning";
  hint?: string;
}) {
  const tones = {
    neutral:
      "border-slate-200 bg-white text-slate-900 [&_svg]:text-sky-700 [&_.metric-icon]:bg-sky-50",
    positive:
      "border-emerald-200 bg-emerald-50/60 text-emerald-800 [&_.metric-icon]:bg-emerald-100",
    negative: "border-rose-200 bg-rose-50/60 text-rose-700 [&_.metric-icon]:bg-rose-100",
    warning: "border-amber-200 bg-amber-50/60 text-amber-800 [&_.metric-icon]:bg-amber-100",
  };
  return (
    <article className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <span className="metric-icon rounded-xl p-2">
          <Icon aria-hidden="true" size={18} />
        </span>
      </div>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs opacity-80">{hint}</p>}
    </article>
  );
}
