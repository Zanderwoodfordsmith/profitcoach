"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type {
  ActivityDayCounts,
  ActivityDayRange,
  ActivityLayer,
} from "@/lib/unipile/activityHeatmap";

type HeatmapResponse = {
  days: ActivityDayRange;
  buckets: ActivityDayCounts[];
  totals: Omit<ActivityDayCounts, "date">;
  error?: string;
};

const RANGE_OPTIONS: { value: ActivityDayRange; label: string }[] = [
  { value: 90, label: "90 days" },
  { value: 180, label: "6 months" },
  { value: 365, label: "1 year" },
];

const LAYER_OPTIONS: { value: ActivityLayer; label: string }[] = [
  { value: "all", label: "All" },
  { value: "invite", label: "Invites" },
  { value: "message", label: "Messages" },
  { value: "email", label: "Emails" },
  { value: "engagement", label: "Engagement" },
];

const LEVEL_CLASSES = [
  "bg-slate-100",
  "bg-emerald-100",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
] as const;

async function authHeaders(): Promise<Record<string, string> | null> {
  return getCoachAuthHeaders();
}

function countForLayer(row: ActivityDayCounts, layer: ActivityLayer): number {
  if (layer === "all") return row.total;
  return row[layer];
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function monthLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Pad to full weeks starting Sunday (GitHub/Skool style). */
function padBuckets(buckets: ActivityDayCounts[]): ActivityDayCounts[] {
  if (buckets.length === 0) return buckets;
  const first = buckets[0]!;
  const last = buckets[buckets.length - 1]!;
  const firstDate = new Date(`${first.date}T12:00:00.000Z`);
  const lastDate = new Date(`${last.date}T12:00:00.000Z`);
  const padStart = firstDate.getUTCDay();
  const padEnd = 6 - lastDate.getUTCDay();

  const empty = (date: string): ActivityDayCounts => ({
    date,
    invite: 0,
    message: 0,
    email: 0,
    engagement: 0,
    total: 0,
  });

  const before: ActivityDayCounts[] = [];
  for (let i = padStart; i > 0; i -= 1) {
    const d = new Date(firstDate);
    d.setUTCDate(d.getUTCDate() - i);
    before.push(
      empty(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
      )
    );
  }

  const after: ActivityDayCounts[] = [];
  for (let i = 1; i <= padEnd; i += 1) {
    const d = new Date(lastDate);
    d.setUTCDate(d.getUTCDate() + i);
    after.push(
      empty(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
      )
    );
  }

  return [...before, ...buckets, ...after];
}

function intensityLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function tooltipText(row: ActivityDayCounts, layer: ActivityLayer): string {
  const n = countForLayer(row, layer);
  const when = dayLabel(row.date);
  if (layer !== "all") {
    const noun =
      layer === "invite"
        ? "invite"
        : layer === "message"
          ? "message"
          : layer === "email"
            ? "email"
            : "engagement";
    return `${when}: ${n} ${noun}${n === 1 ? "" : "s"}`;
  }
  const parts = [
    row.invite ? `${row.invite} invite${row.invite === 1 ? "" : "s"}` : null,
    row.message
      ? `${row.message} message${row.message === 1 ? "" : "s"}`
      : null,
    row.email ? `${row.email} email${row.email === 1 ? "" : "s"}` : null,
    row.engagement
      ? `${row.engagement} engagement${row.engagement === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  if (parts.length === 0) return `${when}: no activity`;
  return `${when}: ${parts.join(" · ")}`;
}

export function OutreachActivityHeatmap() {
  const [days, setDays] = useState<ActivityDayRange>(90);
  const [layer, setLayer] = useState<ActivityLayer>("all");
  const [buckets, setBuckets] = useState<ActivityDayCounts[]>([]);
  const [totals, setTotals] = useState<Omit<ActivityDayCounts, "date"> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: ActivityDayRange) => {
    const headers = await authHeaders();
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/linkedin-outreach/activity?days=${range}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as HeatmapResponse;
      if (!res.ok) {
        throw new Error(body.error || "Could not load activity.");
      }
      setBuckets(body.buckets ?? []);
      setTotals(body.totals ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
      setBuckets([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const padded = useMemo(() => padBuckets(buckets), [buckets]);
  const inRange = useMemo(
    () => new Set(buckets.map((b) => b.date)),
    [buckets]
  );

  const weeks = useMemo(() => {
    const cols: ActivityDayCounts[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      cols.push(padded.slice(i, i + 7));
    }
    return cols;
  }, [padded]);

  const max = useMemo(() => {
    let m = 0;
    for (const b of buckets) {
      m = Math.max(m, countForLayer(b, layer));
    }
    return m;
  }, [buckets, layer]);

  const monthMarkers = useMemo(() => {
    const markers: { week: number; label: string }[] = [];
    let lastMonth = "";
    weeks.forEach((week, weekIdx) => {
      const cell = week.find((c) => inRange.has(c.date));
      if (!cell) return;
      const label = monthLabel(cell.date);
      if (label && label !== lastMonth) {
        markers.push({ week: weekIdx, label });
        lastMonth = label;
      }
    });
    return markers;
  }, [weeks, inRange]);

  const activeTotal =
    layer === "all" ? (totals?.total ?? 0) : (totals?.[layer] ?? 0);

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {loading
              ? "Loading…"
              : error
                ? error
                : `${activeTotal} outbound action${activeTotal === 1 ? "" : "s"} in this period`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {LAYER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLayer(opt.value)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  layer === opt.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={days}
            onChange={(e) =>
              setDays(Number(e.target.value) as ActivityDayRange)
            }
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#0c5290]/30"
            aria-label="Activity range"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="inline-flex gap-2">
          <div className="flex w-6 shrink-0 flex-col gap-[3px] pt-4 text-[10px] leading-none text-slate-400">
            {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
              <span
                key={`dow-${i}`}
                className="flex h-2.5 items-center justify-end sm:h-3"
              >
                {label}
              </span>
            ))}
          </div>

          <div>
            <div
              className="relative mb-1 h-3"
              style={{ width: Math.max(weeks.length * 14, 1) }}
            >
              {monthMarkers.map((m) => (
                <span
                  key={`${m.label}-${m.week}`}
                  className="absolute top-0 text-[10px] text-slate-400"
                  style={{ left: m.week * 14 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week) => (
                <div
                  key={week[0]?.date ?? "w"}
                  className="flex flex-col gap-[3px]"
                >
                  {week.map((cell) => {
                    const active = inRange.has(cell.date);
                    const value = countForLayer(cell, layer);
                    const level = intensityLevel(value, max);
                    return (
                      <div
                        key={cell.date}
                        title={active ? tooltipText(cell, layer) : undefined}
                        className={`h-2.5 w-2.5 rounded-[3px] sm:h-3 sm:w-3 ${
                          active ? LEVEL_CLASSES[level] : "bg-transparent"
                        }`}
                        aria-label={
                          active ? tooltipText(cell, layer) : undefined
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
        <span>Less</span>
        {LEVEL_CLASSES.map((cls) => (
          <span
            key={cls}
            className={`h-2.5 w-2.5 rounded-[3px] sm:h-3 sm:w-3 ${cls}`}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
