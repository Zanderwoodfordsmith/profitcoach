import {
  MEMBERSHIP_PLANS,
  formatMembershipPrice,
  stripePriceIdForPlan,
  type MembershipInterval,
  type MembershipPlanKey,
} from "@/config/membershipPlans";
import type { CheckoutOfferDisplay } from "@/config/programmeJoinOffers";

/**
 * Direct membership checkout pages (/membership/495 etc.).
 * Rolling subscriptions on the membership price IDs — after payment the coach
 * lands on /membership/thank-you and goes back to the classroom (no onboarding).
 */
export type MembershipOfferSlug =
  | "premium-monthly"
  | "premium-annual"
  | "core-monthly"
  | "core-annual";

export type MembershipOffer = CheckoutOfferDisplay & {
  slug: MembershipOfferSlug;
  planKey: MembershipPlanKey;
  interval: MembershipInterval;
};

function membershipOffer(
  slug: MembershipOfferSlug,
  planKey: MembershipPlanKey,
  interval: MembershipInterval
): MembershipOffer {
  const plan = MEMBERSHIP_PLANS[planKey];
  const price = formatMembershipPrice(
    interval === "year" ? plan.annualPriceGbp : plan.monthlyPriceGbp
  );
  const per = interval === "year" ? "year" : "month";
  const headline = `Profit Coach ${plan.label}`;

  return {
    slug,
    planKey,
    interval,
    priceId: stripePriceIdForPlan(planKey, interval) ?? "",
    title: interval === "year" ? "Annual membership" : "Monthly membership",
    headline,
    amountLabel: `${price} / ${per}`,
    todayAmountLabel: price,
    futureAmountLabel: price,
    totalAmountLabel: price,
    totalRowLabel: "Due today",
    totalLabel: `${price} today, then every ${per}`,
    paymentCount: 1,
    futurePaymentsDetail: `${price} every ${per} until you cancel`,
    scheduleNote: "",
    ctaLabel: "Start membership",
    bullets: [
      `${price} today, then ${price} every ${per}`,
      "Cancel any time from your billing settings",
      "Straight back into the classroom after checkout",
    ],
    checkoutSubmitMessage: `You’re starting ${headline} at ${price} per ${per}. Cancel any time.`,
    defaultCountry: "GB",
  };
}

export const MEMBERSHIP_OFFERS: Record<MembershipOfferSlug, MembershipOffer> = {
  "premium-monthly": membershipOffer("premium-monthly", "premium", "month"),
  "premium-annual": membershipOffer("premium-annual", "premium", "year"),
  "core-monthly": membershipOffer("core-monthly", "core", "month"),
  "core-annual": membershipOffer("core-annual", "core", "year"),
};

const MEMBERSHIP_CART_PATHS: Partial<
  Record<MembershipPlanKey, Record<MembershipInterval, string>>
> = {
  core: { month: "/membership/195", year: "/membership/1950" },
  premium: { month: "/membership/495", year: "/membership/4950" },
};

/** Checkout page for a plan, or null when the plan has no cart page (VIP). */
export function membershipCartHref(
  plan: MembershipPlanKey,
  interval: MembershipInterval
): string | null {
  return MEMBERSHIP_CART_PATHS[plan]?.[interval] ?? null;
}

export function isMembershipOfferSlug(
  value: unknown
): value is MembershipOfferSlug {
  return typeof value === "string" && value in MEMBERSHIP_OFFERS;
}

export const MEMBERSHIP_THANK_YOU_CONTINUE_PATH = "/coach/academy/classroom";
