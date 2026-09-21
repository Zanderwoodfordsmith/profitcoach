"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { buildDemoCampaignOverview } from "@/lib/campaigns/demoPreview";
import {
  CampaignCompactDial,
  CampaignReplyMix,
} from "@/components/campaigns/CampaignOverviewMetrics";
import {
  OVERVIEW_RANGE_LABELS,
  OVERVIEW_RANGES,
  type OverviewRange,
} from "@/lib/unipile/campaignPlanBuckets";

type ActualDay = {
  date: string;
  invite: number;
  message: number;
  engagement: number;
  total: number;
};

type PlannedDay = { date: string; planned: number };

type OverviewResponse = {
  window: {
    range: OverviewRange;
    offset: number;
    todayYmd: string;
    startYmd: string;
    endYmd: string;
    label: string;
  };
  actual: ActualDay[];
  planned: PlannedDay[];
  sent: number;
  peopleReached: number;
  plannedRemaining: number;
  fuelDays: number | null;
  fuelLeft: number;
};

type Rate = { numerator: number; denominator: number };

const STACK = {
  invite: "#0c5290",
  message: "#42a1ee",
  engagement: "#1ca0c2",
} as const;

const BAR_MAX_PX = 152;
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function weekdayUtc(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
}

function weekStartMonday(ymd: string): string {
  const weekday = weekdayUtc(ymd);
  const shift = weekday === 0 ? -6 : 1 - weekday;
  const [year, month, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + shift));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function formatDay(ymd: string): string {
  const day = Number(ymd.slice(8));
  const month = Number(ymd.slice(5, 7));
  return `${day} ${MONTH_SHORT[month - 1] ?? ""}`;
}

function formatDayRange(startYmd: string, endYmd: string): string {
  const startDay = Number(startYmd.slice(8));
  const endDay = Number(endYmd.slice(8));
  const startMonth = Number(startYmd.slice(5, 7));
  const endMonth = Number(endYmd.slice(5, 7));
  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${MONTH_SHORT[startMonth - 1] ?? ""}`;
  }
  return `${startDay} ${MONTH_SHORT[startMonth - 1] ?? ""}–${endDay} ${MONTH_SHORT[endMonth - 1] ?? ""}`;
}

function formatWeekday(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (month || 1) - 1, day || 1)));
}

function formatTick(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function monthShortFromKey(yearMonth: string): string {
  const month = Number(yearMonth.slice(5, 7));
  return MONTH_SHORT[month - 1] ?? "";
}

function niceCeiling(value: number): number {
  if (value <= 0) return 4;
  const padded = Math.max(4, Math.ceil(value));
  const exp = 10 ** Math.floor(Math.log10(padded));
  const mantissa = padded / exp;
  const nice =
    mantissa <= 1
      ? 1
      : mantissa <= 2
        ? 2
        : mantissa <= 2.5
          ? 2.5
          : mantissa <= 3
            ? 3
            : mantissa <= 4
              ? 4
              : mantissa <= 5
                ? 5
                : mantissa <= 6
                  ? 6
                  : mantissa <= 8
                    ? 8
                    : 10;
  return nice * exp;
}

function yAxisTicks(maxValue: number): { top: number; ticks: number[] } {
  const top = niceCeiling(maxValue);
  const step =
    top <= 4
      ? 1
      : top % 3 === 0 && top / 3 >= 2
        ? top / 3
        : top % 4 === 0
          ? top / 4
          : top % 5 === 0
            ? top / 5
            : top / 2;
  const ticks: number[] = [];
  for (let n = 0; n <= top + 1e-6; n += step) {
    ticks.push(Math.round(n * 10) / 10);
  }
  return { top, ticks };
}

function barWidthClass(range: OverviewRange): string {
  if (range === "week") return "w-[78%] max-w-[4.75rem]";
  if (range === "month") return "w-[70%] max-w-[3.75rem]";
  if (range === "year") return "w-[72%] max-w-[3.25rem]";
  return "w-[80%] max-w-[2.6rem]";
}

type ChartBar = {
  key: string;
  label: string;
  cardTitle: string;
  sublabel?: string;
  invite: number;
  message: number;
  engagement: number;
  planned: number;
  isToday: boolean;
};

function groupWeekBars(
  actual: ActualDay[],
  plannedByDate: Map<string, number>,
  todayYmd: string,
  labelFrom: "weekStart" | "span"
): ChartBar[] {
  type WeekAcc = ChartBar & { firstDay: string; lastDay: string };
  const groups = new Map<string, WeekAcc>();
  for (const row of actual) {
    const key = weekStartMonday(row.date);
    const plannedCount = plannedByDate.get(row.date) ?? 0;
    const existing = groups.get(key);
    if (existing) {
      existing.invite += row.invite;
      existing.message += row.message;
      existing.engagement += row.engagement;
      existing.planned += plannedCount;
      existing.lastDay = row.date;
      if (row.date === todayYmd) existing.isToday = true;
    } else {
      groups.set(key, {
        key,
        label: "",
        cardTitle: "",
        firstDay: row.date,
        lastDay: row.date,
        invite: row.invite,
        message: row.message,
        engagement: row.engagement,
        planned: plannedCount,
        isToday: row.date === todayYmd,
      });
    }
  }
  return [...groups.values()].map((bar) => {
    const span = formatDayRange(bar.firstDay, bar.lastDay);
    const label = labelFrom === "span" ? span : formatDay(bar.key);
    return {
      key: bar.key,
      label,
      cardTitle: span,
      invite: bar.invite,
      message: bar.message,
      engagement: bar.engagement,
      planned: bar.planned,
      isToday: bar.isToday,
    };
  });
}

function buildBars(
  range: OverviewRange,
  actual: ActualDay[],
  planned: PlannedDay[],
  todayYmd: string
): ChartBar[] {
  const plannedByDate = new Map(planned.map((p) => [p.date, p.planned]));

  if (range === "week") {
    return actual.map((row) => {
      const plannedCount = plannedByDate.get(row.date) ?? 0;
      return {
        key: row.date,
        label: formatWeekday(row.date),
        cardTitle: `${formatWeekday(row.date)} ${formatDay(row.date)}`,
        sublabel: String(Number(row.date.slice(8))),
        invite: row.invite,
        message: row.message,
        engagement: row.engagement,
        planned: plannedCount,
        isToday: row.date === todayYmd,
      };
    });
  }

  if (range === "month") {
    return groupWeekBars(actual, plannedByDate, todayYmd, "span");
  }

  if (range === "year") {
    const groups = new Map<string, ChartBar>();
    for (const row of actual) {
      const key = row.date.slice(0, 7);
      const plannedCount = plannedByDate.get(row.date) ?? 0;
      const existing = groups.get(key);
      if (existing) {
        existing.invite += row.invite;
        existing.message += row.message;
        existing.engagement += row.engagement;
        existing.planned += plannedCount;
        if (row.date === todayYmd) existing.isToday = true;
      } else {
        groups.set(key, {
          key,
          label: monthShortFromKey(key),
          cardTitle: `${monthShortFromKey(key)} ${key.slice(0, 4)}`,
          invite: row.invite,
          message: row.message,
          engagement: row.engagement,
          planned: plannedCount,
          isToday: row.date === todayYmd,
        });
      }
    }
    return [...groups.values()];
  }

  return groupWeekBars(actual, plannedByDate, todayYmd, "weekStart");
}

function BarHoverCard({ bar }: { bar: ChartBar }) {
  const sent = bar.invite + bar.message + bar.engagement;
  const rows: { label: string; value: number; swatch: string }[] = [
    { label: "Invites sent", value: bar.invite, swatch: STACK.invite },
    { label: "Messages", value: bar.message, swatch: STACK.message },
    { label: "Engagement", value: bar.engagement, swatch: STACK.engagement },
    {
      label: "Planned",
      value: bar.planned,
      swatch:
        "repeating-linear-gradient(-45deg, rgba(12,82,144,0.45), rgba(12,82,144,0.45) 2px, rgba(12,82,144,0.12) 2px, rgba(12,82,144,0.12) 5px)",
    },
  ];
  return (
    <div
      role="tooltip"
      className="w-[13.25rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg shadow-slate-300/80"
    >
      <p className="text-[11px] font-medium text-slate-500">{bar.cardTitle}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-slate-900">
        {sent}
        <span className="ml-1 text-xs font-medium text-slate-400">sent</span>
      </p>
      {bar.planned > 0 ? (
        <p className="text-[11px] font-medium tabular-nums text-slate-500">
          {bar.planned} planned
        </p>
      ) : null}
      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: row.swatch }}
              />
              {row.label}
            </span>
            <span className="tabular-nums font-semibold text-slate-900">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiTile({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl bg-slate-100 px-3 py-2.5 sm:px-3.5 sm:py-3 ${className ?? ""}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 flex flex-1 items-center">{children}</div>
    </div>
  );
}

function KpiNumber({ value, hint }: { value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
        {value}
      </p>
      {hint ? <p className="text-[10px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ChartLegend({ className }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-medium text-slate-500 ${className ?? ""}`}
    >
      <li className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ background: STACK.invite }}
        />
        Invites sent
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ background: STACK.message }}
        />
        Messages
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{ background: STACK.engagement }}
        />
        Engagement
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{
            background:
              "repeating-linear-gradient(-45deg, rgba(12,82,144,0.45), rgba(12,82,144,0.45) 2px, rgba(12,82,144,0.12) 2px, rgba(12,82,144,0.12) 5px)",
          }}
        />
        Planned
      </li>
    </ul>
  );
}

/** Soft pulse bars — avoids the hatched "planned" fill used as a fake loading chart. */
const SKELETON_BAR_HEIGHTS = [0.42, 0.68, 0.55, 0.82, 0.48, 0.72, 0.38] as const;

function ChartSkeleton({
  range,
  widthClass,
}: {
  range: OverviewRange;
  widthClass: string;
}) {
  const { ticks } = yAxisTicks(0);
  const showTrack = range === "week" || range === "month" || range === "year";
  return (
    <>
      <ChartLegend className="mb-1.5 opacity-40" />
      <div className="flex gap-3" aria-hidden>
        <div
          className="flex w-10 shrink-0 flex-col justify-between text-right"
          style={{ height: BAR_MAX_PX }}
        >
          {[...ticks].reverse().map((tick) => (
            <span
              key={tick}
              className="text-[11px] font-medium tabular-nums text-slate-300"
            >
              {formatTick(tick)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: BAR_MAX_PX }}>
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute right-0 left-0 border-t border-slate-100"
                style={{
                  bottom: `${(tick / 4) * 100}%`,
                }}
              />
            ))}
            <div className="relative z-10 flex h-full items-end gap-1 sm:gap-1.5">
              {SKELETON_BAR_HEIGHTS.map((ratio, i) => (
                <div
                  key={i}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  {showTrack ? (
                    <div
                      className={`absolute inset-x-0 bottom-0 top-0 mx-auto rounded-2xl bg-slate-100 ${widthClass}`}
                    />
                  ) : null}
                  <div
                    className={`relative z-10 animate-pulse rounded-t-lg bg-slate-200/90 ${widthClass}`}
                    style={{ height: Math.round(ratio * BAR_MAX_PX) }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1 sm:gap-1.5">
            {SKELETON_BAR_HEIGHTS.map((_, i) => (
              <span
                key={i}
                className="flex min-w-0 flex-1 justify-center"
              >
                <span className="h-3 w-8 animate-pulse rounded bg-slate-100" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StackBar({
  invite,
  message,
  engagement,
  planned,
  max,
  widthClass,
}: {
  invite: number;
  message: number;
  engagement: number;
  planned: number;
  max: number;
  widthClass: string;
}) {
  const total = invite + message + engagement + planned;
  const px = total > 0 ? Math.max(10, Math.round((total / max) * BAR_MAX_PX)) : 0;
  if (px <= 0) {
    return <div className={widthClass} style={{ height: 0 }} />;
  }
  return (
    <div
      className={`flex ${widthClass} flex-col-reverse overflow-hidden rounded-t-lg`}
      style={{ height: px }}
    >
      {invite > 0 ? (
        <div
          style={{
            background: STACK.invite,
            height: `${(invite / total) * 100}%`,
          }}
        />
      ) : null}
      {message > 0 ? (
        <div
          style={{
            background: STACK.message,
            height: `${(message / total) * 100}%`,
          }}
        />
      ) : null}
      {engagement > 0 ? (
        <div
          style={{
            background: STACK.engagement,
            height: `${(engagement / total) * 100}%`,
          }}
        />
      ) : null}
      {planned > 0 ? (
        <div
          className="min-h-[3px]"
          style={{
            height: `${(planned / total) * 100}%`,
            background:
              "repeating-linear-gradient(-45deg, rgba(12,82,144,0.45), rgba(12,82,144,0.45) 2px, rgba(12,82,144,0.12) 2px, rgba(12,82,144,0.12) 5px)",
          }}
        />
      ) : null}
    </div>
  );
}

export function CampaignOverviewHero({
  connectRate,
  replies,
  preview = false,
}: {
  connectRate: Rate;
  replies: { positive: number; negative: number; other: number };
  preview?: boolean;
}) {
  const [range, setRange] = useState<OverviewRange>("quarter");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  useEffect(() => {
    if (preview) {
      setData(buildDemoCampaignOverview(range, offset));
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const headers = await getCoachAuthHeaders();
        if (!headers || cancelled) return;
        const res = await fetch(
          `/api/coach/linkedin-outreach/overview?range=${range}&offset=${offset}`,
          { headers }
        );
        const body = (await res.json().catch(() => ({}))) as OverviewResponse & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(body.error || "Could not load overview.");
        }
        setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load overview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, offset, preview]);

  useEffect(() => {
    setHoverKey(null);
  }, [range, offset]);

  const bars = useMemo(() => {
    if (!data) return [];
    return buildBars(range, data.actual, data.planned, data.window.todayYmd);
  }, [data, range]);

  const dataMax = Math.max(
    0,
    ...bars.map((b) => b.invite + b.message + b.engagement + b.planned)
  );
  const { top: max, ticks } = yAxisTicks(dataMax);
  const hasAny = bars.some(
    (b) => b.invite + b.message + b.engagement + b.planned > 0
  );
  const showTrack = range === "week" || range === "month" || range === "year";
  const hoverBar = hoverKey ? bars.find((bar) => bar.key === hoverKey) : undefined;
  const widthClass = barWidthClass(range);
  const fuelNote =
    data && data.fuelLeft <= 0 && data.fuelDays != null
      ? "No invites left in the queue."
      : data && data.fuelDays != null && data.fuelDays <= 2
        ? `About ${data.fuelDays} day${data.fuelDays === 1 ? "" : "s"} of invites left.`
        : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
        <div className="grid grid-cols-1 items-center gap-3 px-4 pt-3.5 sm:grid-cols-[1fr_auto_1fr] sm:px-5">
          <h2 className="min-w-0 text-xl font-semibold tracking-tight text-slate-900">
            Activity this {OVERVIEW_RANGE_LABELS[range]}
          </h2>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              aria-label="Previous period"
              onClick={() => setOffset((n) => n - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <p className="min-w-[9.5rem] text-center text-sm font-medium tabular-nums text-slate-800">
              {data?.window.label ?? OVERVIEW_RANGE_LABELS[range]}
            </p>
            <button
              type="button"
              aria-label="Next period"
              onClick={() => setOffset((n) => n + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="relative justify-self-start sm:justify-self-end">
            <label className="sr-only" htmlFor="campaign-activity-range">
              Activity range
            </label>
            <select
              id="campaign-activity-range"
              value={range}
              onChange={(event) => {
                setRange(event.target.value as OverviewRange);
                setOffset(0);
              }}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-sm font-semibold text-slate-800 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
            >
              {OVERVIEW_RANGES.map((value) => (
                <option key={value} value={value}>
                  {OVERVIEW_RANGE_LABELS[value]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
        </div>

        <div className="px-4 pt-1.5 pb-1.5 sm:px-5 sm:pb-2">
          {error ? (
            <p className="py-10 text-center text-sm text-rose-700">{error}</p>
          ) : loading && !data ? (
            <ChartSkeleton range={range} widthClass={widthClass} />
          ) : (
            <>
              <ChartLegend className="mb-1.5" />
              <div className="flex gap-3">
                <div
                  className="flex w-10 shrink-0 flex-col justify-between text-right"
                  style={{ height: BAR_MAX_PX }}
                  aria-hidden
                >
                  {[...ticks].reverse().map((tick) => (
                    <span
                      key={tick}
                      className="text-[11px] font-medium tabular-nums text-slate-500"
                    >
                      {formatTick(tick)}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="relative"
                    style={{ height: BAR_MAX_PX }}
                    onMouseLeave={(event) => {
                      const next = event.relatedTarget;
                      if (next instanceof Node && event.currentTarget.contains(next)) {
                        return;
                      }
                      if (
                        document.activeElement instanceof Node &&
                        event.currentTarget.contains(document.activeElement)
                      ) {
                        return;
                      }
                      setHoverKey(null);
                    }}
                  >
                    {ticks.map((tick) => (
                      <div
                        key={tick}
                        className="absolute right-0 left-0 border-t border-slate-100"
                        style={{
                          bottom: max <= 0 ? 0 : `${(tick / max) * 100}%`,
                        }}
                      />
                    ))}
                    <div className="relative z-10 flex h-full items-end gap-1 sm:gap-1.5">
                      {bars.map((bar) => (
                        <div
                          key={bar.key}
                          className="relative flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end"
                          onMouseEnter={() => setHoverKey(bar.key)}
                          onFocus={() => setHoverKey(bar.key)}
                          onBlur={() => setHoverKey((current) => (current === bar.key ? null : current))}
                          tabIndex={0}
                          aria-label={
                            bar.cardTitle
                              ? `${bar.cardTitle}: ${bar.invite + bar.message + bar.engagement + bar.planned} total`
                              : undefined
                          }
                        >
                          {showTrack ? (
                            <div
                              className={`absolute inset-x-0 bottom-0 top-0 mx-auto rounded-2xl ${
                                bar.isToday || hoverKey === bar.key
                                  ? "bg-sky-50"
                                  : "bg-slate-100"
                              } ${widthClass}`}
                            />
                          ) : hoverKey === bar.key ? (
                            <div className="absolute inset-x-0 bottom-0 top-0 rounded-md bg-slate-50" />
                          ) : null}
                          <div className="relative z-10 flex w-full justify-center">
                            <StackBar
                              invite={bar.invite}
                              message={bar.message}
                              engagement={bar.engagement}
                              planned={bar.planned}
                              max={max}
                              widthClass={widthClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {hoverBar && !loading && hasAny ? (
                      <div className="pointer-events-none absolute top-1 left-2 z-30">
                        <BarHoverCard bar={hoverBar} />
                      </div>
                    ) : null}
                    {!loading && data && !hasAny ? (
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-3">
                        <div
                          role="status"
                          className="max-w-[17.5rem] rounded-xl bg-slate-100 px-4 py-3 text-center"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            Nothing sent or planned
                          </p>
                          <p className="mt-1 text-xs leading-snug text-slate-600">
                            Start a campaign or add people to one that&apos;s
                            running so there&apos;s always activity going out.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex gap-1 sm:gap-1.5">
                    {bars.map((bar) => (
                      <span
                        key={bar.key}
                        className={`min-w-0 flex-1 text-center ${
                          bar.isToday
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-600"
                        } ${
                          range === "week"
                            ? "text-xs sm:text-sm"
                            : "whitespace-nowrap text-[11px] tabular-nums sm:text-xs"
                        }`}
                      >
                        {bar.label}
                        {bar.sublabel ? (
                          <span className="mt-0.5 block text-[11px] font-medium tabular-nums text-slate-400">
                            {bar.sublabel}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-4 pt-2.5 pb-3 sm:grid-cols-4 sm:gap-3 sm:px-5 sm:pt-3 sm:pb-3.5">
          <KpiTile label="People reached">
            <KpiNumber
              value={loading ? "—" : String(data?.peopleReached ?? 0)}
              hint="touched in this window"
            />
          </KpiTile>
          <KpiTile label="Planned remaining">
            <KpiNumber
              value={loading ? "—" : String(data?.plannedRemaining ?? 0)}
              hint="still queued to send"
            />
          </KpiTile>
          <KpiTile label="Connect rate">
            <CampaignCompactDial
              label="Connect"
              numerator={connectRate.numerator}
              denominator={connectRate.denominator}
              muted={connectRate.denominator <= 0}
              size="sm"
            />
          </KpiTile>
          <KpiTile label="Replies">
            <CampaignReplyMix
              positive={replies.positive}
              negative={replies.negative}
              other={replies.other}
              size="sm"
            />
          </KpiTile>
        </div>
        {fuelNote ? (
          <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-950 sm:px-5">
            {fuelNote}
          </p>
        ) : null}
    </div>
  );
}
