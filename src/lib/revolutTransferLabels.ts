/**
 * Revolut transfer placeholder helpers, safe for the browser (CSV import stays in revolutDirectPaymentsCsvImport.ts).
 */

export const EMAIL_IN_TEXT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_IN_TEXT);
  return match ? match[0].toLowerCase() : null;
}

export function looksLikeInvoiceReference(reference: string): boolean {
  const value = reference.trim();
  if (!value) return false;
  return (
    /^(inv[-\s]?|invoice\b)/i.test(value) ||
    /^\/purp\//i.test(value) ||
    /^[A-Z]{2,5}[-\s]?\d/i.test(value)
  );
}

/** Display label, e.g. "Andy Mclachlan (FORTRESS HEA)". */
export function formatRevolutTransferCustomerLabel(
  payer: string,
  reference: string
): string {
  const payerClean = payer.trim();
  const refClean = reference.trim();

  const email = extractEmail(refClean) ?? extractEmail(payerClean);
  if (email) {
    const name =
      refClean && !extractEmail(refClean)
        ? refClean
        : payerClean && !extractEmail(payerClean)
          ? payerClean
          : "";
    if (name) return `${name} (${email})`;
    return email;
  }

  if (
    refClean &&
    !looksLikeInvoiceReference(refClean) &&
    payerClean &&
    payerClean.toLowerCase() !== refClean.toLowerCase()
  ) {
    return `${refClean} (${payerClean})`;
  }

  if (refClean && looksLikeInvoiceReference(refClean) && payerClean) {
    return `${payerClean} (${refClean})`;
  }

  return refClean || payerClean || "";
}

export const REVOLUT_TRANSFER_PLACEHOLDER_EMAIL =
  /^revolut-transfer\+[^@]+@import\.revolut$/i;

export function isRevolutTransferPlaceholderEmail(email: string): boolean {
  return REVOLUT_TRANSFER_PLACEHOLDER_EMAIL.test(email.trim());
}

/** What to show in the Customer column (not the synthetic import email). */
export function revolutTransferCustomerDisplayLabel(payment: {
  customer_email: string;
  description: string | null;
  customer_company_name: string | null;
  payment_source: string;
}): string {
  if (payment.payment_source !== "revolut_direct") {
    return payment.customer_email;
  }

  if (!isRevolutTransferPlaceholderEmail(payment.customer_email)) {
    return payment.customer_email;
  }

  const description = payment.description?.trim() ?? "";
  if (description.includes(" — ")) {
    const [payer, reference] = description.split(" — ").map((part) => part.trim());
    return formatRevolutTransferCustomerLabel(payer, reference);
  }

  if (description) {
    return description;
  }

  return payment.customer_company_name?.trim() || payment.customer_email;
}
