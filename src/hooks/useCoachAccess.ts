"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHubQuery, peekHubQuery } from "@/lib/getClients/hubQueryCache";
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

  const refresh = useCallback(
    async (force = false) => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAccess(EMPTY_ACCESS);
        setLoading(false);
        return;
      }

      // The layout, route guard and pages all ask on every navigation: paint
      // the last answer and share one request between them.
      const key = `coach-access:${session.user.id}:${impersonatingCoachId ?? "self"}`;
      const cached = peekHubQuery<CoachAccessState>(key);
      if (cached) {
        setAccess(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      try {
        const next = await fetchHubQuery(
          key,
          async () => {
            const res = await fetch("/api/coach/access", { headers });
            const body = (await res.json().catch(() => ({}))) as Partial<CoachAccessState>;
            if (!res.ok || !body.tier) return EMPTY_ACCESS;
            return {
              tier: body.tier,
              tierLocked: Boolean(body.tierLocked),
              features: body.features ?? [],
              enforcementEnabled: Boolean(body.enforcementEnabled),
            };
          },
          { staleMs: 30_000, force }
        );
        setAccess(next);
      } catch {
        if (!cached) setAccess(EMPTY_ACCESS);
      }
      setLoading(false);
    },
    [impersonatingCoachId]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
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

  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  return { access, loading, refresh: forceRefresh, hasFeature };
}
