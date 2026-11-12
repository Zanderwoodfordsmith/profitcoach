import { NextResponse } from "next/server";
import { buildCoachInvoice, paymentHasInvoice } from "@/lib/invoices/coachInvoice";
import { loadInvoiceDetails } from "@/lib/invoices/invoiceDetails";
import { renderInvoicePdf } from "@/lib/invoices/renderInvoicePdf";
import {
  buildPaymentBillingKindIndex,
  type PaymentBillingKind,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** The signed-in coach's own payment as a PDF. Anyone else's reads as not found. */
export async function GET(
  request: Request,
  context: { params: Promise<{ paymentId: string }> }
) {
  const auth = await requireCoachRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const coachId = auth.userId;
  const { paymentId } = await context.params;

  // The whole list, because a payment's kind depends on the ones around it.
  const { data: rows, error } = await supabaseAdmin
    .from("coach_payments")
    .select(
      "id, customer_email, amount_cents, currency, status, paid_at, description, billing_kind_override, payment_source"
    )
    .eq("coach_id", coachId)
    .order("paid_at", { ascending: false });
  if (error) {
    console.error("coach invoice payments:", error.message);
    return NextResponse.json({ error: "Could not load this invoice." }, { status: 500 });
  }

  const payment = (rows ?? []).find((row) => row.id === paymentId);
  if (!payment || !paymentHasInvoice(payment)) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const forKinds: PaymentForBillingKind[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    customer_email: (row.customer_email as string) ?? "",
    coach_id: coachId,
    amount_cents: row.amount_cents as number,
    currency: (row.currency as string) ?? "gbp",
    status: row.status as string,
    paid_at: row.paid_at as string,
    description: (row.description as string | null) ?? null,
    billing_kind_override: row.billing_kind_override as PaymentBillingKind | null,
  }));

  const loaded = await loadInvoiceDetails(coachId);
  const invoice = buildCoachInvoice({
    payment: {
      id: payment.id as string,
      amount_cents: payment.amount_cents as number,
      currency: (payment.currency as string) ?? "gbp",
      paid_at: payment.paid_at as string,
      customer_email: (payment.customer_email as string | null) ?? null,
    },
    billingKind: buildPaymentBillingKindIndex(forKinds).get(paymentId) ?? null,
    coachName: loaded.coachName,
    businessName: loaded.businessName,
    details: loaded.details,
  });

  const bytes = await renderInvoicePdf(invoice);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice ${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
