/**
 * Filter legacy / multi-product Stripe exports by description.
 * Used for the older Business Coach Academy Stripe account (ThriveCart, etc.).
 *
 * Legacy imports use a deny-list only: rows with a customer email are imported
 * unless the description clearly matches another product line (Strivx, Dreams, etc.).
 */

export type PaymentProductSkipReason = "excluded_product";

/** Substrings that always skip (other brands / products). */
const DENY_DESCRIPTION_PATTERNS = [
  /\bstrivx\b/i,
  /\bdreams\s*dashboard\b/i,
  /\bperformance\s*lab\b/i,
  /\bdreams\s*designer\b/i,
  /\bdream\s*designer\b/i,
];

export function isDeniedPaymentDescription(description: string | null): boolean {
  const text = (description ?? "").trim();
  if (!text) return false;
  return DENY_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Whether a legacy Stripe charge row should be skipped for product reasons.
 * Call after email / amount / status checks.
 */
export function legacyStripeProductImportReason(
  description: string | null
): PaymentProductSkipReason | null {
  if (isDeniedPaymentDescription(description)) {
    return "excluded_product";
  }
  return null;
}
