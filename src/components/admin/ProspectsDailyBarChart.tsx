"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  formatProspectLabel,
  formatProspectPersonName,
} from "@/lib/prospectDisplayFormat";

export type ProspectForChart = {
  id: string;
  full_name: string;
  business_name: string | null;
  coach_id?: string;
  coach_name?: string | null;
  coach_business_name?: string | null;
  created_at?: string | null;
};

export type ProspectDayBucket = {
  key: string;
  label: string;
  count: number;
};

type CoachProspectGroup = {
  key: string;
  coachLabel: string;
  prospects: Array<{ id: string; displayName: string }>;
};

type ChartRange = "7" | "14" | "30" | "90";

const CHART_HEIGHT_PX = 160;
const POPOVER_CLOSE_MS = 120;
const POPOVER_WIDTH_PX = 280;
const POPOVER_MAX_HEIGHT = 320;

function dayKeyFromIso(iso: string): string | null {
  const parsed = Date.parse(
    iso.includes("T") ? iso : `${iso}T12:00:00.000Z`
  );
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayLabelFromKey(key: string, compact = false): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  if (compact) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function todayDayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDaysToKey(key: string, delta: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let cur = start;
  while (cur <= end) {
    keys.push(cur);
    const next = addDaysToKey(cur, 1);
    if (next <= cur) break;
    cur = next;
  }
  return keys;
}

function prospectDisplayName(prospect: ProspectForChart): string {
  const name = formatProspectPersonName(prospect.full_name);
  if (name) return name;
  const business = formatProspectLabel(prospect.business_name);
  if (business) return business;
  return "Unnamed prospect";
}

function coachDisplayLabel(prospect: ProspectForChart): string {
  return (
    prospect.coach_name?.trim() ||
    prospect.coach_business_name?.trim() ||
    "Unknown coach"
  );
}

export function buildProspectsByDayKey(
  prospects: ProspectForChart[]
): Map<string, ProspectForChart[]> {
  const map = new Map<string, ProspectForChart[]>();

  for (const prospect of prospects) {
    if (!prospect.created_at) continue;
    const key = dayKeyFromIso(prospect.created_at);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(prospect);
    map.set(key, list);
  }

  return map;
}

export function groupProspectsByCoach(
  prospects: ProspectForChart[]
): CoachProspectGroup[] {
  const groups = new Map<string, CoachProspectGroup>();

  for (const prospect of prospects) {
    const key = prospect.coach_id ?? "unknown";
    const displayName = prospectDisplayName(prospect);
    const existing = groups.get(key);

    if (existing) {
      existing.prospects.push({ id: prospect.id, displayName });
      continue;
    }

    groups.set(key, {
      key,
      coachLabel: coachDisplayLabel(prospect),
      prospects: [{ id: prospect.id, displayName }],
    });
  }

  return [...groups.values()].sort((a, b) =>
    a.coachLabel.localeCompare(b.coachLabel)
  );
}

export function buildProspectDailyBuckets(
  prospects: ProspectForChart[],
  rangeDays: number
): ProspectDayBucket[] {
  const countByDay = new Map<string, number>();

  for (const prospect of prospects) {
    if (!prospect.created_at) continue;
    const key = dayKeyFromIso(prospect.created_at);
    if (!key) continue;
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const endKey = todayDayKey();
  const startKey = addDaysToKey(endKey, -(rangeDays - 1));
  const compact = rangeDays >= 30;

  return dayKeysBetween(startKey, endKey).map((key) => ({
    key,
    label: dayLabelFromKey(key, compact),
    count: countByDay.get(key) ?? 0,
  }));
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

function valueToBottomPx(value: number, axisMax: number): number {
  return axisMax > 0 ? (value / axisMax) * CHART_HEIGHT_PX : 0;
}

function DayBarPopover({
  dayLabel,
  groups,
  isActive,
  onOpenChange,
  children,
  className = "",
}: {
  dayLabel: string;
  groups: CoachProspectGroup[];
  isActive: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const closeTimerRef = useRef<number | null>(null);
  const prospectCount = groups.reduce(
    (sum, group) => sum + group.prospects.length,
    0
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (prospectCount === 0) return;
    clearCloseTimer();
    setOpen(true);
    onOpenChange(true);
  }, [clearCloseTimer, onOpenChange, prospectCount]);

  const scheduleHide = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      onOpenChange(false);
    }, POPOVER_CLOSE_MS);
  }, [clearCloseTimer, onOpenChange]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth = Math.min(POPOVER_WIDTH_PX, window.innerWidth - 24);
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

      const estimatedHeight = Math.min(
        POPOVER_MAX_HEIGHT + 72,
        72 + groups.length * 30 + prospectCount * 22
      );
      let top = rect.bottom + 8;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 8);
      }

      setPosition({ left, top });
    }

    updatePosition();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [groups.length, open, prospectCount]);

  const panel =
    open && position && prospectCount > 0 ? (
      <div
        id={panelId}
        role="tooltip"
        className="fixed z-[220] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
        style={{
          left: position.left,
          top: position.top,
          width: Math.min(POPOVER_WIDTH_PX, window.innerWidth - 24),
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <div className="h-2.5 w-full bg-sky-500" aria-hidden />
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold leading-tight text-slate-900">
            {dayLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {prospectCount} prospect{prospectCount === 1 ? "" : "s"} ·{" "}
            {groups.length} coach{groups.length === 1 ? "" : "es"}
          </p>
          <div
            className="mt-2 space-y-2.5 overflow-y-auto"
            style={{ maxHeight: POPOVER_MAX_HEIGHT }}
          >
            {groups.map((group) => (
              <div key={group.key}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.coachLabel}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {group.prospects.map((prospect) => (
                    <li
                      key={prospect.id}
                      className="truncate px-1.5 py-0.5 text-sm leading-snug text-slate-800"
                    >
                      {prospect.displayName}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={`block h-full w-full cursor-pointer ${className}`.trim()}
        style={
          open && isActive
            ? {
                filter: "brightness(1.08) saturate(1.1)",
              }
            : undefined
        }
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        aria-describedby={open ? panelId : undefined}
      >
        {children}
      </span>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}

type Props = {
  prospects: ProspectForChart[];
  loading?: boolean;
};

export function ProspectsDailyBarChart({ prospects, loading }: Props) {
  const [range, setRange] = useState<ChartRange>("30");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const rangeDays = Number(range);

  const prospectsByDay = useMemo(
    () => buildProspectsByDayKey(prospects),
    [prospects]
  );

  const buckets = useMemo(
    () => buildProspectDailyBuckets(prospects, rangeDays),
    [prospects, rangeDays]
  );

  const maxValue = useMemo(
    () => Math.max(...buckets.map((b) => b.count), 0),
    [buckets]
  );

  const axisMax = useMemo(() => niceAxisMaxCount(maxValue), [maxValue]);
  const yTicks = useMemo(() => buildYAxisTicks(axisMax, 4), [axisMax]);

  const periodTotal = useMemo(
    () => buckets.reduce((sum, b) => sum + b.count, 0),
    [buckets]
  );

  const prospectsWithDate = useMemo(
    () => prospects.filter((p) => p.created_at && dayKeyFromIso(p.created_at)),
    [prospects]
  );

  const hoveredDay = buckets.find((b) => b.key === hoveredKey) ?? null;

  const showEveryNthLabel = rangeDays >= 90 ? 7 : rangeDays >= 30 ? 3 : 1;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            New prospects by day
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Based on when each prospect was added (
            {prospectsWithDate.length} prospect
            {prospectsWithDate.length === 1 ? "" : "s"} with a date).
            {hoveredDay ? (
              <span className="ml-1 font-medium text-slate-800">
                {hoveredDay.label}: {hoveredDay.count} new
              </span>
            ) : null}
          </p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as ChartRange)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
          aria-label="Day range"
        >
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading chart…</p>
      ) : buckets.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No prospects with creation dates yet.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Period total:{" "}
            <span className="font-semibold text-slate-800">{periodTotal}</span>
          </p>

          <div
            className="mt-4 flex gap-2"
            role="img"
            aria-label="Daily new prospect counts"
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

                <div className="absolute inset-0 flex items-end gap-px px-0.5 sm:gap-1 sm:px-1">
                  {buckets.map((bucket) => {
                    const value = bucket.count;
                    const barHeightPx = Math.max(
                      value > 0 ? 2 : 0,
                      valueToBottomPx(value, axisMax)
                    );
                    const isHovered = hoveredKey === bucket.key;
                    const dayProspects = prospectsByDay.get(bucket.key) ?? [];
                    const coachGroups = groupProspectsByCoach(dayProspects);

                    const bar = (
                      <>
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
                          className={`w-full rounded-t-sm bg-sky-500 ${
                            isHovered ? "opacity-100" : "opacity-90"
                          }`}
                          style={{ height: barHeightPx }}
                        />
                      </>
                    );

                    return (
                      <div
                        key={bucket.key}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end"
                      >
                        {value > 0 ? (
                          <DayBarPopover
                            dayLabel={dayLabelFromKey(bucket.key)}
                            groups={coachGroups}
                            isActive={isHovered}
                            onOpenChange={(open) =>
                              setHoveredKey(open ? bucket.key : null)
                            }
                          >
                            {bar}
                          </DayBarPopover>
                        ) : (
                          bar
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-1 flex gap-px px-0.5 sm:gap-1 sm:px-1">
                {buckets.map((bucket, index) => {
                  const isHovered = hoveredKey === bucket.key;
                  const showLabel =
                    index % showEveryNthLabel === 0 ||
                    index === buckets.length - 1;

                  return (
                    <div
                      key={bucket.key}
                      className="flex min-w-0 flex-1 flex-col items-center"
                    >
                      {showLabel ? (
                        <span
                          className={`max-w-full truncate text-center text-[9px] leading-tight sm:text-[10px] ${
                            isHovered
                              ? "font-semibold text-slate-900"
                              : "text-slate-600"
                          }`}
                        >
                          {bucket.label.replace(" ", "\u00a0")}
                        </span>
                      ) : (
                        <span className="h-[14px]" aria-hidden />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
