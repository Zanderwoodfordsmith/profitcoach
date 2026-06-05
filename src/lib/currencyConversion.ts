/** Fixed GBP→USD rate for chart totals (1 GBP = this many USD). */
export const GBP_TO_USD_RATE = 1.27;

export function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toLowerCase() || "gbp";
}

export function convertAmountCents(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string
): number | null {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return amountCents;

  if (from === "gbp" && to === "usd") {
    return Math.round(amountCents * GBP_TO_USD_RATE);
  }
  if (from === "usd" && to === "gbp") {
    return Math.round(amountCents / GBP_TO_USD_RATE);
  }

  return null;
}
