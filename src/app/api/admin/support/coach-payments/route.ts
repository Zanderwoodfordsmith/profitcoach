import { NextResponse } from "next/server";

import { buildCoachPaymentSummary } from "@/lib/admin/coachPaymentSummary";
import { isCoachUuid } from "@/lib/admin/resolveCoachRef";
import type {
  PaymentBillingKind,
  PaymentForBillingKind,
} from "@/lib/paymentBillingKind";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function asBillingKind(value: unknown): PaymentBillingKind | null {
  if (
    value === "recurring" ||
    value === "initial" ||
    value === "installment" ||
    value === "other"
  ) {
    return value;
  }
  return null;
}

/** Recent succeeded payments for the coach linked to a support ticket. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: auth.error ?? "Not authorized." },
      { status }
    );
  }

  const coachId = new URL(request.url).searchParams.get("coachId")?.trim() ?? "";
  if (!isCoachUuid(coachId)) {
    return NextResponse.json({ error: "Missing coach." }, { status: 400 });
  }

  const [coachRes, paymentsRes] = await Promise.all([
    supabaseAdmin.from("coaches").select("slug").eq("id", coachId).maybeSingle(),
    supabaseAdmin
      .from("coach_payments")
      .select(
        "id, customer_email, amount_cents, currency, status, paid_at, description, billing_kind_override"
      )
      .eq("coach_id", coachId)
      .order("paid_at", { ascending: false }),
  ]);

  if (coachRes.error || paymentsRes.error) {
    console.error("admin/support/coach-payments:", coachRes.error ?? paymentsRes.error);
    return NextResponse.json(
      { error: "Unable to load payments." },
      { status: 500 }
    );
  }

  const payments: PaymentForBillingKind[] = (paymentsRes.data ?? []).map((row) => ({
    id: row.id as string,
    customer_email: (row.customer_email as string) ?? "",
    coach_id: coachId,
    amount_cents: row.amount_cents as number,
    currency: row.currency as string,
    status: row.status as string,
    description: (row.description as string | null) ?? null,
    paid_at: row.paid_at as string,
    billing_kind_override: asBillingKind(row.billing_kind_override),
  }));

  return NextResponse.json({
    slug: (coachRes.data?.slug as string | undefined) ?? null,
    summary: buildCoachPaymentSummary(payments, payments.length),
  });
}
