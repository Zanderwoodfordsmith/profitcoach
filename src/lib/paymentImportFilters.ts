const EXCLUDED_CUSTOMER_EMAILS = new Set([
  "pam@businesscoachacademy.com",
  "zander@businesscoachacademy.com",
]);

/** GBP / USD imports below this (in minor units) are ignored. */
const MIN_AMOUNT_CENTS: Record<string, number> = {
  gbp: 2000,
  usd: 2000,
};

export type PaymentImportSkipReason = "excluded_email" | "below_minimum_amount";

export function isExcludedCustomerEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (EXCLUDED_CUSTOMER_EMAILS.has(normalized)) return true;
  if (/^zander\+.+@businesscoachacademy\.com$/.test(normalized)) return true;
  return false;
}

export function paymentImportSkipReason(
  customerEmail: string,
  amountCents: number,
  currency: string
): PaymentImportSkipReason | null {
  if (isExcludedCustomerEmail(customerEmail)) {
    return "excluded_email";
  }

  const minAmount = MIN_AMOUNT_CENTS[currency.trim().toLowerCase()];
  if (minAmount != null && amountCents < minAmount) {
    return "below_minimum_amount";
  }

  return null;
}
