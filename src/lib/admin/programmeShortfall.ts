import { formatPaymentMoney } from "@/lib/adminPaymentDisplay";

/** A payment is still "on plan" when the last programme charge is this recent. */
const CURRENT_PLAN_DAYS = 45;

/** Ignore shortfalls of £500 or less (rounding, small discounts). */
const SHORT_TOLERANCE_CENTS = 50_000;

/**
 * A dollar programme at or above this, with almost no pounds collected,
 * is a USD sale rather than a GBP underpayment.
 */
const FULL_USD_PROGRAMME_CENTS = 900_000;
const NOTABLE_GBP_CENTS = 100_000;

/** Charges under £1,000 / $1,000 are membership or extras, not the programme. */
const PROGRAMME_MIN_CENTS = 100_000;

const MONTHLY_MEMBERSHIP_CENTS: Record<string, Set<number>> = {
  gbp: new Set([39900, 49500, 79500, 95000, 99000]),
  usd: new Set([39900, 79500, 149900, 299900]),
};

export type ProgrammeShortfallKind = "overdue" | "missing";

export type ProgrammeShortfall = {
  expected_cents: number;
  paid_cents: number;
  short_cents: number;
  currency: "GBP";
  kind: ProgrammeShortfallKind;
  explanation: string;
};

export type ProgrammeShortfallPayment = {
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string;
};

type PriceWindow = {
  expectedCents: number;
  priceLabel: string;
  windowLabel: string;
};

function joinDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Programme price in force when the coach joined.
 * February 2025 is still £9,600 — the £15,000 price shows up from March.
 * July–December 2025 intake paid £7,800. 2026 is £9,900.
 */
export function programmePriceForJoinDay(day: string): PriceWindow | null {
  if (day < "2024-04-01") return null;
  if (day < "2024-06-01") {
    return { expectedCents: 495_000, priceLabel: "£4,950", windowLabel: "Apr–May 2024" };
  }
  if (day < "2024-08-01") {
    return { expectedCents: 780_000, priceLabel: "£7,800", windowLabel: "Jun–Jul 2024" };
  }
  if (day < "2025-03-01") {
    return {
      expectedCents: 960_000,
      priceLabel: "£9,600",
      windowLabel: "Aug 2024–Feb 2025",
    };
  }
  if (day < "2025-07-01") {
    return {
      expectedCents: 1_500_000,
      priceLabel: "£15,000",
      windowLabel: "Mar–Jun 2025",
    };
  }
  if (day < "2026-01-01") {
    return { expectedCents: 780_000, priceLabel: "£7,800", windowLabel: "Jul–Dec 2025" };
  }
  return { expectedCents: 990_000, priceLabel: "£9,900", windowLabel: "2026" };
}

function isMonthlyMembership(amountCents: number, currency: string): boolean {
  const code = currency.trim().toLowerCase();
  return MONTHLY_MEMBERSHIP_CENTS[code]?.has(amountCents) ?? false;
}

function isProgrammePayment(payment: ProgrammeShortfallPayment): boolean {
  return (
    payment.status === "succeeded" &&
    payment.amountCents >= PROGRAMME_MIN_CENTS &&
    !isMonthlyMembership(payment.amountCents, payment.currency)
  );
}

function currencyCode(currency: string): string {
  return currency.trim().toLowerCase();
}

/**
 * August and September 2024 were the changeover. A completed £7,800 plan
 * in those months matches the price that was still being sold.
 */
function completedSevenEightHundredThroughSeptember(
  day: string,
  gbpPaidCents: number
): boolean {
  if (day < "2024-08-01" || day >= "2024-10-01") return false;
  return gbpPaidCents >= 730_000 && gbpPaidCents <= 830_000;
}

function formatJoinDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function latestPaidAt(payments: ProgrammeShortfallPayment[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const payment of payments) {
    const ms = Date.parse(payment.paidAt);
    if (Number.isNaN(ms) || ms < latestMs) continue;
    latestMs = ms;
    latest = payment.paidAt;
  }
  return latest;
}

function isCurrentPlan(lastPaidAt: string, now: Date): boolean {
  const paidMs = Date.parse(lastPaidAt);
  if (Number.isNaN(paidMs)) return false;
  return now.getTime() - paidMs <= CURRENT_PLAN_DAYS * 86_400_000;
}

function buildExplanation(input: {
  joinDay: string;
  price: PriceWindow;
  gbpPaidCents: number;
  shortCents: number;
  usdPaidCents: number;
}): string {
  const joined = formatJoinDay(input.joinDay);
  const price = `${input.price.priceLabel} (${input.price.windowLabel})`;
  if (input.gbpPaidCents <= 0 && input.usdPaidCents <= 0) {
    return `Joined ${joined}. No programme payment is on file. The price then was ${price}.`;
  }
  if (input.gbpPaidCents <= 0 && input.usdPaidCents > 0) {
    return `Joined ${joined}. ${formatPaymentMoney(input.usdPaidCents, "USD")} is on file in dollars, and the pound price then was ${price}.`;
  }
  const paid = formatPaymentMoney(input.gbpPaidCents, "GBP");
  const short = formatPaymentMoney(input.shortCents, "GBP");
  const dollars =
    input.usdPaidCents > 0
      ? ` ${formatPaymentMoney(input.usdPaidCents, "USD")} is also on file in dollars.`
      : "";
  return `Joined ${joined}, when the programme was ${price}. ${paid} is on file, so ${short} is still owed.${dollars}`;
}

export function assessProgrammeShortfall(
  input: {
    joinedAt: string | null;
    payments: ProgrammeShortfallPayment[];
    /**
     * False when joinedAt is only the account created date.
     * Those coaches are flagged only once a programme payment exists.
     */
    joinedOnProgrammeDate?: boolean;
  },
  now = new Date()
): ProgrammeShortfall | null {
  const day = joinDay(input.joinedAt);
  if (!day) return null;
  if (input.joinedOnProgrammeDate === false) {
    const hasProgrammePayment = input.payments.some(isProgrammePayment);
    if (!hasProgrammePayment) return null;
  }
  const price = programmePriceForJoinDay(day);
  if (!price) return null;

  const programme = input.payments.filter(isProgrammePayment);
  const gbpPaidCents = programme
    .filter((payment) => currencyCode(payment.currency) === "gbp")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const usdPaidCents = programme
    .filter((payment) => currencyCode(payment.currency) === "usd")
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  if (usdPaidCents >= FULL_USD_PROGRAMME_CENTS && gbpPaidCents < NOTABLE_GBP_CENTS) {
    return null;
  }
  if (completedSevenEightHundredThroughSeptember(day, gbpPaidCents)) return null;

  const shortCents = price.expectedCents - gbpPaidCents;
  if (shortCents <= SHORT_TOLERANCE_CENTS) return null;

  const gbpPayments = programme.filter(
    (payment) => currencyCode(payment.currency) === "gbp"
  );
  const lastPaidAt = latestPaidAt(gbpPayments);
  if (lastPaidAt && gbpPaidCents > 0 && isCurrentPlan(lastPaidAt, now)) return null;

  return {
    expected_cents: price.expectedCents,
    paid_cents: gbpPaidCents,
    short_cents: shortCents,
    currency: "GBP",
    kind: gbpPaidCents > 0 ? "overdue" : "missing",
    explanation: buildExplanation({
      joinDay: day,
      price,
      gbpPaidCents,
      shortCents,
      usdPaidCents,
    }),
  };
}

export type OverdueProgrammeCoach = {
  id: string;
  slug: string;
  name: string;
  joinedAt: string;
  shortfall: ProgrammeShortfall;
};

export function listOverdueProgrammeCoaches(
  coaches: Array<{
    id: string;
    slug: string;
    name: string;
    joinedAt: string | null;
    joinedOnProgrammeDate?: boolean;
  }>,
  payments: Array<ProgrammeShortfallPayment & { coachId: string | null }>,
  now = new Date()
): OverdueProgrammeCoach[] {
  const byCoach = new Map<string, ProgrammeShortfallPayment[]>();
  for (const payment of payments) {
    if (!payment.coachId) continue;
    const list = byCoach.get(payment.coachId) ?? [];
    list.push(payment);
    byCoach.set(payment.coachId, list);
  }

  const rows: OverdueProgrammeCoach[] = [];
  for (const coach of coaches) {
    const shortfall = assessProgrammeShortfall(
      {
        joinedAt: coach.joinedAt,
        payments: byCoach.get(coach.id) ?? [],
        joinedOnProgrammeDate: coach.joinedOnProgrammeDate,
      },
      now
    );
    if (!shortfall || !coach.joinedAt) continue;
    rows.push({
      id: coach.id,
      slug: coach.slug,
      name: coach.name,
      joinedAt: coach.joinedAt,
      shortfall,
    });
  }

  rows.sort((a, b) => {
    if (b.shortfall.short_cents !== a.shortfall.short_cents) {
      return b.shortfall.short_cents - a.shortfall.short_cents;
    }
    return a.name.localeCompare(b.name);
  });
  return rows;
}

export type AttentionCharge = {
  coachId: string | null;
  coachSlug: string | null;
  coachName: string | null;
  email: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string;
  declineReason: string | null;
  description: string | null;
};

export type UnrecoveredFailedCharge = {
  key: string;
  coachId: string | null;
  coachSlug: string | null;
  coachName: string;
  email: string;
  latestPaidAt: string;
  latestAmountCents: number;
  latestCurrency: string;
  declineReason: string | null;
  description: string | null;
  failureCount: number;
};

function partyKey(charge: Pick<AttentionCharge, "coachId" | "email">): string {
  if (charge.coachId) return `coach:${charge.coachId}`;
  return `email:${charge.email.trim().toLowerCase()}`;
}

function sameAmount(a: number, b: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff <= Math.max(100, Math.round(Math.max(a, b) * 0.01));
}

function wasRecovered(failure: AttentionCharge, charges: AttentionCharge[]): boolean {
  const failedAt = Date.parse(failure.paidAt);
  const key = partyKey(failure);
  const currency = currencyCode(failure.currency);
  let laterSucceededCents = 0;
  for (const charge of charges) {
    if (charge.status !== "succeeded") continue;
    if (partyKey(charge) !== key) continue;
    if (currencyCode(charge.currency) !== currency) continue;
    const paidAt = Date.parse(charge.paidAt);
    if (Number.isNaN(paidAt) || paidAt <= failedAt) continue;
    laterSucceededCents += charge.amountCents;
    if (
      sameAmount(charge.amountCents, failure.amountCents) ||
      laterSucceededCents >= failure.amountCents
    ) {
      return true;
    }
  }
  return false;
}

/** Failed charges with no later successful charge for the same amount. */
export function listUnrecoveredFailedCharges(
  charges: AttentionCharge[]
): UnrecoveredFailedCharge[] {
  const failures = charges.filter(
    (charge) => charge.status === "failed" && charge.amountCents >= 2_000
  );
  const open = failures.filter((failure) => !wasRecovered(failure, charges));
  const groups = new Map<string, AttentionCharge[]>();
  for (const failure of open) {
    const key = partyKey(failure);
    const list = groups.get(key) ?? [];
    list.push(failure);
    groups.set(key, list);
  }

  const rows: UnrecoveredFailedCharge[] = [];
  for (const [key, list] of groups) {
    const latest = [...list].sort(
      (a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt)
    )[0];
    if (!latest) continue;
    rows.push({
      key,
      coachId: latest.coachId,
      coachSlug: latest.coachSlug,
      coachName: latest.coachName?.trim() || latest.email,
      email: latest.email,
      latestPaidAt: latest.paidAt,
      latestAmountCents: latest.amountCents,
      latestCurrency: latest.currency,
      declineReason: latest.declineReason,
      description: latest.description,
      failureCount: list.length,
    });
  }

  rows.sort((a, b) => Date.parse(b.latestPaidAt) - Date.parse(a.latestPaidAt));
  return rows;
}
