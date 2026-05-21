import type { ActionOutlineLine, ActionRecurrence } from "@/lib/actionPlans/types";

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

export function formatTimePart(value: string) {
  const timePartRaw = value.split("T")[1]?.slice(0, 5);
  if (!timePartRaw || timePartRaw === "00:00") return "";
  const parsed = parseLocalDateTime(value);
  if (!parsed) return "";
  return parsed.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatStartDateTimeLabel(value: string) {
  if (!value) return "";
  const datePart = formatAbsoluteDate(value);
  const timePart = formatTimePart(value);
  return timePart ? `${datePart}, ${timePart}` : datePart;
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

type LegacyActionItem = {
  id: string;
  text: string;
  done: boolean;
  children?: LegacyActionItem[];
};

export function flattenLegacyActions(items: LegacyActionItem[], depth = 0): ActionOutlineLine[] {
  return items.flatMap((item) => {
    const current: ActionOutlineLine = {
      id: item.id ?? crypto.randomUUID(),
      text: typeof item.text === "string" ? item.text : "",
      done: Boolean(item.done),
      depth,
      estimate: "",
      startAt: "",
      dueAt: "",
      recurrence: "none",
    };
    const children = Array.isArray(item.children)
      ? flattenLegacyActions(item.children, depth + 1)
      : [];
    return [current, ...children];
  });
}

export function normalizeLegacyStorageLines(parsed: unknown): ActionOutlineLine[] | null {
  if (!Array.isArray(parsed) || !parsed.length) return null;
  const firstEntry = parsed[0] as Record<string, unknown>;
  if ("depth" in firstEntry) {
    return (parsed as unknown[]).map((entry) => {
      const line = (entry ?? {}) as Record<string, unknown>;
      const recurrence =
        line.recurrence === "daily" ||
        line.recurrence === "weekly" ||
        line.recurrence === "monthly"
          ? line.recurrence
          : "none";
      return {
        id: typeof line.id === "string" ? line.id : crypto.randomUUID(),
        text: typeof line.text === "string" ? line.text : "",
        done: Boolean(line.done),
        depth: Math.max(0, Math.min(6, Number.isFinite(line.depth) ? Number(line.depth) : 0)),
        estimate: typeof line.estimate === "string" ? line.estimate : "",
        startAt: typeof line.startAt === "string" ? line.startAt : "",
        dueAt:
          typeof line.dueAt === "string"
            ? line.dueAt
            : typeof line.dueDate === "string"
              ? line.dueDate
              : "",
        recurrence: recurrence as ActionRecurrence,
      };
    });
  }
  return flattenLegacyActions(parsed as LegacyActionItem[]);
}
