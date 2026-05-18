export const COACH_RECURRING_PAYMENT_STATUSES = [
  "monthly",
  "annual_prepaid",
  "first_6_months",
  "complimentary",
  "overdue",
] as const;

export type CoachRecurringPaymentStatus =
  (typeof COACH_RECURRING_PAYMENT_STATUSES)[number];

export const COACH_RECURRING_PAYMENT_LABELS: Record<
  CoachRecurringPaymentStatus,
  string
> = {
  monthly: "Monthly",
  annual_prepaid: "Annual prepaid",
  first_6_months: "1st 6 months",
  complimentary: "Complimentary",
  overdue: "Overdue",
};

export function isCoachRecurringPaymentStatus(
  value: string
): value is CoachRecurringPaymentStatus {
  return (COACH_RECURRING_PAYMENT_STATUSES as readonly string[]).includes(value);
}
