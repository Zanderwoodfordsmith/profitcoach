/**
 * Scoreboard V2 (Zander, 5 Nov 2026), beside V1 until he picks. It starts from V1's clean example, and coaches type
 * their own numbers over it. Starting from their data was tried and parked the same day: show rates, roadmap calls
 * and the close aren't tracked yet, so most rows would be targets anyway (the loader is kept in
 * src/lib/scoreboardData.ts for when they are). Changes from V1:
 * 1. Coaches can add their own lead sources (referrals, a partner, an event): a name, how many people a month, the
 *    share who get interested now, and their target for it. These add to Interested like outbound and inbound.
 * 2. Clients at once stop at MAX_CLIENTS, about the most one person can coach, so Great can't show £96k a month.
 * 3. Pace reads in months ("a new client every 2.4 months").
 * Everything else is V1's maths (src/lib/scoreboard.ts).
 */

import {
  DEFAULT_PICKED,
  DEFAULT_TARGETS,
  SOURCES,
  STARTING,
  TARGET_OPTIONS,
  WEEKS_PER_MONTH,
  type Numbers,
  type RateKey,
  type Volumes,
} from "@/lib/scoreboard";

export type ExtraSource = {
  id: string;
  name: string;
  /** People a month. */
  amount: number;
  /** Share who get interested, now. */
  rate: number;
  /** Their target for that share. */
  target: number;
};

/** About the most clients one coach can run at once (Zander's range: 5 to 20). */
export const MAX_CLIENTS = 20;

export const NEW_SOURCE: Omit<ExtraSource, "id"> = { name: "", amount: 2, rate: 0.5, target: 0.5 };

export function interestedOfV2(n: Numbers, extra: ExtraSource[]): number {
  const built = SOURCES.reduce((sum, source) => sum + n[source.key] * n[source.rate], 0);
  return built + extra.reduce((sum, source) => sum + source.amount * source.rate, 0);
}

export function volumesOfV2(n: Numbers, extra: ExtraSource[]): Volumes {
  const interested = interestedOfV2(n, extra);
  const booked = interested * n.interestToBook;
  const callsHeld = booked * n.callShow;
  const roadmapsBooked = callsHeld * n.callToRoadmap;
  const roadmapsHeld = roadmapsBooked * n.roadmapShow;
  const newClients = roadmapsHeld * n.closeRate;
  const clients = Math.min(newClients * n.months, MAX_CLIENTS);
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

/** Clients at once before the cap, and when they'd be full: months of signing at this pace to reach MAX_CLIENTS. */
export function fullnessOf(n: Numbers, extra: ExtraSource[]): { uncapped: number; full: boolean; fullInMonths: number | null } {
  const newClients = volumesOfV2(n, extra).newClients;
  const uncapped = newClients * n.months;
  return { uncapped, full: uncapped > MAX_CLIENTS, fullInMonths: newClients > 0 ? MAX_CLIENTS / newClients : null };
}

/**
 * What an income target needs a month at these rates: every source, the added ones too, scaled by the same share.
 * Worked out before the cap, so a target past MAX_CLIENTS × fee still shows what it would take.
 */
export function needsForV2(target: number, n: Numbers, extra: ExtraSource[]): Volumes & { extra: number[] } {
  const v = volumesOfV2(n, extra);
  const income = v.newClients * n.months * n.fee;
  const scale = income > 0 ? target / income : 0;
  const scaled = { ...n };
  for (const source of SOURCES) scaled[source.key] = n[source.key] * scale;
  const scaledExtra = extra.map((source) => ({ ...source, amount: source.amount * scale }));
  const need = volumesOfV2(scaled, scaledExtra);
  const clients = need.newClients * n.months;
  return { ...need, clients, income: clients * n.fee, extra: scaledExtra.map((source) => source.amount) };
}

export function gainIfHitV2(n: Numbers, extra: ExtraSource[], key: RateKey, target: number): number {
  return volumesOfV2({ ...n, [key]: target }, extra).income - volumesOfV2(n, extra).income;
}

/** Income an added source would add if it hit its own target. */
export function extraGainIfHit(n: Numbers, extra: ExtraSource[], id: string): number {
  const hit = extra.map((source) => (source.id === id ? { ...source, rate: source.target } : source));
  return volumesOfV2(n, hit).income - volumesOfV2(n, extra).income;
}

/** What V2 keeps on this device: their typed numbers, added sources and the income targets ticked. */
export type SavedV2 = { now: Numbers; extra: ExtraSource[]; picked: number[] };

export function storageKeyV2(userId: string | null, coachId: string | null): string {
  return `bca-scoreboard:v2-2:${coachId ?? userId ?? "anon"}`;
}

const share = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;

export function readSavedV2(raw: string | null): SavedV2 {
  const empty: SavedV2 = { now: { ...STARTING }, extra: [], picked: DEFAULT_PICKED };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedV2>;
    const extra = (Array.isArray(parsed.extra) ? parsed.extra : [])
      .filter((s): s is ExtraSource => Boolean(s) && typeof s.id === "string")
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        name: typeof s.name === "string" ? s.name.slice(0, 60) : "",
        amount: typeof s.amount === "number" && Number.isFinite(s.amount) && s.amount >= 0 ? s.amount : NEW_SOURCE.amount,
        rate: share(s.rate, NEW_SOURCE.rate),
        target: share(s.target, NEW_SOURCE.target),
      }));
    const picked = (parsed.picked ?? []).filter((value) => (TARGET_OPTIONS as readonly number[]).includes(value));
    const now = { ...STARTING };
    for (const key of Object.keys(STARTING) as Array<keyof Numbers>) {
      const value = parsed.now?.[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) now[key] = value;
    }
    return { now, extra, picked: picked.length ? picked : DEFAULT_PICKED };
  } catch {
    return empty;
  }
}

/**
 * How often a new client starts, the way people picture it (Zander, 5 Nov 2026): "7 weeks" up to 8 weeks, then
 * months to one decimal, "2.4 months". V1 says weeks throughout.
 */
export function paceText(weeks: number | null): string {
  if (weeks === null || !Number.isFinite(weeks)) return "never";
  if (weeks < 1) return "under a week";
  if (weeks <= 8) return weeks < 1.5 ? "1 week" : `${Math.round(weeks)} weeks`;
  return `${Math.round((weeks / WEEKS_PER_MONTH) * 10) / 10} months`;
}

export { DEFAULT_TARGETS, STARTING };
