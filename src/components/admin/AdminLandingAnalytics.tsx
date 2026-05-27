"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { StickyPageHeader } from "@/components/layout";
import {
  activeLandingVariants,
  coachDisplayName,
  emptyVariantStats,
  formatLandingRate,
  landingConversionRate,
  LANDING_BRAND_COACH_KEY,
  LANDING_VARIANT_LABELS,
  LANDING_VARIANT_PATHS,
  type LandingAnalyticsResult,
  type LandingCoachLabel,
  type LandingVariant,
  type LandingVariantStats,
} from "@/lib/landingAnalytics";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";

type StatsResponse = LandingAnalyticsResult & {
  coachLabels: Record<string, LandingCoachLabel>;
};

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function VariantCard({
  variant,
  stats,
}: {
  variant: LandingVariant;
  stats: LandingVariantStats;
}) {
  const optInRate = landingConversionRate(stats.opt_in, stats.uniqueViews);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Page {variant.toUpperCase()}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            {LANDING_VARIANT_LABELS[variant]}
          </h3>
        </div>
        <Link
          href={LANDING_VARIANT_PATHS[variant]}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900"
        >
          Preview
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Unique views</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(stats.uniqueViews)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Opt-ins</dt>
          <dd className="font-semibold text-slate-900">
            {formatNumber(stats.opt_in)}{" "}
            <span className="font-normal text-slate-500">({formatLandingRate(optInRate)})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Started scorecard</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(stats.started)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Completed</dt>
          <dd className="font-semibold text-slate-900">{formatNumber(stats.finish)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminLandingAnalytics() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const loadStats = useCallback(async (token: string) => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.set("from", new Date(`${dateRange.from}T00:00:00.000Z`).toISOString());
    }
    if (dateRange.to) {
      params.set("to", new Date(`${dateRange.to}T23:59:59.999Z`).toISOString());
    }

    const query = params.toString();
    const res = await fetch(`/api/admin/landing/stats${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as StatsResponse | { error?: string };
    if (!res.ok) {
      throw new Error((body as { error?: string }).error ?? "Unable to load landing analytics.");
    }
    setStats(body as StatsResponse);
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setCheckingRole(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (!roleRes.ok || roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      const token = await getValidSupabaseAccessToken();
      if (!token) {
        if (!cancelled) {
          setError("Unable to load landing analytics.");
          setCheckingRole(false);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;
      setCheckingRole(false);
      setLoading(true);

      try {
        await loadStats(token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load landing analytics.");
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadStats, router]);

  const activeVariants = useMemo(
    () => (stats ? activeLandingVariants(stats.byVariant) : []),
    [stats]
  );

  const coachRows = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.byCoach)
      .map((slug) => ({
        slug,
        stats: stats.byCoach[slug] ?? emptyVariantStats(),
      }))
      .sort((a, b) => b.stats.uniqueViews - a.stats.uniqueViews);
  }, [stats]);

  const overallOptInRate = landingConversionRate(
    stats?.totals.optIns ?? 0,
    stats?.totals.uniqueViews ?? 0
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Landing analytics"
        description="Boss Score landing page views and opt-ins. Traffic is grouped by page variant when more than one is in use."
        below={
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              From
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              To
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
        }
      />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading && !checkingRole ? (
        <p className="text-sm text-slate-600">Loading landing analytics…</p>
      ) : null}

      {!loading && stats ? (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Unique views</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(stats.totals.uniqueViews)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Opt-ins</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(stats.totals.optIns)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatLandingRate(overallOptInRate)} of views
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Started scorecard</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(stats.totals.started)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completed</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(stats.totals.finished)}
              </p>
            </article>
          </section>

          {activeVariants.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">By page variant</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {activeVariants.length === 1
                    ? "All traffic in this period went to one landing page."
                    : `${activeVariants.length} landing page variants received traffic in this period.`}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeVariants.map((variant) => (
                  <VariantCard
                    key={variant}
                    variant={variant}
                    stats={stats.byVariant[variant]}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">By coach</h2>
              <p className="mt-1 text-xs text-slate-500">
                Combined across all landing pages. Opt-in % is opt-ins ÷ unique views.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Coach</th>
                    <th className="px-3 py-3 text-right">Views</th>
                    <th className="px-3 py-3 text-right">Opt-ins</th>
                    <th className="px-3 py-3 text-right">Opt-in %</th>
                    <th className="px-3 py-3 text-right">Started</th>
                    <th className="px-3 py-3 text-right">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coachRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                        No landing page activity in this date range yet.
                      </td>
                    </tr>
                  ) : (
                    coachRows.map((row) => {
                      const optInRate = landingConversionRate(
                        row.stats.opt_in,
                        row.stats.uniqueViews
                      );
                      return (
                        <tr key={row.slug} className="hover:bg-slate-50/80">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-900">
                              {coachDisplayName(row.slug, stats.coachLabels)}
                            </p>
                            {row.slug !== LANDING_BRAND_COACH_KEY ? (
                              <p className="font-mono text-xs text-slate-500">{row.slug}</p>
                            ) : (
                              <p className="text-xs text-slate-500">/score with no coach slug</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatNumber(row.stats.uniqueViews)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatNumber(row.stats.opt_in)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                            {formatLandingRate(optInRate)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatNumber(row.stats.started)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatNumber(row.stats.finish)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {!loading && !checkingRole && stats && stats.totals.uniqueViews === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">No data yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Views and opt-ins are recorded automatically when prospects visit a Boss Score landing
            page. Try widening the date range, or visit a share link (e.g.{" "}
            <code className="text-xs">/score/your-slug</code>) to confirm tracking is working.
          </p>
        </section>
      ) : null}
    </div>
  );
}
