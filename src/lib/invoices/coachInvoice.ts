import type { PaymentBillingKind } from "@/lib/paymentBillingKind";

/**
 * Turns a payment record into an invoice. No company details or AI here: the
 * amount and date come straight from the payment.
 */

export type InvoiceDetails = {
  business_name: string | null;
  address: string | null;
  company_number: string | null;
  vat_number: string | null;
};

export const INVOICE_DETAIL_LIMITS = {
  business_name: 120,
  address: 400,
  company_number: 40,
  vat_number: 40,
} as const;

export type CoachInvoice = {
  number: string;
  /** The date paid, so an invoice never changes date when downloaded again. */
  dateLabel: string;
  amountLabel: string;
  itemTitle: string;
  itemDetail: string;
  billedToName: string;
  billedToLines: string[];
  billedToSmall: string[];
  thankYouName: string | null;
};

/**
 * StryvX US payments went through a separate Stripe account, so a Business Coach
 * Academy invoice may be the wrong company. Those stay with Support for now.
 */
const SOURCES_WITHOUT_INVOICE = new Set(["stripe_stryv_us"]);

export function paymentHasInvoice(payment: {
  status: string;
  payment_source?: string | null;
}): boolean {
  return (
    payment.status === "succeeded" &&
    !SOURCES_WITHOUT_INVOICE.has(payment.payment_source ?? "")
  );
}

/** From the payment id, so it stays the same and never clashes with hand-made BCA-XXX-001 ones. */
export function invoiceNumberFor(paymentId: string, paidAt: string): string {
  const year = new Date(paidAt).getUTCFullYear();
  const short = paymentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `BCA-${year}-${short}`;
}

export function invoiceFormatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
  }
}

/** What a payment is called, on the invoice and in the Billing list. */
export function invoiceLine(kind: PaymentBillingKind | null): { title: string; detail: string } {
  switch (kind) {
    case "initial":
      return { title: "Profit Coach Programme", detail: "Joining payment" };
    case "installment":
      return { title: "Profit Coach Programme", detail: "Payment plan instalment" };
    case "recurring":
      return { title: "Profit Coach membership", detail: "Membership payment" };
    default:
      return { title: "Business Coach Academy", detail: "Payment" };
  }
}

export function buildCoachInvoice(input: {
  payment: {
    id: string;
    amount_cents: number;
    currency: string;
    paid_at: string;
    customer_email: string | null;
  };
  billingKind: PaymentBillingKind | null;
  coachName: string | null;
  businessName: string | null;
  details: InvoiceDetails | null;
}): CoachInvoice {
  const { payment, details } = input;
  const person = input.coachName?.trim() || null;
  const business = input.businessName?.trim() || null;
  const email = payment.customer_email?.trim() || null;
  const address = (details?.address ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const billedToLines: string[] = [];
  if (business && person) billedToLines.push(`FAO ${person}`);
  billedToLines.push(...address);
  // Andrew's layout: no address, so the email shows who it's for.
  if (address.length === 0 && email) billedToLines.push(email);

  const billedToSmall: string[] = [];
  if (details?.company_number?.trim()) {
    billedToSmall.push(`Company number ${details.company_number.trim()}`);
  }
  if (details?.vat_number?.trim()) {
    billedToSmall.push(`VAT number ${details.vat_number.trim()}`);
  }

  const line = invoiceLine(input.billingKind);
  return {
    number: invoiceNumberFor(payment.id, payment.paid_at),
    dateLabel: new Date(payment.paid_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/London",
    }),
    amountLabel: invoiceFormatMoney(payment.amount_cents, payment.currency),
    itemTitle: line.title,
    itemDetail: line.detail,
    billedToName: business || person || email || "Coach",
    billedToLines,
    billedToSmall,
    thankYouName: person ? person.split(/\s+/)[0]! : null,
  };
}
