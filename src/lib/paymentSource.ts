export type PaymentSource =
  | "stripe"
  | "stripe_stryv_us"
  | "revolut_merchant"
  | "revolut_direct";

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  stripe: "Stripe",
  stripe_stryv_us: "Stripe (Stryv US)",
  revolut_merchant: "Revolut merchant",
  revolut_direct: "Revolut transfer",
};

export function paymentSourceLabel(source: string | null | undefined): string {
  if (source === "stripe_stryv_us") {
    return PAYMENT_SOURCE_LABELS.stripe_stryv_us;
  }
  if (source === "revolut_merchant") {
    return PAYMENT_SOURCE_LABELS.revolut_merchant;
  }
  if (source === "revolut_direct") {
    return PAYMENT_SOURCE_LABELS.revolut_direct;
  }
  return PAYMENT_SOURCE_LABELS.stripe;
}
