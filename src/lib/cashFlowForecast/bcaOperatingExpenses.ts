import {
  mondayOfWeekContaining,
  parseIsoDate,
  toIsoDate,
} from "@/lib/scorecardWeeks";
import type { ForecastExpenseRow } from "@/lib/cashFlowForecast/types";

/** Derived from Revolut operating expenses Jan–May 2026. Amounts in minor units (GBP). */
export type BcaExpenseSchedule =
  | {
      kind: "monthly";
      dayOfMonth: number;
      amountCents: number;
      /** Last date this expense should appear (inclusive), YYYY-MM-DD. */
      endDateIso?: string;
    }
  | {
      kind: "lastDayOfMonth";
      amountCents: number;
      endDateIso?: string;
    };

export type BcaExpenseDefinition = {
  id: string;
  label: string;
  section: string;
  schedule: BcaExpenseSchedule;
  note?: string;
};

/** BCA recurring operating expenses — grouped from bank statement patterns. */
export const BCA_OPERATING_EXPENSES: BcaExpenseDefinition[] = [
  // —— Salaries & contractors ——
  {
    id: "payroll:zander",
    label: "Zander Woodford-Smith",
    section: "Salaries & contractors",
    schedule: { kind: "monthly", dayOfMonth: 1, amountCents: 750_000 },
    note: "£7,500 on the 1st",
  },
  {
    id: "payroll:pamela",
    label: "Pamela Featherstone",
    section: "Salaries & contractors",
    schedule: { kind: "monthly", dayOfMonth: 1, amountCents: 250_000 },
    note: "£2,500 on the 1st",
  },
  {
    id: "payroll:zac",
    label: "Zac Fagan",
    section: "Salaries & contractors",
    schedule: { kind: "monthly", dayOfMonth: 1, amountCents: 300_000 },
    note: "£3,000 on the 1st",
  },
  {
    id: "payroll:mark",
    label: "Mark James",
    section: "Salaries & contractors",
    schedule: { kind: "lastDayOfMonth", amountCents: 833_300 },
    note: "£8,333 on the last day of the month",
  },

  // —— Marketing & sales tools ——
  {
    id: "marketing:sales-robot",
    label: "Sales Robot",
    section: "Marketing & sales tools",
    schedule: { kind: "monthly", dayOfMonth: 15, amountCents: 123_500 },
    note: "~£1,235/mo avg",
  },
  {
    id: "marketing:highlevel",
    label: "HighLevel (agency + usage)",
    section: "Marketing & sales tools",
    schedule: { kind: "monthly", dayOfMonth: 30, amountCents: 90_000 },
    note: "~£900/mo (agency sub + platform)",
  },
  {
    id: "marketing:linkedin",
    label: "LinkedIn",
    section: "Marketing & sales tools",
    schedule: { kind: "monthly", dayOfMonth: 10, amountCents: 16_000 },
    note: "2 × £79.99/mo",
  },
  {
    id: "marketing:skool",
    label: "Skool communities",
    section: "Marketing & sales tools",
    schedule: { kind: "monthly", dayOfMonth: 11, amountCents: 24_000 },
    note: "~£240/mo across communities",
  },

  // —— Platform & delivery ——
  {
    id: "platform:disco",
    label: "Disco",
    section: "Platform & delivery",
    schedule: { kind: "monthly", dayOfMonth: 8, amountCents: 33_300 },
  },
  {
    id: "platform:zoom",
    label: "Zoom",
    section: "Platform & delivery",
    schedule: { kind: "monthly", dayOfMonth: 15, amountCents: 14_000 },
  },
  {
    id: "platform:crisp",
    label: "Crisp",
    section: "Platform & delivery",
    schedule: { kind: "monthly", dayOfMonth: 5, amountCents: 7_100 },
  },
  {
    id: "platform:chatdash",
    label: "ChatDash",
    section: "Platform & delivery",
    schedule: { kind: "monthly", dayOfMonth: 2, amountCents: 11_500 },
  },

  // —— Software & tools ——
  {
    id: "software:zapier",
    label: "Zapier",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 19, amountCents: 22_700 },
  },
  {
    id: "software:twilio",
    label: "Twilio",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 14, amountCents: 5_600 },
  },
  {
    id: "software:quickbooks",
    label: "QuickBooks",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 12, amountCents: 5_900 },
  },
  {
    id: "software:mailgun",
    label: "Mailgun",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 2, amountCents: 5_000 },
  },
  {
    id: "software:ai-tools",
    label: "AI tools (Anthropic, Cursor, Perplexity)",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 15, amountCents: 12_500 },
    note: "~£125/mo combined",
  },
  {
    id: "software:productivity",
    label: "Productivity (Make, Gamma, Superhuman, etc.)",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 1, amountCents: 9_000 },
  },
  {
    id: "software:video-design",
    label: "Video & design (Firecut, Figma, Loom, etc.)",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 20, amountCents: 11_000 },
  },
  {
    id: "software:automation-voice",
    label: "Automation & voice (Retell, Superinterface, etc.)",
    section: "Software & tools",
    schedule: { kind: "monthly", dayOfMonth: 21, amountCents: 20_000 },
  },

  // —— Admin & banking ——
  {
    id: "admin:revolut-fees",
    label: "Revolut business fees",
    section: "Admin & banking",
    schedule: { kind: "monthly", dayOfMonth: 1, amountCents: 4_300 },
    note: "Grow plan + expenses app",
  },
  {
    id: "admin:google-workspace",
    label: "Google Workspace",
    section: "Admin & banking",
    schedule: { kind: "monthly", dayOfMonth: 2, amountCents: 1_400 },
  },
  {
    id: "admin:slack",
    label: "Slack",
    section: "Admin & banking",
    schedule: { kind: "monthly", dayOfMonth: 3, amountCents: 1_400 },
  },
];

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year: number, monthIndex: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, monthIndex));
}

function weekStartForDateIso(dateIso: string): string {
  const d = parseIsoDate(dateIso);
  if (!d) return dateIso;
  return toIsoDate(mondayOfWeekContaining(d));
}

function paymentDatesForSchedule(
  schedule: BcaExpenseSchedule,
  rangeStart: Date,
  rangeEnd: Date
): { dateIso: string; amountCents: number }[] {
  const out: { dateIso: string; amountCents: number }[] = [];
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setMonth(cursor.getMonth() + 1)
  ) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    let day: number;
    let amountCents: number;
    let endDateIso: string | undefined;

    if (schedule.kind === "lastDayOfMonth") {
      day = lastDayOfMonth(year, month);
      amountCents = schedule.amountCents;
      endDateIso = schedule.endDateIso;
    } else {
      day = clampDay(year, month, schedule.dayOfMonth);
      amountCents = schedule.amountCents;
      endDateIso = schedule.endDateIso;
    }

    const dateIso = toIsoDate(new Date(year, month, day));
    const paymentDate = parseIsoDate(dateIso);
    if (!paymentDate || paymentDate < rangeStart || paymentDate > rangeEnd) continue;
    if (endDateIso && dateIso > endDateIso) continue;

    out.push({ dateIso, amountCents });
  }

  return out;
}

export function projectBcaOperatingExpenses(
  weekStarts: string[],
  now = new Date()
): ForecastExpenseRow[] {
  if (weekStarts.length === 0) return [];

  const rangeStart = parseIsoDate(weekStarts[0]);
  const rangeEnd = parseIsoDate(weekStarts[weekStarts.length - 1]);
  if (!rangeStart || !rangeEnd) return [];

  rangeEnd.setDate(rangeEnd.getDate() + 6);

  return BCA_OPERATING_EXPENSES.map((def) => {
    const amountsByWeek = Object.fromEntries(
      weekStarts.map((week) => [week, 0])
    ) as Record<string, number>;

    const payments = paymentDatesForSchedule(def.schedule, rangeStart, rangeEnd);
    for (const payment of payments) {
      const weekStart = weekStartForDateIso(payment.dateIso);
      if (!weekStarts.includes(weekStart)) continue;
      amountsByWeek[weekStart] =
        (amountsByWeek[weekStart] ?? 0) + payment.amountCents;
    }

    return {
      id: def.id,
      label: def.label,
      section: def.section,
      amountsByWeek,
      note: def.note ?? null,
      monthlyAmountCents:
        def.schedule.kind === "monthly"
          ? def.schedule.amountCents
          : def.schedule.amountCents,
      paymentDayOfMonth:
        def.schedule.kind === "monthly" ? def.schedule.dayOfMonth : null,
    };
  });
}

const LEGACY_EXPENSE_ID_PREFIXES = [
  "operating-expenses:",
  "owner-&-team:",
  "other:",
];

export function isLegacyExpenseRows(rows: ForecastExpenseRow[]): boolean {
  if (rows.length === 0) return true;
  return rows.some((row) =>
    LEGACY_EXPENSE_ID_PREFIXES.some((prefix) => row.id.startsWith(prefix))
  );
}

/** Saved manual edits overlay projected BCA defaults (non-zero cells win). */
export function mergeExpenseRows(
  projected: ForecastExpenseRow[],
  saved: ForecastExpenseRow[]
): ForecastExpenseRow[] {
  if (isLegacyExpenseRows(saved)) return projected;

  const savedById = new Map(saved.map((row) => [row.id, row]));
  return projected.map((row) => {
    const savedRow = savedById.get(row.id);
    if (!savedRow) return row;

    const amountsByWeek = { ...row.amountsByWeek };
    for (const [week, amount] of Object.entries(savedRow.amountsByWeek)) {
      if (amount > 0) amountsByWeek[week] = amount;
    }

    return {
      ...row,
      label: savedRow.label || row.label,
      amountsByWeek,
    };
  });
}

export function defaultExpenseSections(): ForecastExpenseRow[] {
  return BCA_OPERATING_EXPENSES.map((def) => ({
    id: def.id,
    label: def.label,
    section: def.section,
    amountsByWeek: {},
    note: def.note ?? null,
    monthlyAmountCents:
      def.schedule.kind === "monthly"
        ? def.schedule.amountCents
        : def.schedule.amountCents,
    paymentDayOfMonth:
      def.schedule.kind === "monthly" ? def.schedule.dayOfMonth : null,
  }));
}
