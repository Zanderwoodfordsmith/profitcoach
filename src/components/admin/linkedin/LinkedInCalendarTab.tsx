"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { statusChipClass, type LinkedInPostItem } from "./types";

type Props = {
  items: LinkedInPostItem[];
  onSelectPost?: (item: LinkedInPostItem) => void;
};

function startOfWeekMonday(dt: DateTime): DateTime {
  return dt.startOf("day").minus({ days: dt.weekday - 1 });
}

export function LinkedInCalendarTab({ items, onSelectPost }: Props) {
  const [anchor, setAnchor] = useState(() => new Date());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const weekStart = startOfWeekMonday(
    DateTime.fromJSDate(anchor).setZone(timezone)
  );
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  const now = DateTime.now().setZone(timezone);

  const scheduled = useMemo(
    () =>
      items.filter(
        (i) =>
          i.scheduled_for &&
          (i.status === "scheduled" ||
            i.status === "published" ||
            i.status === "failed")
      ),
    [items]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, LinkedInPostItem[]>();
    for (const day of days) map.set(day.toISODate()!, []);
    for (const item of scheduled) {
      if (!item.scheduled_for) continue;
      const local = DateTime.fromISO(item.scheduled_for, { zone: timezone });
      const key = local.toISODate();
      if (!key || !map.has(key)) continue;
      map.get(key)!.push(item);
    }
    return map;
  }, [days, scheduled, timezone]);

  const rangeLabel = `${weekStart.toFormat("d MMM")} – ${weekStart
    .plus({ days: 6 })
    .toFormat("d MMM yyyy")}`;

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
        <p className="text-xs text-slate-500">Week · {timezone}</p>
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
                    isToday ? "text-[#0A66C2]" : "text-slate-600"
                  }`}
                >
                  <div>{d.toFormat("ccc")}</div>
                  <div className="text-sm">{d.toFormat("d")}</div>
                  {isToday ? (
                    <span className="mt-0.5 inline-block rounded-full bg-[#0A66C2]/10 px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#0A66C2]">
                      Today
                    </span>
                  ) : null}
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
              const dayPosts = byDay.get(key) ?? [];
              const isToday = d.hasSame(now, "day");
              return (
                <div
                  key={key}
                  className={`relative border-r border-slate-100 ${
                    isToday ? "bg-[#0A66C2]/[0.03]" : ""
                  }`}
                >
                  {hours.map((h) => (
                    <div key={h} className="h-16 border-b border-slate-50" />
                  ))}
                  {dayPosts.map((post) => {
                    if (!post.scheduled_for) return null;
                    const start = DateTime.fromISO(post.scheduled_for, {
                      zone: timezone,
                    });
                    const dayStart = d.set({ hour: 7, minute: 0 });
                    const topMin = Math.max(
                      0,
                      start.diff(dayStart, "minutes").minutes
                    );
                    const top = (topMin / 60) * 64;
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => onSelectPost?.(post)}
                        className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[10px] font-semibold shadow-sm ring-1 ring-inset ${statusChipClass(
                          post.status
                        )}`}
                        style={{
                          top,
                          minHeight: 36,
                          maxHeight: 56,
                        }}
                        title={post.content}
                      >
                        <div className="truncate">
                          {start.toFormat("h:mm a")}
                          {post.category ? ` · ${post.category}` : ""}
                        </div>
                        <div className="truncate opacity-90">{post.content}</div>
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
