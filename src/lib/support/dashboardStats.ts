/**
 * Support dashboard numbers (job 237). Pure functions over a small list of
 * tickets, so the page can switch period without asking the server again.
 *
 * Agreed with Zander, 18 Nov:
 * - Times are clock hours, with working hours (Mon to Fri, 9 to 6 UK) beside them.
 * - First reply target: 4 hours.
 * - Ideas count in volume and topics, not in reply or close times.
 * - Only tickets coaches started count (not BCA's own notes, chats BCA opened, or
 *   launch threads). "Right now" counts everything in the inbox.
 */

export const FIRST_REPLY_TARGET_HOURS = 4;
const HOUR = 3_600_000;
const TZ = "Europe/London";
const WORK_START = 9;
const WORK_END = 18;

export type DashTicket = {
  id: string;
  number: number | null;
  title: string;
  createdAt: string;
  resolvedAt: string | null;
  status: string;
  type: string;
  source: string;
  topic: string | null;
  coachId: string | null;
  coachName: string;
  /** First reply from BCA (an admin, or Ava). */
  firstReplyAt: string | null;
  /** How many replies BCA sent. */
  bcaReplies: number;
  reopened: boolean;
  helpful: boolean | null;
  /** A coach started it. Only these count in the numbers; "right now" counts everything in the inbox. */
  coachStarted: boolean;
};

export type PeriodKey = "30" | "90" | "365";
export const PERIODS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "30", label: "Last 30 days", short: "30 days" },
  { key: "90", label: "Last 90 days", short: "90 days" },
  { key: "365", label: "Last 12 months", short: "12 months" },
];

export const SOURCE_LABELS: Record<string, string> = {
  direct: "In the app",
  lesson_private: "In the app",
  public_form: "In the app",
  admin_created: "In the app",
  email_inbox: "Email",
  whatsapp: "WhatsApp",
};
export function sourceGroup(source: string): "app" | "email" | "whatsapp" {
  return source === "email_inbox" ? "email" : source === "whatsapp" ? "whatsapp" : "app";
}

export const TYPE_ORDER = ["question", "bug", "idea", "other"] as const;
export const TYPE_LABELS: Record<string, string> = {
  question: "Questions",
  bug: "Bugs",
  idea: "Ideas",
  other: "Other",
};

/* ---------- London time ---------- */

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

type LondonParts = { y: number; m: number; d: number; h: number; min: number; weekday: number };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function londonParts(date: Date): LondonParts {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

/** UTC time for a London wall-clock time (handles summer time). */
function londonToUtc(y: number, m: number, d: number, h: number): number {
  const guess = Date.UTC(y, m - 1, d, h);
  const p = londonParts(new Date(guess));
  const asIf = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  return guess - (asIf - guess);
}

/** Hours between two times that fall Mon to Fri, 9am to 6pm UK. */
export function workingHoursBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!(end > start)) return 0;
  let total = 0;
  const first = londonParts(new Date(start));
  let day = Date.UTC(first.y, first.m - 1, first.d);
  for (let i = 0; i < 400; i++) {
    const dt = new Date(day);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const open = londonToUtc(y, m, d, WORK_START);
    if (open > end) break;
    const weekday = (dt.getUTCDay() + 6) % 7;
    if (weekday < 5) {
      const close = londonToUtc(y, m, d, WORK_END);
      const from = Math.max(open, start);
      const to = Math.min(close, end);
      if (to > from) total += to - from;
    }
    day += 24 * HOUR;
  }
  return total / HOUR;
}

/* ---------- small maths ---------- */

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / HOUR;
}

/** "45 min", "3.1 hrs", "2.4 days". */
export function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "–";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} hrs`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1).replace(/\.0$/, "") : Math.round(days)} days`;
}

export function monthKey(iso: string): string {
  const p = londonParts(new Date(iso));
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, 15)));
}

/* ---------- period stats ---------- */

export type PeriodStats = {
  tickets: number;
  byType: Record<string, number>;
  bySource: Record<"app" | "email" | "whatsapp", number>;
  /** Tickets that count for times (not ideas). */
  timed: number;
  firstReplyClock: number | null;
  firstReplyWorking: number | null;
  /** Share answered inside the target, of those answered or already past it. */
  withinTarget: number | null;
  withinTargetCount: number;
  targetBase: number;
  closeClock: number | null;
  closeWorking: number | null;
  closed: number;
  /** Closed with exactly one reply from BCA. */
  oneReply: number | null;
  reopened: number;
  helpfulYes: number;
  helpfulVotes: number;
  topics: Record<string, number>;
  coaches: { id: string; name: string; count: number }[];
  /** [weekday 0-6][block 0-3]: night, morning, afternoon, evening. */
  heat: number[][];
  overADay: number;
};

export const HEAT_BLOCKS = [
  { label: "Night", hint: "midnight to 8am" },
  { label: "Morning", hint: "8am to noon" },
  { label: "Afternoon", hint: "noon to 6pm" },
  { label: "Evening", hint: "6pm to midnight" },
];
function heatBlock(hour: number): number {
  return hour < 8 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
}

export function statsFor(tickets: DashTicket[], fromMs: number, toMs: number, nowMs: number): PeriodStats {
  const inPeriod = tickets.filter((t) => {
    const at = new Date(t.createdAt).getTime();
    return at >= fromMs && at < toMs;
  });
  const timed = inPeriod.filter((t) => t.type !== "idea");

  const replyClock: number[] = [];
  const replyWorking: number[] = [];
  let withinTargetCount = 0;
  let targetBase = 0;
  let overADay = 0;
  for (const t of timed) {
    if (t.firstReplyAt) {
      const h = hoursBetween(t.createdAt, t.firstReplyAt);
      replyClock.push(h);
      replyWorking.push(workingHoursBetween(t.createdAt, t.firstReplyAt));
      targetBase += 1;
      if (h <= FIRST_REPLY_TARGET_HOURS) withinTargetCount += 1;
      if (h > 24) overADay += 1;
    } else if (t.status !== "resolved") {
      // Still waiting: counts against the target once it's past it.
      const h = (nowMs - new Date(t.createdAt).getTime()) / HOUR;
      if (h > FIRST_REPLY_TARGET_HOURS) targetBase += 1;
      if (h > 24) overADay += 1;
    }
  }

  const closeClock: number[] = [];
  const closeWorking: number[] = [];
  let oneReplyCount = 0;
  let oneReplyBase = 0;
  for (const t of timed) {
    if (t.status !== "resolved" || !t.resolvedAt) continue;
    closeClock.push(Math.max(0, hoursBetween(t.createdAt, t.resolvedAt)));
    closeWorking.push(workingHoursBetween(t.createdAt, t.resolvedAt));
    if (t.bcaReplies >= 1) {
      oneReplyBase += 1;
      if (t.bcaReplies === 1) oneReplyCount += 1;
    }
  }

  const byType: Record<string, number> = {};
  const bySource = { app: 0, email: 0, whatsapp: 0 };
  const topics: Record<string, number> = {};
  const coachMap = new Map<string, { id: string; name: string; count: number }>();
  const heat = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  let reopened = 0;
  let helpfulYes = 0;
  let helpfulVotes = 0;
  for (const t of inPeriod) {
    byType[t.type] = (byType[t.type] ?? 0) + 1;
    bySource[sourceGroup(t.source)] += 1;
    const topic = t.topic ?? "unsorted";
    topics[topic] = (topics[topic] ?? 0) + 1;
    if (t.coachId) {
      const c = coachMap.get(t.coachId) ?? { id: t.coachId, name: t.coachName, count: 0 };
      c.count += 1;
      coachMap.set(t.coachId, c);
    }
    const p = londonParts(new Date(t.createdAt));
    heat[p.weekday]![heatBlock(p.h)]! += 1;
    if (t.reopened) reopened += 1;
    if (t.helpful !== null) {
      helpfulVotes += 1;
      if (t.helpful) helpfulYes += 1;
    }
  }

  return {
    tickets: inPeriod.length,
    byType,
    bySource,
    timed: timed.length,
    firstReplyClock: median(replyClock),
    firstReplyWorking: median(replyWorking),
    withinTarget: targetBase ? withinTargetCount / targetBase : null,
    withinTargetCount,
    targetBase,
    closeClock: median(closeClock),
    closeWorking: median(closeWorking),
    closed: closeClock.length,
    oneReply: oneReplyBase ? oneReplyCount / oneReplyBase : null,
    reopened,
    helpfulYes,
    helpfulVotes,
    topics,
    coaches: [...coachMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    heat,
    overADay,
  };
}

/* ---------- months ---------- */

export type MonthRow = {
  key: string;
  label: string;
  byType: Record<string, number>;
  total: number;
  firstReplyClock: number | null;
  firstReplyWorking: number | null;
  withinTarget: number | null;
  answered: number;
  closeClock: number | null;
  /** This month is still going. */
  partial: boolean;
};

export function monthlyRows(tickets: DashTicket[], months: number, nowMs: number): MonthRow[] {
  const now = londonParts(new Date(nowMs));
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.y, now.m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const byMonth = new Map<string, DashTicket[]>(keys.map((k) => [k, []]));
  for (const t of tickets) byMonth.get(monthKey(t.createdAt))?.push(t);

  return keys.map((key, i) => {
    const list = byMonth.get(key)!;
    const byType: Record<string, number> = {};
    for (const t of list) byType[t.type] = (byType[t.type] ?? 0) + 1;
    const timed = list.filter((t) => t.type !== "idea");
    const answered = timed.filter((t) => t.firstReplyAt);
    const clock = answered.map((t) => hoursBetween(t.createdAt, t.firstReplyAt!));
    const closed = timed.filter((t) => t.status === "resolved" && t.resolvedAt);
    return {
      key,
      label: monthLabel(key),
      byType,
      total: list.length,
      firstReplyClock: median(clock),
      firstReplyWorking: median(answered.map((t) => workingHoursBetween(t.createdAt, t.firstReplyAt!))),
      withinTarget: clock.length ? clock.filter((h) => h <= FIRST_REPLY_TARGET_HOURS).length / clock.length : null,
      answered: clock.length,
      closeClock: median(closed.map((t) => Math.max(0, hoursBetween(t.createdAt, t.resolvedAt!)))),
      partial: i === keys.length - 1,
    };
  });
}

/* ---------- right now ---------- */

export type NowStats = {
  /** Open with no reply from BCA yet, oldest first. */
  awaitingFirstReply: DashTicket[];
  /** BCA to do or in progress. */
  withBca: number;
  waitingOnCoach: number;
  oldestWithBcaHours: number | null;
};

export function nowStats(tickets: DashTicket[], nowMs: number): NowStats {
  const withBca = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const awaiting = tickets
    .filter((t) => t.coachStarted && t.status !== "resolved" && !t.firstReplyAt && t.type !== "idea")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const oldest = withBca.reduce<string | null>(
    (min, t) => (min === null || t.createdAt < min ? t.createdAt : min),
    null
  );
  return {
    awaitingFirstReply: awaiting,
    withBca: withBca.length,
    waitingOnCoach: tickets.filter((t) => t.status === "waiting_reply").length,
    oldestWithBcaHours: oldest ? (nowMs - new Date(oldest).getTime()) / HOUR : null,
  };
}

/* ---------- where to do better ---------- */

export type Pointer = { tone: "act" | "watch" | "good"; text: string };

export function pointers(
  current: PeriodStats,
  previous: PeriodStats,
  now: NowStats,
  topicLabel: (key: string) => string,
  nowMs: number
): Pointer[] {
  const out: Pointer[] = [];

  const late = now.awaitingFirstReply.filter(
    (t) => (nowMs - new Date(t.createdAt).getTime()) / HOUR > FIRST_REPLY_TARGET_HOURS
  );
  if (late.length) {
    out.push({
      tone: "act",
      text: `${late.length === 1 ? "One coach has" : `${late.length} coaches have`} waited more than ${FIRST_REPLY_TARGET_HOURS} hours for a first reply. Start there.`,
    });
  }

  const topics = Object.entries(current.topics)
    .filter(([k]) => k !== "other" && k !== "unsorted")
    .sort((a, b) => b[1] - a[1]);
  const top = topics[0];
  if (top && top[1] >= 3 && current.tickets) {
    out.push({
      tone: "act",
      text: `${topicLabel(top[0])} came up most: ${top[1]} of ${current.tickets} tickets. A help answer or a fix here saves the most time.`,
    });
  }

  let rising: [string, number, number] | null = null;
  for (const [k, n] of topics) {
    const before = previous.topics[k] ?? 0;
    if (n - before >= 3 && (!rising || n - before > rising[1] - rising[2])) rising = [k, n, before];
  }
  if (rising && rising[0] !== top?.[0]) {
    out.push({
      tone: "watch",
      text: `${topicLabel(rising[0])} is up: ${rising[1]} tickets, from ${rising[2]} the period before.`,
    });
  }

  const bugs = current.byType.bug ?? 0;
  if (current.tickets >= 5 && bugs / current.tickets >= 0.25) {
    out.push({
      tone: "watch",
      text: `${Math.round((bugs / current.tickets) * 100)}% of tickets were bugs. Fewer bugs means fewer tickets.`,
    });
  }

  if (
    current.firstReplyClock !== null &&
    current.firstReplyWorking !== null &&
    current.firstReplyClock - current.firstReplyWorking >= 3
  ) {
    out.push({
      tone: "watch",
      text: `Messages out of hours add about ${formatHours(current.firstReplyClock - current.firstReplyWorking)} to the wait. A quick "got it, we'll reply in the morning" would help.`,
    });
  }

  let busiest: [number, number, number] | null = null;
  current.heat.forEach((row, d) =>
    row.forEach((n, b) => {
      if (!busiest || n > busiest[2]) busiest = [d, b, n];
    })
  );
  const b = busiest as [number, number, number] | null;
  if (b && b[2] >= 3 && current.tickets >= 10) {
    out.push({
      tone: "watch",
      text: `Most tickets come in on ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][b[0]]} ${HEAT_BLOCKS[b[1]]!.label.toLowerCase()}s. Keep that time free for replies.`,
    });
  }

  if (
    current.firstReplyClock !== null &&
    previous.firstReplyClock !== null &&
    current.firstReplyClock < previous.firstReplyClock * 0.75
  ) {
    out.push({
      tone: "good",
      text: `First replies are faster: ${formatHours(current.firstReplyClock)}, down from ${formatHours(previous.firstReplyClock)}.`,
    });
  }

  return out.slice(0, 5);
}
