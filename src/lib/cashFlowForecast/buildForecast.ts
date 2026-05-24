import {
  buildPaymentBillingKindIndex,
  isRecurringSubscriptionAmount,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";
import { isExcludedCustomerEmail } from "@/lib/paymentImportFilters";
import {
  mondayOfWeekContaining,
  mondaySequenceFromStart,
  parseIsoDate,
  toIsoDate,
} from "@/lib/scorecardWeeks";
import {
  mergeExpenseRows,
  projectBcaOperatingExpenses,
} from "@/lib/cashFlowForecast/bcaOperatingExpenses";
import {
  CASH_FLOW_FORECAST_WEEKS,
  type ForecastCashEvent,
  type ForecastCoachBilling,
  type ForecastCustomerRow,
  type ForecastExpenseRow,
  type ForecastPaymentInput,
  type ForecastStreamKind,
  type ForecastWeekSummary,
} from "@/lib/cashFlowForecast/types";

/** Monthly tiers used when projecting cash in (includes £333). */
const FORECAST_RECURRING_AMOUNT_CENTS: Record<string, Set<number>> = {
  gbp: new Set([33300, 49500, 99000, 39900, 79500, 95000]),
  usd: new Set([39900, 79500, 149900, 299900]),
};

import {
  amountsRoughlyMatch,
  inferInstallmentCount,
  isOneTimePlanPayment,
  isPlanInstallmentAmount,
  ongoingPlanInstallmentCents,
  PLAN_STALE_DAYS,
} from "@/lib/cashFlowForecast/paymentPlanInference";
import { detectOwedPayment } from "@/lib/cashFlowForecast/owedPayments";

function normalizeCurrency(currency: string): string {
  return currency.trim().toLowerCase();
}

function isForecastRecurringAmount(amountCents: number, currency: string): boolean {
  const cur = normalizeCurrency(currency);
  if (FORECAST_RECURRING_AMOUNT_CENTS[cur]?.has(amountCents)) return true;
  return isRecurringSubscriptionAmount(amountCents, currency);
}

function streamKeyForPayment(payment: ForecastPaymentInput): string {
  if (payment.coach_id?.trim()) return `coach:${payment.coach_id.trim()}`;
  return `email:${payment.customer_email.trim().toLowerCase()}`;
}

function customerDisplay(
  payment: ForecastPaymentInput,
  coach?: ForecastCoachBilling | null
): { label: string; companyName: string | null } {
  const company =
    coach?.coach_business_name?.trim() ||
    payment.customer_company_name?.trim() ||
    null;

  if (coach) {
    const label =
      coach.full_name?.trim() ||
      coach.email?.trim() ||
      company ||
      payment.customer_email;
    const companyName =
      company && company.toLowerCase() !== label.toLowerCase() ? company : null;
    return { label, companyName };
  }

  return {
    label: payment.customer_company_name?.trim() || payment.customer_email,
    companyName: null,
  };
}

function dayOfMonthFromIso(iso: string): number {
  const d = parseIsoDate(iso);
  return d?.getDate() ?? 1;
}

function addMonthsClamped(year: number, monthIndex: number, day: number, months: number) {
  const d = new Date(year, monthIndex + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function isoFromDate(d: Date): string {
  return toIsoDate(d);
}

function weekStartForDateIso(dateIso: string): string {
  const d = parseIsoDate(dateIso);
  if (!d) return dateIso;
  return toIsoDate(mondayOfWeekContaining(d));
}

function daysSince(iso: string, now = new Date()): number {
  const d = parseIsoDate(iso);
  if (!d) return Number.POSITIVE_INFINITY;
  return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
}

const RECURRING_STALE_DAYS = 75;

type StreamState = {
  streamKey: string;
  coachId: string | null;
  customerLabel: string;
  companyName: string | null;
  kind: ForecastStreamKind;
  amountCents: number;
  currency: string;
  paymentDayOfMonth: number;
  lastPaidIso: string;
  startedIso: string;
  installmentCount?: number;
  installmentsPaid?: number;
};

function hasCanceledRecurringAfterLastSuccess(
  streamKey: string,
  amountCents: number,
  lastPaidIso: string,
  allPayments: ForecastPaymentInput[]
): boolean {
  const lastPaidMs = Date.parse(`${lastPaidIso}T12:00:00`);
  return allPayments.some((p) => {
    if (streamKeyForPayment(p) !== streamKey) return false;
    if (p.status !== "canceled") return false;
    if (!amountsRoughlyMatch(p.amount_cents, amountCents)) return false;
    return Date.parse(p.paid_at) > lastPaidMs;
  });
}

function shouldSkipBillingStatus(status: string | null | undefined): boolean {
  return status === "complimentary";
}

function recurringIsActive(
  lastPaidIso: string,
  billingStatus: string | null | undefined
): boolean {
  if (shouldSkipBillingStatus(billingStatus)) return false;
  if (billingStatus === "annual_prepaid") return false;
  if (billingStatus === "monthly" || billingStatus === "first_6_months") return true;
  return daysSince(lastPaidIso) <= RECURRING_STALE_DAYS;
}

function planIsActive(lastPaidIso: string, remaining: number): boolean {
  if (remaining <= 0) return false;
  return daysSince(lastPaidIso) <= PLAN_STALE_DAYS * 2;
}

function detectStreams(
  payments: ForecastPaymentInput[],
  coachById: Map<string, ForecastCoachBilling>,
  now = new Date()
): { streams: StreamState[]; canceledStreamKeys: Set<string> } {
  const billingIndex = buildPaymentBillingKindIndex(
    payments as PaymentForBillingKind[]
  );

  const succeeded = payments
    .filter((p) => p.status === "succeeded")
    .sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at));

  const byStream = new Map<string, ForecastPaymentInput[]>();
  for (const payment of succeeded) {
    if (isExcludedCustomerEmail(payment.customer_email)) continue;
    const key = streamKeyForPayment(payment);
    const list = byStream.get(key) ?? [];
    list.push(payment);
    byStream.set(key, list);
  }

  const streams: StreamState[] = [];
  const canceledStreamKeys = new Set<string>();

  for (const [streamKey, groupPayments] of byStream) {
    const coachId = groupPayments.find((p) => p.coach_id)?.coach_id ?? null;
    const coach = coachId ? coachById.get(coachId) ?? null : null;
    if (shouldSkipBillingStatus(coach?.recurring_payment_status)) continue;

    const recurringPayments = groupPayments.filter((p) => {
      const kind = billingIndex.get(p.id) ?? "other";
      return kind === "recurring" && isForecastRecurringAmount(p.amount_cents, p.currency);
    });

    if (recurringPayments.length > 0) {
      const latest = recurringPayments[recurringPayments.length - 1];
      const paidIso = latest.paid_at.slice(0, 10);
      const canceled = hasCanceledRecurringAfterLastSuccess(
        streamKey,
        latest.amount_cents,
        paidIso,
        payments
      );
      if (canceled) {
        canceledStreamKeys.add(streamKey);
        continue;
      }
      if (recurringIsActive(paidIso, coach?.recurring_payment_status)) {
        const { label, companyName } = customerDisplay(latest, coach);
        streams.push({
          streamKey,
          coachId,
          customerLabel: label,
          companyName,
          kind: "recurring",
          amountCents: latest.amount_cents,
          currency: latest.currency,
          paymentDayOfMonth: dayOfMonthFromIso(paidIso),
          lastPaidIso: paidIso,
          startedIso: recurringPayments[0].paid_at.slice(0, 10),
        });
        continue;
      }
    }

    const installmentPayments = groupPayments
      .filter((p) => {
        const kind = billingIndex.get(p.id) ?? "other";
        return (
          (kind === "installment" || kind === "initial") &&
          p.status === "succeeded" &&
          isPlanInstallmentAmount(p.amount_cents) &&
          !isForecastRecurringAmount(p.amount_cents, p.currency)
        );
      })
      .sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at));

    if (installmentPayments.length === 0) continue;

    const paidCount = installmentPayments.length;
    const ongoingAmount = ongoingPlanInstallmentCents(
      installmentPayments.map((p) => p.amount_cents)
    );
    const installmentCount = inferInstallmentCount(ongoingAmount, paidCount);

    if (isOneTimePlanPayment(paidCount, ongoingAmount, installmentCount)) {
      continue;
    }

    const remaining = installmentCount - paidCount;
    const latest = installmentPayments[paidCount - 1];
    const paidIso = latest.paid_at.slice(0, 10);

    if (!planIsActive(paidIso, remaining)) continue;

    const { label, companyName } = customerDisplay(latest, coach);
    streams.push({
      streamKey,
      coachId,
      customerLabel: label,
      companyName,
      kind: "plan",
      amountCents: ongoingAmount,
      currency: latest.currency,
      paymentDayOfMonth: dayOfMonthFromIso(paidIso),
      lastPaidIso: paidIso,
      startedIso: installmentPayments[0].paid_at.slice(0, 10),
      installmentCount,
      installmentsPaid: paidCount,
    });
  }

  return { streams, canceledStreamKeys };
}

function formatPlanAmount(cents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPaymentDay(day: number): string {
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
  return `~${day}${suffix}`;
}

function formatStartedMonth(iso: string, now = new Date()): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getMonth()] ?? "???";
  if (d.getFullYear() === now.getFullYear()) return month;
  return `${month} '${String(d.getFullYear()).slice(-2)}`;
}

function buildCustomerSubtitle(stream: StreamState, now = new Date()): string {
  const parts: string[] = [];

  if (stream.paymentDayOfMonth) {
    parts.push(formatPaymentDay(stream.paymentDayOfMonth));
  }
  parts.push(`${formatPlanAmount(stream.amountCents)}/mo`);

  if (stream.kind === "plan") {
    const paid = stream.installmentsPaid ?? 0;
    const total = stream.installmentCount ?? 4;
    const remaining = Math.max(0, total - paid);
    parts.push(`${paid}/${total}`);
    if (remaining > 0) {
      parts.push(`~${formatPlanAmount(stream.amountCents * remaining)} left`);
    }
  }

  parts.push(formatStartedMonth(stream.startedIso, now));
  return parts.join(" · ");
}

function buildCustomerRowFromStream(
  stream: StreamState,
  weekStarts: string[],
  allPayments: ForecastPaymentInput[],
  now: Date
): ForecastCustomerRow {
  const owed = detectOwedPayment(
    stream.streamKey,
    stream.amountCents,
    stream.paymentDayOfMonth,
    allPayments,
    stream.kind === "plan" ? (stream.installmentsPaid ?? 0) : 0,
    stream.kind === "plan" ? (stream.installmentCount ?? 4) : 999,
    now
  );

  return {
    streamKey: stream.streamKey,
    customerLabel: stream.customerLabel,
    companyName: stream.companyName,
    kind: stream.kind,
    amountCents: stream.amountCents,
    currency: stream.currency,
    paymentDayOfMonth: stream.paymentDayOfMonth,
    coachId: stream.coachId,
    amountsByWeek: Object.fromEntries(weekStarts.map((w) => [w, 0])),
    note: buildCustomerSubtitle(stream, now),
    amountOwedCents: owed?.amountOwedCents ?? null,
    owedLabel: owed?.owedLabel ?? null,
    owedSortDateIso: owed?.sortDateIso ?? null,
    lastPaidIso: stream.lastPaidIso,
  };
}

function projectStreamEvents(
  stream: StreamState,
  horizonStart: Date,
  horizonEnd: Date
): ForecastCashEvent[] {
  const events: ForecastCashEvent[] = [];
  const day = stream.paymentDayOfMonth;
  const lastPaid = parseIsoDate(stream.lastPaidIso);
  if (!lastPaid) return events;

  if (stream.kind === "recurring") {
    let cursor = addMonthsClamped(
      lastPaid.getFullYear(),
      lastPaid.getMonth(),
      day,
      1
    );
    while (cursor <= horizonEnd) {
      if (cursor >= horizonStart) {
        events.push({
          streamKey: stream.streamKey,
          customerLabel: stream.customerLabel,
          companyName: stream.companyName,
          kind: "recurring",
          amountCents: stream.amountCents,
          currency: stream.currency,
          dateIso: isoFromDate(cursor),
          source: "projected",
          paymentDayOfMonth: day,
          coachId: stream.coachId,
        });
      }
      cursor = addMonthsClamped(cursor.getFullYear(), cursor.getMonth(), day, 1);
    }
    return events;
  }

  const remaining =
    (stream.installmentCount ?? 4) - (stream.installmentsPaid ?? 0);
  let cursor = addMonthsClamped(
    lastPaid.getFullYear(),
    lastPaid.getMonth(),
    day,
    1
  );
  for (let i = 0; i < remaining && cursor <= horizonEnd; i++) {
    if (cursor >= horizonStart) {
      events.push({
        streamKey: stream.streamKey,
        customerLabel: stream.customerLabel,
        companyName: stream.companyName,
        kind: "plan",
        amountCents: stream.amountCents,
        currency: stream.currency,
        dateIso: isoFromDate(cursor),
        source: "projected",
        paymentDayOfMonth: day,
        coachId: stream.coachId,
      });
    }
    cursor = addMonthsClamped(cursor.getFullYear(), cursor.getMonth(), day, 1);
  }
  return events;
}

function firstPaymentWeek(
  row: ForecastCustomerRow,
  weekStarts: string[]
): string | null {
  for (const week of weekStarts) {
    if ((row.amountsByWeek[week] ?? 0) > 0) return week;
  }
  return null;
}

function compareCustomerRows(
  a: ForecastCustomerRow,
  b: ForecastCustomerRow,
  weekStarts: string[]
): number {
  const aOwed = (a.amountOwedCents ?? 0) > 0;
  const bOwed = (b.amountOwedCents ?? 0) > 0;

  if (aOwed !== bOwed) return aOwed ? -1 : 1;

  if (aOwed && bOwed) {
    const aDue = a.owedSortDateIso ?? "9999-99-99";
    const bDue = b.owedSortDateIso ?? "9999-99-99";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return (b.amountOwedCents ?? 0) - (a.amountOwedCents ?? 0);
  }

  const aLast = a.lastPaidIso ?? "";
  const bLast = b.lastPaidIso ?? "";
  if (aLast !== bLast) return bLast.localeCompare(aLast);

  const aNext = firstPaymentWeek(a, weekStarts);
  const bNext = firstPaymentWeek(b, weekStarts);
  if (aNext !== bNext) {
    if (!aNext) return 1;
    if (!bNext) return -1;
    return aNext.localeCompare(bNext);
  }

  if (a.kind !== b.kind) return a.kind === "recurring" ? -1 : 1;
  return a.customerLabel.localeCompare(b.customerLabel);
}

function actualEventsInHorizon(
  payments: ForecastPaymentInput[],
  weekStarts: string[],
  excludedStreamKeys: Set<string>,
  coachById: Map<string, ForecastCoachBilling>
): ForecastCashEvent[] {
  const weekSet = new Set(weekStarts);
  const horizonStart = parseIsoDate(weekStarts[0]);
  const horizonEnd = parseIsoDate(weekStarts[weekStarts.length - 1]);
  if (!horizonStart || !horizonEnd) return [];
  horizonEnd.setDate(horizonEnd.getDate() + 6);

  const billingIndex = buildPaymentBillingKindIndex(
    payments as PaymentForBillingKind[]
  );

  const events: ForecastCashEvent[] = [];
  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;
    if (isExcludedCustomerEmail(payment.customer_email)) continue;
    const streamKey = streamKeyForPayment(payment);
    if (excludedStreamKeys.has(streamKey)) continue;

    const paidIso = payment.paid_at.slice(0, 10);
    const paidDate = parseIsoDate(paidIso);
    if (!paidDate || paidDate < horizonStart || paidDate > horizonEnd) continue;

    const weekStart = weekStartForDateIso(paidIso);
    if (!weekSet.has(weekStart)) continue;

    const kindRaw = billingIndex.get(payment.id) ?? "other";
    let kind: ForecastStreamKind | null = null;
    if (
      kindRaw === "recurring" &&
      isForecastRecurringAmount(payment.amount_cents, payment.currency)
    ) {
      kind = "recurring";
    } else if (kindRaw === "installment" || kindRaw === "initial") {
      if (!isForecastRecurringAmount(payment.amount_cents, payment.currency)) {
        kind = "plan";
      }
    }
    if (!kind) continue;

    const coach = payment.coach_id ? coachById.get(payment.coach_id) ?? null : null;
    const { label, companyName } = customerDisplay(payment, coach);

    events.push({
      streamKey,
      customerLabel: label,
      companyName,
      kind,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      dateIso: paidIso,
      source: "actual",
      paymentDayOfMonth: dayOfMonthFromIso(paidIso),
      coachId: payment.coach_id,
    });
  }
  return events;
}

function shortWeekLabel(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function buildCashFlowForecast(input: {
  payments: ForecastPaymentInput[];
  coachById: Map<string, ForecastCoachBilling>;
  openingBalanceCents: number;
  stripeBalanceCents?: number;
  stripeBalanceAsOf?: string | null;
  expenseRows: ForecastExpenseRow[];
  excludedStreamKeys: string[];
  startMonday?: string | null;
  now?: Date;
}): {
  startMonday: string;
  weekStarts: string[];
  customerRows: ForecastCustomerRow[];
  expenseRows: ForecastExpenseRow[];
  weekSummaries: ForecastWeekSummary[];
} {
  const now = input.now ?? new Date();
  const startMonday =
    input.startMonday && parseIsoDate(input.startMonday)?.getDay() === 1
      ? input.startMonday
      : toIsoDate(mondayOfWeekContaining(now));

  const weekStarts = mondaySequenceFromStart(
    startMonday,
    CASH_FLOW_FORECAST_WEEKS
  );
  const excluded = new Set(input.excludedStreamKeys);
  const horizonStart = parseIsoDate(weekStarts[0])!;
  const horizonEnd = parseIsoDate(weekStarts[weekStarts.length - 1])!;
  horizonEnd.setDate(horizonEnd.getDate() + 6);

  const { streams: detectedStreams, canceledStreamKeys } = detectStreams(
    input.payments,
    input.coachById,
    now
  );
  const streams = detectedStreams.filter(
    (s) => !excluded.has(s.streamKey) && !canceledStreamKeys.has(s.streamKey)
  );

  const projected = streams.flatMap((stream) =>
    projectStreamEvents(stream, horizonStart, horizonEnd)
  );
  const actual = actualEventsInHorizon(
    input.payments,
    weekStarts,
    excluded,
    input.coachById
  ).filter((event) => !canceledStreamKeys.has(event.streamKey));

  const allEvents = [...actual, ...projected];
  const rowMap = new Map<string, ForecastCustomerRow>();

  for (const stream of streams) {
    rowMap.set(
      stream.streamKey,
      buildCustomerRowFromStream(stream, weekStarts, input.payments, now)
    );
  }

  for (const event of allEvents) {
    if (normalizeCurrency(event.currency) !== "gbp") continue;
    const weekStart = weekStartForDateIso(event.dateIso);
    let row = rowMap.get(event.streamKey);
    if (!row) {
      row = {
        streamKey: event.streamKey,
        customerLabel: event.customerLabel,
        companyName: event.companyName,
        kind: event.kind,
        amountCents: event.amountCents,
        currency: event.currency,
        paymentDayOfMonth: event.paymentDayOfMonth,
        coachId: event.coachId,
        amountsByWeek: Object.fromEntries(weekStarts.map((w) => [w, 0])),
        note: null,
        amountOwedCents: null,
        owedLabel: null,
        owedSortDateIso: null,
        lastPaidIso: null,
      };
      rowMap.set(event.streamKey, row);
    }
    if (!weekStarts.includes(weekStart)) continue;
    row.amountsByWeek[weekStart] =
      (row.amountsByWeek[weekStart] ?? 0) + event.amountCents;
  }

  const customerRows = [...rowMap.values()]
    .filter((row) => row.owedLabel !== "Canceled")
    .sort((a, b) => compareCustomerRows(a, b, weekStarts));

  const projectedExpenses = projectBcaOperatingExpenses(weekStarts, input.now);
  const expenseRows = mergeExpenseRows(projectedExpenses, input.expenseRows);

  const startingBalanceCents =
    input.openingBalanceCents + Math.max(0, input.stripeBalanceCents ?? 0);

  const expenseByWeek = Object.fromEntries(
    weekStarts.map((w) => [w, 0])
  ) as Record<string, number>;
  for (const expense of expenseRows) {
    for (const week of weekStarts) {
      expenseByWeek[week] += expense.amountsByWeek[week] ?? 0;
    }
  }

  const weekSummaries: ForecastWeekSummary[] = [];
  let runningBalance = startingBalanceCents;

  for (let i = 0; i < weekStarts.length; i++) {
    const weekStart = weekStarts[i];
    let cashInRecurringCents = 0;
    let cashInPlanCents = 0;
    for (const row of customerRows) {
      const amount = row.amountsByWeek[weekStart] ?? 0;
      if (row.kind === "recurring") cashInRecurringCents += amount;
      else cashInPlanCents += amount;
    }
    const cashInTotalCents = cashInRecurringCents + cashInPlanCents;
    const cashOutCents = expenseByWeek[weekStart] ?? 0;
    const netDifferenceCents = cashInTotalCents - cashOutCents;
    const beginningCashCents = runningBalance;
    const endingCashCents = beginningCashCents + netDifferenceCents;
    runningBalance = endingCashCents;

    weekSummaries.push({
      weekStart,
      weekLabel: shortWeekLabel(weekStart),
      cashInRecurringCents,
      cashInPlanCents,
      cashInTotalCents,
      cashOutCents,
      netDifferenceCents,
      beginningCashCents,
      endingCashCents,
    });
  }

  return {
    startMonday,
    weekStarts,
    customerRows,
    expenseRows,
    weekSummaries,
  };
}

export { defaultExpenseSections } from "@/lib/cashFlowForecast/bcaOperatingExpenses";
