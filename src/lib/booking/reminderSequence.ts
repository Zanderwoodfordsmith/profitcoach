export type BookingReminderStepKind = "confirmation" | "reminder";

export type BookingReminderStep = {
  id: string;
  kind: BookingReminderStepKind;
  enabled: boolean;
  /** Minutes before start. Unused for confirmation. */
  minutes_before: number;
  email: boolean;
  sms: boolean;
  subject: string;
  body: string;
};

export type BookingNotifyVars = {
  first_name: string;
  coach_name: string;
  calendar_title: string;
  when: string;
  where: string;
};

const CONFIRMATION_BODY = [
  "Hi {{first_name}},",
  "",
  "Your {{calendar_title}} with {{coach_name}} is booked.",
  "",
  "When: {{when}}",
  "Where: {{where}}",
  "",
  "Reply to this email if you need to reschedule.",
  "",
  "— {{coach_name}}",
].join("\n");

const REMINDER_BODY = [
  "Hi {{first_name}},",
  "",
  "Quick reminder — your {{calendar_title}} with {{coach_name}} starts soon.",
  "",
  "When: {{when}}",
  "Where: {{where}}",
  "",
  "— {{coach_name}}",
].join("\n");

export const DEFAULT_REMINDER_SEQUENCE: BookingReminderStep[] = [
  {
    id: "confirmation",
    kind: "confirmation",
    enabled: true,
    minutes_before: 0,
    email: true,
    sms: true,
    subject: "Confirmed: {{calendar_title}} with {{coach_name}}",
    body: CONFIRMATION_BODY,
  },
  {
    id: "24h",
    kind: "reminder",
    enabled: true,
    minutes_before: 24 * 60,
    email: true,
    sms: true,
    subject: "Reminder: {{calendar_title}} with {{coach_name}} tomorrow",
    body: REMINDER_BODY,
  },
  {
    id: "2h",
    kind: "reminder",
    enabled: true,
    minutes_before: 120,
    email: true,
    sms: true,
    subject: "Reminder: {{calendar_title}} with {{coach_name}} in 2 hours",
    body: REMINDER_BODY,
  },
];

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function parseReminderSequence(raw: unknown): BookingReminderStep[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_REMINDER_SEQUENCE.map((step) => ({ ...step }));
  }

  const steps: BookingReminderStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind === "confirmation" ? "confirmation" : "reminder";
    const id =
      asString(row.id, "").trim() ||
      (kind === "confirmation" ? "confirmation" : `r${steps.length}`);
    const minutes =
      kind === "confirmation"
        ? 0
        : Math.max(5, Math.min(14 * 24 * 60, asInt(row.minutes_before, 120)));
    steps.push({
      id: id.slice(0, 40),
      kind,
      enabled: asBool(row.enabled, true),
      minutes_before: minutes,
      email: asBool(row.email, true),
      sms: asBool(row.sms, true),
      subject: asString(row.subject, "").trim() ||
        (kind === "confirmation"
          ? DEFAULT_REMINDER_SEQUENCE[0]!.subject
          : DEFAULT_REMINDER_SEQUENCE[2]!.subject),
      body: asString(row.body, "").trim() ||
        (kind === "confirmation" ? CONFIRMATION_BODY : REMINDER_BODY),
    });
  }

  if (!steps.some((step) => step.kind === "confirmation")) {
    steps.unshift({ ...DEFAULT_REMINDER_SEQUENCE[0]! });
  }

  const seen = new Set<string>();
  return steps.map((step, index) => {
    let id = step.id || `step-${index}`;
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return { ...step, id };
  });
}

export function interpolateReminderText(
  template: string,
  vars: BookingNotifyVars
): string {
  return template
    .replaceAll("{{first_name}}", vars.first_name)
    .replaceAll("{{coach_name}}", vars.coach_name)
    .replaceAll("{{calendar_title}}", vars.calendar_title)
    .replaceAll("{{when}}", vars.when)
    .replaceAll("{{where}}", vars.where);
}

export function reminderTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const withBreaks = escaped.replace(/\n/g, "<br/>");
  return withBreaks.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );
}

export function reminderSequenceSummary(
  sequence: BookingReminderStep[]
): string {
  const parts = sequence
    .filter((step) => step.enabled)
    .map((step) =>
      step.kind === "confirmation"
        ? "Confirmation"
        : `${hoursFromMinutes(step.minutes_before)}h`
    );
  return parts.length > 0 ? parts.join(" · ") : "Reminders off";
}

export function hoursFromMinutes(minutes: number): number {
  if (minutes % 60 === 0) return minutes / 60;
  return Math.round((minutes / 60) * 10) / 10;
}

export function minutesFromHours(hours: number): number {
  const n = Number.isFinite(hours) ? hours : 2;
  return Math.max(5, Math.min(14 * 24 * 60, Math.round(n * 60)));
}

export const MAX_REMINDER_LEAD_MINUTES = 14 * 24 * 60;

export function newReminderStep(): BookingReminderStep {
  return {
    id: `r${Date.now().toString(36)}`,
    kind: "reminder",
    enabled: true,
    minutes_before: 24 * 60,
    email: true,
    sms: true,
    subject: "Reminder: {{calendar_title}} with {{coach_name}}",
    body: REMINDER_BODY,
  };
}

export function confirmationStep(
  sequence: BookingReminderStep[]
): BookingReminderStep {
  return (
    sequence.find((step) => step.kind === "confirmation") ??
    DEFAULT_REMINDER_SEQUENCE[0]!
  );
}

/** Step ids already delivered, including the legacy single T-2h flag. */
export function sentReminderStepIds(args: {
  reminderSends: unknown;
  reminderSentAt: string | null | undefined;
  sequence: BookingReminderStep[];
}): Set<string> {
  const ids = new Set<string>();
  if (
    args.reminderSends &&
    typeof args.reminderSends === "object" &&
    !Array.isArray(args.reminderSends)
  ) {
    for (const key of Object.keys(args.reminderSends as Record<string, unknown>)) {
      if (key.trim()) ids.add(key);
    }
  }
  if (!args.reminderSentAt) return ids;

  const twoHour = args.sequence.find(
    (step) => step.kind === "reminder" && step.minutes_before === 120
  );
  if (twoHour) {
    ids.add(twoHour.id);
    return ids;
  }
  const shortest = args.sequence
    .filter((step) => step.kind === "reminder")
    .sort((a, b) => a.minutes_before - b.minutes_before)[0];
  if (shortest) ids.add(shortest.id);
  return ids;
}

/**
 * Reminders due now. Each step owns the window down to the next closer
 * step (or the start), so a missed 24h ping is not sent at T-2h.
 */
export function dueReminderSteps(args: {
  sequence: BookingReminderStep[];
  startsAtMs: number;
  createdAtMs: number;
  nowMs: number;
  sentStepIds: Set<string>;
}): BookingReminderStep[] {
  const remaining = (args.startsAtMs - args.nowMs) / 60_000;
  if (remaining <= 0) return [];

  const reminders = args.sequence
    .filter(
      (step) =>
        step.kind === "reminder" &&
        step.enabled &&
        (step.email || step.sms)
    )
    .sort((a, b) => b.minutes_before - a.minutes_before);

  const due: BookingReminderStep[] = [];
  for (let i = 0; i < reminders.length; i++) {
    const step = reminders[i]!;
    if (args.sentStepIds.has(step.id)) continue;
    if (remaining > step.minutes_before) continue;
    const nextMinutes = reminders[i + 1]?.minutes_before ?? 0;
    if (remaining <= nextMinutes) continue;
    const bookedTooLate =
      args.createdAtMs > args.startsAtMs - step.minutes_before * 60_000;
    if (bookedTooLate) continue;
    due.push(step);
  }
  return due;
}
