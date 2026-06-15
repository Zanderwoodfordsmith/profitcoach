"use client";

import { useEffect, useMemo, useState } from "react";
import { LandingStatActorsHover } from "@/components/prospects/LandingStatActorsHover";
import { supabaseClient } from "@/lib/supabaseClient";
import type { LandingStatKind } from "@/lib/landingActors";
import {
  formatLandingRate,
  landingConversionRate,
  type LandingAnalyticsResult,
} from "@/lib/landingAnalytics";

type Props = {
  coachSlug: string | null;
  impersonatingCoachId: string | null;
};

const RANGE_DAYS = 30;

function rangeParams(): string {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - RANGE_DAYS);
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return params.toString();
}

function StatCard({
  label,
  value,
  hint,
  hoverable = false,
}: {
  label: string;
  value: string;
  hint?: string;
  hoverable?: boolean;
}) {
  return (
    <article
      className={`flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
        hoverable ? "cursor-default transition hover:border-sky-200 hover:shadow-md" : ""
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p
        className={`mt-1 min-h-[1rem] text-xs leading-4 ${
          hint ? "text-slate-500" : "invisible select-none"
        }`}
        aria-hidden={!hint}
      >
        {hint ?? "\u00a0"}
      </p>
    </article>
  );
}

export function ProspectsLandingStats({ coachSlug, impersonatingCoachId }: Props) {
  const [stats, setStats] = useState<LandingAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rangeQuery = useMemo(() => rangeParams(), []);

  useEffect(() => {
    if (!coachSlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setError("Unable to load landing stats.");
          setLoading(false);
        }
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      try {
        const res = await fetch(`/api/coach/landing/stats?${rangeQuery}`, {
          headers,
        });
        const body = (await res.json().catch(() => ({}))) as
          | (LandingAnalyticsResult & { error?: string })
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            (body as { error?: string }).error ?? "Unable to load landing stats."
          );
        }
        if (!cancelled) setStats(body as LandingAnalyticsResult);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load landing stats."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [coachSlug, impersonatingCoachId, rangeQuery]);

  // No public funnel link yet, so there is nothing to report on.
  if (!coachSlug) return null;

  const totals = stats?.totals;
  const optInRate = landingConversionRate(
    totals?.optIns ?? 0,
    totals?.uniqueViews ?? 0
  );
  const completionRate = landingConversionRate(
    totals?.finished ?? 0,
    totals?.uniqueViews ?? 0
  );

  function hoverStat(
    kind: LandingStatKind,
    count: number,
    card: React.ReactNode
  ) {
    return (
      <LandingStatActorsHover
        kind={kind}
        count={count}
        rangeQuery={rangeQuery}
        impersonatingCoachId={impersonatingCoachId}
      >
        {card}
      </LandingStatActorsHover>
    );
  }

  const optInCount = totals?.optIns ?? 0;
  const startedCount = totals?.started ?? 0;
  const finishedCount = totals?.finished ?? 0;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Landing page (last {RANGE_DAYS} days)
        </h2>
        <span className="text-xs text-slate-500">/score/{coachSlug}</span>
      </div>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Unique views"
            value={loading ? "—" : (totals?.uniqueViews ?? 0).toLocaleString()}
          />
          {hoverStat(
            "opt_in",
            loading ? 0 : optInCount,
            <StatCard
              label="Opt-ins"
              value={loading ? "—" : optInCount.toLocaleString()}
              hint={loading ? undefined : `${formatLandingRate(optInRate)} of views`}
              hoverable={!loading && optInCount > 0}
            />
          )}
          {hoverStat(
            "start",
            loading ? 0 : startedCount,
            <StatCard
              label="Started scorecard"
              value={loading ? "—" : startedCount.toLocaleString()}
              hoverable={!loading && startedCount > 0}
            />
          )}
          {hoverStat(
            "finish",
            loading ? 0 : finishedCount,
            <StatCard
              label="Completed"
              value={loading ? "—" : finishedCount.toLocaleString()}
              hint={
                loading ? undefined : `${formatLandingRate(completionRate)} of views`
              }
              hoverable={!loading && finishedCount > 0}
            />
          )}
        </div>
      )}
    </section>
  );
}
