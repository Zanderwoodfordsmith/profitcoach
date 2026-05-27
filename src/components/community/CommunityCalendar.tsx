"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ListChecks,
  Pencil,
  MapPin,
  Link as LinkIcon,
  Video,
  XCircle,
  Trash2,
} from "lucide-react";
import { DateTime } from "luxon";

import {
  communityCalendarMondayStart,
  expandCommunityCalendar,
  filterCommunityCalendarOccurrencesInRange,
} from "@/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import { communityCalendarOccurrenceKey, communityCalendarExceptionOccurrenceStart } from "@/lib/communityCalendarTypes";
import {
  communityCalendarCoverUrl,
  communityCalendarCancellationHoverTitle,
  communityCalendarCancelledBadgeClass,
  communityCalendarCancelledTextClass,
  communityCalendarHasRecording,
  communityCalendarKickoffHighlightBoxClass,
  communityCalendarKickoffMonthTimeClass,
  communityCalendarKickoffMonthTitleClass,
  communityCalendarKickoffWeekBlockClass,
  communityCalendarKickoffWeekBlockTimeClass,
  communityCalendarRecordingWatchUrl,
  communityCalendarWeekBlockClass,
  communityCalendarWeekBlockTimeClass,
  isLiveCommunityCalendarOccurrence,
  isNewMemberKickoffOccurrence,
} from "@/lib/communityCalendarDisplay";
import { CommunityCalendarCoverImage } from "@/components/community/CommunityCalendarCoverImage";
import {
  COMMUNITY_CALENDAR_TIMEZONES,
  defaultCommunityCalendarTimezone,
} from "@/lib/communityCalendarTimezones";
import {
  cancelCommunityCalendarOccurrence,
  deleteCommunityCalendarEventSeries,
  loadCommunityCalendarData,
  mergeCommunityCalendarOccurrenceState,
} from "@/lib/communityCalendarData";
import {
  communityAccessHint,
  isSupabaseAbortError,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import { AddCommunityEventModal } from "@/components/community/AddCommunityEventModal";
import { CommunityCalendarCancelModal } from "@/components/community/CommunityCalendarCancelModal";
import type { CommunityCalendarCancelScope } from "@/components/community/CommunityCalendarCancelModal";
import { CommunityCalendarEventModal } from "@/components/community/CommunityCalendarEventModal";
import { useBelowBreakpoint } from "@/hooks/useBreakpoint";

const LIST_PAGE_SIZE = 6;

const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const WEEKEND_CELL_BG_CLASS = "bg-slate-200/70";

const BCA_CONFERENCE_YEAR = 2026;
const BCA_CONFERENCE_MONTH = 5;
const BCA_CONFERENCE_START_DAY = 12;
const BCA_CONFERENCE_END_DAY = 13;
const BCA_CONFERENCE_CELL_BG_CLASS = "bg-sky-100/80";

type BcaConferenceMonthCell = {
  isConferenceDay: true;
  showBanner: boolean;
  spanColumns: 1 | 2;
};

function getBcaConferenceMonthCell(
  cell: DateTime,
  cellIndex: number,
  gridCells: DateTime[]
): BcaConferenceMonthCell | null {
  if (
    cell.year !== BCA_CONFERENCE_YEAR ||
    cell.month !== BCA_CONFERENCE_MONTH ||
    cell.day < BCA_CONFERENCE_START_DAY ||
    cell.day > BCA_CONFERENCE_END_DAY
  ) {
    return null;
  }

  const prev = gridCells[cellIndex - 1];
  const next = gridCells[cellIndex + 1];
  const coveredByPrevSpan =
    cell.day === BCA_CONFERENCE_END_DAY &&
    prev?.year === BCA_CONFERENCE_YEAR &&
    prev?.month === BCA_CONFERENCE_MONTH &&
    prev.day === BCA_CONFERENCE_START_DAY &&
    cellIndex % 7 !== 0;
  const canSpanTwo =
    cell.day === BCA_CONFERENCE_START_DAY &&
    next?.year === BCA_CONFERENCE_YEAR &&
    next?.month === BCA_CONFERENCE_MONTH &&
    next.day === BCA_CONFERENCE_END_DAY &&
    cellIndex % 7 !== 6;

  return {
    isConferenceDay: true,
    showBanner: !coveredByPrevSpan,
    spanColumns: canSpanTwo ? 2 : 1,
  };
}

function isWeekendDate(dt: DateTime): boolean {
  return dt.weekday >= 6;
}

const WEEKDAY_COL = "minmax(5.25rem,1fr)";
const WEEKEND_COL_NARROW = "minmax(2.25rem,0.35fr)";
const WEEKEND_COL_WIDE = "minmax(5.25rem,1fr)";

function calendarGridTemplateColumns(
  satExpanded: boolean,
  sunExpanded: boolean,
  includeTimeGutter = false
): string {
  const sat = satExpanded ? WEEKEND_COL_WIDE : WEEKEND_COL_NARROW;
  const sun = sunExpanded ? WEEKEND_COL_WIDE : WEEKEND_COL_NARROW;
  const days = `repeat(5, ${WEEKDAY_COL}) ${sat} ${sun}`;
  return includeTimeGutter ? `3.5rem ${days}` : `repeat(5, minmax(0,1fr)) ${sat} ${sun}`;
}

/** Week time-grid: pixels per hour (scrollable 24h). */
const WEEK_PX_PER_HOUR = 52;
const WEEK_TOTAL_MINUTES = 24 * 60;
const WEEK_HEADER_ROW_PX = 52;
const WEEK_DEFAULT_START_MINUTES = 8 * 60;
const WEEK_DEFAULT_END_MINUTES = 20 * 60;
const WEEK_EVENT_PADDING_MINUTES = 60;
const WEEK_MIN_VISIBLE_SPAN_MINUTES = 6 * 60;

/** Week time-grid: shared layout minus column template (set via inline style). */
const WEEK_GRID_BASE_CLASS = "grid w-full min-w-[44rem]";

type CalendarLayout = "month" | "week";

type ListTab = "upcoming" | "previous";

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

function CalendarLiveBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md bg-red-500 font-bold uppercase tracking-wide text-white ${
        compact
          ? "px-1 py-px text-[8px]"
          : "px-1.5 py-0.5 text-[9px]"
      }`}
    >
      <span
        className={`rounded-full bg-white ${compact ? "h-1 w-1" : "h-1.5 w-1.5"}`}
        aria-hidden
      />
      Live
    </span>
  );
}

function CalendarStatusBar({
  variant,
  compact = false,
}: {
  variant: "recording" | "cancelled";
  compact?: boolean;
}) {
  const isRecording = variant === "recording";
  return (
    <span
      className={`mt-0.5 inline-flex w-auto max-w-full items-center gap-1 rounded font-semibold no-underline ${
        isRecording
          ? "bg-emerald-100 text-emerald-800"
          : "bg-rose-100 text-rose-800"
      } ${
        compact
          ? "px-0.5 py-px text-[8px] leading-tight"
          : "px-1 py-0.5 text-[9px] leading-tight"
      }`}
    >
      {isRecording ? (
        <Video
          className={compact ? "h-2 w-2 shrink-0" : "h-2.5 w-2.5 shrink-0"}
          aria-hidden
        />
      ) : (
        <XCircle
          className={compact ? "h-2 w-2 shrink-0" : "h-2.5 w-2.5 shrink-0"}
          aria-hidden
        />
      )}
      <span className="truncate">
        {isRecording
          ? compact
            ? "Recording"
            : "Recording available"
          : "Cancelled"}
      </span>
    </span>
  );
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

function formatCompactTimePart(dt: DateTime, omitMeridiem = false): string {
  const meridiem = dt.toFormat("a").toLowerCase();
  const hour12 = dt.hour % 12 || 12;
  const core =
    dt.minute === 0
      ? String(hour12)
      : `${hour12}:${String(dt.minute).padStart(2, "0")}`;
  return omitMeridiem ? core : `${core}${meridiem}`;
}

function formatWeekBlockRange(start: DateTime, end: DateTime, tz: string): string {
  const a = start.setZone(tz);
  const b = end.setZone(tz);
  const sameMeridiem = a.toFormat("a") === b.toFormat("a");
  return `${formatCompactTimePart(a, sameMeridiem)}-${formatCompactTimePart(b)}`;
}

function formatMonthEventTimeRange(
  startsAtIso: string,
  endsAtIso: string,
  tz: string
): string {
  return formatWeekBlockRange(
    DateTime.fromISO(startsAtIso, { zone: "utc" }),
    DateTime.fromISO(endsAtIso, { zone: "utc" }),
    tz
  );
}

function formatListEventLabel(
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
  const sameDay = a.toISODate() === b.toISODate();
  if (sameDay) {
    return `${dayFmt.format(a.toJSDate())}, ${formatWeekBlockRange(start, end, tz)}`;
  }
  return `${dayFmt.format(a.toJSDate())}, ${formatCompactTimePart(a)} – ${dayFmt.format(b.toJSDate())}, ${formatCompactTimePart(b)}`;
}

export function CommunityCalendar({
  addModalOpen,
  onAddModalOpenChange,
  canAddEvent = false,
}: Props) {
  const isBelowMd = useBelowBreakpoint("md");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  useEffect(() => {
    if (isBelowMd) {
      setViewMode((mode) => (mode === "calendar" ? "list" : mode));
    }
  }, [isBelowMd]);
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>("month");
  const [viewTz, setViewTz] = useState(defaultCommunityCalendarTimezone);
  const [focusDate, setFocusDate] = useState(() => {
    const z = defaultCommunityCalendarTimezone();
    return DateTime.now().setZone(z).startOf("day");
  });
  const [rows, setRows] = useState<CommunityCalendarEventRow[]>([]);
  const [exceptions, setExceptions] = useState<
    CommunityCalendarEventExceptionRow[]
  >([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [listTab, setListTab] = useState<ListTab>("upcoming");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [editingEvent, setEditingEvent] = useState<CommunityCalendarEventRow | null>(
    null
  );
  const [eventMenuOpenId, setEventMenuOpenId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<CommunityCalendarOccurrence | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const tzPickerRef = useRef<HTMLDivElement>(null);
  const eventMenuRef = useRef<HTMLDivElement>(null);
  const loadGenerationRef = useRef(0);

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
    if (!eventMenuOpenId) return;
    const onDoc = (e: MouseEvent) => {
      const el = eventMenuRef.current;
      if (el && !el.contains(e.target as Node)) setEventMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [eventMenuOpenId]);

  useEffect(() => {
    setFocusDate((d) => d.setZone(viewTz).startOf("day"));
  }, [viewTz]);

  const loadEvents = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const { events, exceptions: loadedExceptions } =
        await loadCommunityCalendarData();
      if (generation !== loadGenerationRef.current) return;
      setRows(events);
      setExceptions(loadedExceptions);
    } catch (e) {
      if (generation !== loadGenerationRef.current || isSupabaseAbortError(e)) {
        return;
      }
      const msg = supabaseErrorMessage(e);
      const hint = communityAccessHint(msg);
      setLoadError(
        [msg, hint ?? ""].filter(Boolean).join("\n\n") ||
          "Could not load calendar."
      );
      setRows([]);
      setExceptions([]);
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadEvents, refreshNonce]);

  const effectiveViewMode =
    isBelowMd && viewMode === "calendar" ? "list" : viewMode;

  const calendarYearWindow = useMemo(() => {
    const z = focusDate.setZone(viewTz);
    return {
      start: z.minus({ years: 1 }).startOf("year"),
      end: z.plus({ years: 1 }).endOf("year"),
    };
  }, [focusDate.year, viewTz]);

  const expandedCalendarWindow = useMemo(() => {
    if (rows.length === 0) return [];
    return expandCommunityCalendar(
      rows,
      calendarYearWindow.start,
      calendarYearWindow.end,
      exceptions
    );
  }, [rows, exceptions, calendarYearWindow.start, calendarYearWindow.end]);

  const gridStart = useMemo(() => {
    const first = focusDate.setZone(viewTz).startOf("month");
    const back = luxonToMon0Sun6(first.weekday);
    return first.minus({ days: back });
  }, [focusDate, viewTz]);

  const gridEnd = useMemo(() => {
    const last = focusDate.setZone(viewTz).endOf("month").startOf("day");
    const forward = 6 - luxonToMon0Sun6(last.weekday);
    return last.plus({ days: forward });
  }, [focusDate, viewTz]);

  const gridCells = useMemo(() => {
    const cells: DateTime[] = [];
    let d = gridStart.startOf("day");
    const end = gridEnd.startOf("day");
    while (d <= end) {
      cells.push(d);
      d = d.plus({ days: 1 });
    }
    return cells;
  }, [gridStart, gridEnd]);

  const gridRange = useMemo(() => {
    if (gridCells.length === 0) {
      const start = gridStart.startOf("day");
      return { start, end: start.endOf("day") };
    }
    return {
      start: gridCells[0].startOf("day"),
      end: gridCells[gridCells.length - 1].endOf("day"),
    };
  }, [gridCells, gridStart]);

  /** Month (and year) the grid is centred on — used to dim leading/trailing cells. */
  const visibleMonth = useMemo(
    () => focusDate.setZone(viewTz),
    [focusDate, viewTz],
  );

  const occurrencesInMonth = useMemo(() => {
    return filterCommunityCalendarOccurrencesInRange(
      expandedCalendarWindow,
      gridRange.start,
      gridRange.end
    );
  }, [expandedCalendarWindow, gridRange.start, gridRange.end]);

  const weekMonday = useMemo(() => {
    const d = focusDate.setZone(viewTz).startOf("day");
    return communityCalendarMondayStart(d);
  }, [focusDate, viewTz]);

  const weekRangeUtc = useMemo(() => {
    const start = weekMonday.startOf("day");
    const end = weekMonday.plus({ days: 6 }).endOf("day");
    return { startUtc: start.toUTC(), endUtc: end.toUTC() };
  }, [weekMonday]);

  const occurrencesInWeek = useMemo(() => {
    if (effectiveViewMode !== "calendar" || calendarLayout !== "week") {
      return [];
    }
    return filterCommunityCalendarOccurrencesInRange(
      expandedCalendarWindow,
      weekRangeUtc.startUtc,
      weekRangeUtc.endUtc
    );
  }, [
    expandedCalendarWindow,
    weekRangeUtc.startUtc,
    weekRangeUtc.endUtc,
    effectiveViewMode,
    calendarLayout,
  ]);

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

  const weekVisibleRange = useMemo(() => {
    let minMinutes = Number.POSITIVE_INFINITY;
    let maxMinutes = Number.NEGATIVE_INFINITY;
    for (const seg of weekSegments) {
      minMinutes = Math.min(minMinutes, minutesInDay(seg.start));
      maxMinutes = Math.max(maxMinutes, minutesInDay(seg.end));
    }

    if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) {
      return {
        startMinutes: WEEK_DEFAULT_START_MINUTES,
        endMinutes: WEEK_DEFAULT_END_MINUTES,
      };
    }

    const startWithPadding = minMinutes - WEEK_EVENT_PADDING_MINUTES;
    const endWithPadding = maxMinutes + WEEK_EVENT_PADDING_MINUTES;
    let startMinutes = Math.max(
      0,
      Math.floor(startWithPadding / 60) * 60
    );
    let endMinutes = Math.min(
      WEEK_TOTAL_MINUTES,
      Math.ceil(endWithPadding / 60) * 60
    );

    startMinutes = Math.min(startMinutes, WEEK_DEFAULT_START_MINUTES);
    endMinutes = Math.max(endMinutes, WEEK_DEFAULT_END_MINUTES);

    const span = endMinutes - startMinutes;
    if (span < WEEK_MIN_VISIBLE_SPAN_MINUTES) {
      const deficit = WEEK_MIN_VISIBLE_SPAN_MINUTES - span;
      const up = Math.min(
        WEEK_TOTAL_MINUTES - endMinutes,
        Math.ceil(deficit / 2 / 60) * 60
      );
      const down = Math.min(startMinutes, Math.floor((deficit - up) / 60) * 60);
      endMinutes += up;
      startMinutes -= down;
      if (endMinutes - startMinutes < WEEK_MIN_VISIBLE_SPAN_MINUTES) {
        endMinutes = Math.min(
          WEEK_TOTAL_MINUTES,
          startMinutes + WEEK_MIN_VISIBLE_SPAN_MINUTES
        );
      }
    }

    return { startMinutes, endMinutes };
  }, [weekSegments]);

  const weekBodyHeightPx = useMemo(
    () =>
      ((weekVisibleRange.endMinutes - weekVisibleRange.startMinutes) / 60) *
      WEEK_PX_PER_HOUR,
    [weekVisibleRange.endMinutes, weekVisibleRange.startMinutes]
  );

  const weekMinuteScale = useMemo(
    () => weekBodyHeightPx / (weekVisibleRange.endMinutes - weekVisibleRange.startMinutes),
    [weekBodyHeightPx, weekVisibleRange.endMinutes, weekVisibleRange.startMinutes]
  );

  const weekVisibleHours = useMemo(() => {
    const startHour = Math.floor(weekVisibleRange.startMinutes / 60);
    const endHour = Math.ceil(weekVisibleRange.endMinutes / 60);
    const count = Math.max(1, endHour - startHour);
    return Array.from({ length: count }, (_, i) => startHour + i);
  }, [weekVisibleRange.endMinutes, weekVisibleRange.startMinutes]);

  const weekNowLine = useMemo(() => {
    void nowTick;
    const now = DateTime.now().setZone(viewTz);
    const todayKey = now.toISODate() ?? "";
    const weekEndKey = weekMonday.plus({ days: 6 }).toISODate() ?? "";
    const weekStartKey = weekMonday.toISODate() ?? "";
    if (todayKey < weekStartKey || todayKey > weekEndKey) return null;
    const mins = minutesInDay(now);
    if (
      mins < weekVisibleRange.startMinutes ||
      mins > weekVisibleRange.endMinutes
    ) {
      return null;
    }
    const top = (mins - weekVisibleRange.startMinutes) * weekMinuteScale;
    return { top };
  }, [viewTz, weekMonday, nowTick, weekVisibleRange.endMinutes, weekVisibleRange.startMinutes, weekMinuteScale]);

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

  const monthWeekendColumnsExpanded = useMemo(() => {
    let saturday = false;
    let sunday = false;
    for (const cell of gridCells) {
      const weekday = cell.weekday;
      if (weekday !== 6 && weekday !== 7) continue;
      const key = cell.toISODate() ?? "";
      if ((byDayKey.get(key)?.length ?? 0) > 0) {
        if (weekday === 6) saturday = true;
        if (weekday === 7) sunday = true;
      }
    }
    return { saturday, sunday };
  }, [gridCells, byDayKey]);

  const monthGridTemplateColumns = useMemo(
    () =>
      calendarGridTemplateColumns(
        monthWeekendColumnsExpanded.saturday,
        monthWeekendColumnsExpanded.sunday
      ),
    [monthWeekendColumnsExpanded]
  );

  const weekWeekendColumnsExpanded = useMemo(
    () => ({
      saturday: (weekSegmentsByDay[5]?.length ?? 0) > 0,
      sunday: (weekSegmentsByDay[6]?.length ?? 0) > 0,
    }),
    [weekSegmentsByDay]
  );

  const weekGridTemplateColumns = useMemo(
    () =>
      calendarGridTemplateColumns(
        weekWeekendColumnsExpanded.saturday,
        weekWeekendColumnsExpanded.sunday,
        true
      ),
    [weekWeekendColumnsExpanded]
  );

  const listOccurrences = useMemo(() => {
    if (effectiveViewMode !== "list") return [];
    void nowTick;
    const nowMs = DateTime.now().toUTC().toMillis();
    const rangeStart = DateTime.now().minus({ years: 3 }).startOf("day");
    const rangeEnd = DateTime.now().plus({ years: 3 }).endOf("day");
    const expanded = expandCommunityCalendar(
      rows,
      rangeStart,
      rangeEnd,
      exceptions
    );
    return expanded
      .filter((occurrence) => {
        const endMs = new Date(occurrence.endsAtIso).getTime();
        return listTab === "upcoming" ? endMs >= nowMs : endMs < nowMs;
      })
      .sort((a, b) => {
        const startA = new Date(a.startsAtIso).getTime();
        const startB = new Date(b.startsAtIso).getTime();
        return listTab === "upcoming" ? startA - startB : startB - startA;
      });
  }, [rows, exceptions, listTab, nowTick, effectiveViewMode]);

  const listTotalPages = Math.max(
    1,
    Math.ceil(listOccurrences.length / LIST_PAGE_SIZE)
  );

  useEffect(() => {
    if (listPage > listTotalPages) setListPage(listTotalPages);
  }, [listPage, listTotalPages]);

  useEffect(() => {
    setListPage(1);
  }, [listTab]);

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
    [viewTz, nowTick]
  );

  const goToday = () => {
    startTransition(() => {
      setFocusDate(DateTime.now().setZone(viewTz).startOf("day"));
      setListPage(1);
      setListTab("upcoming");
    });
  };

  const monthTitle = focusDate.setZone(viewTz).toFormat("MMMM yyyy");
  const listViewTitle = listTab === "upcoming" ? "Upcoming" : "Previous calls";

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
    startTransition(() => {
      setFocusDate((d) => {
        const z = d.setZone(viewTz);
        if (viewMode === "list" || calendarLayout === "month") {
          return z.minus({ months: 1 }).startOf("month");
        }
        return communityCalendarMondayStart(z).minus({ days: 7 });
      });
      if (viewMode === "list") setListPage(1);
    });
  };

  const goNextPeriod = () => {
    startTransition(() => {
      setFocusDate((d) => {
        const z = d.setZone(viewTz);
        if (viewMode === "list" || calendarLayout === "month") {
          return z.plus({ months: 1 }).startOf("month");
        }
        return communityCalendarMondayStart(z).plus({ days: 7 });
      });
      if (viewMode === "list") setListPage(1);
    });
  };

  const periodNavLabel =
    effectiveViewMode === "list" || calendarLayout === "month" ? "month" : "week";

  const cancelTargetEventRow = useMemo(
    () => rows.find((row) => row.id === cancelTarget?.eventId) ?? null,
    [rows, cancelTarget]
  );

  const confirmCancelSession = useCallback(
    async (
      scope: CommunityCalendarCancelScope,
      cancellationReason?: string | null
    ) => {
      if (!canAddEvent || !cancelTarget) return;
      setCancelSaving(true);
      try {
        if (scope === "occurrence") {
          await cancelCommunityCalendarOccurrence(
            cancelTarget.eventId,
            communityCalendarExceptionOccurrenceStart(cancelTarget),
            cancellationReason
          );
        } else {
          await deleteCommunityCalendarEventSeries(cancelTarget.eventId);
        }
        setEventMenuOpenId(null);
        setSelectedOccurrence((occ) =>
          occ &&
          (scope === "series" ||
            communityCalendarOccurrenceKey(occ.eventId, occ.startsAtIso) ===
              communityCalendarOccurrenceKey(
                cancelTarget.eventId,
                cancelTarget.startsAtIso
              ))
            ? null
            : occ
        );
        setCancelTarget(null);
        setRefreshNonce((n) => n + 1);
      } catch (e) {
        const msg = supabaseErrorMessage(e);
        const hint = communityAccessHint(msg);
        setLoadError(
          [msg, hint ?? ""].filter(Boolean).join("\n\n") ||
            "Could not cancel session."
        );
      } finally {
        setCancelSaving(false);
      }
    },
    [canAddEvent, cancelTarget]
  );

  const selectedEventRow = useMemo(
    () => rows.find((row) => row.id === selectedOccurrence?.eventId) ?? null,
    [rows, selectedOccurrence]
  );

  useEffect(() => {
    if (!selectedOccurrence) return;
    const row = rows.find((r) => r.id === selectedOccurrence.eventId);
    if (!row) return;
    const exception = exceptions.find(
      (ex) =>
        communityCalendarOccurrenceKey(ex.event_id, ex.occurrence_start) ===
        communityCalendarOccurrenceKey(
          selectedOccurrence.eventId,
          communityCalendarExceptionOccurrenceStart(selectedOccurrence)
        )
    );
    setSelectedOccurrence((prev) =>
      !prev || prev.eventId !== row.id
        ? prev
        : mergeCommunityCalendarOccurrenceState(prev, row, exception)
    );
  }, [rows, exceptions, selectedOccurrence?.eventId, selectedOccurrence?.startsAtIso]);

  return (
    <>
      <div className="flex min-h-0 w-full min-w-0 flex-col gap-5 pt-3 lg:pt-3.5">
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
              {effectiveViewMode === "list" ? (
                <h2 className="min-w-[10rem] text-center text-lg font-bold text-slate-900 sm:text-xl">
                  {listViewTitle}
                </h2>
              ) : (
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
              )}
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
              {canAddEvent ? (
                <button
                  type="button"
                  onClick={() => onAddModalOpenChange(true)}
                  className="h-10 shrink-0 rounded-full bg-sky-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  Add event
                </button>
              ) : null}
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
                  className={`hidden items-center justify-center px-3 transition md:flex ${
                    viewMode === "calendar"
                      ? "bg-sky-100 text-slate-900"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <span
                  className="hidden w-px shrink-0 self-stretch bg-slate-300 md:block"
                  aria-hidden
                />
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                  onClick={() => {
                    setViewMode("list");
                    setListPage(1);
                    setListTab("upcoming");
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
            </div>
          </div>

          {loading ? (
            <p className="mt-8 text-center text-sm text-slate-500">Loading…</p>
          ) : effectiveViewMode === "calendar" ? (
            calendarLayout === "month" ? (
              <div className="mt-6 max-md:hidden overflow-x-auto lg:overflow-visible">
                <div
                  className="grid min-w-[640px] border border-slate-200 lg:min-w-0 lg:w-full"
                  style={{ gridTemplateColumns: monthGridTemplateColumns }}
                >
                  {WEEK_HEADERS.map((h, i) => {
                    const isWeekendHeader = i >= 5;
                    return (
                      <div
                        key={h}
                        className={`border-b border-slate-200 bg-slate-50 px-1 py-2 text-center text-xs font-bold text-slate-900 ${
                          isWeekendHeader ? WEEKEND_CELL_BG_CLASS : ""
                        }`}
                      >
                        {h}
                      </div>
                    );
                  })}
                  {gridCells.map((cell, cellIndex) => {
                    const key = cell.toISODate() ?? "";
                    const inMonth =
                      cell.month === visibleMonth.month &&
                      cell.year === visibleMonth.year;
                    const isToday = key === todayInView;
                    const isWeekend = isWeekendDate(cell);
                    const dayEvents = byDayKey.get(key) ?? [];
                    const showFullWeekendCell = !isWeekend || dayEvents.length > 0;
                    const conferenceCell = getBcaConferenceMonthCell(
                      cell,
                      cellIndex,
                      gridCells
                    );
                    const hasDayEvents = dayEvents.length > 0;
                    const cellBgClass = conferenceCell
                      ? BCA_CONFERENCE_CELL_BG_CLASS
                      : isWeekend
                        ? WEEKEND_CELL_BG_CLASS
                        : "bg-white";
                    return (
                      <div
                        key={key}
                        className={`relative border-b border-r border-slate-200 px-1.5 pt-1.5 align-top last:border-r-0 ${cellBgClass} ${
                          hasDayEvents ? "pb-4" : "pb-1.5"
                        } ${showFullWeekendCell ? "min-h-[6.5rem]" : "min-h-[3rem]"}`}
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
                        {conferenceCell?.showBanner ? (
                          <div
                            className="pointer-events-none absolute bottom-1.5 left-1.5 z-[1] flex items-center justify-center rounded-md bg-sky-600 px-2 py-2.5 shadow-sm"
                            style={{
                              top: "1.75rem",
                              width:
                                conferenceCell.spanColumns === 2
                                  ? "calc(200% + 1px - 0.75rem)"
                                  : "calc(100% - 0.75rem)",
                            }}
                          >
                            <span className="text-center text-sm font-bold leading-snug text-white">
                              <span className="block">Business Coach Academy</span>
                              <span className="block">Conference</span>
                            </span>
                          </div>
                        ) : null}
                        {showFullWeekendCell ? (
                        <ul
                          className={`mt-1 space-y-0.5 ${
                            conferenceCell ? "relative z-[2] pt-16" : ""
                          }`}
                        >
                          {dayEvents.slice(0, 3).map((ev) => {
                            const end = DateTime.fromISO(ev.endsAtIso, {
                              zone: "utc",
                            });
                            const showRecording =
                              !ev.isCancelled &&
                              end.isValid &&
                              end <= DateTime.now().toUTC() &&
                              communityCalendarHasRecording(ev);
                            const isLive = isLiveCommunityCalendarOccurrence(ev);
                            const isKickoff = isNewMemberKickoffOccurrence(ev);
                            const kickoffBox = isKickoff
                              ? communityCalendarKickoffHighlightBoxClass(
                                  Boolean(ev.isCancelled)
                                )
                              : null;
                            const eventBody = (
                              <>
                                <span
                                  className={`text-xs font-medium leading-tight ${
                                    ev.isCancelled
                                      ? "text-rose-500"
                                      : isKickoff
                                        ? communityCalendarKickoffMonthTimeClass(
                                            Boolean(ev.isCancelled)
                                          )
                                        : "text-sky-600"
                                  }`}
                                >
                                  {formatMonthEventTimeRange(
                                    ev.startsAtIso,
                                    ev.endsAtIso,
                                    viewTz
                                  )}
                                </span>
                                <span
                                  className={`line-clamp-2 block text-sm font-semibold leading-snug ${
                                    ev.isCancelled
                                      ? communityCalendarCancelledTextClass()
                                      : isKickoff
                                        ? communityCalendarKickoffMonthTitleClass(
                                            Boolean(ev.isCancelled)
                                          )
                                        : "text-sky-800"
                                  }`}
                                >
                                  {ev.title}
                                </span>
                                {isLive ? (
                                  <span className="-mt-1 block">
                                    <CalendarLiveBadge compact />
                                  </span>
                                ) : null}
                                {ev.isCancelled ? (
                                  <CalendarStatusBar variant="cancelled" />
                                ) : showRecording ? (
                                  <CalendarStatusBar variant="recording" />
                                ) : null}
                              </>
                            );
                            return (
                              <li key={`${ev.eventId}-${ev.startsAtIso}`}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOccurrence(ev)}
                                  title={communityCalendarCancellationHoverTitle(
                                    ev
                                  )}
                                  className="w-full text-left hover:underline"
                                >
                                  {kickoffBox ? (
                                    <div className={kickoffBox}>{eventBody}</div>
                                  ) : (
                                    eventBody
                                  )}
                                </button>
                              </li>
                            );
                          })}
                          {dayEvents.length > 3 ? (
                            <li className="text-[10px] text-slate-500">
                              +{dayEvents.length - 3} more
                            </li>
                          ) : null}
                        </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6 max-lg:overflow-x-auto rounded-xl border border-slate-200 bg-white max-md:hidden">
                <div className="min-w-[44rem] lg:min-w-0">
                  <div
                    className={`${WEEK_GRID_BASE_CLASS} items-end border-b border-slate-200 bg-white`}
                    style={{
                      minHeight: WEEK_HEADER_ROW_PX,
                      gridTemplateColumns: weekGridTemplateColumns,
                    }}
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
                      const isWeekend = i >= 5;
                      const isLast = i === 6;
                      return (
                        <div
                          key={key}
                          className={`border-r border-slate-200 py-2 text-center ${
                            isLast ? "border-r-0" : ""
                          } ${isWeekend ? WEEKEND_CELL_BG_CLASS : "bg-white"}`}
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
                      className={WEEK_GRID_BASE_CLASS}
                      style={{
                        gridTemplateRows: `${weekBodyHeightPx}px`,
                        gridTemplateColumns: weekGridTemplateColumns,
                      }}
                      role="grid"
                      aria-label={weekGridAriaLabel}
                    >
                      <div className="relative z-10 border-r border-slate-200 bg-white">
                        {weekVisibleHours.map((hour) => (
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
                        const isWeekend = col >= 5;
                        const isLast = col === 6;
                        return (
                          <div
                            key={`body-${dayKey}`}
                            className={`relative min-h-0 overflow-hidden border-r border-slate-200 ${
                              isLast ? "border-r-0" : ""
                            } ${isWeekend ? WEEKEND_CELL_BG_CLASS : "bg-white"}`}
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
                                  (minutesInDay(seg.start) -
                                    weekVisibleRange.startMinutes) *
                                  weekMinuteScale;
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
                                const isKickoff = isNewMemberKickoffOccurrence(ev);
                                const blockClass = isKickoff
                                  ? communityCalendarKickoffWeekBlockClass(
                                      Boolean(ev.isCancelled)
                                    )
                                  : communityCalendarWeekBlockClass(
                                      Boolean(ev.isCancelled),
                                      alt
                                    );
                                const timeLine = formatWeekBlockRange(
                                  seg.start,
                                  seg.end,
                                  viewTz
                                );
                                const eventEnd = DateTime.fromISO(ev.endsAtIso, {
                                  zone: "utc",
                                });
                                const showRecording =
                                  !ev.isCancelled &&
                                  eventEnd.isValid &&
                                  eventEnd <= DateTime.now().toUTC() &&
                                  communityCalendarHasRecording(ev);
                                const inner = (
                                  <>
                                    <p
                                      className={`line-clamp-2 text-[11px] font-semibold leading-snug ${
                                        ev.isCancelled ? "line-through" : ""
                                      }`}
                                    >
                                      {ev.title}
                                    </p>
                                    <p
                                      className={`mt-0.5 text-[10px] font-medium leading-tight ${
                                        isKickoff
                                          ? communityCalendarKickoffWeekBlockTimeClass(
                                              Boolean(ev.isCancelled)
                                            )
                                          : communityCalendarWeekBlockTimeClass(
                                              Boolean(ev.isCancelled),
                                              alt
                                            )
                                      }`}
                                    >
                                      {timeLine}
                                    </p>
                                    {ev.isCancelled ? (
                                      <CalendarStatusBar
                                        variant="cancelled"
                                        compact={hPx < 48}
                                      />
                                    ) : showRecording ? (
                                      <CalendarStatusBar
                                        variant="recording"
                                        compact={hPx < 48}
                                      />
                                    ) : null}
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
                                      title={
                                        showRecording
                                          ? "Recording available"
                                          : communityCalendarCancellationHoverTitle(
                                              ev
                                            )
                                      }
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
              <div
                className="inline-flex h-10 overflow-hidden rounded-full border border-slate-300 bg-white shadow-sm"
                role="tablist"
                aria-label="Event list"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={listTab === "upcoming"}
                  onClick={() => setListTab("upcoming")}
                  className={`px-4 text-sm font-medium transition ${
                    listTab === "upcoming"
                      ? "bg-sky-100 text-slate-900"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Upcoming
                </button>
                <span className="w-px shrink-0 self-stretch bg-slate-300" aria-hidden />
                <button
                  type="button"
                  role="tab"
                  aria-selected={listTab === "previous"}
                  onClick={() => setListTab("previous")}
                  className={`px-4 text-sm font-medium transition ${
                    listTab === "previous"
                      ? "bg-sky-100 text-slate-900"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Previous calls
                </button>
              </div>
              {listOccurrences.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  {listTab === "upcoming"
                    ? "No upcoming events."
                    : "No previous calls."}
                </p>
              ) : (
                listSlice.map((ev) => {
                  const s = DateTime.fromISO(ev.startsAtIso, { zone: "utc" });
                  const e = DateTime.fromISO(ev.endsAtIso, { zone: "utc" });
                  const label = formatListEventLabel(s, e, viewTz);
                  const sourceEventRow =
                    rows.find((row) => row.id === ev.eventId) ?? null;
                  const occurrenceKey = communityCalendarOccurrenceKey(
                    ev.eventId,
                    ev.startsAtIso
                  );
                  const isPast =
                    e.isValid && e <= DateTime.now().toUTC();
                  const hasRecording = communityCalendarHasRecording(ev);
                  const watchUrl = communityCalendarRecordingWatchUrl(ev);
                  const isLive = isLiveCommunityCalendarOccurrence(ev);
                  const isKickoff = isNewMemberKickoffOccurrence(ev);
                  return (
                    <div
                      key={`${ev.eventId}-${ev.startsAtIso}`}
                      className={`relative rounded-xl border bg-white p-4 shadow-sm hover:border-slate-300 ${
                        ev.isCancelled
                          ? "border-rose-100 bg-rose-50/60"
                          : "border-slate-200"
                      }`}
                    >
                      {canAddEvent && sourceEventRow && !ev.isCancelled ? (
                        <div className="absolute right-3 top-3 z-10" ref={eventMenuRef}>
                          <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={eventMenuOpenId === occurrenceKey}
                            aria-label="Event options"
                            onClick={(evt) => {
                              evt.stopPropagation();
                              setEventMenuOpenId((id) =>
                                id === occurrenceKey ? null : occurrenceKey
                              );
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Ellipsis className="h-4 w-4" />
                          </button>
                          {eventMenuOpenId === occurrenceKey ? (
                            <div
                              role="menu"
                              className="absolute right-0 mt-1 min-w-[9rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  setEditingEvent(sourceEventRow);
                                  setEventMenuOpenId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  setCancelTarget(ev);
                                  setEventMenuOpenId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Cancel session
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex w-full flex-col gap-3 pr-8 sm:flex-row sm:gap-4">
                        <button
                          type="button"
                          onClick={() => setSelectedOccurrence(ev)}
                          title={communityCalendarCancellationHoverTitle(ev)}
                          className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-28 sm:w-56"
                        >
                          {communityCalendarCoverUrl(ev) ? (
                            <CommunityCalendarCoverImage
                              occurrence={ev}
                              variant="thumbnail"
                              className="h-full w-full object-contain object-center"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                              No cover
                            </div>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOccurrence(ev)}
                            title={communityCalendarCancellationHoverTitle(ev)}
                            className="w-full text-left"
                          >
                            <div
                              className={
                                isKickoff
                                  ? communityCalendarKickoffHighlightBoxClass(
                                      Boolean(ev.isCancelled)
                                    )
                                  : undefined
                              }
                            >
                              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                <span
                                  className={
                                    isKickoff && !ev.isCancelled
                                      ? communityCalendarKickoffMonthTimeClass(false)
                                      : ev.isCancelled
                                        ? "text-rose-500"
                                        : undefined
                                  }
                                >
                                  {label}
                                </span>
                                {isLive ? <CalendarLiveBadge /> : null}
                              </p>
                              <h3
                                className={`mt-1 text-lg font-bold ${
                                  ev.isCancelled
                                    ? communityCalendarCancelledTextClass()
                                    : isKickoff
                                      ? communityCalendarKickoffMonthTitleClass(
                                          Boolean(ev.isCancelled)
                                        )
                                      : "text-slate-900"
                                }`}
                              >
                                {ev.title}
                              </h3>
                            </div>
                            <p className="mt-[0.2rem] flex items-center gap-1.5 text-xs text-slate-600">
                              {ev.location_kind === "link" &&
                              ev.location_url?.startsWith("http") ? (
                                <>
                                  <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                                  <a
                                    href={ev.location_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(evt) => evt.stopPropagation()}
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
                            {ev.isCancelled ? (
                              <p className={`mt-2 ${communityCalendarCancelledBadgeClass()}`}>
                                Cancelled
                              </p>
                            ) : null}
                          </button>
                          {isPast && hasRecording && watchUrl && !ev.isCancelled ? (
                            <a
                              href={watchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-[0.3rem] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              <Video className="h-4 w-4 shrink-0" />
                              Watch recording
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
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
          onSaved={async () => {
            onAddModalOpenChange(false);
            setRefreshNonce((n) => n + 1);
          }}
        />
      ) : null}
      {editingEvent ? (
        <AddCommunityEventModal
          initialEvent={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={async () => {
            setEditingEvent(null);
            setRefreshNonce((n) => n + 1);
          }}
        />
      ) : null}
      {selectedOccurrence ? (
        <CommunityCalendarEventModal
          occurrence={selectedOccurrence}
          eventRow={selectedEventRow}
          canManage={canAddEvent && Boolean(selectedEventRow)}
          onEdit={() => {
            if (!selectedEventRow) return;
            setSelectedOccurrence(null);
            setEditingEvent(selectedEventRow);
          }}
          onDelete={() => {
            if (!selectedEventRow) return;
            setCancelTarget(selectedOccurrence);
            setSelectedOccurrence(null);
          }}
          onClose={() => setSelectedOccurrence(null)}
          onRecordingSaved={() => setRefreshNonce((n) => n + 1)}
          onCancellationReasonSaved={() => setRefreshNonce((n) => n + 1)}
        />
      ) : null}
      {cancelTarget && cancelTargetEventRow ? (
        <CommunityCalendarCancelModal
          occurrence={cancelTarget}
          eventRow={cancelTargetEventRow}
          saving={cancelSaving}
          onClose={() => {
            if (!cancelSaving) setCancelTarget(null);
          }}
          onConfirm={confirmCancelSession}
        />
      ) : null}
    </>
  );
}

function luxonToMon0Sun6(weekday: number): number {
  return (weekday + 6) % 7;
}
