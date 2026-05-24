import { NextResponse } from "next/server";

import { paymentImportSkipReason } from "@/lib/paymentImportFilters";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  loadCoachDirectory,
  suggestCoachForPayment,
} from "@/lib/stripePaymentsSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function coachOptionFromInfo(coach: {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
  joined_at: string | null;
}) {
  return {
    id: coach.id,
    slug: coach.slug,
    full_name: coach.full_name,
    coach_business_name: coach.coach_business_name,
    email: coach.email,
    joined_at: coach.joined_at,
  };
}

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const directory = await loadCoachDirectory(supabaseAdmin);
    const coachById = new Map(directory.coaches.map((coach) => [coach.id, coach]));

    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("coach_payments")
      .select(
        "id, stripe_payment_intent_id, stripe_checkout_session_id, stripe_charge_id, customer_email, customer_company_name, amount_cents, currency, status, paid_at, coach_id, assignment_method, decline_reason, description, notes, payment_source, billing_kind_override, created_at"
      )
      .order("paid_at", { ascending: false })
      .limit(2000);

    if (paymentsError) {
      return NextResponse.json({ error: "Unable to load payments." }, { status: 500 });
    }

    const rows = (payments ?? []).map((row: Record<string, unknown>) => {
      const customerEmail = row.customer_email as string;
      const customerCompanyName = (row.customer_company_name as string | null) ?? null;
      const assignedCoach = row.coach_id
        ? coachById.get(row.coach_id as string) ?? null
        : null;
      const suggestedCoach =
        !assignedCoach
          ? suggestCoachForPayment(directory, customerEmail, customerCompanyName)
          : null;

      return {
        id: row.id as string,
        stripe_payment_intent_id: (row.stripe_payment_intent_id as string | null) ?? null,
        stripe_checkout_session_id: (row.stripe_checkout_session_id as string | null) ?? null,
        stripe_charge_id: (row.stripe_charge_id as string | null) ?? null,
        customer_email: customerEmail,
        customer_company_name: customerCompanyName,
        amount_cents: row.amount_cents as number,
        currency: row.currency as string,
        status: row.status as string,
        paid_at: row.paid_at as string,
        assignment_method: row.assignment_method as string,
        decline_reason: (row.decline_reason as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        payment_source: (row.payment_source as string) ?? "stripe",
        billing_kind_override:
          (row.billing_kind_override as string | null) ?? null,
        matched: Boolean(row.coach_id),
        assigned_coach: assignedCoach ? coachOptionFromInfo(assignedCoach) : null,
        suggested_coach: suggestedCoach ? coachOptionFromInfo(suggestedCoach) : null,
      };
    });

    return NextResponse.json({
      payments: rows,
      coaches: directory.coaches.map(coachOptionFromInfo),
    });
  } catch (error) {
    console.error("admin/payments GET:", error);
    return NextResponse.json({ error: "Unable to load payments." }, { status: 500 });
  }
}

type CreatePaymentBody = {
  customerEmail?: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
  notes?: string;
  coachId?: string | null;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
};

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const body = (await request.json()) as CreatePaymentBody;
    const customerEmail = normalizeEmail(body.customerEmail);
    const rawAmount = body.amount;
    const amountCents = Math.round((Number.isFinite(rawAmount) ? Number(rawAmount) : Number.NaN) * 100);
    const currency = (body.currency ?? "gbp").trim().toLowerCase();
    const paidAt = body.paidAt?.trim() ? new Date(body.paidAt) : new Date();
    const notes = body.notes?.trim() ? body.notes.trim() : null;

    if (!customerEmail) {
      return NextResponse.json({ error: "Customer email is required." }, { status: 400 });
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }
    if (!/^[a-z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "Currency must be a 3-letter ISO code." }, { status: 400 });
    }
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: "Paid date is invalid." }, { status: 400 });
    }

    const skipReason = paymentImportSkipReason(customerEmail, amountCents, currency);
    if (skipReason) {
      return NextResponse.json(
        { error: "This payment is excluded from imports (internal email or below minimum amount)." },
        { status: 400 }
      );
    }

    const directory = await loadCoachDirectory(supabaseAdmin);

    let coachId: string | null = body.coachId ?? null;
    let assignmentMethod: "manual" | "email_auto" | "unassigned" = "unassigned";
    if (coachId) {
      assignmentMethod = "manual";
    } else {
      const suggested = suggestCoachForPayment(directory, customerEmail, null);
      if (suggested) {
        coachId = suggested.id;
        assignmentMethod = "email_auto";
      }
    }

    const { error: insertError } = await supabaseAdmin.from("coach_payments").insert({
      customer_email: customerEmail,
      amount_cents: amountCents,
      currency,
      paid_at: paidAt.toISOString(),
      notes,
      coach_id: coachId,
      assignment_method: assignmentMethod,
      stripe_payment_intent_id: body.stripePaymentIntentId?.trim() || null,
      stripe_checkout_session_id: body.stripeCheckoutSessionId?.trim() || null,
    });

    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "Payment intent or checkout session id already exists." },
        { status: 400 }
      );
    }
    if (insertError) {
      console.error("admin/payments POST:", insertError);
      return NextResponse.json({ error: "Unable to create payment." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("admin/payments POST catch:", error);
    return NextResponse.json({ error: "Unable to create payment." }, { status: 500 });
  }
}
