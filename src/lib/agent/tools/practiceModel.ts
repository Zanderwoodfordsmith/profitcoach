import { DEFAULT_TARGETS, GREAT, type RateKey } from "@/lib/scoreboard";

/**
 * The coach's practice as a model (Zander, 5 Nov 2026): how fast they sign clients, how long clients stay and the
 * fee set a ceiling on income. New clients a month × months kept = clients at once; × fee = income a month. Below
 * the ceiling they grow towards it at the pace they sign; to get past it, one of the three numbers has to change.
 * Each funnel rate is judged against the Scoreboard's Good and Great (src/lib/scoreboard.ts), so Ava and the
 * Scoreboard use the same targets. Pure maths, no data loading.
 */

/** Calls that happen and become a client: show × Constraint Call to roadmap × roadmap show × close. */
function callsToClient(t: Record<RateKey, number>): number {
  return t.callShow * t.callToRoadmap * t.roadmapShow * t.closeRate;
}

/** The Scoreboard's targets for each rate Ava can judge. Good 20% and Great 50% for calls to clients. */
export const RATE_TARGETS = {
  outbound_to_interested: { good: DEFAULT_TARGETS.outboundRate, great: GREAT.outboundRate, side: "marketing" },
  inbound_to_interested: { good: DEFAULT_TARGETS.inboundRate, great: GREAT.inboundRate, side: "marketing" },
  interested_to_booked: { good: DEFAULT_TARGETS.interestToBook, great: GREAT.interestToBook, side: "sales" },
  calls_to_client: { good: callsToClient(DEFAULT_TARGETS), great: callsToClient(GREAT), side: "sales" },
} as const;

export type RateId = keyof typeof RATE_TARGETS;

/** Enough people at a step to judge its rate. Below this, Ava says it is too early. */
export const JUDGE_FROM: Record<RateId, number> = {
  outbound_to_interested: 300,
  inbound_to_interested: 4,
  interested_to_booked: 4,
  calls_to_client: 5,
};

export const DEFAULT_MONTHS_KEPT = DEFAULT_TARGETS.months;

export type RateCheck = {
  rate: RateId;
  side: "marketing" | "sales";
  /** How many reached this step, and how many went on. */
  of: number;
  went_on: number;
  actual: number | null;
  good: number;
  great: number;
  band: "below_good" | "good" | "great" | "too_early";
};

export function checkRate(rate: RateId, wentOn: number, of: number): RateCheck {
  const t = RATE_TARGETS[rate];
  const actual = of > 0 ? wentOn / of : null;
  const band =
    of < JUDGE_FROM[rate] || actual == null
      ? "too_early"
      : actual >= t.great
        ? "great"
        : actual >= t.good
          ? "good"
          : "below_good";
  return { rate, side: t.side, of, went_on: wentOn, actual, good: t.good, great: t.great, band };
}

export type ModelInputs = {
  /** New clients signed in the last 180 days. */
  signed_180d: number;
  /** How many months ago each client with a start date joined. */
  client_join_months_ago: number[];
  fee_month: number | null;
  months_kept: number;
  goal_income_month: number | null;
};

export type PracticeModel = {
  signed_per_month: number;
  /** The same pace in words people picture (Zander, 5 Nov 2026): "one every 2.4 months", "one every 6 weeks". */
  signing_pace: string;
  months_kept: number;
  fee_month: number | null;
  /** Clients who joined within one client lifetime, so likely still with them. */
  clients_now: number;
  income_now: number | null;
  /** Where they top out if nothing changes. */
  ceiling_clients: number;
  ceiling_income: number | null;
  goal_income_month: number | null;
  goal_clients: number | null;
  /** True when the goal is under the ceiling; null without a goal or fee. */
  goal_reachable: boolean | null;
  /** At this pace, roughly how long until the goal (when reachable) or the ceiling. */
  months_to_goal: number | null;
  months_to_ceiling: number | null;
  /** Each number on its own that would reach the goal, when it is above the ceiling. */
  to_reach_goal: { sign_one_every_months: number; or_months_kept: number | null; or_fee: number | null } | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** New clients a month as "one every …": weeks under 2 months, otherwise months to one decimal. */
export function paceWords(perMonth: number): string {
  if (!(perMonth > 0)) return "no clients signed yet";
  const months = 1 / perMonth;
  if (months < 2) return `one every ${Math.round(months * (52 / 12))} weeks`;
  return `one every ${round1(months)} months`;
}

export function practiceModel(i: ModelInputs): PracticeModel {
  const signed = i.signed_180d / 6;
  const months = i.months_kept > 0 ? i.months_kept : DEFAULT_MONTHS_KEPT;
  const fee = i.fee_month && i.fee_month > 0 ? i.fee_month : null;
  const clientsNow = i.client_join_months_ago.filter((m) => m >= 0 && m < months).length;
  const ceilingClients = signed * months;
  const goal = i.goal_income_month && i.goal_income_month > 0 ? i.goal_income_month : null;
  const goalClients = goal && fee ? Math.ceil(goal / fee) : null;
  const reachable = goalClients == null ? null : goalClients <= ceilingClients + 1e-9;
  const monthsTo = (clients: number) => (signed > 0 ? round1(Math.max(0, (clients - clientsNow) / signed)) : null);

  return {
    signed_per_month: round1(signed * 100) / 100,
    signing_pace: paceWords(signed),
    months_kept: months,
    fee_month: fee,
    clients_now: clientsNow,
    income_now: fee ? clientsNow * fee : null,
    ceiling_clients: round1(ceilingClients),
    ceiling_income: fee ? Math.round(ceilingClients * fee) : null,
    goal_income_month: goal,
    goal_clients: goalClients,
    goal_reachable: reachable,
    months_to_goal: reachable && goalClients != null ? monthsTo(goalClients) : null,
    months_to_ceiling: ceilingClients > clientsNow ? monthsTo(ceilingClients) : null,
    to_reach_goal:
      reachable === false && goalClients != null && goal != null
        ? {
            sign_one_every_months: round1(months / goalClients),
            or_months_kept: signed > 0 ? Math.ceil(goalClients / signed) : null,
            or_fee: signed > 0 ? Math.ceil(goal / (signed * months) / 50) * 50 : null,
          }
        : null,
  };
}

export type VolumePlan = {
  rates: "theirs" | "good" | "great";
  outbound_to_interested: number;
  interested_to_client: number;
  /** Interested people a month the goal needs at these rates. */
  interested_a_month: number;
  /** Outbound people a month, after inbound interested people are counted. -1 (here and above): never at these
   *  rates, because one of them is 0. */
  outbound_a_month: number;
};

/**
 * Work back from the goal (Zander, 5 Nov 2026: "one new client every 2.4 months, what needs to be done to make that
 * happen"): the new clients a month it needs, then the people a month at their own rates, at Good and at Great. The
 * gap between "theirs" and "good" is a rate problem; between what they reach now and "good" is a volume problem.
 * Inbound interested people count first; outbound fills the rest. Same maths as the Scoreboard.
 */
export function workBack(args: {
  goal_clients: number | null;
  months_kept: number;
  outbound_month: number;
  inbound_interested_month: number | null;
  /** Their own rates where judged; a missing one uses Good. */
  their_outbound_to_interested: number | null;
  their_interested_to_client: number | null;
}): {
  new_clients_a_month: number;
  sign_one_every_months: number;
  signing_pace: string;
  outbound_now: number;
  plans: VolumePlan[];
} | null {
  if (args.goal_clients == null || args.goal_clients <= 0) return null;
  const months = args.months_kept > 0 ? args.months_kept : DEFAULT_MONTHS_KEPT;
  const newClients = args.goal_clients / months;
  const inbound = args.inbound_interested_month ?? 0;
  const good = { o: RATE_TARGETS.outbound_to_interested.good, c: DEFAULT_TARGETS.interestToBook * RATE_TARGETS.calls_to_client.good };
  const great = { o: RATE_TARGETS.outbound_to_interested.great, c: GREAT.interestToBook * RATE_TARGETS.calls_to_client.great };
  const theirs = { o: args.their_outbound_to_interested ?? good.o, c: args.their_interested_to_client ?? good.c };
  const plan = (rates: VolumePlan["rates"], r: { o: number; c: number }): VolumePlan => {
    const interested = r.c > 0 ? newClients / r.c : Infinity;
    const outbound = r.o > 0 ? Math.max(0, interested - inbound) / r.o : Infinity;
    return {
      rates,
      outbound_to_interested: r.o,
      interested_to_client: r.c,
      interested_a_month: Number.isFinite(interested) ? round1(interested) : -1,
      outbound_a_month: Number.isFinite(outbound) ? Math.ceil(outbound / 10) * 10 : -1,
    };
  };
  return {
    new_clients_a_month: Math.round(newClients * 100) / 100,
    sign_one_every_months: round1(1 / newClients),
    signing_pace: paceWords(newClients),
    outbound_now: args.outbound_month,
    plans: [plan("theirs", theirs), plan("good", good), plan("great", great)],
  };
}

/** The first money amount in free text: "£1,500 a month" → 1500, "£2k" → 2000. */
export function moneyIn(text: unknown): number | null {
  const m = String(text ?? "").replace(/,/g, "").match(/£\s*(\d+(?:\.\d+)?)\s*(k\b)?|(\d+(?:\.\d+)?)\s*(k\b)/i);
  if (!m) return null;
  const n = Number(m[1] ?? m[3]);
  return Math.round((m[2] || m[4] ? n * 1000 : n));
}
