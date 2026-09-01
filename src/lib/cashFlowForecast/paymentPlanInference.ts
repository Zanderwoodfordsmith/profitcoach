/** BCA payment plans typically total £6k–£11k. Amounts in minor units (GBP). */

export const PLAN_INSTALLMENT_MIN_CENTS = 100_000; // £1,000
export const PLAN_INSTALLMENT_MAX_CENTS = 400_000; // £4,000
export const PLAN_TOTAL_MIN_CENTS = 600_000;
export const PLAN_TOTAL_MAX_CENTS = 1_100_000;
export const PLAN_TARGET_TOTAL_CENTS = 990_000;

/** Known monthly instalment → number of payments. */
const KNOWN_PLAN_INSTALLMENTS_GBP: Record<number, number> = {
  150_000: 7, // £1,500 × 7 = £10,500
  175_000: 6, // £1,750 × 6 = £10,500
  220_000: 5, // £2,200 × 5 = £11,000
  230_000: 4, // £2,300 × 4 = £9,200 (first may be discounted)
  260_000: 4, // £2,600 × 4 = £10,400
  330_000: 3, // £3,300 × 3 = £9,900
  340_000: 3, // £3,400 × 3 = £10,200
  495_000: 2, // £4,950 × 2 = £9,900
};

const KNOWN_PLAN_INSTALLMENTS_USD: Record<number, number> = {
  230_000: 6, // $2,300 × 6 = $13,800
  340_000: 4, // $3,400 × 4 = $13,600
  430_000: 3, // $4,300 × 3 = $12,900
  645_000: 2, // $6,450 × 2 = $12,900
};

const PLAN_TOTAL_MIN_CENTS_USD = 1_200_000;
const PLAN_TOTAL_MAX_CENTS_USD = 1_400_000;
const PLAN_TARGET_TOTAL_CENTS_USD = 1_290_000;

function normalizePlanCurrency(currency?: string): "gbp" | "usd" | null {
  const code = currency?.trim().toLowerCase();
  if (code === "usd") return "usd";
  if (code === "gbp") return "gbp";
  return null;
}

export function knownPlanInstallmentCount(
  installmentAmountCents: number,
  currency?: string
): number | null {
  const code = normalizePlanCurrency(currency);
  if (code === "usd") {
    return KNOWN_PLAN_INSTALLMENTS_USD[installmentAmountCents] ?? null;
  }
  if (code === "gbp") {
    return KNOWN_PLAN_INSTALLMENTS_GBP[installmentAmountCents] ?? null;
  }
  return (
    KNOWN_PLAN_INSTALLMENTS_GBP[installmentAmountCents] ??
    KNOWN_PLAN_INSTALLMENTS_USD[installmentAmountCents] ??
    null
  );
}

export function isPlanInstallmentAmount(amountCents: number): boolean {
  return (
    amountCents >= PLAN_INSTALLMENT_MIN_CENTS &&
    amountCents <= PLAN_INSTALLMENT_MAX_CENTS
  );
}

export function isRecognizedPlanInstallmentAmount(
  amountCents: number,
  currency?: string
): boolean {
  return (
    isPlanInstallmentAmount(amountCents) ||
    knownPlanInstallmentCount(amountCents, currency) != null
  );
}

export function inferInstallmentCount(
  installmentAmountCents: number,
  paidCount: number,
  currency?: string
): number {
  const known = knownPlanInstallmentCount(installmentAmountCents, currency);
  if (known != null) {
    return Math.max(known, paidCount);
  }

  const code = normalizePlanCurrency(currency);
  const totalMin =
    code === "usd" ? PLAN_TOTAL_MIN_CENTS_USD : PLAN_TOTAL_MIN_CENTS;
  const totalMax =
    code === "usd" ? PLAN_TOTAL_MAX_CENTS_USD : PLAN_TOTAL_MAX_CENTS;
  const target =
    code === "usd" ? PLAN_TARGET_TOTAL_CENTS_USD : PLAN_TARGET_TOTAL_CENTS;

  let bestN = 4;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const n of [7, 6, 5, 4, 3, 2]) {
    const total = installmentAmountCents * n;
    if (total < totalMin || total > totalMax) continue;
    const dist = Math.abs(total - target);
    if (dist < bestDist) {
      bestDist = dist;
      bestN = n;
    }
  }
  return Math.max(bestN, paidCount);
}

/** Ongoing instalment after discounts (e.g. £2,300 then £3,300 → £3,300). */
export function ongoingPlanInstallmentCents(amounts: number[]): number {
  if (amounts.length === 0) return 0;
  if (amounts.includes(330_000)) return 330_000;
  if (amounts.includes(340_000)) return 340_000;
  const max = Math.max(...amounts.slice(-3));
  if (max === 230_000) return 330_000;
  return max;
}

/** Skip one-off programme payments — single payment with no remaining plan. */
export function isOneTimePlanPayment(
  paidCount: number,
  installmentAmountCents: number,
  installmentCount: number
): boolean {
  if (paidCount !== 1) return false;
  if (installmentCount > paidCount) return false;
  const total = installmentAmountCents * installmentCount;
  return total < PLAN_TOTAL_MIN_CENTS || total > PLAN_TOTAL_MAX_CENTS;
}

export const PLAN_STALE_DAYS = 45;

export function amountsRoughlyMatch(a: number, b: number): boolean {
  if (a === b) return true;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return hi - lo <= Math.max(10_000, lo * 0.08);
}
