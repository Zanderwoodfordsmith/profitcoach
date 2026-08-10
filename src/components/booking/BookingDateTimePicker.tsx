"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDaysYmd,
  formatInTimeZone,
  ymdInTimeZone,
} from "@/lib/booking/bookingTime";

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
  /** Optional timezone control rendered in the “What time works?” line. */
  timezoneControl?: ReactNode;
  nowLabel?: string;
  timezoneShort?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Monday-first month grid (Mon … Sun). */
function monthMatrixMonFirst(
  year: number,
  monthIndex0: number
): (number | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const startPad = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
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

function dayMonthLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((bMs - aMs) / 86_400_000);
}

const PREVIEW_SLOT_COUNT = 9;
const MONTH_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Pick up to `count` slots spread evenly across the day (by index order). */
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

/**
 * Chili Piper–style day + time picker: week strip by default (today on the left),
 * with a month toggle for further-out dates.
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
    [timezone]
  );
  const availableSet = useMemo(
    () => new Set(days.map((d) => d.date)),
    [days]
  );
  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? null,
    [days, selectedDate]
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
    selectedDay && selectedDay.slots.length > PREVIEW_SLOT_COUNT && !showAllSlots
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
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 ${
              mode === "week"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => switchMode("week")}
          >
            Week
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 ${
              mode === "month"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => switchMode("month")}
          >
            Month
          </button>
        </div>
      </div>

      <div className={mode === "week" ? "relative px-10" : undefined}>
        {mode === "week" ? (
          <>
            <button
              type="button"
              aria-label="Previous week"
              disabled={weekOffset <= 0}
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              className="absolute left-0 top-[1.35rem] z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 sm:top-[1.5rem]"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="absolute right-0 top-[1.35rem] z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 sm:top-[1.5rem]"
            >
              ›
            </button>
          </>
        ) : null}

        {loading ? (
          <p className="text-center text-sm text-slate-500">
            Loading availability…
          </p>
        ) : mode === "week" ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-7 divide-x divide-slate-100">
              {weekDays.map((ymd) => {
                const available = availableSet.has(ymd);
                const selected = selectedDate === ymd;
                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={!available}
                    onClick={() => pickDate(ymd)}
                    className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-center transition sm:py-3 ${
                      selected
                        ? "bg-[var(--brand-teal,#1ca0c2)] text-white"
                        : available
                          ? "bg-white text-slate-900 hover:bg-slate-50"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide sm:text-[11px] ${
                        selected
                          ? "text-white/85"
                          : available
                            ? "text-slate-500"
                            : "text-slate-400"
                      }`}
                    >
                      {weekdayShort(ymd)}
                    </span>
                    <span
                      className={`text-xs font-semibold leading-tight sm:text-sm ${
                        available && !selected ? "text-slate-900" : ""
                      }`}
                    >
                      {dayMonthLabel(ymd)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-stretch divide-x divide-slate-100 border-b border-slate-200">
              <button
                type="button"
                aria-label="Previous month"
                className="flex w-9 shrink-0 items-center justify-center bg-white text-slate-500 transition hover:bg-slate-50"
                onClick={() => {
                  const d = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
                  setViewYear(d.getUTCFullYear());
                  setViewMonth(d.getUTCMonth());
                }}
              >
                ‹
              </button>
              <div className="flex min-w-0 flex-1 items-center justify-center bg-white px-2 py-2.5 text-sm font-semibold text-slate-900">
                {monthLabel}
              </div>
              <button
                type="button"
                aria-label="Next month"
                className="flex w-9 shrink-0 items-center justify-center bg-white text-slate-500 transition hover:bg-slate-50"
                onClick={() => {
                  const d = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
                  setViewYear(d.getUTCFullYear());
                  setViewMonth(d.getUTCMonth());
                }}
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50">
              {MONTH_WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-100">
              {monthMatrixMonFirst(viewYear, viewMonth).map((row, ri) => (
                <div
                  key={ri}
                  className="grid grid-cols-7 divide-x divide-slate-100"
                >
                  {row.map((day, ci) => {
                    if (day == null) {
                      return (
                        <div
                          key={`${ri}-${ci}`}
                          className="bg-slate-50 py-2"
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
                        disabled={!available}
                        onClick={() => pickDate(ymd)}
                        className={`py-2 text-center text-xs font-semibold transition sm:text-sm ${
                          selected
                            ? "bg-[var(--brand-teal,#1ca0c2)] text-white"
                            : available
                              ? "bg-white text-slate-900 hover:bg-slate-50"
                              : "bg-slate-100 text-slate-400"
                        }`}
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

        <div className="mt-5 text-center">
          <h3 className="text-base font-semibold text-slate-900">
            What time works?
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {meetingDurationMinutes} minute meeting
            {timezoneShort || timezoneControl ? (
              <>
                {" • "}
                {timezoneControl ?? (
                  <span>
                    {timezoneShort ?? timezone}
                    {nowLabel ? ` (${nowLabel})` : ""}
                  </span>
                )}
              </>
            ) : null}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {!selectedDay ? (
              <p className="col-span-full text-sm text-slate-500">
                Select an available day.
              </p>
            ) : selectedDay.slots.length === 0 ? (
              <p className="col-span-full text-sm text-slate-500">
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
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "border-[var(--brand-teal,#1ca0c2)] bg-teal-50 text-teal-950"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                    }`}
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
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Show more
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
