import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { tierFromStripePriceId } from "@/config/membershipPlans";
import type { CoachAccessTier } from "@/lib/coachAccess/tiers";
import type { CoachRecurringPaymentStatus } from "@/lib/coachBilling";

export type MembershipStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

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

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): MembershipStatus | null {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return status;
    default:
      return null;
  }
}

function recurringStatusFromInterval(
  interval: string | null | undefined
): CoachRecurringPaymentStatus | null {
  if (interval === "year") return "annual_prepaid";
  if (interval === "month") return "monthly";
  return null;
}

function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0];
  if (!item?.price?.id) return null;
  return item.price.id;
}

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number;
};

function subscriptionPeriodEndIso(subscription: Stripe.Subscription): string | null {
  const periodEnd = (subscription as SubscriptionWithPeriod).current_period_end;
  if (!periodEnd) return null;
  return new Date(periodEnd * 1000).toISOString();
}

function subscriptionInterval(
  subscription: Stripe.Subscription
): "month" | "year" | null {
  const item = subscription.items.data[0];
  const interval = item?.price?.recurring?.interval;
  if (interval === "month" || interval === "year") return interval;
  return null;
}

export async function findCoachForStripeCustomer(
  supabase: SupabaseClient,
  customerId: string,
  customerEmail?: string | null
): Promise<CoachMembershipRow | null> {
  const { data: byCustomer } = await supabase
    .from("coaches")
    .select(
      "id, access_tier, access_tier_locked, stripe_customer_id, stripe_subscription_id, membership_status, membership_interval, membership_current_period_end, membership_cancel_at_period_end, recurring_payment_status"
    )
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (byCustomer) return byCustomer as CoachMembershipRow;

  const email = customerEmail?.trim().toLowerCase();
  if (!email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!profile?.id) return null;

  const { data: byProfile } = await supabase
    .from("coaches")
    .select(
      "id, access_tier, access_tier_locked, stripe_customer_id, stripe_subscription_id, membership_status, membership_interval, membership_current_period_end, membership_cancel_at_period_end, recurring_payment_status"
    )
    .eq("id", profile.id)
    .maybeSingle();

  return (byProfile as CoachMembershipRow | null) ?? null;
}

export async function syncCoachMembershipFromSubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
  customerEmail?: string | null
): Promise<{ coachId: string | null; updated: boolean }> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return { coachId: null, updated: false };

  const coach = await findCoachForStripeCustomer(
    supabase,
    customerId,
    customerEmail
  );

  if (!coach) return { coachId: null, updated: false };

  const priceId = subscriptionPriceId(subscription);
  const tierFromPrice = priceId ? tierFromStripePriceId(priceId) : null;
  const interval = subscriptionInterval(subscription);
  const membershipStatus = mapSubscriptionStatus(subscription.status);
  const periodEnd = subscriptionPeriodEndIso(subscription);

  const updates: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    membership_status: membershipStatus,
    membership_interval: interval,
    membership_current_period_end: periodEnd,
    membership_cancel_at_period_end: subscription.cancel_at_period_end,
  };

  const recurringStatus = recurringStatusFromInterval(interval);
  if (recurringStatus && subscription.status === "active") {
    updates.recurring_payment_status = recurringStatus;
  } else if (
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
  ) {
    updates.recurring_payment_status = "overdue";
  }

  if (!coach.access_tier_locked) {
    if (
      subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due"
    ) {
      if (tierFromPrice) {
        updates.access_tier = tierFromPrice;
      }
    } else if (
      subscription.status === "canceled" ||
      subscription.status === "unpaid" ||
      subscription.status === "incomplete_expired"
    ) {
      updates.access_tier = "alumni" satisfies CoachAccessTier;
    }
  }

  const { error } = await supabase
    .from("coaches")
    .update(updates)
    .eq("id", coach.id);

  if (error) {
    console.error("syncCoachMembershipFromSubscription failed:", error);
    return { coachId: coach.id, updated: false };
  }

  return { coachId: coach.id, updated: true };
}

export async function linkStripeCustomerToCoach(
  supabase: SupabaseClient,
  coachId: string,
  customerId: string
): Promise<void> {
  await supabase
    .from("coaches")
    .update({ stripe_customer_id: customerId })
    .eq("id", coachId)
    .is("stripe_customer_id", null);
}
