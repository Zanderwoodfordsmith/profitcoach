import type { CoachAccessTier } from "@/lib/coachAccess/tiers";

export type MembershipPlanKey = "core" | "premium" | "vip";

export type MembershipInterval = "month" | "year";

export type MembershipPlanConfig = {
  key: MembershipPlanKey;
  tier: CoachAccessTier;
  label: string;
  monthlyPriceGbp: number;
  annualPriceGbp: number;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  description: string;
};

function priceId(envKey: string): string | null {
  const value = process.env[envKey]?.trim();
  return value || null;
}

export const MEMBERSHIP_PLANS: Record<MembershipPlanKey, MembershipPlanConfig> = {
  core: {
    key: "core",
    tier: "core",
    label: "Core",
    monthlyPriceGbp: 195,
    annualPriceGbp: 1950,
    monthlyPriceId: priceId("STRIPE_PRICE_CORE_MONTHLY"),
    annualPriceId: priceId("STRIPE_PRICE_CORE_ANNUAL"),
    description: "Keep everything switched on. Maintain and grow steadily.",
  },
  premium: {
    key: "premium",
    tier: "premium",
    label: "Premium",
    monthlyPriceGbp: 495,
    annualPriceGbp: 4950,
    monthlyPriceId: priceId("STRIPE_PRICE_PREMIUM_MONTHLY"),
    annualPriceId: priceId("STRIPE_PRICE_PREMIUM_ANNUAL"),
    description: "Weekly support to grow your book.",
  },
  vip: {
    key: "vip",
    tier: "vip",
    label: "VIP",
    monthlyPriceGbp: 1995,
    annualPriceGbp: 19950,
    monthlyPriceId: priceId("STRIPE_PRICE_VIP_MONTHLY"),
    annualPriceId: priceId("STRIPE_PRICE_VIP_ANNUAL"),
    description: "Close partnership and systems help.",
  },
};

export const MEMBERSHIP_PLAN_ORDER: MembershipPlanKey[] = [
  "core",
  "premium",
  "vip",
];

export function stripePriceIdForPlan(
  plan: MembershipPlanKey,
  interval: MembershipInterval
): string | null {
  const config = MEMBERSHIP_PLANS[plan];
  return interval === "year" ? config.annualPriceId : config.monthlyPriceId;
}

export function planKeyFromStripePriceId(
  priceId: string
): { plan: MembershipPlanKey; interval: MembershipInterval } | null {
  for (const key of MEMBERSHIP_PLAN_ORDER) {
    const config = MEMBERSHIP_PLANS[key];
    if (config.monthlyPriceId === priceId) {
      return { plan: key, interval: "month" };
    }
    if (config.annualPriceId === priceId) {
      return { plan: key, interval: "year" };
    }
  }
  return null;
}

export function tierFromStripePriceId(priceId: string): CoachAccessTier | null {
  const match = planKeyFromStripePriceId(priceId);
  return match ? MEMBERSHIP_PLANS[match.plan].tier : null;
}

export function formatMembershipPrice(amountGbp: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountGbp);
}
