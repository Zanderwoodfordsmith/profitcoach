import {
  coachHasFeature,
  resolveCoachAccessForUserId,
  type CoachAccessSnapshot,
} from "@/lib/coachAccess/resolveCoachAccess";
import type { CoachFeature } from "@/lib/coachAccess/tiers";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

export async function requireCoachFeature(
  request: Request,
  feature: CoachFeature
): Promise<
  | {
      error:
        | "Missing access token."
        | "Invalid access token."
        | "Not authorized."
        | "Admin must pass x-impersonate-coach-id for this resource."
        | "Feature not available for your access tier.";
      userId: null;
      access: null;
    }
  | { error: null; userId: string; access: CoachAccessSnapshot }
> {
  const auth = await requireCoachRequest(request);
  if (auth.error) {
    return { error: auth.error, userId: null, access: null };
  }

  const access = await resolveCoachAccessForUserId(auth.userId);
  if (!coachHasFeature(access, feature)) {
    return {
      error: "Feature not available for your access tier." as const,
      userId: null,
      access: null,
    };
  }

  return { error: null, userId: auth.userId, access };
}
