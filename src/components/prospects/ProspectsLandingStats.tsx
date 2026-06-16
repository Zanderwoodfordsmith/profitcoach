"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { LandingStatActorsHover } from "@/components/prospects/LandingStatActorsHover";
import { supabaseClient } from "@/lib/supabaseClient";
import type { LandingStatKind } from "@/lib/landingActors";
import {
  formatLandingRate,
  landingConversionRate,
  type LandingAnalyticsResult,
} from "@/lib/landingAnalytics";
import {
  defaultLandingStatsRange,
  isLandingStatsRangeValid,
  LANDING_STATS_RANGE_PRESETS,
  landingStatsRangeLabel,
  landingStatsRangeQuery,
  type LandingStatsRange,
  type LandingStatsRangePreset,
} from "@/lib/landingStatsRange";

type Props = {
  coachSlug: string | null;
  impersonatingCoachId: string | null;
};

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

const PRESET_DROPDOWN_LABELS: Record<LandingStatsRangePreset, string> = {
  "7": "Last 7 days",
  "14": "Last 14 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
  custom: "Custom range",
};

function LandingStatsRangeDropdown({
  value,
  onChange,
}: {
  value: LandingStatsRange;
  onChange: (next: LandingStatsRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const triggerLabel = useMemo(() => {
    if (value.preset === "custom") {
      return landingStatsRangeLabel(value);
    }
    return PRESET_DROPDOWN_LABELS[value.preset];
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectPreset(preset: LandingStatsRangePreset) {
    onChange({ ...value, preset });
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Landing page date range"
        className="inline-flex min-w-[8.5rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
          role="listbox"
          aria-label="Date range options"
        >
          {LANDING_STATS_RANGE_PRESETS.map((preset) => {
            const active = value.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectPreset(preset.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                  active
                    ? "bg-sky-50 text-sky-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${
                    active ? "text-sky-600" : "text-transparent"
                  }`}
                  aria-hidden
                />
                <span>{PRESET_DROPDOWN_LABELS[preset.id]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LandingStatsCustomRangeFields({
  value,
  onChange,
}: {
  value: LandingStatsRange;
  onChange: (next: LandingStatsRange) => void;
}) {
  const customInvalid =
    value.preset === "custom" && !isLandingStatsRangeValid(value);

  if (value.preset !== "custom") return null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        From
        <input
          type="date"
          value={value.customFrom}
          max={value.customTo || undefined}
          onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        To
        <input
          type="date"
          value={value.customTo}
          min={value.customFrom || undefined}
          onChange={(e) => onChange({ ...value, customTo: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </label>
      {customInvalid ? (
        <p className="pb-1 text-xs text-rose-600">
          Choose a valid from and to date.
        </p>
      ) : null}
    </div>
  );
}

export function ProspectsLandingStats({ coachSlug, impersonatingCoachId }: Props) {
  const [stats, setStats] = useState<LandingAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(defaultLandingStatsRange);

  const rangeQuery = useMemo(
    () => landingStatsRangeQuery(dateRange),
    [dateRange]
  );
  const rangeValid = isLandingStatsRangeValid(dateRange);

  useEffect(() => {
    if (!coachSlug || !rangeValid) {
      setLoading(false);
      if (!rangeValid) {
        setStats(null);
      }
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
        const url = rangeQuery
          ? `/api/coach/landing/stats?${rangeQuery}`
          : "/api/coach/landing/stats";
        const res = await fetch(url, { headers });
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
  }, [coachSlug, impersonatingCoachId, rangeQuery, rangeValid]);

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
    card: ReactNode
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
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Landing page</h2>
          <LandingStatsRangeDropdown value={dateRange} onChange={setDateRange} />
        </div>
        <span className="shrink-0 text-xs text-slate-500">/score/{coachSlug}</span>
      </div>

      <LandingStatsCustomRangeFields value={dateRange} onChange={setDateRange} />

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Unique views"
            value={
              loading || !rangeValid
                ? "—"
                : (totals?.uniqueViews ?? 0).toLocaleString()
            }
          />
          {hoverStat(
            "opt_in",
            loading || !rangeValid ? 0 : optInCount,
            <StatCard
              label="Opt-ins"
              value={
                loading || !rangeValid ? "—" : optInCount.toLocaleString()
              }
              hint={
                loading || !rangeValid
                  ? undefined
                  : `${formatLandingRate(optInRate)} of views`
              }
              hoverable={!loading && rangeValid && optInCount > 0}
            />
          )}
          {hoverStat(
            "start",
            loading || !rangeValid ? 0 : startedCount,
            <StatCard
              label="Started scorecard"
              value={
                loading || !rangeValid ? "—" : startedCount.toLocaleString()
              }
              hoverable={!loading && rangeValid && startedCount > 0}
            />
          )}
          {hoverStat(
            "finish",
            loading || !rangeValid ? 0 : finishedCount,
            <StatCard
              label="Completed"
              value={
                loading || !rangeValid ? "—" : finishedCount.toLocaleString()
              }
              hint={
                loading || !rangeValid
                  ? undefined
                  : `${formatLandingRate(completionRate)} of views`
              }
              hoverable={!loading && rangeValid && finishedCount > 0}
            />
          )}
        </div>
      )}
    </section>
  );
}
