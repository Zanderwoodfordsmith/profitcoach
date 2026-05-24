/** BCA payment plans typically total £6k–£11k. Amounts in minor units (GBP). */

export const PLAN_INSTALLMENT_MIN_CENTS = 100_000; // £1,000
export const PLAN_INSTALLMENT_MAX_CENTS = 400_000; // £4,000
export const PLAN_TOTAL_MIN_CENTS = 600_000;
export const PLAN_TOTAL_MAX_CENTS = 1_100_000;
export const PLAN_TARGET_TOTAL_CENTS = 990_000;

/** Known monthly instalment → number of payments. */
const KNOWN_PLAN_INSTALLMENTS: Record<number, number> = {
  150_000: 7, // £1,500 × 7 = £10,500
  220_000: 5, // £2,200 × 5 = £11,000
  230_000: 4, // £2,300 × 4 = £9,200 (first may be discounted)
  260_000: 4, // £2,600 × 4 = £10,400
  330_000: 3, // £3,300 × 3 = £9,900
  340_000: 3, // £3,400 × 3 = £10,200
};

export function isPlanInstallmentAmount(amountCents: number): boolean {
  return (
    amountCents >= PLAN_INSTALLMENT_MIN_CENTS &&
    amountCents <= PLAN_INSTALLMENT_MAX_CENTS
  );
}

export function inferInstallmentCount(
  installmentAmountCents: number,
  paidCount: number
): number {
  const known = KNOWN_PLAN_INSTALLMENTS[installmentAmountCents];
  if (known != null) {
    return Math.max(known, paidCount);
  }

  let bestN = 4;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const n of [7, 6, 5, 4, 3]) {
    const total = installmentAmountCents * n;
    if (total < PLAN_TOTAL_MIN_CENTS || total > PLAN_TOTAL_MAX_CENTS) continue;
    const dist = Math.abs(total - PLAN_TARGET_TOTAL_CENTS);
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
