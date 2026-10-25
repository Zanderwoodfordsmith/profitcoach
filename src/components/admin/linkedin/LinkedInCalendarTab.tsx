"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HistoryPostItem, NewsletterIssueItem } from "@/lib/linkedinHistory/loadHistory";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { statusChipClass, type LinkedInPostItem } from "./types";

type Props = {
  items: LinkedInPostItem[];
  /** Posts imported from LinkedIn, so the calendar shows what already went out. */
  history?: HistoryPostItem[];
  issues?: NewsletterIssueItem[];
  onSelectPost?: (item: LinkedInPostItem) => void;
  onOpenIssue?: (issueId: string) => void;
};

type View = "month" | "week";

type Entry = {
  key: string;
  at: DateTime;
  label: string;
  text: string;
  chip: string;
  onClick?: () => void;
  href?: string;
};

const POSTED_CHIP = "bg-white text-slate-700 ring-slate-200";
const ISSUE_CHIP = "bg-[#0A66C2]/[0.07] text-[#0A3D73] ring-[#0A66C2]/25";
const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", published: "Published", failed: "Failed" };
const MAX_CHIPS = 3;

function startOfWeekMonday(dt: DateTime): DateTime {
  return dt.startOf("day").minus({ days: dt.weekday - 1 });
}

function snippet(text: string, words = 8): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const cut = clean.split(" ").slice(0, words).join(" ");
  return cut.length < clean.length ? `${cut}…` : cut || "Post";
}

function textKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

function EntryChip({ entry, showTime = true }: { entry: Entry; showTime?: boolean }) {
  const className = `flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-caption font-medium ring-1 ring-inset transition hover:brightness-[0.97] ${entry.chip}`;
  const body = (
    <>
      {showTime ? <span className="shrink-0 tabular-nums opacity-60">{entry.at.toFormat("h:mma").toLowerCase()}</span> : null}
      <span className="truncate">{entry.label}</span>
    </>
  );
  return entry.href ? (
    <a href={entry.href} target="_blank" rel="noreferrer" title={entry.text} className={className}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={entry.onClick} title={entry.text} className={className}>
      {body}
    </button>
  );
}

export function LinkedInCalendarTab({ items, history = [], issues = [], onSelectPost, onOpenIssue }: Props) {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const now = DateTime.now().setZone(timezone);
  const anchorDt = DateTime.fromJSDate(anchor).setZone(timezone);

  const entries = useMemo(() => {
    const out: Entry[] = [];
    const ownDays = new Set<string>();
    for (const item of items) {
      const when = item.scheduled_for ?? (item.status === "published" ? item.published_at : null);
      if (!when || !(item.status === "scheduled" || item.status === "published" || item.status === "failed")) continue;
      const at = DateTime.fromISO(when, { zone: timezone });
      if (item.status === "published") ownDays.add(`${at.toISODate()}|${textKey(item.content)}`);
      out.push({
        key: `s-${item.id}`,
        at,
        label: `${STATUS_LABEL[item.status] ?? ""}${item.category ? ` · ${item.category}` : ""}: ${snippet(item.content, 6)}`,
        text: item.content,
        chip: statusChipClass(item.status),
        onClick: () => onSelectPost?.(item),
      });
    }
    const issueByArticle = new Map(issues.map((issue) => [issue.article_id, issue]));
    for (const post of history) {
      const at = DateTime.fromISO(post.posted_at, { zone: timezone });
      // Posted from here and imported back from LinkedIn: show it once.
      if (ownDays.has(`${at.toISODate()}|${textKey(post.text)}`)) continue;
      const issue = post.kind === "newsletter" && post.article_id ? issueByArticle.get(post.article_id) : undefined;
      if (issue) {
        out.push({
          key: `h-${post.id}`,
          at,
          label: `Newsletter: ${issue.topic || issue.title}`,
          text: issue.title,
          chip: ISSUE_CHIP,
          onClick: () => onOpenIssue?.(issue.id),
        });
        continue;
      }
      out.push({
        key: `h-${post.id}`,
        at,
        label: post.kind === "repost" ? `Repost: ${snippet(post.text, 6)}` : snippet(post.text),
        text: post.text,
        chip: POSTED_CHIP,
        href: post.share_url ?? undefined,
      });
    }
    return out.sort((a, b) => a.at.toMillis() - b.at.toMillis());
  }, [items, history, issues, timezone, onSelectPost, onOpenIssue]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = entry.at.toISODate()!;
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [entries]);

  const weekStart = startOfWeekMonday(anchorDt);
  const monthStart = anchorDt.startOf("month");
  const gridStart = startOfWeekMonday(monthStart);
  const gridDays = Math.ceil(monthStart.endOf("month").diff(gridStart, "days").days / 7) * 7;
  const days =
    view === "month"
      ? Array.from({ length: gridDays }, (_, i) => gridStart.plus({ days: i }))
      : Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

  const rangeLabel =
    view === "month"
      ? monthStart.toFormat("LLLL yyyy")
      : `${weekStart.toFormat("d MMM")} – ${weekStart.plus({ days: 6 }).toFormat("d MMM yyyy")}`;

  function step(dir: 1 | -1) {
    setOpenDay(null);
    setAnchor((view === "month" ? monthStart.plus({ months: dir }) : weekStart.plus({ weeks: dir })).toJSDate());
  }

  const dayEntries = openDay ? byDay.get(openDay) ?? [] : [];

  return (
    <div className={cardClass("plain", "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonClass("second", "small")}
            onClick={() => {
              setOpenDay(null);
              setAnchor(new Date());
            }}
          >
            Today
          </button>
          <button type="button" aria-label={view === "month" ? "Previous month" : "Previous week"} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label={view === "month" ? "Next month" : "Next week"} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-slate-900">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-slate-400 sm:block">{timezone}</p>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Calendar view">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  setOpenDay(null);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${
                  view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "month" ? (
        <>
          <div className="grid grid-cols-7 border-b border-slate-100">
            {days.slice(0, 7).map((d) => (
              <div key={d.weekday} className="px-2 py-2 text-center text-kicker font-semibold uppercase text-slate-400">
                <span className="sm:hidden">{d.toFormat("ccccc")}</span>
                <span className="hidden sm:inline">{d.toFormat("ccc")}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = d.toISODate()!;
              const list = byDay.get(key) ?? [];
              const inMonth = d.month === monthStart.month;
              const isToday = d.hasSame(now, "day");
              const selected = openDay === key;
              return (
                <div
                  key={key}
                  className={`min-h-[4.25rem] border-b border-r border-slate-100 p-1 sm:min-h-[7.25rem] sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                    inMonth ? "" : "bg-slate-50/70"
                  } ${selected ? "bg-[#0A66C2]/[0.04]" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDay(selected ? null : key)}
                    aria-label={`${d.toFormat("cccc d LLLL")}, ${list.length} ${list.length === 1 ? "post" : "posts"}`}
                    className="flex w-full items-center justify-between gap-1 rounded-md px-0.5 text-left"
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                        isToday ? "bg-[#0A66C2] text-white" : inMonth ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {d.day}
                    </span>
                    {list.length ? (
                      <span className="flex gap-0.5 sm:hidden" aria-hidden>
                        {list.slice(0, 3).map((e) => (
                          <span key={e.key} className={`h-1.5 w-1.5 rounded-full ${e.chip.includes("0A66C2") ? "bg-[#0A66C2]" : "bg-slate-400"}`} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {list.slice(0, MAX_CHIPS).map((entry) => (
                      <EntryChip key={entry.key} entry={entry} />
                    ))}
                    {list.length > MAX_CHIPS ? (
                      <button
                        type="button"
                        onClick={() => setOpenDay(key)}
                        className="w-full rounded-md px-1.5 py-0.5 text-left text-caption font-medium text-slate-500 hover:bg-slate-100"
                      >
                        +{list.length - MAX_CHIPS} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {openDay ? (
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold text-slate-900">{DateTime.fromISO(openDay).toFormat("cccc d LLLL")}</p>
              {dayEntries.length ? (
                <ul className="mt-2 space-y-1.5">
                  {dayEntries.map((entry) => (
                    <li key={entry.key}>
                      <EntryChip entry={entry} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Nothing posted or scheduled.</p>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <WeekGrid days={days} byDay={byDay} now={now} />
      )}
    </div>
  );
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const HOUR_PX = 64;

/** The time-blocked week: for planning when posts go out. */
function WeekGrid({ days, byDay, now }: { days: DateTime[]; byDay: Map<string, Entry[]>; now: DateTime }) {
  const maxTop = HOURS.length * HOUR_PX - 40;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-100">
          <div />
          {days.map((d) => {
            const isToday = d.hasSame(now, "day");
            return (
              <div key={d.toISODate()} className={`px-2 py-2 text-center text-xs font-semibold ${isToday ? "text-[#0A66C2]" : "text-slate-600"}`}>
                <div>{d.toFormat("ccc")}</div>
                <div className="text-sm">{d.toFormat("d")}</div>
              </div>
            );
          })}
        </div>

        <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-slate-100">
            {HOURS.map((h) => (
              <div key={h} className="h-16 border-b border-slate-50 pr-2 text-right text-caption text-slate-400">
                {DateTime.fromObject({ hour: h }).toFormat("h a")}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const key = d.toISODate()!;
            const isToday = d.hasSame(now, "day");
            const dayStart = d.set({ hour: 7, minute: 0 });
            return (
              <div key={key} className={`relative border-r border-slate-100 ${isToday ? "bg-[#0A66C2]/[0.03]" : ""}`}>
                {HOURS.map((h) => (
                  <div key={h} className="h-16 border-b border-slate-50" />
                ))}
                {(byDay.get(key) ?? []).map((entry) => {
                  const top = Math.min(maxTop, Math.max(0, (entry.at.diff(dayStart, "minutes").minutes / 60) * HOUR_PX));
                  return (
                    <div key={entry.key} className="absolute left-1 right-1 z-10 shadow-sm" style={{ top }}>
                      <EntryChip entry={entry} />
                    </div>
                  );
                })}
                {isToday ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-rose-500"
                    style={{ top: Math.min(maxTop + 40, Math.max(0, (now.diff(dayStart, "minutes").minutes / 60) * HOUR_PX)) }}
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
