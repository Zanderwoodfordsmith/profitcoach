"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { CallsHub } from "@/components/calls/CallsHub";
import type { CallRow } from "@/lib/callRow";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";
import { fetchHubQuery, peekHubQuery, writeHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import {
  loadCallsHubPayload,
  type CallsHubPayload,
} from "@/lib/getClients/hubFetchers";

export default function AdminCallsPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const { checking } = useRequireAdminRole("/coach/calls");
  const cacheKey = hubQueryKey("calls:admin");
  const cached = peekHubQuery<CallsHubPayload>(cacheKey);
  const [calls, setCalls] = useState<CallRow[]>(() => cached?.calls ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [coachFilter, setCoachFilter] = useState<string | "all">("all");
  const [coaches, setCoaches] = useState<
    Array<{
      id: string;
      full_name: string | null;
      coach_business_name: string | null;
    }>
  >(() => cached?.coaches ?? []);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const hit = peekHubQuery<CallsHubPayload>(cacheKey);
      if (hit) {
        setCalls(hit.calls);
        setCoaches(hit.coaches);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const payload = await fetchHubQuery(cacheKey, () =>
          loadCallsHubPayload({ admin: true })
        );
        if (cancelled) return;
        setCalls(payload.calls);
        setCoaches(payload.coaches);
      } catch (err) {
        console.error("admin/calls load:", err);
        if (!cancelled && !hit) setError("Unable to load calls.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (checking) return;
    void init();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, checking]);

  const coachOptionsFromCalls = Array.from(
    new Map(
      calls.map((row) => [
        row.coach_id,
        {
          id: row.coach_id!,
          label:
            row.coach_name ??
            row.coach_business_name ??
            `Coach ${(row.coach_id ?? "").slice(0, 6)}`,
        },
      ])
    ).values()
  ).filter((coach) => coach.id);

  const coachOptionsFromList = coaches.map((coach) => ({
    id: coach.id,
    label:
      coach.full_name ??
      coach.coach_business_name ??
      `Coach ${coach.id.slice(0, 8)}`,
  }));

  const coachOptions =
    coachOptionsFromCalls.length > 0
      ? Array.from(
          new Map(
            [...coachOptionsFromCalls, ...coachOptionsFromList].map((coach) => [
              coach.id,
              coach,
            ])
          ).values()
        )
      : coachOptionsFromList;

  const navigateToCall = useCallback(
    (row: CallRow) => {
      if (!row.contact_id) return;
      flushSync(() => {
        if (row.coach_id) setImpersonatingCoachId(row.coach_id);
      });
      router.push(bossProHubPath(row.contact_id, { admin: true }));
    },
    [router, setImpersonatingCoachId]
  );

  const handleCallsChange = useCallback(
    (next: CallRow[]) => {
      setCalls(next);
      const current = peekHubQuery<CallsHubPayload>(cacheKey);
      writeHubQuery(cacheKey, {
        calls: next,
        coaches: current?.coaches ?? coaches,
      });
    },
    [cacheKey, coaches]
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Get Clients"
        description="Calendar is the working view; the call list and booking settings are still available."
        tabs={<CoachToolsHubTabs hub="get-clients" />}
      />

      <Suspense fallback={<p className="text-sm text-slate-600">Loading calls…</p>}>
        <CallsHub
          calls={calls}
          loading={loading}
          error={error}
          showCoachColumn={true}
          appOrigin={appOrigin}
          callsBasePath="/admin/calls"
          onCallsChange={handleCallsChange}
          coachFilterOptions={coachOptions}
          coachFilter={coachFilter}
          onCoachFilterChange={setCoachFilter}
          onRowClick={navigateToCall}
          emptyMessage="No calls found. Bookings from native calendars and GHL will appear here."
        />
      </Suspense>
    </div>
  );
}
