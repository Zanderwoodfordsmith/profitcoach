import { NextResponse } from "next/server";

import {
  PAYMENT_BILLING_KINDS,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PatchBody = {
  coachId?: string | null;
  billingKindOverride?: PaymentBillingKind | null;
};

function parseBillingKindOverride(
  value: unknown
): PaymentBillingKind | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (
    typeof value === "string" &&
    PAYMENT_BILLING_KINDS.includes(value as PaymentBillingKind)
  ) {
    return value as PaymentBillingKind;
  }
  return "invalid";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { id: paymentId } = await context.params;
  if (!paymentId?.trim()) {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const hasCoachId = Object.prototype.hasOwnProperty.call(body, "coachId");
  const hasBillingOverride = Object.prototype.hasOwnProperty.call(
    body,
    "billingKindOverride"
  );

  if (!hasCoachId && !hasBillingOverride) {
    return NextResponse.json(
      { error: "coachId or billingKindOverride is required." },
      { status: 400 }
    );
  }

  if (hasBillingOverride) {
    const parsed = parseBillingKindOverride(body.billingKindOverride);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "Invalid billingKindOverride." },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("coach_payments")
      .select("id")
      .eq("id", paymentId)
      .maybeSingle();

    if (fetchError) {
      console.error("admin/payments/[id] PATCH billing fetch:", fetchError);
      return NextResponse.json(
        { error: "Unable to update billing." },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("coach_payments")
      .update({ billing_kind_override: parsed })
      .eq("id", paymentId);

    if (updateError) {
      console.error("admin/payments/[id] PATCH billing:", updateError);
      return NextResponse.json(
        { error: "Unable to update billing." },
        { status: 500 }
      );
    }

    if (!hasCoachId) {
      return NextResponse.json({ ok: true, updatedCount: 1 });
    }
  }

  if (!hasCoachId) {
    return NextResponse.json({ ok: true, updatedCount: 1 });
  }

  const coachId = body.coachId?.trim() ? body.coachId.trim() : null;
  if (coachId) {
    const { data: coach, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("id")
      .eq("id", coachId)
      .maybeSingle();
    if (coachError || !coach) {
      return NextResponse.json({ error: "Coach not found." }, { status: 400 });
    }
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("coach_payments")
    .select("id, customer_email")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    console.error("admin/payments/[id] PATCH fetch:", paymentError);
    return NextResponse.json({ error: "Unable to update payment assignment." }, { status: 500 });
  }

  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const assignmentUpdate = {
    coach_id: coachId,
    assignment_method: coachId ? "manual" : "unassigned",
  };

  if (coachId) {
    const customerEmail = String(payment.customer_email ?? "").trim();
    if (!customerEmail) {
      return NextResponse.json({ error: "Payment has no customer email." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("coach_payments")
      .update(assignmentUpdate)
      .ilike("customer_email", customerEmail)
      .select("id");

    if (updateError) {
      console.error("admin/payments/[id] PATCH bulk:", updateError);
      return NextResponse.json({ error: "Unable to update payment assignment." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      updatedCount: updated?.length ?? 0,
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("coach_payments")
    .update(assignmentUpdate)
    .eq("id", paymentId);

  if (updateError) {
    console.error("admin/payments/[id] PATCH:", updateError);
    return NextResponse.json({ error: "Unable to update payment assignment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedCount: 1 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { id: paymentId } = await context.params;
  if (!paymentId?.trim()) {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("coach_payments")
    .select("id")
    .eq("id", paymentId)
    .maybeSingle();

  if (fetchError) {
    console.error("admin/payments/[id] DELETE fetch:", fetchError);
    return NextResponse.json({ error: "Unable to delete payment." }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("coach_payments")
    .delete()
    .eq("id", paymentId);

  if (deleteError) {
    console.error("admin/payments/[id] DELETE:", deleteError);
    return NextResponse.json({ error: "Unable to delete payment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
