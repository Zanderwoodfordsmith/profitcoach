import { parseIsoDate, toIsoDate } from "@/lib/scorecardWeeks";
import type { ForecastPaymentInput } from "@/lib/cashFlowForecast/types";
import { amountsRoughlyMatch } from "@/lib/cashFlowForecast/paymentPlanInference";

export type ForecastOwedStatus = {
  amountOwedCents: number;
  owedLabel: string;
  /** Earliest relevant date for sorting — due date or failed payment date. */
  sortDateIso: string;
};

function streamKeyForPayment(payment: ForecastPaymentInput): string {
  if (payment.coach_id?.trim()) return `coach:${payment.coach_id.trim()}`;
  return `email:${payment.customer_email.trim().toLowerCase()}`;
}

function formatOwedDueDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const day = d.getDate();
  const mod100 = day % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day}${suffix} ${months[d.getMonth()] ?? ""}`;
}

export function formatForecastOwedDueDate(iso: string): string {
  return formatOwedDueDate(iso);
}

function addMonthsClamped(year: number, monthIndex: number, day: number, months: number) {
  const d = new Date(year, monthIndex + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function detectOwedPayment(
  streamKey: string,
  expectedAmountCents: number,
  paymentDayOfMonth: number,
  allPayments: ForecastPaymentInput[],
  installmentsPaid: number,
  installmentCount: number,
  now = new Date()
): ForecastOwedStatus | null {
  if (installmentsPaid >= installmentCount) return null;

  const streamPayments = allPayments.filter(
    (p) => streamKeyForPayment(p) === streamKey
  );

  const failed = streamPayments
    .filter(
      (p) =>
        (p.status === "failed" || p.status === "canceled") &&
        amountsRoughlyMatch(p.amount_cents, expectedAmountCents)
    )
    .sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at));

  if (failed.length > 0) {
    const latest = failed[0];
    return {
      amountOwedCents: latest.amount_cents,
      owedLabel: latest.status === "canceled" ? "Canceled" : "Failed",
      sortDateIso: latest.paid_at.slice(0, 10),
    };
  }

  if (installmentCount > 100) {
    return null;
  }

  const succeeded = streamPayments
    .filter((p) => p.status === "succeeded")
    .sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at));

  const lastSuccess = succeeded[0];
  const lastPaid = lastSuccess
    ? parseIsoDate(lastSuccess.paid_at.slice(0, 10))
    : null;

  const dueDate = lastPaid
    ? addMonthsClamped(
        lastPaid.getFullYear(),
        lastPaid.getMonth(),
        paymentDayOfMonth,
        1
      )
    : new Date(now.getFullYear(), now.getMonth(), paymentDayOfMonth);

  const dueIso = toIsoDate(dueDate);
  const todayIso = toIsoDate(now);
  const duePassed = dueIso <= todayIso;

  const paidThisCycle = succeeded.some((p) => {
    const d = parseIsoDate(p.paid_at.slice(0, 10));
    if (!d) return false;
    return (
      d.getFullYear() === dueDate.getFullYear() &&
      d.getMonth() === dueDate.getMonth() &&
      amountsRoughlyMatch(p.amount_cents, expectedAmountCents)
    );
  });

  if (duePassed && !paidThisCycle) {
    return {
      amountOwedCents: expectedAmountCents,
      owedLabel: "Overdue",
      sortDateIso: dueIso,
    };
  }

  return null;
}
