import { NextResponse } from "next/server";

import {
  MEMBERSHIP_PLAN_ORDER,
  MEMBERSHIP_PLANS,
  type MembershipInterval,
  type MembershipPlanKey,
  stripePriceIdForPlan,
} from "@/config/membershipPlans";

import type { CoachAccessTier } from "@/lib/coachAccess/tiers";
import {
  COACH_ACCESS_TIER_LABELS,
  isCoachAccessTier,
  isProgrammeTier,
  tierRank,
} from "@/lib/coachAccess/tiers";
import { refreshCoachProgrammeStatus } from "@/lib/coachAccess/refreshProgrammeStatus";
import { coachHasActiveRecurringBilling } from "@/lib/coachRecurringBilling";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CoachMembershipRow = {
  id: string;
  access_tier: string | null;
  access_tier_locked: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  membership_status: string | null;
  membership_interval: string | null;
  membership_current_period_end: string | null;
  membership_cancel_at_period_end: boolean | null;
  recurring_payment_status: string | null;
};

function buildCatalogPayload(options?: { publicView?: boolean }) {
  return {
    publicView: options?.publicView ?? false,
    tier: "alumni",
    tierLabel: COACH_ACCESS_TIER_LABELS.alumni,
    tierLocked: false,
    stripeCustomerId: null,
    subscription: {
      id: null,
      status: null,
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    recurringPaymentStatus: null,
    recurringActive: false,
    needsPaymentChoice: false,
    plans: MEMBERSHIP_PLAN_ORDER.map((key) => {
      const plan = MEMBERSHIP_PLANS[key];
      return {
        key,
        tier: plan.tier,
        label: plan.label,
        description: plan.description,
        monthlyPriceGbp: plan.monthlyPriceGbp,
        annualPriceGbp: plan.annualPriceGbp,
        checkoutAvailable: {
          month: Boolean(plan.monthlyPriceId),
          year: Boolean(plan.annualPriceId),
        },
        isCurrent: false,
        relation: "upgrade" as const,
      };
    }),
    stripeConfigured: MEMBERSHIP_PLAN_ORDER.some(
      (key) => MEMBERSHIP_PLANS[key].monthlyPriceId
    ),
  };
}

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request);
  if (auth.error) {
    // Admins without impersonation, public page, and logged-out visitors all
    // see the plan catalog; Join buttons always go to Stripe checkout.
    if (
      auth.error === "Admin must pass x-impersonate-coach-id for this resource." ||
      auth.error === "Missing access token." ||
      auth.error === "Invalid access token." ||
      auth.error === "Not authorized."
    ) {
      return NextResponse.json(buildCatalogPayload({ publicView: true }));
    }
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const coachId = auth.userId;

  await refreshCoachProgrammeStatus(supabaseAdmin, coachId);

  const { data: coach, error } = await supabaseAdmin
    .from("coaches")
    .select(
      "id, access_tier, access_tier_locked, stripe_customer_id, stripe_subscription_id, membership_status, membership_interval, membership_current_period_end, membership_cancel_at_period_end, recurring_payment_status"
    )
    .eq("id", coachId)
    .maybeSingle();

  if (error || !coach) {
    return NextResponse.json({ error: "Coach record not found." }, { status: 404 });
  }

  const row = coach as CoachMembershipRow;
  const tier: CoachAccessTier =
    row.access_tier && isCoachAccessTier(row.access_tier)
      ? row.access_tier
      : "programme";

  const { data: payments } = await supabaseAdmin
    .from("coach_payments")
    .select("id, amount_cents, currency, status, paid_at, billing_kind_override")
    .eq("coach_id", coachId)
    .order("paid_at", { ascending: false })
    .limit(50);

  const recurringActive = coachHasActiveRecurringBilling({
    recurringPaymentStatus: row.recurring_payment_status as
      | import("@/lib/coachBilling").CoachRecurringPaymentStatus
      | null,
    payments: (payments ?? []).map((p) => ({
      id: p.id as string,
      customer_email: "",
      amount_cents: p.amount_cents as number,
      currency: (p.currency as string) ?? "gbp",
      status: p.status as string,
      paid_at: p.paid_at as string,
      description: null,
      billing_kind_override: p.billing_kind_override as import("@/lib/paymentBillingKind").PaymentBillingKind | null,
    })),
  });

  const hasActiveSubscription =
    row.membership_status === "active" ||
    row.membership_status === "trialing" ||
    row.membership_status === "past_due";

  const needsPaymentChoice =
    tier !== "do_not_contact" &&
    !isProgrammeTier(tier) &&
    !hasActiveSubscription &&
    !recurringActive &&
    row.recurring_payment_status !== "first_6_months" &&
    row.recurring_payment_status !== "complimentary";

  const plans = MEMBERSHIP_PLAN_ORDER.map((key) => {
    const plan = MEMBERSHIP_PLANS[key];
    return {
      key,
      tier: plan.tier,
      label: plan.label,
      description: plan.description,
      monthlyPriceGbp: plan.monthlyPriceGbp,
      annualPriceGbp: plan.annualPriceGbp,
      checkoutAvailable: {
        month: Boolean(plan.monthlyPriceId),
        year: Boolean(plan.annualPriceId),
      },
      isCurrent: tier === plan.tier && hasActiveSubscription,
      // Programme is not a paid plan — every membership option is a join/upgrade.
      relation: isProgrammeTier(tier)
        ? ("upgrade" as const)
        : tierRank(plan.tier) > tierRank(tier)
          ? ("upgrade" as const)
          : tierRank(plan.tier) < tierRank(tier)
            ? ("downgrade" as const)
            : ("current" as const),
    };
  });

  return NextResponse.json({
    tier,
    tierLabel: COACH_ACCESS_TIER_LABELS[tier],
    tierLocked: Boolean(row.access_tier_locked),
    stripeCustomerId: row.stripe_customer_id,
    subscription: {
      id: row.stripe_subscription_id,
      status: row.membership_status,
      interval: row.membership_interval as MembershipInterval | null,
      currentPeriodEnd: row.membership_current_period_end,
      cancelAtPeriodEnd: Boolean(row.membership_cancel_at_period_end),
    },
    recurringPaymentStatus: row.recurring_payment_status,
    recurringActive,
    needsPaymentChoice,
    plans,
    stripeConfigured: MEMBERSHIP_PLAN_ORDER.some(
      (key) => MEMBERSHIP_PLANS[key].monthlyPriceId
    ),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    plan?: MembershipPlanKey;
    interval?: MembershipInterval;
  };

  const planKey = body.plan;
  const interval = body.interval ?? "month";

  if (!planKey || !(planKey in MEMBERSHIP_PLANS)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const priceId = stripePriceIdForPlan(planKey, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured for this plan." },
      { status: 503 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const {
    createGuestMembershipCheckoutSession,
    createMembershipCheckoutSession,
  } = await import("@/lib/membership/checkout");

  const auth = await requireCoachRequest(request);

  if (!auth.error) {
    const { data: coachRow } = await supabaseAdmin
      .from("coaches")
      .select("access_tier")
      .eq("id", auth.userId)
      .maybeSingle();

    if (coachRow?.access_tier === "do_not_contact") {
      return NextResponse.json(
        { error: "Membership checkout is not available for this account." },
        { status: 403 }
      );
    }
  }

  try {
    const result = auth.error
      ? await createGuestMembershipCheckoutSession({ priceId, planKey, request })
      : await createMembershipCheckoutSession({
          coachId: auth.userId,
          priceId,
          request,
        });
    return NextResponse.json(result);
  } catch (error) {
    console.error("membership checkout error:", error);
    const detail = error instanceof Error ? error.message : "Could not start checkout.";
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? detail
            : "Could not start checkout.",
      },
      { status: 500 }
    );
  }
}
