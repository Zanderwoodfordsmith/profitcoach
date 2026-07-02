import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { membershipTierEnforcementEnabled } from "@/lib/coachAccess/enforcement";
import {
  type CoachAccessTier,
  type CoachFeature,
  featuresForTier,
  isCoachAccessTier,
  PREMIUM_EQUIVALENT_FEATURES,
  tierHasFeature,
} from "@/lib/coachAccess/tiers";

export type CoachAccessSnapshot = {
  tier: CoachAccessTier;
  tierLocked: boolean;
  features: CoachFeature[];
  enforcementEnabled: boolean;
};

const DEFAULT_ACCESS: CoachAccessSnapshot = {
  tier: "premium",
  tierLocked: false,
  features: PREMIUM_EQUIVALENT_FEATURES,
  enforcementEnabled: false,
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
    : "premium";

  const enforcementEnabled = membershipTierEnforcementEnabled();
  const features = enforcementEnabled
    ? featuresForTier(tier)
    : PREMIUM_EQUIVALENT_FEATURES;

  return {
    tier,
    tierLocked: Boolean(data.access_tier_locked),
    features,
    enforcementEnabled,
  };
}

export function coachHasFeature(
  access: CoachAccessSnapshot,
  feature: CoachFeature
): boolean {
  if (!access.enforcementEnabled) {
    return PREMIUM_EQUIVALENT_FEATURES.includes(feature);
  }
  return tierHasFeature(access.tier, feature);
}
