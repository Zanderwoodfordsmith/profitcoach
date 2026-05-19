"use client";

import { useMemo, useState } from "react";

export type CoachForChart = {
  joined_at: string | null;
};

export type CoachMonthBucket = {
  key: string;
  label: string;
  newCount: number;
  totalCount: number;
};

type ChartRange = "6" | "12" | "all";
type ChartMode = "new" | "total";

const CHART_HEIGHT_PX = 160;
/** When "all months" has at least this many points, group the x-axis by quarter. */
const COMPACT_AXIS_MONTH_THRESHOLD = 13;
/** When span exceeds two years, add a year row above quarters. */
const COMPACT_AXIS_YEAR_ROW_THRESHOLD = 25;

export type QuarterAxisGroup = {
  key: string;
  label: string;
  monthKeys: string[];
};

export type YearAxisGroup = {
  year: number;
  label: string;
  monthCount: number;
  quarters: QuarterAxisGroup[];
};

/** End-of-quarter snapshot for the total line chart when the axis is compact. */
export type QuarterChartPoint = {
  key: string;
  label: string;
  newCount: number;
  totalCount: number;
};

export type LineChartPoint = {
  key: string;
  label: string;
  value: number;
  newCount: number;
  totalCount: number;
};

function monthKeyFromIso(iso: string): string | null {
  const parsed = Date.parse(
    iso.includes("T") ? iso : `${iso}T12:00:00.000Z`
  );
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonthsToKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let cur = start;
  while (cur <= end) {
    keys.push(cur);
    const next = addMonthsToKey(cur, 1);
    if (next <= cur) break;
    cur = next;
  }
  return keys;
}

export function buildCoachMonthlyBuckets(
  coaches: CoachForChart[]
): CoachMonthBucket[] {
  const newByMonth = new Map<string, number>();

  for (const coach of coaches) {
    if (!coach.joined_at) continue;
    const key = monthKeyFromIso(coach.joined_at);
    if (!key) continue;
    newByMonth.set(key, (newByMonth.get(key) ?? 0) + 1);
  }

  if (newByMonth.size === 0) return [];

  const sortedJoinMonths = [...newByMonth.keys()].sort();
  const firstKey = sortedJoinMonths[0]!;
  const lastJoinKey = sortedJoinMonths[sortedJoinMonths.length - 1]!;
  const endKey =
    currentMonthKey() > lastJoinKey ? currentMonthKey() : lastJoinKey;

  let runningTotal = 0;
  return monthKeysBetween(firstKey, endKey).map((key) => {
    const newCount = newByMonth.get(key) ?? 0;
    runningTotal += newCount;
    return {
      key,
      label: monthLabelFromKey(key),
      newCount,
      totalCount: runningTotal,
    };
  });
}

function niceAxisMaxCount(max: number): number {
  if (max <= 0) return 5;
  const exponent = Math.floor(Math.log10(max));
  const magnitude = 10 ** exponent;
  const normalized = max / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.ceil(nice * magnitude);
}

function buildYAxisTicks(axisMax: number, tickCount = 4): number[] {
  const step = axisMax / tickCount;
  return Array.from({ length: tickCount + 1 }, (_, i) => Math.round(i * step));
}

function bucketValue(bucket: CoachMonthBucket, mode: ChartMode): number {
  return mode === "new" ? bucket.newCount : bucket.totalCount;
}

function valueToBottomPx(value: number, axisMax: number): number {
  return axisMax > 0 ? (value / axisMax) * CHART_HEIGHT_PX : 0;
}

function quarterKeyFromMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

function quarterLabelFromKey(quarterKey: string): string {
  const [yearStr, qPart] = quarterKey.split("-");
  const year = Number(yearStr);
  const quarter = Number(qPart?.replace("Q", "") ?? 0);
  if (!year || !quarter) return quarterKey;
  return `Q${quarter} ${year}`;
}

export function buildQuarterAxisGroups(
  buckets: CoachMonthBucket[]
): QuarterAxisGroup[] {
  const groups: QuarterAxisGroup[] = [];

  for (const bucket of buckets) {
    const key = quarterKeyFromMonthKey(bucket.key);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.monthKeys.push(bucket.key);
    } else {
      groups.push({
        key,
        label: quarterLabelFromKey(key),
        monthKeys: [bucket.key],
      });
    }
  }

  return groups;
}

export function buildYearAxisGroups(
  quarterGroups: QuarterAxisGroup[]
): YearAxisGroup[] {
  const years: YearAxisGroup[] = [];

  for (const quarter of quarterGroups) {
    const year = Number(quarter.key.split("-")[0]);
    const last = years[years.length - 1];
    if (last?.year === year) {
      last.quarters.push(quarter);
      last.monthCount += quarter.monthKeys.length;
    } else {
      years.push({
        year,
        label: String(year),
        monthCount: quarter.monthKeys.length,
        quarters: [quarter],
      });
    }
  }

  return years;
}

export function buildQuarterChartPoints(
  monthlyBuckets: CoachMonthBucket[]
): QuarterChartPoint[] {
  return buildQuarterAxisGroups(monthlyBuckets).map((group) => {
    const monthsInQuarter = monthlyBuckets.filter((b) =>
      group.monthKeys.includes(b.key)
    );
    const last = monthsInQuarter[monthsInQuarter.length - 1];
    return {
      key: group.key,
      label: group.label,
      newCount: monthsInQuarter.reduce((sum, b) => sum + b.newCount, 0),
      totalCount: last?.totalCount ?? 0,
    };
  });
}

function buildLinePolylinePoints(
  points: LineChartPoint[],
  axisMax: number
): string {
  const n = points.length;
  if (n === 0) return "";

  return points
    .map((point, i) => {
      const x = ((i + 0.5) / n) * 100;
      const y = 100 - (axisMax > 0 ? (point.value / axisMax) * 100 : 0);
      return `${x},${y}`;
    })
    .join(" ");
}

function toLineChartPoints(
  buckets: CoachMonthBucket[],
  quarterPoints: QuarterChartPoint[],
  useQuarterlyLine: boolean
): LineChartPoint[] {
  if (useQuarterlyLine) {
    return quarterPoints.map((q) => ({
      key: q.key,
      label: q.label,
      value: q.totalCount,
      newCount: q.newCount,
      totalCount: q.totalCount,
    }));
  }
  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: b.totalCount,
    newCount: b.newCount,
    totalCount: b.totalCount,
  }));
}

type Props = {
  coaches: CoachForChart[];
  loading?: boolean;
};

export function CoachesMonthlyBarChart({ coaches, loading }: Props) {
  const [range, setRange] = useState<ChartRange>("12");
  const [mode, setMode] = useState<ChartMode>("new");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const allBuckets = useMemo(
    () => buildCoachMonthlyBuckets(coaches),
    [coaches]
  );

  const buckets = useMemo(() => {
    if (range === "all") return allBuckets;
    const count = range === "6" ? 6 : 12;
    return allBuckets.slice(-count);
  }, [allBuckets, range]);

  const useCompactAxis =
    range === "all" && buckets.length >= COMPACT_AXIS_MONTH_THRESHOLD;

  const useQuarterlyLine = mode === "total" && useCompactAxis;

  const quarterChartPoints = useMemo(
    () => (useCompactAxis ? buildQuarterChartPoints(buckets) : []),
    [buckets, useCompactAxis]
  );

  const linePoints = useMemo(
    () => toLineChartPoints(buckets, quarterChartPoints, useQuarterlyLine),
    [buckets, quarterChartPoints, useQuarterlyLine]
  );

  const maxValue = useMemo(() => {
    if (mode === "total" && useQuarterlyLine) {
      return Math.max(...linePoints.map((p) => p.value), 0);
    }
    return Math.max(...buckets.map((b) => bucketValue(b, mode)), 0);
  }, [buckets, linePoints, mode, useQuarterlyLine]);

  const axisMax = useMemo(() => niceAxisMaxCount(maxValue), [maxValue]);

  const yTicks = useMemo(() => buildYAxisTicks(axisMax, 4), [axisMax]);

  const periodNewTotal = useMemo(
    () => buckets.reduce((sum, b) => sum + b.newCount, 0),
    [buckets]
  );

  const latestTotal =
    buckets.length > 0 ? buckets[buckets.length - 1]!.totalCount : 0;

  const hoveredLinePoint =
    mode === "total"
      ? (linePoints.find((p) => p.key === hoveredKey) ?? null)
      : null;

  const hoveredMonth =
    mode === "new" ? (buckets.find((b) => b.key === hoveredKey) ?? null) : null;

  const coachesWithJoinDate = useMemo(
    () => coaches.filter((c) => c.joined_at && monthKeyFromIso(c.joined_at)),
    [coaches]
  );

  const quarterGroups = useMemo(
    () => (useCompactAxis ? buildQuarterAxisGroups(buckets) : []),
    [buckets, useCompactAxis]
  );

  const yearGroups = useMemo(
    () =>
      useCompactAxis && buckets.length >= COMPACT_AXIS_YEAR_ROW_THRESHOLD
        ? buildYearAxisGroups(quarterGroups)
        : [],
    [buckets.length, quarterGroups, useCompactAxis]
  );

  const showYearAxisRow = yearGroups.length > 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {mode === "new"
              ? "New coaches by month"
              : "Total coaches over time"}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Based on join date (
            {coachesWithJoinDate.length} coach
            {coachesWithJoinDate.length === 1 ? "" : "es"} with a date).
            {hoveredLinePoint ? (
              <span className="ml-1 font-medium text-slate-800">
                {hoveredLinePoint.label}: {hoveredLinePoint.totalCount} total
                {useQuarterlyLine
                  ? ` (+${hoveredLinePoint.newCount} in quarter)`
                  : ""}
              </span>
            ) : hoveredMonth ? (
              <span className="ml-1 font-medium text-slate-800">
                {hoveredMonth.label}: {hoveredMonth.newCount} new
              </span>
            ) : useQuarterlyLine ? (
              <span className="ml-1 text-slate-500">
                One point per quarter (end-of-quarter total). Hover for detail.
              </span>
            ) : useCompactAxis ? (
              <span className="ml-1 text-slate-500">
                Monthly bars; axis grouped by quarter
                {showYearAxisRow ? " and year" : ""}.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-slate-300 p-0.5"
            role="group"
            aria-label="Chart mode"
          >
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                mode === "new"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              aria-pressed={mode === "new"}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setMode("total")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                mode === "total"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              aria-pressed={mode === "total"}
            >
              Total
            </button>
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as ChartRange)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
            aria-label="Month range"
          >
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="all">All months</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading chart…</p>
      ) : buckets.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No coaches with join dates yet.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-500">
            {mode === "new" ? (
              <>
                Period new:{" "}
                <span className="font-semibold text-slate-800">
                  {periodNewTotal}
                </span>
              </>
            ) : (
              <>
                Total at end of period:{" "}
                <span className="font-semibold text-slate-800">{latestTotal}</span>
              </>
            )}
          </p>

          <div
            className="mt-4 flex gap-2"
            role="img"
            aria-label={
              mode === "new"
                ? "Monthly new coach counts"
                : "Cumulative coach totals line chart"
            }
          >
            <div
              className="flex shrink-0 flex-col justify-between pr-1 text-right"
              style={{ height: CHART_HEIGHT_PX + 28 }}
            >
              {[...yTicks].reverse().map((tick) => (
                <span
                  key={tick}
                  className="text-[10px] leading-none text-slate-500 sm:text-xs"
                >
                  {tick}
                </span>
              ))}
              <span className="invisible text-[10px]">0</span>
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="relative border-b border-l border-slate-300 bg-slate-50/50"
                style={{ height: CHART_HEIGHT_PX }}
              >
                {yTicks.slice(1).map((tick) => {
                  const pct = axisMax > 0 ? (tick / axisMax) * 100 : 0;
                  return (
                    <div
                      key={tick}
                      className="pointer-events-none absolute right-0 left-0 border-t border-slate-200/80"
                      style={{ bottom: `${pct}%` }}
                    />
                  );
                })}

                {mode === "total" ? (
                  <div className="absolute inset-0 px-1 sm:px-2">
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full text-sky-600"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        points={buildLinePolylinePoints(linePoints, axisMax)}
                      />
                    </svg>
                    <div
                      className={`absolute inset-0 flex ${
                        useQuarterlyLine ? "gap-0.5 sm:gap-1" : "gap-1 sm:gap-2"
                      }`}
                    >
                      {linePoints.map((point) => {
                        const value = point.value;
                        const bottomPx = valueToBottomPx(value, axisMax);
                        const isHovered = hoveredKey === point.key;

                        return (
                          <div
                            key={point.key}
                            className="relative min-w-0 flex-1"
                            onMouseEnter={() => setHoveredKey(point.key)}
                            onMouseLeave={() => setHoveredKey(null)}
                          >
                            {isHovered ? (
                              <span
                                className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-white/95 px-1 text-center text-[9px] font-semibold leading-tight text-slate-900 shadow-sm sm:text-[10px]"
                                style={{ bottom: bottomPx + 12 }}
                              >
                                {value}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
                              aria-label={`${point.label}: ${value} total coaches`}
                              onFocus={() => setHoveredKey(point.key)}
                              onBlur={() => setHoveredKey(null)}
                            />
                            <span
                              className={`pointer-events-none absolute left-1/2 z-10 rounded-full ring-2 ring-white transition-opacity ${
                                useQuarterlyLine
                                  ? "h-2 w-2 bg-sky-600"
                                  : `h-2 w-2 bg-sky-500 ${isHovered ? "opacity-100" : "opacity-0"}`
                              }`}
                              style={{
                                bottom: bottomPx - 4,
                                transform: "translateX(-50%)",
                              }}
                              aria-hidden
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-end gap-1 px-1 sm:gap-2 sm:px-2">
                    {buckets.map((bucket) => {
                      const value = bucket.newCount;
                      const barHeightPx = Math.max(
                        value > 0 ? 2 : 0,
                        valueToBottomPx(value, axisMax)
                      );
                      const isHovered = hoveredKey === bucket.key;

                    return (
                      <div
                        key={bucket.key}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end"
                        onMouseEnter={() => setHoveredKey(bucket.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                      >
                        {value > 0 ? (
                          <span
                            className={`mb-0.5 max-w-full truncate px-0.5 text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${
                              isHovered ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {value}
                          </span>
                        ) : (
                          <span className="mb-0.5 h-[14px]" aria-hidden />
                        )}
                        <div
                          className={`w-full max-w-[2.75rem] rounded-t-sm bg-sky-500 ${
                            isHovered ? "opacity-100" : "opacity-90"
                          }`}
                          style={{ height: barHeightPx }}
                          title={`${bucket.newCount} new coaches`}
                        />
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              {useCompactAxis ? (
                <div className="mt-1 space-y-0.5 px-1 sm:px-2">
                  {showYearAxisRow ? (
                    <div className="flex gap-1 sm:gap-2">
                      {yearGroups.map((yearGroup) => (
                        <div
                          key={yearGroup.year}
                          className="flex min-w-0 items-center justify-center border-b border-slate-200 pb-0.5"
                          style={{
                            flex: useQuarterlyLine
                              ? yearGroup.quarters.length
                              : yearGroup.monthCount,
                          }}
                        >
                          <span className="truncate text-center text-[10px] font-semibold text-slate-700 sm:text-xs">
                            {yearGroup.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-1 sm:gap-2">
                    {quarterGroups.map((group, groupIndex) => (
                      <div
                        key={group.key}
                        className={`flex min-w-0 flex-col items-center justify-center ${
                          groupIndex > 0 ? "border-l border-slate-200/90" : ""
                        }`}
                        style={{
                          flex: useQuarterlyLine ? 1 : group.monthKeys.length,
                        }}
                      >
                        <span className="max-w-full truncate px-0.5 text-center text-[10px] leading-tight text-slate-600 sm:text-xs">
                          {group.label.replace(" ", "\u00a0")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex gap-1 px-1 sm:gap-2 sm:px-2">
                {buckets.map((bucket) => {
                  const isHovered = hoveredKey === bucket.key;
                  const value = bucketValue(bucket, mode);
                  return (
                    <div
                      key={bucket.key}
                      className="flex min-w-0 flex-1 flex-col items-center"
                    >
                      <span
                        className={`max-w-full truncate text-center text-[10px] leading-tight sm:text-xs ${
                          isHovered
                            ? "font-semibold text-slate-900"
                            : "text-slate-600"
                        }`}
                      >
                        {bucket.label.replace(" ", "\u00a0")}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {mode === "new" ? `${value} new` : `${value} total`}
                      </span>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
