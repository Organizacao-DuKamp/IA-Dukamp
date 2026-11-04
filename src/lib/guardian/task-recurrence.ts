import { localDateTimeToUtc } from "../whatsapp/proactive.ts";
import type { GuardianTask } from "./schema.ts";

export const TASK_TIME_ZONE = "America/Sao_Paulo";
const day = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TASK_TIME_ZONE }).format(at);
const clock = (at: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TASK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(at);

export function addTaskDays(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400_000).toISOString().slice(0, 10);
}

/** Daily schedules use Brasília's local wall clock, independently of the host timezone. */
export function taskOccurrenceOn(task: Pick<GuardianTask, "dueAt">, date: string) {
  const anchor = new Date(task.dueAt);
  const [hour, minute, second] = clock(anchor).split(":").map(Number);
  return new Date(
    localDateTimeToUtc(date, hour * 60 + minute, TASK_TIME_ZONE).getTime() +
      second * 1000 +
      anchor.getUTCMilliseconds(),
  ).toISOString();
}

/** Today's occurrence remains pending until completed or the next local day begins. */
export function taskDisplayDueAt(task: GuardianTask, now = new Date()): string {
  if (task.recurrence !== "daily" || task.status !== "open") return task.dueAt;
  let due = taskOccurrenceOn(task, day(now));
  if (Date.parse(due) < Date.parse(task.dueAt)) due = task.dueAt;
  if (task.completedThrough && Date.parse(due) <= Date.parse(task.completedThrough))
    due = taskOccurrenceOn(task, addTaskDays(day(new Date(task.completedThrough)), 1));
  return due;
}

/** Expand only a bounded window; never generate one permanent task per day. */
export function taskOccurrences(task: GuardianTask, from: Date, until: Date): string[] {
  if (task.status !== "open") return [];
  if (task.recurrence !== "daily")
    return Date.parse(task.dueAt) >= from.getTime() && Date.parse(task.dueAt) <= until.getTime()
      ? [task.dueAt]
      : [];
  const result: string[] = [];
  for (
    let date = day(from), i = 0;
    i < 33 && date <= day(until);
    date = addTaskDays(date, 1), i++
  ) {
    const due = taskOccurrenceOn(task, date),
      time = Date.parse(due);
    if (
      time >= Date.parse(task.dueAt) &&
      time >= from.getTime() &&
      time <= until.getTime() &&
      (!task.completedThrough || time > Date.parse(task.completedThrough))
    )
      result.push(due);
  }
  return result;
}

export function isTaskOccurrence(task: GuardianTask, due: string) {
  const time = Date.parse(due);
  return (
    Number.isFinite(time) &&
    time >= Date.parse(task.dueAt) &&
    (task.recurrence === "daily"
      ? Date.parse(taskOccurrenceOn(task, day(new Date(due)))) === time
      : time === Date.parse(task.dueAt))
  );
}

export const hasDailyRecurrence = (text: string) =>
  /\b(?:todos?\s+(?:os\s+)?dias?|todo\s+dia|diariamente|di[aá]ri[oa]|cada\s+dia|toda(?:s)?\s+(?:as\s+)?manh[ãa]s?)\b/iu.test(
    text,
  );

export function firstDailyDueAt(due: string, now: Date) {
  if (Date.parse(due) > now.getTime()) return due;
  const candidate = taskOccurrenceOn({ dueAt: due }, day(now));
  return Date.parse(candidate) > now.getTime()
    ? candidate
    : taskOccurrenceOn({ dueAt: due }, addTaskDays(day(now), 1));
}
