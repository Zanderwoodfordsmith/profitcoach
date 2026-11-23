import type { CoachRecurringPaymentStatus } from "@/lib/coachBilling";
import {
  isAnnual10MonthSubscriptionAmount,
  isAnnual12MonthSubscriptionAmount,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";

/**
 * One line for the Billing column on Admin → Coaches, worked out from real
 * payments rather than the stored status (Stripe sync marks payment plans
 * "monthly" because they bill monthly). Zander, 21 Nov 2026: monthly is only
 * under £1,000; £1,000+ is a payment plan.
 */
export type CoachBillingKind =
  | "monthly"
  | "annual"
  | "plan"
  | "paid_in_full"
  | "lapsed"
  | "overdue"
  | "free"
  | "none";

export type CoachBillingSummary = {
  kind: CoachBillingKind;
  label: string;
  /** Hover text: amount and when. */
  detail: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A monthly or plan payer pays about every 30 days; allow a late retry. */
const CURRENT_DAYS = 45;
/** A one-off full payment covers the programme months. */
const PAID_IN_FULL_CURRENT_DAYS = 125;
const MONTHLY_BELOW_CENTS = 100_000;
const PAID_IN_FULL_FROM_CENTS = 700_000;

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function summariseCoachBilling(input: {
  status: CoachRecurringPaymentStatus | null;
  payments: PaymentForBillingKind[];
  now?: number;
}): CoachBillingSummary {
  const now = input.now ?? Date.now();
  if (input.status === "complimentary") {
    return { kind: "free", label: "Free", detail: "Marked free (no payments due)" };
  }
  if (input.status === "overdue") {
    return { kind: "overdue", label: "Overdue", detail: "Marked overdue" };
  }

  const paid = input.payments
    .filter((p) => p.status === "succeeded" && p.paid_at)
    .sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at));
  const latest = paid[0];
  if (!latest) {
    return { kind: "none", label: "No payments", detail: "No payments yet" };
  }
  const ageDays = (iso: string) => (now - Date.parse(iso)) / DAY_MS;

  // A coach's first payment is the programme fee, even at an annual amount
  // (£9,900 up front is "paid in full", not a year of membership).
  const first = paid[paid.length - 1];
  const annual = paid.find(
    (p) =>
      p !== first &&
      ((isAnnual10MonthSubscriptionAmount(p.amount_cents, p.currency) && ageDays(p.paid_at) <= 305) ||
      (isAnnual12MonthSubscriptionAmount(p.amount_cents, p.currency) && ageDays(p.paid_at) <= 365))
  );
  if (annual) {
    return {
      kind: "annual",
      label: "Annual",
      detail: `${money(annual.amount_cents, annual.currency)} for the year, paid ${shortDate(annual.paid_at)}`,
    };
  }

  const amount = money(latest.amount_cents, latest.currency);
  const age = ageDays(latest.paid_at);
  if (latest.amount_cents < MONTHLY_BELOW_CENTS) {
    if (age <= CURRENT_DAYS) {
      return { kind: "monthly", label: `${amount}/mo`, detail: `Monthly, last paid ${shortDate(latest.paid_at)}` };
    }
  } else if (latest.amount_cents >= PAID_IN_FULL_FROM_CENTS) {
    if (age <= PAID_IN_FULL_CURRENT_DAYS) {
      return { kind: "paid_in_full", label: "Paid in full", detail: `${amount} on ${shortDate(latest.paid_at)}` };
    }
  } else if (age <= CURRENT_DAYS) {
    const sameAmount = paid.filter(
      (p) => p.amount_cents === latest.amount_cents && p.currency === latest.currency
    ).length;
    return {
      kind: "plan",
      label: "Payment plan",
      detail: `${amount} a month, ${sameAmount} paid, last ${shortDate(latest.paid_at)}`,
    };
  }

  // Should be paying monthly but nothing recent has come in (21 Nov).
  return {
    kind: "lapsed",
    label: "Not paying",
    detail: `Nothing since ${amount} on ${shortDate(latest.paid_at)}`,
  };
}

/**
 * The access level a coach would be on, from their billing and join date
 * (job 257, 21 Nov 2026). A label only: nobody's access changes until the
 * levels are switched on. Names are provisional.
 */
export type CoachPlannedLevel = "advisor_os" | "academy" | "no_access";

export const COACH_PLANNED_LEVEL_LABELS: Record<CoachPlannedLevel, string> = {
  advisor_os: "Advisor OS",
  academy: "Academy",
  no_access: "Do not contact",
};

const PROGRAMME_MONTHS = 4;

export function plannedCoachLevel(input: {
  billing: CoachBillingSummary;
  accessTier: string | null;
  joinedAt: string | null;
  now?: number;
}): { level: CoachPlannedLevel; reason: string } {
  if (input.accessTier === "do_not_contact" || input.accessTier === "early_exit") {
    return { level: "no_access", reason: "Access tier is Do not contact or Early exit" };
  }
  const now = input.now ?? Date.now();
  const joined = input.joinedAt ? new Date(input.joinedAt) : null;
  if (joined && !Number.isNaN(joined.getTime())) {
    const programmeEnds = new Date(joined);
    programmeEnds.setMonth(programmeEnds.getMonth() + PROGRAMME_MONTHS);
    if (programmeEnds.getTime() > now) {
      return { level: "advisor_os", reason: `In their first ${PROGRAMME_MONTHS} months (programme)` };
    }
  }
  switch (input.billing.kind) {
    case "monthly":
    case "annual":
      return { level: "advisor_os", reason: "Paying for membership" };
    case "plan":
      return { level: "advisor_os", reason: "On a payment plan" };
    case "paid_in_full":
      return { level: "advisor_os", reason: "Paid the programme in full" };
    case "free":
      return { level: "advisor_os", reason: "Marked free" };
    case "overdue":
      return { level: "academy", reason: "Marked overdue" };
    case "lapsed":
      return { level: "academy", reason: "Not paying monthly" };
    default:
      return { level: "academy", reason: "No payments and past the programme months" };
  }
}
