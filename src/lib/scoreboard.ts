/**
 * The coach Scoreboard: the BCA dashboard's Targets tab, turned round for a coach's own practice. Pure maths, no
 * data import yet: the coach types or drags their numbers in. Targets are income a month (£5k, £10k, £20k).
 *
 * The funnel: outbound (people the coach reaches out to) and inbound (people who come to them), each an amount a
 * month and the share who end up interested. One rate books them into
 * a Constraint Call; some of those book a Profit Roadmap call, and some of those become clients. Clients stay a
 * number of months at a fee a month.
 */

import { amount, lineFor, percent, pounds, type TargetLine } from "@/lib/profitTargets";

export { amount, lineFor, percent, pounds, type TargetLine };

/** Two volumes (Zander, 2 Nov 2026: keep it simple). Inbound covers posts, referrals and the website together. */
export type SourceKey = "outbound" | "inbound";

export type RateKey =
  | "outboundRate"
  | "inboundRate"
  | "interestToBook"
  | "callShow"
  | "callToRoadmap"
  | "roadmapShow"
  | "closeRate"
  | "months"
  | "fee";

/** Every number the coach sets: an amount a month for each source, and every rate. */
export type Numbers = Record<RateKey, number> & Record<SourceKey, number>;

type Unit = "percent" | "months" | "pounds";

const OUTBOUND_WHY =
  "Outbound is new people you reach out to a month, by connection request, message or email. Count each person once. The rate is how many in every 100 end up interested in a call. In our data from 110,000 connection requests, about 1 in 100 do. The best notes get 2 in 100.";
const INBOUND_WHY =
  "Inbound is people who come to you a month, from your posts, a referral or your website. The rate is how many of them are interested in a call: 50% is 5 in every 10.";

export const SOURCES: Array<{
  key: SourceKey;
  rate: RateKey;
  label: string;
  /** What the amount a month counts, after the number: "400 people". */
  word: string;
  why: string;
}> = [
  { key: "outbound", rate: "outboundRate", label: "Outbound", word: "people", why: OUTBOUND_WHY },
  { key: "inbound", rate: "inboundRate", label: "Inbound", word: "people", why: INBOUND_WHY },
];

export const RATES: Array<{ key: RateKey; label: string; unit: Unit; why: string }> = [
  { key: "outboundRate", label: "Outbound to interested", unit: "percent", why: OUTBOUND_WHY },
  { key: "inboundRate", label: "Inbound to interested", unit: "percent", why: INBOUND_WHY },
  {
    key: "interestToBook",
    label: "Interested to booked",
    unit: "percent",
    why: "Share of interested people who book a Constraint Call with you.",
  },
  {
    key: "callShow",
    label: "Constraint Call show rate",
    unit: "percent",
    why: "Share of booked Constraint Calls that happen. On the Constraint Call you find the one thing holding the business back.",
  },
  {
    key: "callToRoadmap",
    label: "Constraint Call to roadmap",
    unit: "percent",
    why: "Share of Constraint Calls that happen and book a Profit Roadmap call.",
  },
  {
    key: "roadmapShow",
    label: "Roadmap show rate",
    unit: "percent",
    why: "Share of booked Profit Roadmap calls that happen.",
  },
  {
    key: "closeRate",
    label: "Close rate",
    unit: "percent",
    why: "Share of owners who had a Profit Roadmap call and became a client, on the call or later.",
  },
  {
    key: "months",
    label: "Months a client stays",
    unit: "months",
    why: "How long a client stays with you on average, in months.",
  },
  {
    key: "fee",
    label: "Fee a month",
    unit: "pounds",
    why: "What a client pays you a month on average.",
  },
];

export const unitOf = (key: RateKey): Unit => RATES.find((rate) => rate.key === key)!.unit;
export const labelOf = (key: RateKey): string => RATES.find((rate) => rate.key === key)!.label;


/**
 * What good looks like: each step's target until the coach moves it. Zander, 2 Nov 2026: interested to booked 50%,
 * both show rates 100%, Constraint Call to roadmap 80%, close 25%.
 */
export const DEFAULT_TARGETS: Record<RateKey, number> = {
  outboundRate: 0.01,
  inboundRate: 0.5,
  interestToBook: 0.5,
  callShow: 1,
  callToRoadmap: 0.8,
  roadmapShow: 1,
  closeRate: 0.25,
  months: 12,
  fee: 2000,
};

/**
 * Where everyone starts until they put in their own: every rate at its target (Zander, 2 Nov 2026), so nothing on
 * the page is made up. The two amounts a month have no target, so they start at 400 outbound and 2 inbound.
 */
export const STARTING: Numbers = { outbound: 400, inbound: 2, ...DEFAULT_TARGETS };

/** Income targets a month to compare against. */
export const TARGET_OPTIONS = [5_000, 10_000, 20_000] as const;
export const DEFAULT_PICKED: number[] = [...TARGET_OPTIONS];

/** Where each bar starts and ends, and one drag step. Better is always on the right. */
export const RANGES: Record<RateKey, { min: number; max: number; step: number }> = {
  outboundRate: { min: 0, max: 0.05, step: 0.001 },
  inboundRate: { min: 0, max: 1, step: 0.01 },
  interestToBook: { min: 0, max: 1, step: 0.01 },
  callShow: { min: 0, max: 1, step: 0.01 },
  callToRoadmap: { min: 0, max: 1, step: 0.01 },
  roadmapShow: { min: 0, max: 1, step: 0.01 },
  closeRate: { min: 0, max: 1, step: 0.01 },
  months: { min: 0, max: 36, step: 1 },
  fee: { min: 0, max: 5000, step: 50 },
};

/** The five call steps, interested to client. */
export const CALL_KEYS: RateKey[] = ["interestToBook", "callShow", "callToRoadmap", "roadmapShow", "closeRate"];

/** Share of people interested in a call who become a client: the five call rates multiplied. */
export function interestedToClient(n: Record<RateKey, number>): number {
  return CALL_KEYS.reduce((share, key) => share * n[key], 1);
}

/**
 * Great: what the new scripts aim for (Scripts and simulators deck, 26 Oct 2026): 80% book, 100% fit, 50% close,
 * so 10 interested become 4 clients, not 1. Outbound 2%, what the best notes got in our 110,000 requests (Zander,
 * 2 Nov 2026). Targets, not results yet. Everything else is the same as Good.
 */
export const GREAT: Record<RateKey, number> = {
  ...DEFAULT_TARGETS,
  outboundRate: 0.02,
  interestToBook: 0.8,
  callToRoadmap: 1,
  closeRate: 0.5,
};

export const WEEKS_PER_MONTH = 52 / 12;

/** Everything a month of these numbers makes, step by step. */
export type Volumes = Record<SourceKey, number> & {
  interested: number;
  booked: number;
  callsHeld: number;
  roadmapsBooked: number;
  roadmapsHeld: number;
  newClients: number;
  /** Clients at once, when new clients keep coming at this pace: new a month × months they stay. */
  clients: number;
  /** Income a month from those clients. */
  income: number;
};

export function interestedOf(n: Numbers): number {
  return SOURCES.reduce((sum, source) => sum + n[source.key] * n[source.rate], 0);
}

export function volumesOf(n: Numbers): Volumes {
  const interested = interestedOf(n);
  const booked = interested * n.interestToBook;
  const callsHeld = booked * n.callShow;
  const roadmapsBooked = callsHeld * n.callToRoadmap;
  const roadmapsHeld = roadmapsBooked * n.roadmapShow;
  const newClients = roadmapsHeld * n.closeRate;
  const clients = newClients * n.months;
  return {
    outbound: n.outbound,
    inbound: n.inbound,
    interested,
    booked,
    callsHeld,
    roadmapsBooked,
    roadmapsHeld,
    newClients,
    clients,
    income: clients * n.fee,
  };
}

/**
 * What an income target needs a month at these rates. Everything is in step with the outreach, so every source
 * grows by the same share: the coach's own mix, scaled up or down.
 */
export function needsFor(target: number, n: Numbers): Volumes {
  const income = volumesOf(n).income;
  const scale = income > 0 ? target / income : 0;
  const scaled = { ...n };
  for (const source of SOURCES) scaled[source.key] = n[source.key] * scale;
  return volumesOf(scaled);
}

/** Income a month this one step adds if it hits its target, with everything else as it is. */
export function gainIfHit(n: Numbers, key: RateKey, target: number): number {
  return volumesOf({ ...n, [key]: target }).income - volumesOf(n).income;
}

/** How often a new client has to start: "every 6 weeks". Null when none ever do. */
export function signEveryWeeks(newClients: number): number | null {
  return newClients > 0 ? WEEKS_PER_MONTH / newClients : null;
}

export function weeksText(weeks: number | null): string {
  if (weeks === null || !Number.isFinite(weeks)) return "never";
  if (weeks < 1) return "under a week";
  const shown = Math.round(weeks);
  return shown === 1 ? "1 week" : `${shown} weeks`;
}

export function rateText(key: RateKey, value: number): string {
  const unit = unitOf(key);
  if (unit === "percent") return percent(value);
  if (unit === "months") return `${Math.round(value)} months`;
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

/** Income with one decimal in thousands: £12.5k, £20k. */
export function incomeText(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1000) return `${sign}£${Math.round(abs)}`;
  return `${sign}£${(abs / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export function targetLabel(target: number): string {
  return `£${Math.round(target / 1000)}k`;
}

/** What gets kept between visits, on this device. */
export type Saved = {
  now: Numbers;
  targets: Partial<Record<RateKey, number>>;
  picked: number[];
};

export function storageKey(userId: string | null): string {
  return `bca-scoreboard:v4:${userId ?? "anon"}`;
}

/** A saved copy, with anything missing or broken put back to the start. */
export function readSaved(raw: string | null): Saved | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const now = { ...STARTING };
    for (const key of Object.keys(STARTING) as Array<keyof Numbers>) {
      const value = parsed.now?.[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) now[key] = value;
    }
    const targets: Partial<Record<RateKey, number>> = {};
    for (const key of Object.keys(DEFAULT_TARGETS) as RateKey[]) {
      const value = parsed.targets?.[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) targets[key] = value;
    }
    const picked = (parsed.picked ?? []).filter((value) => (TARGET_OPTIONS as readonly number[]).includes(value));
    return { now, targets, picked: picked.length > 0 ? picked : DEFAULT_PICKED };
  } catch {
    return null;
  }
}
