"use client";

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  FIRST_REPLY_TARGET_HOURS,
  HEAT_BLOCKS,
  PERIODS,
  TYPE_LABELS,
  TYPE_ORDER,
  formatHours,
  monthLabel,
  monthlyRows,
  nowStats,
  pointers,
  sourceGroup,
  statsFor,
  type DashTicket,
  type MonthRow,
  type PeriodKey,
  type PeriodStats,
  type Pointer,
} from "@/lib/support/dashboardStats";
import { SUPPORT_TOPICS, supportTopicLabel } from "@/lib/support/ticketTopics";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Admin → Support → Dashboard (job 237). How support is going: what's waiting
 * now, how fast BCA replies and closes, what coaches ask about, and how each of
 * those moves month by month.
 */

const DAY = 86_400_000;

// Chart colours (checked for colour-blind separation). Counts always sit beside
// them in text, so no colour carries meaning alone.
const TYPE_COLORS: Record<string, string> = {
  question: "#0c5290",
  bug: "#e07b39",
  idea: "#7c5cc4",
  other: "#94a3b8",
};
const CHANNELS = [
  { key: "app", label: "In the app", color: "#0c5290" },
  { key: "email", label: "Email", color: "#e07b39" },
  { key: "whatsapp", label: "WhatsApp", color: "#2bb3c0" },
] as const;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ticketHref(id: string) {
  return `/admin/support?ticket=${id}`;
}

function ago(iso: string, nowMs: number) {
  return formatHours((nowMs - new Date(iso).getTime()) / 3_600_000);
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(
    new Date(iso)
  );
}

export function SupportDashboard() {
  const [tickets, setTickets] = useState<DashTicket[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("30");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) setError("Sign in again to see the dashboard.");
        return;
      }
      const res = await fetch("/api/admin/support/dashboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { tickets?: DashTicket[]; now?: string; error?: string };
      if (cancelled) return;
      if (!res.ok || !body.tickets) {
        setError(body.error ?? "Couldn't load the dashboard. Try again in a moment.");
        return;
      }
      setTickets(body.tickets);
      if (body.now) setNowMs(new Date(body.now).getTime());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    if (!tickets) return null;
    const all = tickets;
    const coach = all.filter((t) => t.coachStarted);
    const days = Number(period);
    const from = nowMs - days * DAY;
    const current = statsFor(coach, from, nowMs + 1, nowMs);
    const previous = statsFor(coach, from - days * DAY, from, nowMs);
    const now = nowStats(all, nowMs);
    // Months from the first ticket's month to this one, up to a year.
    const first = coach[0]?.createdAt;
    const [fy, fm] = first ? monthKeyLocal(first).split("-").map(Number) : [0, 0];
    const [ny, nm] = monthKeyLocal(new Date(nowMs).toISOString()).split("-").map(Number);
    const span = first ? Math.min(12, Math.max(3, (ny! - fy!) * 12 + (nm! - fm!) + 1)) : 6;
    const months = monthlyRows(coach, span, nowMs);
    const inPeriod = coach.filter((t) => new Date(t.createdAt).getTime() >= from);
    return {
      coach,
      current,
      previous,
      now,
      months,
      inPeriod,
      pointers: pointers(current, previous, now, supportTopicLabel, nowMs),
    };
  }, [tickets, period, nowMs]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-10">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-ui text-red-800">{error}</p>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-ui text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Adding up support…
      </div>
    );
  }

  const periodInfo = PERIODS.find((p) => p.key === period)!;
  const hasPrevious = view.previous.tickets > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 pt-6 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSwitch value={period} onChange={setPeriod} />
        <p className="text-caption text-slate-500">
          {hasPrevious ? `Compared with the ${periodInfo.short} before` : "Nothing to compare with yet"}
        </p>
      </div>

      <NowBand current={view.current} now={view.now} periodLabel={periodInfo.label} nowMs={nowMs} />

      <KpiStrip current={view.current} previous={hasPrevious ? view.previous : null} />

      {view.pointers.length > 0 && <Pointers items={view.pointers} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Box
          title="First reply, month by month"
          note={`Typical wait in clock hours. The line at ${FIRST_REPLY_TARGET_HOURS} hours is the target.`}
        >
          <FirstReplyChart months={view.months} />
        </Box>
        <Box title="Tickets each month" note="Every ticket coaches started, ideas too.">
          <VolumeChart months={view.months} tickets={view.coach} />
        </Box>
      </div>

      <Box
        title="What coaches ask about"
        note={`${periodInfo.label}, sorted by AI. Open a topic to see its tickets.`}
      >
        <TopicsPanel
          current={view.current}
          previous={hasPrevious ? view.previous : null}
          tickets={view.inPeriod}
          nowMs={nowMs}
        />
      </Box>

      <div className="grid gap-6 lg:grid-cols-3">
        <Box title="When tickets come in" note={`${periodInfo.label}, UK time.`}>
          <HeatGrid heat={view.current.heat} />
        </Box>
        <Box title="Where they come from" note={periodInfo.label}>
          <MixPanel current={view.current} />
        </Box>
        <Box title="Coaches who asked most" note={periodInfo.label}>
          <CoachList coaches={view.current.coaches} />
        </Box>
      </div>

      <p className="text-caption text-slate-500">
        Counts tickets coaches started; the numbers in the blue band count everything in the inbox. Ideas count in tickets and topics, not in reply or close times. Working
        hours are Monday to Friday, 9am to 6pm UK. Before 18 Nov 2026, a ticket&apos;s close time is its last message.
      </p>
    </div>
  );
}

/* ---------------- frame ---------------- */

function Box({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {note && <p className="mt-0.5 text-caption text-slate-500">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function PeriodSwitch({ value, onChange }: { value: PeriodKey; onChange: (v: PeriodKey) => void }) {
  return (
    <div
      className="inline-flex h-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
      role="group"
      aria-label="Period"
    >
      {PERIODS.map((p, i) => (
        <span key={p.key} className="flex">
          {i > 0 && <span className="w-px shrink-0 self-stretch bg-slate-200" aria-hidden />}
          <button
            type="button"
            aria-pressed={value === p.key}
            onClick={() => onChange(p.key)}
            className={`px-3.5 text-ui font-medium transition ${
              value === p.key ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ---------------- right now ---------------- */

function NowBand({
  current,
  now,
  periodLabel,
  nowMs,
}: {
  current: PeriodStats;
  now: ReturnType<typeof nowStats>;
  periodLabel: string;
  nowMs: number;
}) {
  const wait = current.firstReplyClock;
  const onTarget = wait !== null && wait <= FIRST_REPLY_TARGET_HOURS;
  const waiting = now.awaitingFirstReply;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div
        className="grid gap-8 px-6 py-7 text-white md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-8"
        style={{ background: "linear-gradient(165deg, #051e36 0%, #0c5290 58%, #1a8fd4 100%)" }}
      >
        <div className="min-w-0">
          <h2 className="text-heading text-white text-balance">
            {wait === null ? (
              <span className="font-light">No first replies in this period yet</span>
            ) : (
              <>
                <span className="font-light">Coaches typically wait </span>
                <span className="font-semibold">{formatHours(wait)}</span>
                <span className="font-light"> for a first reply</span>
              </>
            )}
          </h2>
          <p className="mt-3 text-ui text-sky-100">
            {periodLabel}.
            {current.firstReplyWorking !== null && ` ${formatHours(current.firstReplyWorking)} in working hours.`}
            {wait !== null && (
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-0.5 font-medium text-white">
                {onTarget ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                )}
                {onTarget ? "Inside" : "Over"} the {FIRST_REPLY_TARGET_HOURS}-hour target
              </span>
            )}
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-white/15 md:min-w-[26rem]">
          <NowFact label="With BCA now" value={String(now.withBca)} />
          <NowFact label="Waiting on a coach" value={String(now.waitingOnCoach)} />
          <NowFact
            label="Oldest with BCA"
            value={now.oldestWithBcaHours === null ? "None" : formatHours(now.oldestWithBcaHours)}
          />
        </dl>
      </div>
      {waiting.length > 0 && (
        <div className="px-6 py-4 md:px-8">
          <h3 className="text-ui font-semibold text-slate-900">
            Waiting for a first reply <span className="font-normal text-slate-500">({waiting.length})</span>
          </h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {waiting.slice(0, 6).map((t) => {
              const hours = (nowMs - new Date(t.createdAt).getTime()) / 3_600_000;
              const late = hours > FIRST_REPLY_TARGET_HOURS;
              return (
                <li key={t.id}>
                  <Link
                    href={ticketHref(t.id)}
                    className="group flex items-center gap-3 py-2.5 text-ui focus-visible:outline-2 focus-visible:outline-sky-600"
                  >
                    <span className="w-28 shrink-0 truncate font-medium text-slate-900 sm:w-36">{t.coachName}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">{t.title || "No title"}</span>
                    <span
                      className={`shrink-0 tabular-nums ${late ? "font-medium text-amber-700" : "text-slate-500"}`}
                    >
                      {ago(t.createdAt, nowMs)}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function NowFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0 md:px-6">
      <dt className="text-caption text-sky-100">{label}</dt>
      <dd className="mt-1 whitespace-nowrap text-xl font-semibold text-white md:text-2xl">{value}</dd>
    </div>
  );
}

/* ---------------- key numbers ---------------- */

type Direction = "lower" | "higher" | "none";

function KpiStrip({ current, previous }: { current: PeriodStats; previous: PeriodStats | null }) {
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-5">
      <Kpi
        label="Tickets"
        value={String(current.tickets)}
        sub={[
          plural(current.byType.question ?? 0, "question"),
          plural(current.byType.bug ?? 0, "bug"),
          plural(current.byType.idea ?? 0, "idea"),
        ].join(", ")}
        now={current.tickets}
        before={previous?.tickets ?? null}
        better="none"
        format={(v) => String(v)}
      />
      <Kpi
        label="First reply"
        value={formatHours(current.firstReplyClock)}
        sub={current.firstReplyWorking === null ? "No replies yet" : `${formatHours(current.firstReplyWorking)} in working hours`}
        now={current.firstReplyClock}
        before={previous?.firstReplyClock ?? null}
        better="lower"
        format={formatHours}
      />
      <Kpi
        label={`Replied inside ${FIRST_REPLY_TARGET_HOURS} hours`}
        value={pct(current.withinTarget)}
        sub={current.targetBase ? `${current.withinTargetCount} of ${current.targetBase} tickets` : "No tickets yet"}
        now={current.withinTarget}
        before={previous?.withinTarget ?? null}
        better="higher"
        format={pct}
      />
      <Kpi
        label="Time to close"
        value={formatHours(current.closeClock)}
        sub={current.closeWorking === null ? "None closed yet" : `${formatHours(current.closeWorking)} in working hours`}
        now={current.closeClock}
        before={previous?.closeClock ?? null}
        better="lower"
        format={formatHours}
      />
      <Kpi
        label="Closed in one reply"
        value={pct(current.oneReply)}
        sub={`${current.reopened} opened again`}
        now={current.oneReply}
        before={previous?.oneReply ?? null}
        better="higher"
        format={pct}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  now,
  before,
  better,
  format,
}: {
  label: string;
  value: string;
  sub: string;
  now: number | null;
  before: number | null;
  better: Direction;
  format: (v: number) => string;
}) {
  let delta: ReactNode = null;
  if (now !== null && before !== null && format(now) !== format(before)) {
    const up = now > before;
    const good = better === "none" ? null : better === "lower" ? !up : up;
    const Arrow = up ? ArrowUpRight : ArrowDownRight;
    delta = (
      <p
        className={`mt-2 inline-flex items-center gap-1 text-caption font-medium ${
          good === null ? "text-slate-500" : good ? "text-emerald-700" : "text-red-700"
        }`}
      >
        <Arrow className="h-3.5 w-3.5" aria-hidden />
        <span>
          {up ? "Up" : "Down"} from {format(before)}
        </span>
      </p>
    );
  }
  return (
    <div className="border-slate-100 p-5 max-md:odd:border-r max-md:[&:not(:nth-last-child(-n+2))]:border-b md:border-r md:last:border-r-0">
      <p className="text-caption text-slate-500">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-caption text-slate-500">{sub}</p>
      {delta}
    </div>
  );
}

/* ---------------- where to do better ---------------- */

function Pointers({ items }: { items: Pointer[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <h2 className="text-base font-semibold text-slate-900">Where to do better</h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {items.map((p) => {
          const Icon = p.tone === "act" ? AlertCircle : p.tone === "good" ? CheckCircle2 : Eye;
          return (
            <li key={p.text} className="flex items-start gap-3 py-2.5 text-ui text-slate-700">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  p.tone === "act" ? "text-amber-600" : p.tone === "good" ? "text-emerald-600" : "text-sky-600"
                }`}
                aria-label={p.tone === "act" ? "Act on this" : p.tone === "good" ? "Going well" : "Worth watching"}
              />
              <span>{p.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------- charts ---------------- */

const CHART_H = 200;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

function useHover() {
  return useState<number | null>(null);
}

/** Draw charts at their real width so the text stays readable on phones. */
function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // x is a share of the chart width (0..1).
  const right = x > 0.6;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-max max-w-[15rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-caption text-slate-700 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.25)]"
      style={right ? { right: `${(1 - x) * 100 + 2}%` } : { left: `${x * 100 + 2}%` }}
    >
      {children}
    </div>
  );
}

/** Median first reply per month, on a log scale (1 hour to a couple of weeks). */
function FirstReplyChart({ months }: { months: MonthRow[] }) {
  const [hover, setHover] = useHover();
  const [boxRef, W] = useChartWidth();
  const firstWithData = months.findIndex((m) => m.firstReplyClock !== null);
  const rows = firstWithData < 0 ? [] : months.slice(firstWithData);
  if (!rows.length) return <Empty>No replies recorded yet.</Empty>;

  const innerW = W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const max = Math.max(24 * 7, ...rows.map((r) => r.firstReplyClock ?? 0));
  const ticks = [
    { h: 1, label: "1 hr" },
    { h: 4, label: "4 hrs" },
    { h: 24, label: "1 day" },
    { h: 24 * 7, label: "1 week" },
    ...(max > 24 * 14 ? [{ h: 24 * 28, label: "4 weeks" }] : []),
  ];
  const top = ticks[ticks.length - 1]!.h;
  const lo = Math.log(0.5);
  const y = (h: number) => PAD.top + innerH - ((Math.log(Math.max(0.5, h)) - lo) / (Math.log(top) - lo)) * innerH;
  const step = innerW / rows.length;
  const x = (i: number) => PAD.left + step * (i + 0.5);

  const points = rows.map((r, i) => (r.firstReplyClock === null ? null : { i, x: x(i), y: y(r.firstReplyClock) }));
  const segments: string[] = [];
  let seg = "";
  for (const p of points) {
    if (!p) {
      if (seg) segments.push(seg);
      seg = "";
      continue;
    }
    seg += `${seg ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  if (seg) segments.push(seg);
  const last = [...points].reverse().find(Boolean);
  const beforeLast = last ? [...points.slice(0, last.i)].reverse().find(Boolean) : undefined;
  // Put the end label on the side the line isn't coming from.
  const labelBelow = Boolean(last && beforeLast && beforeLast.y < last.y);
  const h = hover === null ? null : rows[hover];

  return (
    <div className="relative" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${CHART_H}`} className="block h-auto w-full" role="img" aria-label="Typical first reply time by month">
        {ticks.map((t) => (
          <g key={t.h}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t.h)} y2={y(t.h)} stroke="#eef2f6" />
            <text x={PAD.left - 8} y={y(t.h) + 4} textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
              {t.label}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(FIRST_REPLY_TARGET_HOURS)}
          y2={y(FIRST_REPLY_TARGET_HOURS)}
          stroke="#16a34a"
          strokeWidth={1.25}
        />
        <text x={W - PAD.right} y={y(FIRST_REPLY_TARGET_HOURS) - 6} textAnchor="end" className="fill-emerald-700 text-[11px] font-medium">
          Target
        </text>
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="#0c5290" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p) =>
          p ? (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={hover === p.i ? 5.5 : 4.5}
              fill="#0c5290"
              stroke="#fff"
              strokeWidth={2}
            />
          ) : null
        )}
        {last && rows[last.i]?.firstReplyClock != null && (
          <text
            x={Math.min(last.x, W - PAD.right - 4)}
            y={labelBelow ? last.y + 20 : last.y - 12}
            textAnchor={last.x > W - 80 ? "end" : "middle"}
            className="fill-slate-900 text-[12px] font-semibold"
          >
            {formatHours(rows[last.i]!.firstReplyClock)}
          </text>
        )}
        {rows.map((r, i) => (
          <g key={r.key}>
            <text x={x(i)} y={CHART_H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {r.label}
            </text>
            <rect
              x={PAD.left + step * i}
              y={PAD.top}
              width={step}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#cbd5e1" />}
      </svg>
      {h && (
        <Tooltip x={x(hover!) / W}>
          <p className="font-semibold text-slate-900">
            {monthLabel(h.key, true)}
            {h.partial ? " so far" : ""}
          </p>
          {h.firstReplyClock === null ? (
            <p>No replies recorded</p>
          ) : (
            <>
              <p>Typical wait: {formatHours(h.firstReplyClock)}</p>
              <p>In working hours: {formatHours(h.firstReplyWorking)}</p>
              <p>
                Inside {FIRST_REPLY_TARGET_HOURS} hours: {Math.round((h.withinTarget ?? 0) * 100)}% of {h.answered}
              </p>
              <p>Typical time to close: {formatHours(h.closeClock)}</p>
            </>
          )}
        </Tooltip>
      )}
    </div>
  );
}

function VolumeChart({ months, tickets }: { months: MonthRow[]; tickets: DashTicket[] }) {
  const [mode, setMode] = useState<"type" | "channel">("type");
  const [hover, setHover] = useHover();
  const [boxRef, W] = useChartWidth();

  const series =
    mode === "type"
      ? TYPE_ORDER.map((k) => ({ key: k as string, label: TYPE_LABELS[k]!, color: TYPE_COLORS[k]! }))
      : CHANNELS.map((c) => ({ key: c.key as string, label: c.label, color: c.color }));

  const byChannel = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const t of tickets) {
      const k = t.createdAt ? monthKeyLocal(t.createdAt) : "";
      const row = map.get(k) ?? {};
      const g = sourceGroup(t.source);
      row[g] = (row[g] ?? 0) + 1;
      map.set(k, row);
    }
    return map;
  }, [tickets]);

  const valuesFor = (m: MonthRow): Record<string, number> => (mode === "type" ? m.byType : byChannel.get(m.key) ?? {});

  const innerW = W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const maxTotal = Math.max(1, ...months.map((m) => m.total));
  const niceMax = maxTotal <= 10 ? 10 : maxTotal <= 20 ? 20 : maxTotal <= 40 ? 40 : Math.ceil(maxTotal / 20) * 20;
  const ticks = [0, niceMax / 2, niceMax];
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;
  const step = innerW / months.length;
  const barW = Math.min(24, step * 0.55);
  const h = hover === null ? null : months[hover];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend items={series} />
        <div className="inline-flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-white" role="group" aria-label="Split by">
          {(["type", "channel"] as const).map((m, i) => (
            <span key={m} className="flex">
              {i > 0 && <span className="w-px self-stretch bg-slate-200" aria-hidden />}
              <button
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`px-3 text-caption font-medium transition ${
                  mode === m ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m === "type" ? "By kind" : "By channel"}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${CHART_H}`} className="block h-auto w-full" role="img" aria-label="Tickets each month">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#eef2f6" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const vals = valuesFor(m);
            const cx = PAD.left + step * (i + 0.5);
            let base = 0;
            const parts = series
              .map((s) => ({ ...s, v: vals[s.key] ?? 0 }))
              .filter((s) => s.v > 0);
            return (
              <g key={m.key} opacity={hover === null || hover === i ? 1 : 0.55}>
                {parts.map((s, j) => {
                  const y0 = y(base);
                  base += s.v;
                  const y1 = y(base);
                  const isTop = j === parts.length - 1;
                  // 2px white gap between stacked parts.
                  const height = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
                  return isTop ? (
                    <path
                      key={s.key}
                      d={roundedTopRect(cx - barW / 2, y1, barW, height, 4)}
                      fill={s.color}
                    />
                  ) : (
                    <rect key={s.key} x={cx - barW / 2} y={y1} width={barW} height={height} fill={s.color} />
                  );
                })}
                {m.total > 0 && (
                  <text x={cx} y={y(m.total) - 6} textAnchor="middle" className="fill-slate-700 text-[11px] font-medium tabular-nums">
                    {m.total}
                  </text>
                )}
                <text x={cx} y={CHART_H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                  {m.label}
                </text>
                <rect
                  x={PAD.left + step * i}
                  y={PAD.top}
                  width={step}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {h && (
          <Tooltip x={(PAD.left + step * (hover! + 0.5)) / W}>
            <p className="font-semibold text-slate-900">
              {monthLabel(h.key, true)}
              {h.partial ? " so far" : ""}: {h.total}
            </p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.label}: {valuesFor(h)[s.key] ?? 0}
              </p>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function monthKeyLocal(iso: string) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

function roundedTopRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Legend({ items }: { items: { key: string; label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-slate-600">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- topics ---------------- */

function TopicsPanel({
  current,
  previous,
  tickets,
  nowMs,
}: {
  current: PeriodStats;
  previous: PeriodStats | null;
  tickets: DashTicket[];
  nowMs: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = [...SUPPORT_TOPICS.map((t) => t.key as string), "unsorted"]
    .map((key) => ({ key, n: current.topics[key] ?? 0, before: previous?.topics[key] ?? null }))
    .filter((r) => r.n > 0 || (r.before ?? 0) > 0)
    // "Other" last: it isn't a thing to fix.
    .sort((a, b) => (a.key === "other" ? 1 : b.key === "other" ? -1 : b.n - a.n));
  if (!rows.length) return <Empty>No tickets in this period.</Empty>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  void nowMs;

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => {
        const isOpen = open === r.key;
        const list = isOpen
          ? tickets
              .filter((t) => (t.topic ?? "unsorted") === r.key)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          : [];
        const change = r.before === null ? null : r.n - r.before;
        return (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : r.key)}
              aria-expanded={isOpen}
              disabled={r.n === 0}
              className="grid w-full grid-cols-[minmax(0,1fr)_2rem_3rem_1rem] items-center gap-3 py-2.5 text-left text-ui hover:bg-slate-50/70 disabled:cursor-default disabled:hover:bg-transparent sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_3rem_6.5rem_1rem]"
            >
              <span className="truncate font-medium text-slate-900">{supportTopicLabel(r.key === "unsorted" ? null : r.key)}</span>
              <span className="h-3 overflow-hidden rounded-r-[4px] max-sm:hidden">
                <span
                  className="block h-full rounded-r-[4px] bg-[#0c5290] transition-[width] duration-500 ease-out"
                  style={{ width: `${(r.n / max) * 100}%`, opacity: r.key === "other" ? 0.35 : 1 }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums text-slate-900">{r.n}</span>
              <span
                className={`text-right text-caption tabular-nums ${
                  change === null || change === 0 ? "text-slate-400" : change > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {change === null ? "" : change === 0 ? (
                  <>
                    <span className="sm:hidden">=</span>
                    <span className="max-sm:hidden">Same as before</span>
                  </>
                ) : (
                  <>
                    {`${change > 0 ? "+" : ""}${change}`}
                    <span className="max-sm:hidden"> on before</span>
                  </>
                )}
              </span>
              <ChevronRight
                className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-90" : ""} ${r.n === 0 ? "invisible" : ""}`}
                aria-hidden
              />
            </button>
            {isOpen && (
              <ul className="mb-3 ml-1 border-l border-slate-200 pl-4">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={ticketHref(t.id)}
                      className="flex items-center gap-3 py-1.5 text-ui text-slate-700 hover:text-sky-700"
                    >
                      <span className="w-14 shrink-0 text-caption tabular-nums text-slate-500 max-sm:hidden">{shortDate(t.createdAt)}</span>
                      <span className="w-28 shrink-0 truncate text-slate-900 sm:w-36">{t.coachName}</span>
                      <span className="min-w-0 flex-1 truncate">{t.title || "No title"}</span>
                      <span className="shrink-0 text-caption text-slate-500 max-sm:hidden">{TYPE_LABELS[t.type]?.replace(/s$/, "") ?? t.type}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- busiest times, mix, coaches ---------------- */

const HEAT_RAMP = ["#f1f5f9", "#dbeafe", "#a9cdee", "#5b9ad3", "#1f6bb0", "#0c4a80"];

function HeatGrid({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div>
      <div className="grid grid-cols-[2.5rem_repeat(4,minmax(0,1fr))] gap-1 text-caption text-slate-500">
        <span />
        {HEAT_BLOCKS.map((b) => (
          <span key={b.label} className="truncate text-center" title={b.hint}>
            {b.label}
          </span>
        ))}
        {heat.map((row, d) => (
          <HeatRow key={days[d]} day={days[d]!} row={row} max={max} />
        ))}
      </div>
    </div>
  );
}

function HeatRow({ day, row, max }: { day: string; row: number[]; max: number }) {
  return (
    <>
      <span className="flex items-center">{day}</span>
      {row.map((n, b) => {
        const level = n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5));
        return (
          <span
            key={b}
            title={`${day} ${HEAT_BLOCKS[b]!.label.toLowerCase()} (${HEAT_BLOCKS[b]!.hint}): ${n} ticket${n === 1 ? "" : "s"}`}
            className={`flex h-8 items-center justify-center rounded-[4px] text-caption font-medium tabular-nums ${
              level >= 3 ? "text-white" : "text-slate-600"
            }`}
            style={{ background: HEAT_RAMP[level] }}
          >
            {n > 0 ? n : ""}
          </span>
        );
      })}
    </>
  );
}

function MixPanel({ current }: { current: PeriodStats }) {
  const channels = CHANNELS.map((c) => ({ ...c, v: current.bySource[c.key] }));
  const types = TYPE_ORDER.map((k) => ({ key: k, label: TYPE_LABELS[k]!, color: TYPE_COLORS[k]!, v: current.byType[k] ?? 0 }));
  if (!current.tickets) return <Empty>No tickets in this period.</Empty>;
  return (
    <div className="space-y-6">
      <SplitBar title="Channel" parts={channels} total={current.tickets} />
      <SplitBar title="Kind" parts={types} total={current.tickets} />
      <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div>
          <dt className="text-caption text-slate-500">Marked helpful</dt>
          <dd className="mt-0.5 text-ui font-semibold text-slate-900">
            {current.helpfulVotes ? `${current.helpfulYes} of ${current.helpfulVotes} votes` : "No votes yet"}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-slate-500">Waited over a day</dt>
          <dd className="mt-0.5 text-ui font-semibold text-slate-900">
            {current.overADay} ticket{current.overADay === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SplitBar({
  title,
  parts,
  total,
}: {
  title: string;
  parts: { key: string; label: string; color: string; v: number }[];
  total: number;
}) {
  const shown = parts.filter((p) => p.v > 0);
  return (
    <div>
      <p className="mb-2 text-caption font-medium text-slate-700">{title}</p>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={shown.map((p) => `${p.label} ${p.v}`).join(", ")}>
        {shown.map((p) => (
          <span key={p.key} style={{ width: `${(p.v / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.v}`} />
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-caption text-slate-600">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="flex-1">{p.label}</span>
            <span className="tabular-nums text-slate-900">{p.v}</span>
            <span className="w-9 text-right tabular-nums text-slate-500">{Math.round((p.v / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoachList({ coaches }: { coaches: { id: string; name: string; count: number }[] }) {
  if (!coaches.length) return <Empty>No tickets in this period.</Empty>;
  const top = coaches.slice(0, 7);
  const max = top[0]!.count;
  return (
    <ul className="space-y-2.5">
      {top.map((c) => (
        <li key={c.id} className="text-ui">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-slate-900">{c.name}</span>
            <span className="font-semibold tabular-nums text-slate-900">{c.count}</span>
          </div>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-sky-600" style={{ width: `${(c.count / max) * 100}%` }} />
          </span>
        </li>
      ))}
      {coaches.length > top.length && (
        <li className="pt-1 text-caption text-slate-500">
          {coaches.length - top.length} more coach{coaches.length - top.length === 1 ? "" : "es"}
        </li>
      )}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-ui text-slate-500">{children}</p>;
}
