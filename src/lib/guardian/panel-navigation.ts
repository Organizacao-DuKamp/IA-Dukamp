export const primaryPanelTabs = ["overview", "herd", "tasks", "finance", "more"] as const;
export function swipePanelTab(tab: string, dx: number, dy: number, durationMs: number) {
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6 || durationMs > 1200) return null;
  const index = primaryPanelTabs.indexOf(tab as (typeof primaryPanelTabs)[number]);
  const current = index < 0 ? 4 : index;
  return primaryPanelTabs[current + (dx < 0 ? 1 : -1)] ?? null;
}
