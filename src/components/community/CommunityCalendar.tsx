"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MapPin,
  Link as LinkIcon,
} from "lucide-react";
import { DateTime } from "luxon";

import { supabaseClient } from "@/lib/supabaseClient";
import {
  communityCalendarMondayStart,
  expandCommunityCalendar,
} from "@/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import {
  COMMUNITY_CALENDAR_TIMEZONES,
  defaultCommunityCalendarTimezone,
} from "@/lib/communityCalendarTimezones";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import { AddCommunityEventModal } from "@/components/community/AddCommunityEventModal";
import { CommunityCalendarEventModal } from "@/components/community/CommunityCalendarEventModal";

const LIST_PAGE_SIZE = 6;

const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Week time-grid: pixels per hour (scrollable 24h). */
const WEEK_PX_PER_HOUR = 52;
const WEEK_TOTAL_MINUTES = 24 * 60;
const WEEK_HEADER_ROW_PX = 52;
const weekBodyHeightPx = 24 * WEEK_PX_PER_HOUR;
const weekMinuteScale = weekBodyHeightPx / WEEK_TOTAL_MINUTES;

/** Time gutter + seven equal day columns (header + body share this template). */
const WEEK_GRID_CLASS =
  "grid w-full min-w-[44rem] grid-cols-[3.5rem_repeat(7,minmax(5.25rem,1fr))]";

type CalendarLayout = "month" | "week";

type WeekSegment = {
  occurrence: CommunityCalendarOccurrence;
  start: DateTime;
  end: DateTime;
  dayIndex: number;
  lane: number;
  laneCount: number;
};

type Props = {
  addModalOpen: boolean;
  onAddModalOpenChange: (open: boolean) => void;
  canAddEvent?: boolean;
};

function zonedDateKey(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(tz).toISODate() ?? "";
}

/** Short place-style label from IANA id (e.g. Europe/London → "London"). */
function timeZoneCityLabel(iana: string): string {
  if (iana === "UTC") return "UTC";
  const parts = iana.split("/");
  const tail = parts[parts.length - 1] ?? iana;
  return tail.replace(/_/g, " ");
}

function layoutWeekSegments(
  occurrences: CommunityCalendarOccurrence[],
  weekMonday: DateTime,
  viewTz: string
): WeekSegment[] {
  type Raw = {
    occurrence: CommunityCalendarOccurrence;
    start: DateTime;
    end: DateTime;
    dayIndex: number;
  };
  const raw: Raw[] = [];
  for (const occ of occurrences) {
    const s = DateTime.fromISO(occ.startsAtIso, { zone: "utc" }).setZone(
      viewTz
    );
    const e = DateTime.fromISO(occ.endsAtIso, { zone: "utc" }).setZone(viewTz);
    for (let i = 0; i < 7; i++) {
      const day = weekMonday.plus({ days: i });
      const ds = day.startOf("day");
      const de = day.endOf("day");
      const cs = s > ds ? s : ds;
      const ce = e < de ? e : de;
      if (ce > cs) {
        raw.push({ occurrence: occ, start: cs, end: ce, dayIndex: i });
      }
    }
  }

  const byDay: Raw[][] = Array.from({ length: 7 }, () => []);
  for (const seg of raw) {
    byDay[seg.dayIndex].push(seg);
  }

  const out: WeekSegment[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const segs = byDay[dayIndex];
    segs.sort((a, b) => a.start.toMillis() - b.start.toMillis());
    const lanes: Raw[][] = [];
    for (const seg of segs) {
      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (!last || last.end.toMillis() <= seg.start.toMillis()) {
          lane.push(seg);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([seg]);
    }
    const laneCount = Math.max(1, lanes.length);
    for (let lane = 0; lane < lanes.length; lane++) {
      for (const seg of lanes[lane]) {
        out.push({ ...seg, lane, laneCount });
      }
    }
  }
  return out;
}

function minutesInDay(dt: DateTime): number {
  return (
    dt.hour * 60 +
    dt.minute +
    (dt.second + dt.millisecond / 1000) / 60
  );
}

function formatWeekBlockRange(start: DateTime, end: DateTime, tz: string): string {
  const a = start.setZone(tz);
  const b = end.setZone(tz);
  const sameDay = a.toISODate() === b.toISODate();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) {
    return `${fmt.format(a.toJSDate())} – ${fmt.format(b.toJSDate())}`;
  }
  return `${fmt.format(a.toJSDate())} – ${fmt.format(b.toJSDate())}`;
}

function formatRangeLabel(
  start: DateTime,
  end: DateTime,
  tz: string
): string {
  const a = start.setZone(tz);
  const b = end.setZone(tz);
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  const sameDay = a.toISODate() === b.toISODate();
  if (sameDay) {
    return `${dayFmt.format(a.toJSDate())} @ ${timeFmt.format(
      a.toJSDate()
    )} – ${timeFmt.format(b.toJSDate())}`;
  }
  return `${dayFmt.format(a.toJSDate())}, ${timeFmt.format(
    a.toJSDate()
  )} – ${dayFmt.format(b.toJSDate())}, ${timeFmt.format(b.toJSDate())}`;
}

export function CommunityCalendar({
  addModalOpen,
  onAddModalOpenChange,
  canAddEvent = false,
}: Props) {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>("week");
  const [viewTz, setViewTz] = useState(defaultCommunityCalendarTimezone);
  const [focusDate, setFocusDate] = useState(() => {
    const z = defaultCommunityCalendarTimezone();
    return DateTime.now().setZone(z).startOf("day");
  });
  const [rows, setRows] = useState<CommunityCalendarEventRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const tzPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tzPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = tzPickerRef.current;
      if (el && !el.contains(e.target as Node)) setTzPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [tzPickerOpen]);

  useEffect(() => {
    setFocusDate((d) => d.setZone(viewTz).startOf("day"));
  }, [viewTz]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabaseClient
        .from("community_calendar_events")
        .select(
          "id, created_by, title, description, cover_image_url, starts_at, ends_at, display_timezone, location_kind, location_url, is_recurring, recurrence, created_at, updated_at"
        )
        .order("starts_at", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as CommunityCalendarEventRow[]);
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      const hint = communityAccessHint(msg);
      setLoadError(
        [msg, hint ?? ""].filter(Boolean).join("\n\n") ||
          "Could not load calendar."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, refreshNonce]);

  const monthRange = useMemo(() => {
    const vm = focusDate.setZone(viewTz);
    const start = vm.startOf("month");
    const end = vm.endOf("month");
    return { start, end };
  }, [focusDate, viewTz]);

  const weekMonday = useMemo(() => {
    const d = focusDate.setZone(viewTz).startOf("day");
    return communityCalendarMondayStart(d);
  }, [focusDate, viewTz]);

  const weekRangeUtc = useMemo(() => {
    const start = weekMonday.startOf("day");
    const end = weekMonday.plus({ days: 6 }).endOf("day");
    return { startUtc: start.toUTC(), endUtc: end.toUTC() };
  }, [weekMonday]);

  const gridStart = useMemo(() => {
    const first = focusDate.setZone(viewTz).startOf("month");
    const back = luxonToMon0Sun6(first.weekday);
    return first.minus({ days: back });
  }, [focusDate, viewTz]);

  const gridCells = useMemo(() => {
    const cells: DateTime[] = [];
    let d = gridStart;
    for (let i = 0; i < 42; i++) {
      cells.push(d);
      d = d.plus({ days: 1 });
    }
    return cells;
  }, [gridStart]);

  /** Month (and year) the grid is centred on — used to dim leading/trailing cells. */
  const visibleMonth = useMemo(
    () => focusDate.setZone(viewTz),
    [focusDate, viewTz],
  );

  const occurrencesInMonth = useMemo(() => {
    return expandCommunityCalendar(rows, monthRange.start, monthRange.end);
  }, [rows, monthRange.start, monthRange.end]);

  const occurrencesInWeek = useMemo(() => {
    return expandCommunityCalendar(
      rows,
      weekRangeUtc.startUtc,
      weekRangeUtc.endUtc
    );
  }, [rows, weekRangeUtc.startUtc, weekRangeUtc.endUtc]);

  const weekSegments = useMemo(
    () => layoutWeekSegments(occurrencesInWeek, weekMonday, viewTz),
    [occurrencesInWeek, weekMonday, viewTz]
  );

  const weekSegmentsByDay = useMemo(() => {
    const buckets: WeekSegment[][] = Array.from({ length: 7 }, () => []);
    for (const seg of weekSegments) {
      if (seg.dayIndex >= 0 && seg.dayIndex <= 6) {
        buckets[seg.dayIndex].push(seg);
      }
    }
    return buckets;
  }, [weekSegments]);

  const weekGridAriaLabel = useMemo(() => {
    const a = weekMonday.setZone(viewTz);
    const b = weekMonday.plus({ days: 6 }).setZone(viewTz);
    return `Week of ${a.toFormat("MMM d")} to ${b.toFormat("MMM d, yyyy")}`;
  }, [weekMonday, viewTz]);

  const weekNowLine = useMemo(() => {
    void nowTick;
    const now = DateTime.now().setZone(viewTz);
    const todayKey = now.toISODate() ?? "";
    const weekEndKey = weekMonday.plus({ days: 6 }).toISODate() ?? "";
    const weekStartKey = weekMonday.toISODate() ?? "";
    if (todayKey < weekStartKey || todayKey > weekEndKey) return null;
    const mins = minutesInDay(now);
    const top = (mins / WEEK_TOTAL_MINUTES) * (24 * WEEK_PX_PER_HOUR);
    return { top };
  }, [viewTz, weekMonday, nowTick]);

  const byDayKey = useMemo(() => {
    const m = new Map<string, typeof occurrencesInMonth>();
    for (const o of occurrencesInMonth) {
      const k = zonedDateKey(o.startsAtIso, viewTz);
      const arr = m.get(k) ?? [];
      arr.push(o);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime()
      );
    }
    return m;
  }, [occurrencesInMonth, viewTz]);

  const listOccurrences = useMemo(() => {
    const now = DateTime.now().setZone(viewTz).startOf("day");
    const end = now.plus({ days: 120 });
    return expandCommunityCalendar(rows, now, end);
  }, [rows, viewTz]);

  const listTotalPages = Math.max(
    1,
    Math.ceil(listOccurrences.length / LIST_PAGE_SIZE)
  );

  useEffect(() => {
    if (listPage > listTotalPages) setListPage(listTotalPages);
  }, [listPage, listTotalPages]);

  const listSlice = useMemo(() => {
    const from = (listPage - 1) * LIST_PAGE_SIZE;
    return listOccurrences.slice(from, from + LIST_PAGE_SIZE);
  }, [listOccurrences, listPage]);

  const timeCityLine = useMemo(() => {
    void nowTick;
    const n = DateTime.now().setZone(viewTz);
    const clock = n.toFormat("h:mma").toLowerCase();
    const city = timeZoneCityLabel(viewTz);
    return `${clock} ${city} time`;
  }, [viewTz, nowTick]);

  const todayInView = useMemo(
    () => DateTime.now().setZone(viewTz).toISODate(),
    [viewTz]
  );

  const goToday = () => {
    setFocusDate(DateTime.now().setZone(viewTz).startOf("day"));
    setListPage(1);
  };

  const monthTitle = focusDate.setZone(viewTz).toFormat("MMMM yyyy");

  const tzOffsetLabel = useMemo(() => {
    const ref = weekMonday.setZone(viewTz);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: viewTz,
      timeZoneName: "shortOffset",
    }).formatToParts(ref.toJSDate());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ?? viewTz.replace(/_/g, " ");
  }, [weekMonday, viewTz]);

  const goPrevPeriod = () => {
    setFocusDate((d) => {
      const z = d.setZone(viewTz);
      if (viewMode === "list" || calendarLayout === "month") {
        return z.minus({ months: 1 }).startOf("month");
      }
      return communityCalendarMondayStart(z).minus({ days: 7 });
    });
  };

  const goNextPeriod = () => {
    setFocusDate((d) => {
      const z = d.setZone(viewTz);
      if (viewMode === "list" || calendarLayout === "month") {
        return z.plus({ months: 1 }).startOf("month");
      }
      return communityCalendarMondayStart(z).plus({ days: 7 });
    });
  };

  const periodNavLabel =
    viewMode === "list" || calendarLayout === "month" ? "month" : "week";

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl min-w-0 flex-col gap-5 pt-5 lg:mx-0 lg:pt-6">
        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p className="font-semibold text-rose-900">
              Calendar could not be loaded
            </p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
              {loadError}
            </pre>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              onClick={goToday}
              className="order-2 w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:order-1"
            >
              Today
            </button>

            <div className="order-1 flex flex-1 flex-col items-center sm:order-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label={`Previous ${periodNavLabel}`}
                  onClick={goPrevPeriod}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="min-w-[10rem] text-center text-lg font-bold text-slate-900 sm:text-xl">
                  {monthTitle}
                </h2>
                <button
                  type="button"
                  aria-label={`Next ${periodNavLabel}`}
                  onClick={goNextPeriod}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div
                ref={tzPickerRef}
                className="relative mt-1 flex justify-center px-2"
              >
                <button
                  type="button"
                  onClick={() => setTzPickerOpen((o) => !o)}
                  aria-expanded={tzPickerOpen}
                  aria-haspopup="listbox"
                  aria-label={`${timeCityLine}. Change time zone.`}
                  className="inline max-w-full cursor-pointer border-0 bg-transparent p-0 text-center text-xs font-normal leading-normal text-slate-500 underline decoration-slate-400 decoration-1 underline-offset-2 outline-none hover:text-slate-700 hover:decoration-slate-600 focus-visible:rounded focus-visible:text-slate-800 focus-visible:no-underline focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1"
                >
                  {timeCityLine}
                </button>
                {tzPickerOpen ? (
                  <div
                    role="listbox"
                    aria-label="Time zones"
                    className="absolute left-1/2 top-full z-50 mt-1.5 max-h-56 w-[min(100vw-2rem,18rem)] min-w-[12rem] -translate-x-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
                  >
                    {[...new Set([viewTz, ...COMMUNITY_CALENDAR_TIMEZONES])].map(
                      (z) => {
                        const city = timeZoneCityLabel(z);
                        const selected = z === viewTz;
                        return (
                          <button
                            key={z}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              setViewTz(z);
                              setTzPickerOpen(false);
                            }}
                            className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs transition hover:bg-slate-50 ${
                              selected
                                ? "bg-sky-50 font-medium text-slate-900"
                                : "text-slate-700"
                            }`}
                          >
                            <span>{city}</span>
                            <span className="font-normal text-[10px] text-slate-500">
                              {z.replace(/_/g, " ")}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="order-3 flex flex-wrap items-center justify-end gap-2 self-end sm:self-start">
              {viewMode === "calendar" ? (
                <div className="relative">
                  <label htmlFor="community-calendar-layout" className="sr-only">
                    Calendar layout
                  </label>
                  <select
                    id="community-calendar-layout"
                    value={calendarLayout}
                    onChange={(e) =>
                      setCalendarLayout(e.target.value as CalendarLayout)
                    }
                    className="h-10 cursor-pointer appearance-none rounded-full border border-slate-300 bg-white py-0 pl-3.5 pr-9 text-sm font-medium text-slate-800 shadow-sm outline-none ring-slate-300 hover:border-slate-400 focus-visible:ring-2"
                  >
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-800"
                    aria-hidden
                  />
                </div>
              ) : null}
              <div
                className="inline-flex h-10 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-white shadow-sm"
                role="group"
                aria-label="Calendar or list"
              >
                <button
                  type="button"
                  aria-label="Calendar view"
                  aria-pressed={viewMode === "calendar"}
                  onClick={() => setViewMode("calendar")}
                  className={`flex items-center justify-center px-3 transition ${
                    viewMode === "calendar"
                      ? "bg-sky-100 text-slate-900"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <span
                  className="w-px shrink-0 self-stretch bg-slate-300"
                  aria-hidden
                />
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                  onClick={() => {
                    setViewMode("list");
                    setListPage(1);
                  }}
                  className={`flex items-center justify-center px-3 transition ${
                    viewMode === "list"
                      ? "bg-sky-100 text-slate-900"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ListChecks className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              {canAddEvent ? (
                <button
                  type="button"
                  onClick={() => onAddModalOpenChange(true)}
                  className="mt-2 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  Add event
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="mt-8 text-center text-sm text-slate-500">Loading…</p>
          ) : viewMode === "calendar" ? (
            calendarLayout === "month" ? (
              <div className="mt-6 overflow-x-auto">
                <div className="grid min-w-[640px] grid-cols-7 border border-slate-200">
                  {WEEK_HEADERS.map((h) => (
                    <div
                      key={h}
                      className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-bold text-slate-900"
                    >
                      {h}
                    </div>
                  ))}
                  {gridCells.map((cell) => {
                    const key = cell.toISODate() ?? "";
                    const inMonth =
                      cell.month === visibleMonth.month &&
                      cell.year === visibleMonth.year;
                    const isToday = key === todayInView;
                    const dayEvents = byDayKey.get(key) ?? [];
                    return (
                      <div
                        key={key}
                        className="min-h-[6.5rem] border-b border-r border-slate-200 p-1.5 align-top last:border-r-0"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              inMonth ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
                            {isToday ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white">
                                {cell.day}
                              </span>
                            ) : (
                              <span className="inline-block pt-0.5">
                                {cell.day}
                              </span>
                            )}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <li key={`${ev.eventId}-${ev.startsAtIso}`}>
                              <button
                                type="button"
                                onClick={() => setSelectedOccurrence(ev)}
                                className="line-clamp-2 text-left text-[11px] font-medium leading-snug text-sky-700 hover:underline"
                              >
                                {DateTime.fromISO(ev.startsAtIso, {
                                  zone: "utc",
                                })
                                  .setZone(viewTz)
                                  .toLocaleString({
                                    timeZone: viewTz,
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}{" "}
                                — {ev.title}
                              </button>
                            </li>
                          ))}
                          {dayEvents.length > 3 ? (
                            <li className="text-[10px] text-slate-500">
                              +{dayEvents.length - 3} more
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <div className="min-w-[44rem]">
                  <div
                    className={`${WEEK_GRID_CLASS} items-end border-b border-slate-200 bg-white`}
                    style={{ minHeight: WEEK_HEADER_ROW_PX }}
                  >
                    <div className="flex flex-col justify-end border-r border-slate-200 px-1 pb-2 pt-2">
                      <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {tzOffsetLabel}
                      </span>
                    </div>
                    {WEEK_HEADERS.map((h, i) => {
                      const day = weekMonday.plus({ days: i });
                      const key = day.toISODate() ?? "";
                      const isToday = key === todayInView;
                      const isLast = i === 6;
                      return (
                        <div
                          key={key}
                          className={`border-r border-slate-200 py-2 text-center ${
                            isLast ? "border-r-0" : ""
                          }`}
                          aria-label={`${h} ${day.toFormat("MMMM d")}`}
                        >
                          <div
                            className={`text-[11px] font-bold uppercase tracking-wide ${
                              isToday ? "text-sky-700" : "text-slate-500"
                            }`}
                          >
                            {h}
                          </div>
                          <div className="mt-1 flex justify-center">
                            {isToday ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                                {day.day}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold tabular-nums text-slate-800">
                                {day.day}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative max-h-[70vh] overflow-y-auto">
                    {weekNowLine ? (
                      <div
                        className="pointer-events-none absolute left-1 right-0 z-30 flex items-center"
                        style={{ top: weekNowLine.top }}
                      >
                        <div className="h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-white" />
                        <div className="h-px flex-1 bg-red-500" />
                      </div>
                    ) : null}
                    <div
                      className={WEEK_GRID_CLASS}
                      style={{
                        gridTemplateRows: `${weekBodyHeightPx}px`,
                      }}
                      role="grid"
                      aria-label={weekGridAriaLabel}
                    >
                      <div className="relative z-10 border-r border-slate-200 bg-white">
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div
                            key={hour}
                            className="relative border-b border-slate-100"
                            style={{ height: WEEK_PX_PER_HOUR }}
                          >
                            <span className="absolute right-1 top-0 -translate-y-1/2 text-[11px] tabular-nums text-slate-500">
                              {weekMonday
                                .set({ hour, minute: 0, second: 0 })
                                .setZone(viewTz)
                                .toFormat("h a")}
                            </span>
                          </div>
                        ))}
                      </div>
                      {WEEK_HEADERS.map((h, col) => {
                        const day = weekMonday.plus({ days: col });
                        const dayKey = day.toISODate() ?? `${col}`;
                        const isLast = col === 6;
                        return (
                          <div
                            key={`body-${dayKey}`}
                            className={`relative min-h-0 overflow-hidden border-r border-slate-200 ${
                              isLast ? "border-r-0" : ""
                            } ${col % 2 === 0 ? "bg-slate-50/70" : "bg-white"}`}
                            role="gridcell"
                            aria-label={`${h} ${day.toFormat("MMMM d")}`}
                          >
                            <div
                              className="pointer-events-none absolute inset-0 z-0"
                              style={{
                                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${
                                  WEEK_PX_PER_HOUR - 1
                                }px, rgb(226 232 240) ${WEEK_PX_PER_HOUR - 1}px, rgb(226 232 240) ${WEEK_PX_PER_HOUR}px)`,
                              }}
                            />
                            <div className="relative z-[1] h-full w-full">
                              {weekSegmentsByDay[col].map((seg) => {
                                const ev = seg.occurrence;
                                const top =
                                  minutesInDay(seg.start) * weekMinuteScale;
                                const durMin = seg.end
                                  .diff(seg.start)
                                  .as("minutes");
                                const hPx = Math.max(
                                  22,
                                  durMin * weekMinuteScale
                                );
                                const laneW = 100 / seg.laneCount;
                                const leftPct = seg.lane * laneW;
                                const alt =
                                  ev.eventId.charCodeAt(0) % 2 === 0;
                                const blockClass = alt
                                  ? "border border-sky-500/30 bg-sky-500 text-white shadow-sm"
                                  : "border border-sky-200 bg-sky-100 text-slate-800 shadow-sm";
                                const timeLine = formatWeekBlockRange(
                                  seg.start,
                                  seg.end,
                                  viewTz
                                );
                                const inner = (
                                  <>
                                    <p className="line-clamp-2 text-[11px] font-semibold leading-snug">
                                      {ev.title}
                                    </p>
                                    <p
                                      className={`mt-0.5 text-[10px] font-medium leading-tight ${
                                        alt
                                          ? "text-white/90"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {timeLine}
                                    </p>
                                  </>
                                );
                                return (
                                  <div
                                    key={`${ev.eventId}-${seg.start.toMillis()}-${seg.lane}`}
                                    className="absolute z-[5] px-0.5"
                                    style={{
                                      top,
                                      height: hPx,
                                      left: `calc(${leftPct}% + 2px)`,
                                      width: `calc(${laneW}% - 4px)`,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOccurrence(ev)}
                                      className={`flex h-full w-full flex-col rounded-md px-1.5 py-1 text-left ${blockClass} hover:opacity-95`}
                                    >
                                      {inner}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="mt-6 space-y-3">
              {listOccurrences.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  No upcoming events in the next few months.
                </p>
              ) : (
                listSlice.map((ev) => {
                  const s = DateTime.fromISO(ev.startsAtIso, { zone: "utc" });
                  const e = DateTime.fromISO(ev.endsAtIso, { zone: "utc" });
                  const label = formatRangeLabel(s, e, viewTz);
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedOccurrence(ev)}
                      key={`${ev.eventId}-${ev.startsAtIso}`}
                      className="flex w-full gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300"
                    >
                      <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-28 sm:w-44">
                        {ev.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ev.cover_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            No cover
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-600">{label}</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {ev.title}
                        </h3>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                          {ev.location_kind === "link" &&
                          ev.location_url?.startsWith("http") ? (
                            <>
                              <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                              <a
                                href={ev.location_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-sky-600 hover:underline"
                              >
                                {ev.location_url.replace(/^https?:\/\//, "")}
                              </a>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span>In person</span>
                            </>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}

              {listOccurrences.length > LIST_PAGE_SIZE ? (
                <nav
                  className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  aria-label="Event list pagination"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={listPage <= 1}
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-slate-700">
                      {listPage}
                    </span>
                    <button
                      type="button"
                      disabled={listPage >= listTotalPages}
                      onClick={() =>
                        setListPage((p) => Math.min(listTotalPages, p + 1))
                      }
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-600">
                    {(listPage - 1) * LIST_PAGE_SIZE + 1}-
                    {Math.min(
                      listPage * LIST_PAGE_SIZE,
                      listOccurrences.length
                    )}{" "}
                    of {listOccurrences.length}
                  </p>
                </nav>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {addModalOpen ? (
        <AddCommunityEventModal
          onClose={() => onAddModalOpenChange(false)}
          onCreated={async () => {
            onAddModalOpenChange(false);
            setRefreshNonce((n) => n + 1);
          }}
        />
      ) : null}
      {selectedOccurrence ? (
        <CommunityCalendarEventModal
          occurrence={selectedOccurrence}
          onClose={() => setSelectedOccurrence(null)}
        />
      ) : null}
    </>
  );
}

function luxonToMon0Sun6(weekday: number): number {
  return (weekday + 6) % 7;
}
