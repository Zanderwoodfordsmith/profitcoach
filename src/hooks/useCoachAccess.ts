"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { CoachAccessTier, CoachFeature } from "@/lib/coachAccess/tiers";

export type CoachAccessState = {
  tier: CoachAccessTier;
  tierLocked: boolean;
  features: CoachFeature[];
};

const EMPTY_ACCESS: CoachAccessState = {
  tier: "premium",
  tierLocked: false,
  features: [],
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
    (feature: CoachFeature) => access.features.includes(feature),
    [access.features]
  );

  return { access, loading, refresh, hasFeature };
}
