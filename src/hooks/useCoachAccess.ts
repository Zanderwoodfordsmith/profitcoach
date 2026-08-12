"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  PREMIUM_EQUIVALENT_FEATURES,
  type CoachAccessTier,
  type CoachFeature,
} from "@/lib/coachAccess/tiers";

export type CoachAccessState = {
  tier: CoachAccessTier;
  tierLocked: boolean;
  features: CoachFeature[];
  enforcementEnabled: boolean;
};

const EMPTY_ACCESS: CoachAccessState = {
  tier: "programme",
  tierLocked: false,
  features: [],
  enforcementEnabled: false,
};

export function useCoachAccess(impersonatingCoachId: string | null) {
  const [access, setAccess] = useState<CoachAccessState>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setAccess(EMPTY_ACCESS);
      setLoading(false);
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch("/api/coach/access", { headers });
    const body = (await res.json().catch(() => ({}))) as Partial<CoachAccessState>;
    if (res.ok && body.tier) {
      setAccess({
        tier: body.tier,
        tierLocked: Boolean(body.tierLocked),
        features: body.features ?? [],
        enforcementEnabled: Boolean(body.enforcementEnabled),
      });
    } else {
      setAccess(EMPTY_ACCESS);
    }
    setLoading(false);
  }, [impersonatingCoachId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasFeature = useCallback(
    (feature: CoachFeature) => {
      // Match server coachHasFeature: when tiers are not enforced, everyone
      // gets Premium-equivalent access (do not rely on an empty features[]).
      if (!access.enforcementEnabled) {
        return PREMIUM_EQUIVALENT_FEATURES.includes(feature);
      }
      return access.features.includes(feature);
    },
    [access.features, access.enforcementEnabled]
  );

  return { access, loading, refresh, hasFeature };
}
