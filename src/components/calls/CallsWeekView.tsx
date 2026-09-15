"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CallRow } from "@/lib/callRow";
import { CallsCalendarKey } from "@/components/calls/CallsCalendarKey";
import { callMatchesSearch } from "@/lib/calls/callSearch";
import {
  blockedSlotCalendarClass,
  callStatusCalendarClass,
  formatCompactTime,
  getCallDisplayName,
} from "@/lib/callStatusUi";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type {
  CalendarBusyBlock,
  CalendarViewType,
} from "@/lib/calls/calendarView";

type CalendarRange = "day" | "week" | "month";

type Props = {
  calls: CallRow[];
  timezone: string;
  selectedCalendarNames: Set<string> | null;
  selectedCoachIds: Set<string> | null;
  viewType: CalendarViewType;
  search?: string;
  settingsHref?: string;
  onSelectCall?: (row: CallRow) => void;
};

const GRID_START_HOUR = 7;
const GRID_HOURS = 14;
const HOUR_PX = 64;
const MONTH_VISIBLE = 3;

function startOfWeekMonday(dt: DateTime): DateTime {
  const weekday = dt.weekday;
  return dt.startOf("day").minus({ days: weekday - 1 });
}

function filterCalls(
  calls: CallRow[],
  selectedCalendarNames: Set<string> | null,
  selectedCoachIds: Set<string> | null
): CallRow[] {
  return calls.filter((c) => {
    if (selectedCalendarNames && selectedCalendarNames.size > 0) {
      const name = c.calendar_name ?? c.title ?? "";
      if (!selectedCalendarNames.has(name)) return false;
    }
    if (selectedCoachIds && selectedCoachIds.size > 0) {
      if (!c.coach_id || !selectedCoachIds.has(c.coach_id)) return false;
    }
    return true;
  });
}

function groupByDay(
  calls: CallRow[],
  timezone: string,
  keys: string[]
): Map<string, CallRow[]> {
  const byDay = new Map<string, CallRow[]>();
  for (const key of keys) byDay.set(key, []);
  for (const call of calls) {
    if (!call.start_time) continue;
    const key = DateTime.fromISO(call.start_time, { zone: timezone }).toISODate();
    if (!key || !byDay.has(key)) continue;
    byDay.get(key)!.push(call);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  }
  return byDay;
}

function formatEventCardTimeRange(start: DateTime, end: DateTime): string {
  const sameMeridiem = start.toFormat("a") === end.toFormat("a");
  const clock = (dt: DateTime, omitMeridiem: boolean) => {
    const meridiem = dt.toFormat("a").toLowerCase();
    const hour12 = dt.hour % 12 || 12;
    const core =
      dt.minute === 0
        ? String(hour12)
        : `${hour12}:${String(dt.minute).padStart(2, "0")}`;
    return omitMeridiem ? core : `${core}${meridiem}`;
  };
  return `${clock(start, sameMeridiem)} – ${clock(end, false)}`;
}

function EventCardCopy({
  title,
  timeRange,
}: {
  title: string;
  timeRange: string;
}) {
  return (
    <>
      <div className="truncate text-[14px] font-semibold leading-tight">
        {title}
      </div>
      <div className="truncate text-[14px] font-medium leading-tight opacity-90">
        {timeRange}
      </div>
    </>
  );
}

const timedEventCardInsetClass = "absolute left-0 right-2";

function busyOverlapsDay(
  block: CalendarBusyBlock,
  day: DateTime,
  timezone: string
): boolean {
  const dayStart = day.startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });
  const start = DateTime.fromISO(block.starts_at, { zone: timezone });
  const end = DateTime.fromISO(block.ends_at, { zone: timezone });
  if (!start.isValid || !end.isValid) return false;
  return start < dayEnd && end > dayStart;
}

function TimedDayGrid({
  days,
  timezone,
  byDay,
  busyBlocks,
  showAppointments,
  showBlocked,
  now,
  onSelectCall,
  onDayHeaderClick,
}: {
  days: DateTime[];
  timezone: string;
  byDay: Map<string, CallRow[]>;
  busyBlocks: CalendarBusyBlock[];
  showAppointments: boolean;
  showBlocked: boolean;
  now: DateTime;
  onSelectCall?: (row: CallRow) => void;
  onDayHeaderClick?: (day: DateTime) => void;
}) {
  const hours = Array.from({ length: GRID_HOURS }, (_, i) => i + GRID_START_HOUR);
  const colTemplate = `4.25rem repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className={days.length > 1 ? "min-w-[720px]" : "min-w-[320px]"}>
        <div
          className="grid border-b border-slate-100"
          style={{ gridTemplateColumns: colTemplate }}
        >
          <div />
          {days.map((d) => {
            const isToday = d.hasSame(now, "day");
            const headerClass = `px-2 py-2 text-center text-xs font-semibold ${
              isToday ? "text-sky-700" : "text-slate-600"
            } ${onDayHeaderClick ? "hover:bg-slate-50" : ""}`;
            const label = (
              <>
                <div>{d.toFormat("ccc")}</div>
                <div className="text-sm">{d.toFormat("d")}</div>
              </>
            );
            if (onDayHeaderClick) {
              return (
                <button
                  key={d.toISODate()}
                  type="button"
                  onClick={() => onDayHeaderClick(d)}
                  className={headerClass}
                >
                  {label}
                </button>
              );
            }
            return (
              <div key={d.toISODate()} className={headerClass}>
                {label}
              </div>
            );
          })}
        </div>

        {showBlocked &&
        busyBlocks.some((block) => days.some((d) => busyOverlapsDay(block, d, timezone) && block.all_day)) ? (
          <div
            className="grid border-b border-slate-100"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div className="px-1 py-1 text-[13px] font-medium text-slate-700">
              All day
            </div>
            {days.map((d) => {
              const allDay = busyBlocks.filter(
                (block) =>
                  block.all_day && busyOverlapsDay(block, d, timezone)
              );
              return (
                <div
                  key={`${d.toISODate()}-allday`}
                  className="min-h-[1.75rem] space-y-0.5 border-l border-slate-100 px-1 py-1"
                >
                  {allDay.map((block) => (
                    <div
                      key={block.id}
                      className={`truncate rounded-sm border px-1 py-0.5 text-[10px] font-semibold ${blockedSlotCalendarClass}`}
                      title={block.title}
                    >
                      {block.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          className="relative grid"
          style={{ gridTemplateColumns: colTemplate }}
        >
          <div className="border-r border-slate-100">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-slate-50 pr-2 pt-0.5 text-right text-[13px] font-medium leading-none text-slate-700"
                style={{ height: HOUR_PX }}
              >
                {DateTime.fromObject({ hour: h }).toFormat("h a")}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const key = d.toISODate()!;
            const dayCalls = showAppointments ? byDay.get(key) ?? [] : [];
            const dayBusy = showBlocked
              ? busyBlocks.filter(
                  (block) =>
                    !block.all_day && busyOverlapsDay(block, d, timezone)
                )
              : [];
            const isToday = d.hasSame(now, "day");
            const dayStart = d.set({ hour: GRID_START_HOUR, minute: 0 });
            const dayEnd = d.startOf("day").plus({ days: 1 });
            return (
              <div
                key={key}
                className={`relative border-r border-slate-100 ${
                  isToday ? "bg-sky-50/30" : ""
                }`}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-slate-50"
                    style={{ height: HOUR_PX }}
                  />
                ))}
                {dayBusy.map((block) => {
                  const start = DateTime.fromISO(block.starts_at, {
                    zone: timezone,
                  });
                  const end = DateTime.fromISO(block.ends_at, {
                    zone: timezone,
                  });
                  const clipStart = start < dayStart ? dayStart : start;
                  const clipEnd = end > dayEnd ? dayEnd : end;
                  const topMin = Math.max(
                    0,
                    clipStart.diff(dayStart, "minutes").minutes
                  );
                  const dur = Math.max(
                    20,
                    clipEnd.diff(clipStart, "minutes").minutes
                  );
                  const top = (topMin / 60) * HOUR_PX;
                  const height = (dur / 60) * HOUR_PX;
                  return (
                    <div
                      key={block.id}
                      className={`${timedEventCardInsetClass} z-[1] overflow-hidden rounded-r-md border px-1.5 py-1 text-left ${blockedSlotCalendarClass}`}
                      style={{
                        top,
                        height: Math.min(height, HOUR_PX * GRID_HOURS - top),
                      }}
                      title={`${block.title} · ${formatEventCardTimeRange(clipStart, clipEnd)}`}
                    >
                      <EventCardCopy
                        title={block.title}
                        timeRange={formatEventCardTimeRange(clipStart, clipEnd)}
                      />
                    </div>
                  );
                })}
                {dayCalls.map((call) => {
                  if (!call.start_time) return null;
                  const start = DateTime.fromISO(call.start_time, {
                    zone: timezone,
                  });
                  const end = call.end_time
                    ? DateTime.fromISO(call.end_time, { zone: timezone })
                    : start.plus({ minutes: 30 });
                  const topMin = Math.max(
                    0,
                    start.diff(dayStart, "minutes").minutes
                  );
                  const dur = Math.max(20, end.diff(start, "minutes").minutes);
                  const top = (topMin / 60) * HOUR_PX;
                  const height = (dur / 60) * HOUR_PX;
                  return (
                    <button
                      key={call.id}
                      type="button"
                      onClick={() => onSelectCall?.(call)}
                      className={`${timedEventCardInsetClass} z-10 overflow-hidden rounded-r-md border px-1.5 py-1 text-left shadow-sm ${callStatusCalendarClass(call.status_normalized)}`}
                      style={{
                        top,
                        height: Math.min(height, HOUR_PX * GRID_HOURS - top),
                      }}
                      title={`${getCallDisplayName(call)} · ${call.prospect_name} · ${formatEventCardTimeRange(start, end)}`}
                    >
                      <EventCardCopy
                        title={call.prospect_name || getCallDisplayName(call)}
                        timeRange={formatEventCardTimeRange(start, end)}
                      />
                    </button>
                  );
                })}
                {isToday ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-rose-500"
                    style={{
                      top: Math.max(
                        0,
                        (now.diff(dayStart, "minutes").minutes / 60) * HOUR_PX
                      ),
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CallsWeekView({
  calls,
  timezone,
  selectedCalendarNames,
  selectedCoachIds,
  viewType,
  search = "",
  settingsHref,
  onSelectCall,
}: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const [anchor, setAnchor] = useState(() => new Date());
  const [range, setRange] = useState<CalendarRange>("week");
  const [busyBlocks, setBusyBlocks] = useState<CalendarBusyBlock[]>([]);
  const [busyConnected, setBusyConnected] = useState(true);
  const [busyError, setBusyError] = useState<string | null>(null);
  const [busyLoading, setBusyLoading] = useState(false);

  const now = DateTime.now().setZone(timezone);
  const cursor = DateTime.fromJSDate(anchor).setZone(timezone).startOf("day");
  const weekStart = startOfWeekMonday(cursor);
  const monthStart = cursor.startOf("month");
  const monthGridStart = startOfWeekMonday(monthStart);

  const days = useMemo(() => {
    if (range === "day") return [cursor];
    if (range === "week") {
      return Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));
    }
    return Array.from({ length: 42 }, (_, i) =>
      monthGridStart.plus({ days: i })
    );
  }, [range, cursor, weekStart, monthGridStart]);

  const rangeStartIso = days[0]?.startOf("day").toUTC().toISO() ?? "";
  const rangeEndIso =
    days[days.length - 1]?.endOf("day").toUTC().toISO() ?? "";

  useEffect(() => {
    if (!rangeStartIso || !rangeEndIso) return;
    let cancelled = false;
    setBusyLoading(true);
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) {
        if (!cancelled) {
          setBusyBlocks([]);
          setBusyConnected(false);
          setBusyError(null);
          setBusyLoading(false);
        }
        return;
      }
      const res = await fetch(
        `/api/coach/calendar-busy?from=${encodeURIComponent(rangeStartIso)}&to=${encodeURIComponent(rangeEndIso)}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as {
        intervals?: CalendarBusyBlock[];
        connected?: boolean;
        calendar_error?: string | null;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setBusyBlocks([]);
        setBusyError(body.error || "Could not load calendar events.");
        setBusyLoading(false);
        return;
      }
      setBusyBlocks(Array.isArray(body.intervals) ? body.intervals : []);
      setBusyConnected(body.connected !== false);
      setBusyError(body.calendar_error?.trim() || null);
      setBusyLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeStartIso, rangeEndIso, impersonatingCoachId]);

  const showAppointments = viewType !== "blocked";
  const showBlocked = viewType !== "appointments";

  const filtered = useMemo(() => {
    const rows = filterCalls(calls, selectedCalendarNames, selectedCoachIds);
    if (!search.trim()) return rows;
    return rows.filter((row) => callMatchesSearch(row, search));
  }, [calls, selectedCalendarNames, selectedCoachIds, search]);

  const dayKeys = days.map((d) => d.toISODate()!);
  const byDay = useMemo(
    () => groupByDay(filtered, timezone, dayKeys),
    [filtered, timezone, dayKeys]
  );

  const rangeLabel =
    range === "day"
      ? cursor.toFormat("EEEE d MMMM yyyy")
      : range === "week"
        ? `${weekStart.toFormat("d MMM")} – ${weekStart
            .plus({ days: 6 })
            .toFormat("d MMM yyyy")}`
        : monthStart.toFormat("MMMM yyyy");

  function step(direction: -1 | 1) {
    const unit =
      range === "day" ? "days" : range === "week" ? "weeks" : "months";
    const base = range === "month" ? monthStart : range === "week" ? weekStart : cursor;
    setAnchor(base.plus({ [unit]: direction }).toJSDate());
  }

  function goToDay(day: DateTime) {
    setAnchor(day.toJSDate());
    setRange("day");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            aria-label={`Previous ${range}`}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Next ${range}`}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => step(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-slate-900">{rangeLabel}</p>
          <div
            className="inline-flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-white"
            role="group"
            aria-label="Calendar range"
          >
            {(
              [
                ["day", "Day"],
                ["week", "Week"],
                ["month", "Month"],
              ] as const
            ).map(([value, label]) => {
              const selected = range === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRange(value)}
                  className={`px-2.5 text-xs font-semibold ${
                    selected
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
          <CallsCalendarKey />
          <p className="text-xs text-slate-500">
            {timezone}
            {viewType !== "appointments" &&
            !busyLoading &&
            !busyConnected &&
            !busyError
              ? " · Connect Google or Outlook in Settings to see calendar events"
              : null}
          </p>
        </div>
      </div>

      {viewType !== "appointments" && busyError ? (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
          <p>{busyError}</p>
          {settingsHref ? (
            <p className="mt-1">
              <Link
                href={settingsHref}
                className="font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2 hover:text-amber-800"
              >
                Open Settings to connect again
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {range === "month" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {Array.from({ length: 7 }, (_, i) =>
                monthGridStart.plus({ days: i })
              ).map((d) => (
                <div
                  key={d.toFormat("ccc")}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  {d.toFormat("ccc")}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = d.toISODate()!;
                const inMonth = d.hasSame(monthStart, "month");
                const isToday = d.hasSame(now, "day");
                const dayCalls = showAppointments ? byDay.get(key) ?? [] : [];
                const dayBusy = showBlocked
                  ? busyBlocks.filter((block) => busyOverlapsDay(block, d, timezone))
                  : [];
                const visibleBusy = dayBusy.slice(0, Math.max(0, MONTH_VISIBLE - dayCalls.length));
                const extra = Math.max(
                  0,
                  dayCalls.length + dayBusy.length - MONTH_VISIBLE
                );
                return (
                  <div
                    key={key}
                    className={`min-h-[7.5rem] border-b border-r border-slate-100 p-1.5 ${
                      isToday ? "bg-sky-50/40" : inMonth ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => goToDay(d)}
                      className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-sky-600 text-white"
                          : inMonth
                            ? "text-slate-800 hover:bg-slate-100"
                            : "text-slate-400 hover:bg-slate-100"
                      }`}
                      aria-label={`Open ${d.toFormat("d MMMM")}`}
                    >
                      {d.toFormat("d")}
                    </button>
                    <ul className="space-y-0.5">
                      {visibleBusy.map((block) => (
                        <li key={block.id}>
                          <div
                            className={`truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold ${blockedSlotCalendarClass}`}
                            title={block.title}
                          >
                            {block.title}
                          </div>
                        </li>
                      ))}
                      {dayCalls
                        .slice(0, Math.max(0, MONTH_VISIBLE - visibleBusy.length))
                        .map((call) => {
                        const start = call.start_time
                          ? DateTime.fromISO(call.start_time, { zone: timezone })
                          : null;
                        return (
                          <li key={call.id}>
                            <button
                              type="button"
                              onClick={() => onSelectCall?.(call)}
                              className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold ${callStatusCalendarClass(
                                call.status_normalized
                              )}`}
                              title={`${getCallDisplayName(call)} · ${call.prospect_name}`}
                            >
                              {start ? `${formatCompactTime(start.toJSDate())} ` : ""}
                              {call.prospect_name || getCallDisplayName(call)}
                            </button>
                          </li>
                        );
                      })}
                      {extra > 0 ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => goToDay(d)}
                            className="w-full px-1 text-left text-[10px] font-semibold text-sky-700 hover:underline"
                          >
                            +{extra} more
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <TimedDayGrid
          days={days}
          timezone={timezone}
          byDay={byDay}
          busyBlocks={busyBlocks}
          showAppointments={showAppointments}
          showBlocked={showBlocked}
          now={now}
          onSelectCall={onSelectCall}
          onDayHeaderClick={range === "week" ? goToDay : undefined}
        />
      )}
    </div>
  );
}
