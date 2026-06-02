"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

export function ProspectsLandingStats({ coachSlug, impersonatingCoachId }: Props) {
  const [stats, setStats] = useState<LandingAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const res = await fetch(`/api/coach/landing/stats?${rangeParams()}`, {
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
  }, [coachSlug, impersonatingCoachId]);

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Unique views"
            value={loading ? "—" : (totals?.uniqueViews ?? 0).toLocaleString()}
          />
          <StatCard
            label="Opt-ins"
            value={loading ? "—" : (totals?.optIns ?? 0).toLocaleString()}
            hint={loading ? undefined : `${formatLandingRate(optInRate)} of views`}
          />
          <StatCard
            label="Started scorecard"
            value={loading ? "—" : (totals?.started ?? 0).toLocaleString()}
          />
          <StatCard
            label="Completed"
            value={loading ? "—" : (totals?.finished ?? 0).toLocaleString()}
            hint={
              loading ? undefined : `${formatLandingRate(completionRate)} of views`
            }
          />
        </div>
      )}
    </section>
  );
}
