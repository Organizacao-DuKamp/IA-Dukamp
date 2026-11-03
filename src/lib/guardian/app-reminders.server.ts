import { createHash } from "node:crypto";
import type { PanelIdentity } from "./panel.server.ts";

export const APP_REMINDER_LIMIT = 128;
export const APP_REMINDER_GRACE_MS = 5 * 60_000;
export function reminderRevision(task: PanelIdentity["book"]["tasks"][number]) {
  return createHash("sha256")
    .update(JSON.stringify([task.id, task.dueAt, task.updatedAt, task.title]))
    .digest("hex");
}
export function appReminderSnapshot(identity: PanelIdentity, now = new Date()) {
  const own = identity.book.tasks.filter(
    (task) =>
      task.status === "open" && (task.responsiblePhone ?? task.source.actor) === identity.phone,
  );
  const key = (task: (typeof own)[number]) =>
    createHash("sha256")
      .update(identity.propertyId + ":" + task.id + ":" + reminderRevision(task))
      .digest("hex");
  const tasks = own
    .filter(
      (task) =>
        Date.parse(task.dueAt) >= now.getTime() - APP_REMINDER_GRACE_MS &&
        Date.parse(task.dueAt) <= now.getTime() + 30 * 86400_000,
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  return {
    propertyId: identity.propertyId,
    propertyName: identity.book.name ?? "Minha fazenda",
    version: identity.version,
    serverNow: now.toISOString(),
    sessionExpiresAt: identity.expiresAt,
    hasMore: tasks.length > APP_REMINDER_LIMIT,
    // Revalidate local snoozes without sending their old contents again.
    activeKeys: own.map(key),
    reminders: tasks.slice(0, APP_REMINDER_LIMIT).map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt,
      revision: reminderRevision(task),
      key: key(task),
    })),
  };
}
