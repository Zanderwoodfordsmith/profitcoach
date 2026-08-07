"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CallRow } from "@/lib/callRow";
import {
  callStatusCalendarClass,
  formatCompactTime,
  getCallDisplayName,
} from "@/lib/callStatusUi";

type Props = {
  calls: CallRow[];
  timezone: string;
  selectedCalendarNames: Set<string> | null;
  selectedCoachIds: Set<string> | null;
  onSelectCall?: (row: CallRow) => void;
};

function startOfWeekMonday(dt: DateTime): DateTime {
  const weekday = dt.weekday;
  return dt.startOf("day").minus({ days: weekday - 1 });
}

export function CallsWeekView({
  calls,
  timezone,
  selectedCalendarNames,
  selectedCoachIds,
  onSelectCall,
}: Props) {
  const [anchor, setAnchor] = useState(() => new Date());

  const weekStart = startOfWeekMonday(
    DateTime.fromJSDate(anchor).setZone(timezone)
  );
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  const filtered = calls.filter((c) => {
    if (selectedCalendarNames && selectedCalendarNames.size > 0) {
      const name = c.calendar_name ?? c.title ?? "";
      if (!selectedCalendarNames.has(name)) return false;
    }
    if (selectedCoachIds && selectedCoachIds.size > 0) {
      if (!c.coach_id || !selectedCoachIds.has(c.coach_id)) return false;
    }
    return true;
  });

  const byDay = new Map<string, CallRow[]>();
  for (const day of days) {
    byDay.set(day.toISODate()!, []);
  }
  for (const call of filtered) {
    if (!call.start_time) continue;
    const local = DateTime.fromISO(call.start_time, { zone: timezone });
    const key = local.toISODate();
    if (!key || !byDay.has(key)) continue;
    byDay.get(key)!.push(call);
  }

  const rangeLabel = `${weekStart.toFormat("d MMM")} – ${weekStart
    .plus({ days: 6 })
    .toFormat("d MMM yyyy")}`;

  const now = DateTime.now().setZone(timezone);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous week"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => setAnchor(weekStart.minus({ weeks: 1 }).toJSDate())}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next week"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => setAnchor(weekStart.plus({ weeks: 1 }).toJSDate())}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-slate-900">{rangeLabel}</p>
        </div>
        <p className="text-xs text-slate-500">Week view · {timezone}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-100">
            <div />
            {days.map((d) => {
              const isToday = d.hasSame(now, "day");
              return (
                <div
                  key={d.toISODate()}
                  className={`px-2 py-2 text-center text-xs font-semibold ${
                    isToday ? "text-sky-700" : "text-slate-600"
                  }`}
                >
                  <div>{d.toFormat("ccc")}</div>
                  <div className="text-sm">{d.toFormat("d")}</div>
                </div>
              );
            })}
          </div>

          <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div className="border-r border-slate-100">
              {hours.map((h) => (
                <div
                  key={h}
                  className="h-16 border-b border-slate-50 pr-2 text-right text-[10px] text-slate-400"
                >
                  {DateTime.fromObject({ hour: h }).toFormat("h a")}
                </div>
              ))}
            </div>

            {days.map((d) => {
              const key = d.toISODate()!;
              const dayCalls = byDay.get(key) ?? [];
              const isToday = d.hasSame(now, "day");
              return (
                <div
                  key={key}
                  className={`relative border-r border-slate-100 ${
                    isToday ? "bg-sky-50/30" : ""
                  }`}
                >
                  {hours.map((h) => (
                    <div key={h} className="h-16 border-b border-slate-50" />
                  ))}
                  {dayCalls.map((call) => {
                    if (!call.start_time) return null;
                    const start = DateTime.fromISO(call.start_time, {
                      zone: timezone,
                    });
                    const end = call.end_time
                      ? DateTime.fromISO(call.end_time, { zone: timezone })
                      : start.plus({ minutes: 30 });
                    const dayStart = d.set({ hour: 7, minute: 0 });
                    const topMin = Math.max(
                      0,
                      start.diff(dayStart, "minutes").minutes
                    );
                    const dur = Math.max(
                      20,
                      end.diff(start, "minutes").minutes
                    );
                    const top = (topMin / 60) * 64;
                    const height = (dur / 60) * 64;
                    return (
                      <button
                        key={call.id}
                        type="button"
                        onClick={() => onSelectCall?.(call)}
                        className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[10px] font-semibold shadow-sm ${callStatusCalendarClass(
                          call.status_normalized
                        )}`}
                        style={{
                          top,
                          height: Math.min(height, 64 * 14 - top),
                        }}
                        title={`${getCallDisplayName(call)} · ${call.prospect_name}`}
                      >
                        <div className="truncate">
                          {formatCompactTime(start.toJSDate())}{" "}
                          {call.prospect_name}
                        </div>
                        <div className="truncate opacity-90">
                          {getCallDisplayName(call)}
                        </div>
                      </button>
                    );
                  })}
                  {isToday ? (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-rose-500"
                      style={{
                        top: Math.max(
                          0,
                          (now.diff(d.set({ hour: 7 }), "minutes").minutes /
                            60) *
                            64
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
    </div>
  );
}
