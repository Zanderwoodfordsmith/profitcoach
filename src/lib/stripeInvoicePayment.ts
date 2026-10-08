import type Stripe from "stripe";

type InvoiceWithLegacyPayment = Stripe.Invoice & {
  payment_intent?: string | Stripe.PaymentIntent | null;
  subscription?: string | Stripe.Subscription | null;
};

function idFromStripeRef(
  value: string | { id?: string | null } | null | undefined
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}

/** PaymentIntent for an invoice, including Basil/Dahlia invoices that nest it under payments. */
export function paymentIntentIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = idFromStripeRef((invoice as InvoiceWithLegacyPayment).payment_intent);
  if (legacy) return legacy;

  const payments = invoice.payments?.data ?? [];
  const chosen = payments.find((payment) => payment.is_default) ?? payments[0];
  return idFromStripeRef(chosen?.payment?.payment_intent);
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = idFromStripeRef((invoice as InvoiceWithLegacyPayment).subscription);
  if (legacy) return legacy;

  const parent = invoice.parent;
  if (parent?.type === "subscription_details") {
    return idFromStripeRef(parent.subscription_details?.subscription);
  }
  return null;
}

export function invoiceIdFromCheckoutSession(
  session: Stripe.Checkout.Session
): string | null {
  return idFromStripeRef(session.invoice);
}
