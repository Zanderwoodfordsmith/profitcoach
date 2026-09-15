"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useCoachClientHubAccess } from "@/hooks/useCoachClientHubAccess";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { CallsHub } from "@/components/calls/CallsHub";
import type { CallRow } from "@/lib/callRow";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import { fetchHubQuery, peekHubQuery, writeHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import {
  loadCallsHubPayload,
  type CallsHubPayload,
} from "@/lib/getClients/hubFetchers";

export default function CoachCallsPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { allowed: clientHubAllowed } = useCoachClientHubAccess(impersonatingCoachId);
  const cacheKey = hubQueryKey("calls:coach", impersonatingCoachId);
  const cached = peekHubQuery<CallsHubPayload>(cacheKey);
  const [calls, setCalls] = useState<CallRow[]>(() => cached?.calls ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const hit = peekHubQuery<CallsHubPayload>(cacheKey);
      if (hit) {
        setCalls(hit.calls);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const user = session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const effectiveId = impersonatingCoachId || user.id;
      try {
        const payload = await fetchHubQuery(cacheKey, () =>
          loadCallsHubPayload({ admin: false, coachId: effectiveId })
        );
        if (!cancelled) setCalls(payload.calls);
      } catch (err) {
        console.error("coach/calls load:", err);
        if (!cancelled && !hit) setError("Unable to load calls.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, impersonatingCoachId, router]);

  const handleCallsChange = useCallback(
    (next: CallRow[]) => {
      setCalls(next);
      const current = peekHubQuery<CallsHubPayload>(cacheKey);
      writeHubQuery(cacheKey, {
        calls: next,
        coaches: current?.coaches ?? [],
      });
    },
    [cacheKey]
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        description="Booked calls from native calendars and GoHighLevel."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      <Suspense fallback={<p className="text-sm text-slate-600">Loading calls…</p>}>
        <CallsHub
          calls={calls}
          loading={loading}
          error={error}
          showCoachColumn={false}
          appOrigin={appOrigin}
          callsBasePath="/coach/calls"
          onCallsChange={handleCallsChange}
          onRowClick={(row) => {
            if (row.contact_id && clientHubAllowed) {
              router.push(bossProHubPath(row.contact_id));
            }
          }}
          emptyMessage="No calls yet. When prospects book through your calendars, they will appear here."
        />
      </Suspense>
    </div>
  );
}
