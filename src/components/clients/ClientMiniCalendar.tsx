"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  /** ISO timestamps of sessions to highlight */
  sessionDates: string[];
  selectedDate?: string | null;
  onSelectDate?: (isoDate: string | null) => void;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ClientMiniCalendar({
  sessionDates,
  selectedDate,
  onSelectDate,
}: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const sessionKeys = useMemo(() => {
    const set = new Set<string>();
    for (const iso of sessionDates) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) set.add(toKey(d));
    }
    return set;
  }, [sessionDates]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(cursor);

  const firstDow = cursor.getDay(); // 0 Sun
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0
  ).getDate();
  const today = new Date();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Sessions</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
              )
            }
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-xs font-medium text-slate-600">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
              )
            }
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`e-${idx}`} className="h-8" />;
          }
          const key = toKey(date);
          const hasSession = sessionKeys.has(key);
          const isToday = sameDay(date, today);
          const isSelected = selectedDate === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                onSelectDate?.(isSelected ? null : key)
              }
              className={`relative flex h-8 items-center justify-center rounded-lg text-xs transition ${
                isSelected
                  ? "bg-sky-600 font-semibold text-white"
                  : isToday
                    ? "bg-sky-50 font-semibold text-sky-800"
                    : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {date.getDate()}
              {hasSession && !isSelected ? (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
