import type { ActionOutlineLine } from "@/lib/actionPlans/types";

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function parseLocalDateTime(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function daysFromToday(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return null;
  const day = startOfDay(parsed);
  if (Number.isNaN(day.getTime())) return null;
  const today = startOfDay(new Date());
  const diffMs = day.getTime() - today.getTime();
  return Math.round(diffMs / 86_400_000);
}

export function formatAbsoluteDate(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return value;
  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

export function formatDueDateLabel(value: string) {
  if (!value) return "";
  const diffDays = daysFromToday(value);
  if (diffDays === null) return value;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 14) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) {
    const parsed = parseLocalDateTime(value);
    if (!parsed) return value;
    return parsed.toLocaleDateString(undefined, { weekday: "long" });
  }
  return formatAbsoluteDate(value);
}

export function isOverdue(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return false;
  return parsed.getTime() < Date.now();
}

export function createOutlineLine(text: string, depth: number): ActionOutlineLine {
  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    depth,
    estimate: "",
    startAt: "",
    dueAt: "",
    recurrence: "none",
  };
}
