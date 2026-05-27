import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type CoachAccessTier,
  type CoachFeature,
  featuresForTier,
  isCoachAccessTier,
  tierHasFeature,
} from "@/lib/coachAccess/tiers";

export type CoachAccessSnapshot = {
  tier: CoachAccessTier;
  tierLocked: boolean;
  features: CoachFeature[];
};

const DEFAULT_ACCESS: CoachAccessSnapshot = {
  tier: "pro",
  tierLocked: false,
  features: featuresForTier("pro"),
};

export async function resolveCoachAccessForUserId(
  userId: string
): Promise<CoachAccessSnapshot> {
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("access_tier, access_tier_locked")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_ACCESS;
  }

  const tier = isCoachAccessTier(data.access_tier ?? "")
    ? data.access_tier
    : "pro";

  return {
    tier,
    tierLocked: Boolean(data.access_tier_locked),
    features: featuresForTier(tier),
  };
}

export function coachHasFeature(
  access: CoachAccessSnapshot,
  feature: CoachFeature
): boolean {
  return tierHasFeature(access.tier, feature);
}
