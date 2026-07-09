import { NextResponse } from "next/server";
import { inferTierFromBilling } from "@/lib/coachAccess/inferTierFromBilling";
import {
  isCoachAccessTier,
  type CoachAccessTier,
} from "@/lib/coachAccess/tiers";
import type { CoachRecurringPaymentStatus } from "@/lib/coachBilling";
import { isCoachRecurringPaymentStatus } from "@/lib/coachBilling";
import type { PaymentForBillingKind } from "@/lib/paymentBillingKind";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request: Request): Promise<
  | { error: "Missing access token." | "Invalid access token." | "Not authorized."; userId: null }
  | { error: null; userId: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: user.id as string };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Not authorized." ? 403 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  const { data: coach, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("access_tier, access_tier_locked, recurring_payment_status")
    .eq("id", coachId)
    .maybeSingle();

  if (coachError || !coach) {
    return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  }

  const { data: payments } = await supabaseAdmin
    .from("coach_payments")
    .select(
      "id, customer_email, coach_id, amount_cents, currency, status, description, paid_at, billing_kind_override"
    )
    .eq("coach_id", coachId)
    .order("paid_at", { ascending: false })
    .limit(24);

  const recurringStatus = isCoachRecurringPaymentStatus(
    coach.recurring_payment_status ?? ""
  )
    ? (coach.recurring_payment_status as CoachRecurringPaymentStatus)
    : null;

  const suggestion = inferTierFromBilling({
    recurringPaymentStatus: recurringStatus,
    payments: (payments ?? []) as PaymentForBillingKind[],
  });

  const currentTier = isCoachAccessTier(coach.access_tier ?? "")
    ? (coach.access_tier as CoachAccessTier)
    : "premium";

  if (currentTier === "do_not_contact") {
    return NextResponse.json({
      currentTier,
      tierLocked: true,
      suggestion: {
        suggestedTier: null,
        reason: "Do not contact — tier is set manually and is not changed from billing.",
        confidence: "high" as const,
      },
    });
  }

  return NextResponse.json({
    currentTier,
    tierLocked: Boolean(coach.access_tier_locked),
    suggestion,
  });
}
