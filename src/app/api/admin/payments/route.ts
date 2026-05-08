import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { loadCoachDirectory } from "@/lib/stripePaymentsSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const { coaches, uniqueCoachByEmail } = await loadCoachDirectory(supabaseAdmin);
    const coachById = new Map(coaches.map((coach) => [coach.id, coach]));

    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("coach_payments")
      .select(
        "id, stripe_payment_intent_id, stripe_checkout_session_id, customer_email, amount_cents, currency, status, paid_at, coach_id, assignment_method, notes, created_at"
      )
      .order("paid_at", { ascending: false })
      .limit(500);

    if (paymentsError) {
      return NextResponse.json({ error: "Unable to load payments." }, { status: 500 });
    }

    const rows = (payments ?? []).map((row: any) => {
      const normalizedEmail = normalizeEmail(row.customer_email);
      const assignedCoach = row.coach_id ? coachById.get(row.coach_id as string) ?? null : null;
      const suggestedCoach =
        !assignedCoach && normalizedEmail
          ? uniqueCoachByEmail.get(normalizedEmail) ?? null
          : null;
      return {
        id: row.id as string,
        stripe_payment_intent_id: (row.stripe_payment_intent_id as string | null) ?? null,
        stripe_checkout_session_id: (row.stripe_checkout_session_id as string | null) ?? null,
        customer_email: row.customer_email as string,
        amount_cents: row.amount_cents as number,
        currency: row.currency as string,
        status: row.status as string,
        paid_at: row.paid_at as string,
        assignment_method: row.assignment_method as string,
        notes: (row.notes as string | null) ?? null,
        assigned_coach: assignedCoach
          ? {
              id: assignedCoach.id,
              slug: assignedCoach.slug,
              full_name: assignedCoach.full_name,
              coach_business_name: assignedCoach.coach_business_name,
              email: assignedCoach.email,
            }
          : null,
        suggested_coach: suggestedCoach
          ? {
              id: suggestedCoach.id,
              slug: suggestedCoach.slug,
              full_name: suggestedCoach.full_name,
              coach_business_name: suggestedCoach.coach_business_name,
              email: suggestedCoach.email,
            }
          : null,
      };
    });

    return NextResponse.json({
      payments: rows,
      coaches: coaches.map((coach) => ({
        id: coach.id,
        slug: coach.slug,
        full_name: coach.full_name,
        coach_business_name: coach.coach_business_name,
        email: coach.email,
      })),
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

    const { uniqueCoachByEmail } = await loadCoachDirectory(supabaseAdmin);

    let coachId: string | null = body.coachId ?? null;
    let assignmentMethod: "manual" | "email_auto" | "unassigned" = "unassigned";
    if (coachId) {
      assignmentMethod = "manual";
    } else {
      const matched = uniqueCoachByEmail.get(customerEmail);
      if (matched) {
        coachId = matched.id;
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
