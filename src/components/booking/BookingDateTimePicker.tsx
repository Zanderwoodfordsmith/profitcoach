"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDaysYmd,
  formatInTimeZone,
  ymdInTimeZone,
} from "@/lib/booking/bookingTime";
import "./native-booking.css";

export type BookingDaySlots = {
  date: string;
  label: string;
  slots: { starts_at: string; ends_at: string; label: string }[];
};

type DateMode = "week" | "month";

type Props = {
  timezone: string;
  meetingDurationMinutes: number;
  days: BookingDaySlots[];
  loading?: boolean;
  selectedDate: string | null;
  onSelectDate: (ymd: string) => void;
  selectedSlot: { starts_at: string; ends_at: string } | null;
  onSelectSlot: (slot: { starts_at: string; ends_at: string } | null) => void;
  timezoneControl?: ReactNode;
  nowLabel?: string;
  timezoneShort?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Sunday-first month grid (Sun … Sat). */
function monthMatrixSunFirst(
  year: number,
  monthIndex0: number,
): (number | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const startPad = first.getUTCDay(); // Sun=0
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function ymdFromParts(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

function formatSlotLabel(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function weekdayShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function dayNumber(ymd: string): number {
  return Number(ymd.split("-")[2]);
}

function monthShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/** Add calendar days to a YYYY-MM-DD string (no TZ). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((bMs - aMs) / 86_400_000);
}

const PREVIEW_SLOT_COUNT = 9;
const MONTH_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Pick up to `count` slots spread evenly across the day. */
function sampleSpreadSlots<T>(slots: T[], count: number): T[] {
  if (slots.length <= count) return slots;
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i * (slots.length - 1)) / (count - 1)));
  }
  let fill = 0;
  while (indices.size < count && fill < slots.length) {
    indices.add(fill++);
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => slots[i]!);
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="nb-picker__chevron"
    >
      {dir === "left" ? (
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9.5 5.5 16 12l-6.5 6.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Chili Piper–style day + time picker.
 * Week strip by default (Sun–Sat); month view tucked behind a quiet link.
 */
export function BookingDateTimePicker({
  timezone,
  meetingDurationMinutes,
  days,
  loading = false,
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  timezoneControl,
  nowLabel,
  timezoneShort,
}: Props) {
  const todayYmd = useMemo(
    () => ymdInTimeZone(new Date(), timezone),
    [timezone],
  );
  const availableSet = useMemo(
    () => new Set(days.map((d) => d.date)),
    [days],
  );
  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate],
  );

  const [mode, setMode] = useState<DateMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const [y] = todayYmd.split("-").map(Number);
    return y;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = todayYmd.split("-").map(Number);
    return m - 1;
  });

  useEffect(() => {
    setShowAllSlots(false);
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    const delta = daysBetween(todayYmd, selectedDate);
    if (delta >= 0) setWeekOffset(Math.floor(delta / 7));
  }, [selectedDate, todayYmd]);

  // Rolling 7 days with today on the left (not a Sun–Sat calendar week).
  const weekDays = useMemo(() => {
    const start = addDaysYmd(todayYmd, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  }, [todayYmd, weekOffset]);

  const visibleSlots = useMemo(() => {
    if (!selectedDay) return [];
    if (showAllSlots) return selectedDay.slots;
    return sampleSpreadSlots(selectedDay.slots, PREVIEW_SLOT_COUNT);
  }, [selectedDay, showAllSlots]);

  const hasMoreSlots = Boolean(
    selectedDay && selectedDay.slots.length > PREVIEW_SLOT_COUNT && !showAllSlots,
  );

  function pickDate(ymd: string) {
    onSelectDate(ymd);
    onSelectSlot(null);
    const [y, m] = ymd.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
  }

  function switchMode(next: DateMode) {
    setMode(next);
    if (next === "month") {
      const base =
        selectedDate && selectedDate >= todayYmd ? selectedDate : todayYmd;
      const [y, m] = base.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <div className="nb-picker">
      {mode === "week" ? (
        <div className="nb-picker__week-wrap">
          <button
            type="button"
            aria-label="Previous week"
            disabled={weekOffset <= 0}
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            className="nb-picker__nav"
          >
            <Chevron dir="left" />
          </button>

          {loading ? (
            <p className="nb-picker__status">Loading availability…</p>
          ) : (
            <div className="nb-picker__strip">
              <div className="nb-picker__strip-wd" aria-hidden>
                {weekDays.map((ymd) => (
                  <span key={`wd-${ymd}`}>{weekdayShort(ymd)}</span>
                ))}
              </div>
              <div className="nb-picker__strip-row">
                {weekDays.map((ymd) => {
                  const available = availableSet.has(ymd) && ymd >= todayYmd;
                  const selected = selectedDate === ymd;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      aria-disabled={!available}
                      aria-label={
                        available
                          ? undefined
                          : `No available times, ${weekdayShort(ymd)} ${dayNumber(ymd)} ${monthShort(ymd)}`
                      }
                      data-tip={!available ? "No available times" : undefined}
                      tabIndex={0}
                      onClick={() => {
                        if (!available) return;
                        pickDate(ymd);
                      }}
                      className={`nb-picker__day${selected ? " is-selected" : ""}${
                        available ? " is-available" : " is-unavailable"
                      }`}
                    >
                      <span className="nb-picker__day-num">{dayNumber(ymd)}</span>
                      <span className="nb-picker__day-mo">{monthShort(ymd)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="nb-picker__nav"
          >
            <Chevron dir="right" />
          </button>
        </div>
      ) : loading ? (
        <p className="nb-picker__status">Loading availability…</p>
      ) : (
        <div className="nb-picker__month">
          <div className="nb-picker__month-head">
            <button
              type="button"
              aria-label="Previous month"
              className="nb-picker__month-nav"
              onClick={() => {
                const d = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
                setViewYear(d.getUTCFullYear());
                setViewMonth(d.getUTCMonth());
              }}
            >
              <Chevron dir="left" />
            </button>
            <div className="nb-picker__month-label">{monthLabel}</div>
            <button
              type="button"
              aria-label="Next month"
              className="nb-picker__month-nav"
              onClick={() => {
                const d = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
                setViewYear(d.getUTCFullYear());
                setViewMonth(d.getUTCMonth());
              }}
            >
              <Chevron dir="right" />
            </button>
          </div>

          <div className="nb-picker__month-wd">
            {MONTH_WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="nb-picker__month-body">
            {monthMatrixSunFirst(viewYear, viewMonth).map((row, ri) => (
              <div key={ri} className="nb-picker__month-row">
                {row.map((day, ci) => {
                  if (day == null) {
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        className="nb-picker__month-empty"
                        aria-hidden
                      />
                    );
                  }
                  const ymd = ymdFromParts(viewYear, viewMonth, day);
                  const available = availableSet.has(ymd) && ymd >= todayYmd;
                  const selected = selectedDate === ymd;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      aria-disabled={!available}
                      aria-label={
                        available
                          ? undefined
                          : `No available times, ${day} ${monthShort(ymd)}`
                      }
                      data-tip={!available ? "No available times" : undefined}
                      tabIndex={0}
                      onClick={() => {
                        if (!available) return;
                        pickDate(ymd);
                      }}
                      className={`nb-picker__month-day${
                        selected ? " is-selected" : ""
                      }${available ? " is-available" : " is-unavailable"}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="nb-picker__view-switch">
        {mode === "week" ? (
          <button type="button" onClick={() => switchMode("month")}>
            Browse by month
          </button>
        ) : (
          <button type="button" onClick={() => switchMode("week")}>
            Back to week
          </button>
        )}
      </p>

      <div className="nb-picker__times">
        <h3 className="nb-picker__times-title">What time works?</h3>
        <p className="nb-picker__times-meta">
          {meetingDurationMinutes} minute meeting
          {timezoneShort || timezoneControl ? (
            <>
              {" · "}
              {timezoneControl ?? (
                <span>
                  {timezoneShort ?? timezone}
                  {nowLabel ? ` (${nowLabel})` : ""}
                </span>
              )}
            </>
          ) : null}
        </p>

        <div className="nb-picker__slot-grid">
          {!selectedDay ? (
            <p className="nb-picker__status nb-picker__status--full">
              Select an available day.
            </p>
          ) : selectedDay.slots.length === 0 ? (
            <p className="nb-picker__status nb-picker__status--full">
              No times this day.
            </p>
          ) : (
            visibleSlots.map((slot) => {
              const active = selectedSlot?.starts_at === slot.starts_at;
              return (
                <button
                  key={slot.starts_at}
                  type="button"
                  onClick={() =>
                    onSelectSlot({
                      starts_at: slot.starts_at,
                      ends_at: slot.ends_at,
                    })
                  }
                  className={`nb-picker__slot${active ? " is-selected" : ""}`}
                >
                  {formatSlotLabel(slot.starts_at, timezone)}
                </button>
              );
            })
          )}
        </div>
        {hasMoreSlots ? (
          <button
            type="button"
            onClick={() => setShowAllSlots(true)}
            className="nb-picker__more"
          >
            Show more
          </button>
        ) : null}
      </div>
    </div>
  );
}
