/**
 * Profit levers v2: the BCA dashboard's Targets tab, for an owner's business.
 * Leads come in; each rate turns them into the next thing, down to profit.
 * Every row has a quality (the rate against its target) and a volume (what it
 * makes a year against what each £ target needs). Costs can be switched on.
 * Pure maths, so the page and its tests share it.
 */

/** The steps with a rate and a target. Cost per lead only counts when costs are on. */
export type RateKey = "costPerLead" | "meetingRate" | "winRate" | "timesBought" | "averageSale" | "margin";

/** Their numbers: the six rates, leads a month, and overheads a year (costs only). */
export type Numbers = Record<RateKey, number> & { leads: number; overheads: number };

export type Unit = "percent" | "pounds" | "times";

export const RATES: Array<{ key: RateKey; label: string; unit: Unit; why: string; costs?: true }> = [
  { key: "costPerLead", label: "Cost per lead", unit: "pounds", why: "Marketing spend ÷ leads. Lower is better.", costs: true },
  { key: "meetingRate", label: "Meeting or quote", unit: "percent", why: "Out of every 100 leads, how many get a meeting or a quote." },
  { key: "winRate", label: "Buy", unit: "percent", why: "Out of every 100 meetings or quotes, how many buy." },
  { key: "timesBought", label: "Times they buy", unit: "times", why: "How often a customer buys in a year." },
  { key: "averageSale", label: "Average sale", unit: "pounds", why: "What a typical order or job is worth." },
  { key: "margin", label: "Gross margin", unit: "percent", why: "What's left of each £1 of sales after the direct costs." },
];

export const unitOf = (key: RateKey): Unit => RATES.find((rate) => rate.key === key)!.unit;
export const lowerIsBetter = (key: RateKey) => key === "costPerLead";

/** The run sheet's worked example: £1.98M sales and £792k gross profit a year. */
export const EXAMPLE: Numbers = {
  leads: 20,
  costPerLead: 50,
  meetingRate: 0.5,
  winRate: 0.25,
  timesBought: 3,
  averageSale: 22_000,
  margin: 0.4,
  overheads: 400_000,
};

/** A year of the business at some numbers. */
export type Volumes = {
  leads: number;
  spend: number;
  meetings: number;
  customers: number;
  orders: number;
  sales: number;
  grossProfit: number;
  overheads: number;
  netProfit: number;
};

export function volumesOf(n: Numbers): Volumes {
  const leads = n.leads * 12;
  const spend = leads * n.costPerLead;
  const meetings = leads * n.meetingRate;
  const customers = meetings * n.winRate;
  const orders = customers * n.timesBought;
  const sales = orders * n.averageSale;
  const grossProfit = sales * n.margin;
  return { leads, spend, meetings, customers, orders, sales, grossProfit, overheads: n.overheads, netProfit: grossProfit - spend - n.overheads };
}

/** The profit the targets are set on: gross profit, or net profit once costs are on. */
export function profitOf(n: Numbers, costs: boolean): number {
  const v = volumesOf(n);
  return costs ? v.netProfit : v.grossProfit;
}

/** What one £ profit target needs a year at these rates: the leads that make it, and everything they make. */
export function needsFor(target: number, n: Numbers, costs: boolean): Volumes {
  const perLead = n.meetingRate * n.winRate * n.timesBought * n.averageSale * n.margin - (costs ? n.costPerLead : 0);
  const leadsAYear = perLead > 0 ? (target + (costs ? n.overheads : 0)) / perLead : 0;
  return volumesOf({ ...n, leads: leadsAYear / 12 });
}

/** A target from the one number: Close is the 20% just short of it. The same rule as the BCA Targets tab. */
export type TargetLine = { good: number; poor: number };
export const CLOSE_SHARE = 0.2;

export function lineFor(good: number, lower: boolean): TargetLine {
  return { good, poor: lower ? good * (1 + CLOSE_SHARE) : good * (1 - CLOSE_SHARE) };
}

export type Status = "good" | "close" | "below" | "none";

export function lineStatus(value: number | null, line: TargetLine, lower: boolean): Status {
  if (value === null) return "none";
  const e = 1e-9;
  if (lower) return value <= line.good + e ? "good" : value <= line.poor + e ? "close" : "below";
  return value >= line.good - e ? "good" : value >= line.poor - e ? "close" : "below";
}

/** A rate can't pass 100%. */
function capped(key: RateKey, value: number): number {
  return unitOf(key) === "percent" ? Math.min(value, 1) : value;
}

/** Until the coach sets one, each step's target is 10% better than where they are. */
export function defaultTarget(key: RateKey, now: number): number {
  return capped(key, lowerIsBetter(key) ? now * 0.9 : now * 1.1);
}

/** Every rate at its target. Leads and overheads stay as they are. */
export function atTargets(n: Numbers, targets: Record<RateKey, number>): Numbers {
  return { ...n, ...targets };
}

/** What hitting one step's target adds to profit a year, with everything else as it is now. */
export function gainIfHit(n: Numbers, key: RateKey, target: number, costs: boolean): number {
  return profitOf({ ...n, [key]: target }, costs) - profitOf(n, costs);
}

/** The drag range for a step: rates run 0 to 100%; the rest from 0 to well past where they are and their target. */
export function rangeFor(key: RateKey, now: number, target: number): { min: number; max: number; step: number } {
  const unit = unitOf(key);
  if (unit === "percent") return { min: 0, max: 1, step: 0.005 };
  const max = niceCeil(Math.max(now * 2, target * 1.5, unit === "times" ? 2 : 10));
  const step = unit === "times" ? 0.1 : max >= 1000 ? max / 500 : max >= 100 ? 1 : 0.5;
  return { min: 0, max, step };
}

/** The next round number up: 1, 2 or 5 times a power of ten. */
export function niceCeil(value: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 2, 5, 10]) if (value <= m * power) return m * power;
  return 10 * power;
}

/** Two significant figures: £990k is £1M, £1.27M is £1.3M. For the starting £ targets. */
export function roundTarget(value: number): number {
  if (value <= 0) return 0;
  const power = Math.pow(10, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / power) * power;
}

export type TargetName = "need" | "great" | "amazing";
export const TARGET_NAMES: Array<{ key: TargetName; label: string; times: number }> = [
  { key: "need", label: "Need", times: 1.25 },
  { key: "great", label: "Great", times: 1.6 },
  { key: "amazing", label: "Amazing", times: 2.5 },
];

/** Starting £ targets from the profit they make now, until the owner names their own. */
export function defaultProfitTargets(profitNow: number): Record<TargetName, number> {
  const base = Math.max(profitNow, 100_000);
  return Object.fromEntries(TARGET_NAMES.map(({ key, times }) => [key, roundTarget(base * times)])) as Record<TargetName, number>;
}

/** £7,700, then £146k, then £1.2M. */
export function pounds(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "")}M`;
  if (abs >= 10_000) return `${sign}£${Math.round(abs / 1000).toLocaleString("en-GB")}k`;
  return `${sign}£${Math.round(abs).toLocaleString("en-GB")}`;
}

/** One decimal under ten (2.6), whole numbers above (623). */
export function amount(value: number): string {
  if (value > 0 && value < 10) return value.toFixed(1).replace(/\.0$/, "");
  return Math.round(value).toLocaleString("en-GB");
}

/** 62%, or 6.3% under ten. */
export function percent(value: number): string {
  const points = value * 100;
  if (points > 0 && points < 10) return `${points.toFixed(1).replace(/\.0$/, "")}%`;
  return `${Math.round(points)}%`;
}

export function rateText(key: RateKey, value: number): string {
  const unit = unitOf(key);
  if (unit === "percent") return percent(value);
  if (unit === "times") return `${value.toFixed(1).replace(/\.0$/, "")}×`;
  return key === "costPerLead" ? `£${value < 100 ? value.toFixed(value % 1 ? 2 : 0) : Math.round(value).toLocaleString("en-GB")}` : pounds(value);
}

/**
 * Which line each target's label sits on (0 the usual one, 1 just above it), so labels of targets close together
 * don't print over each other. `gap` is how far apart, as a share of the bar, two labels on one line must be.
 */
export function labelRows(fractions: number[], gap: number): number[] {
  const order = fractions.map((fraction, i) => ({ fraction, i })).sort((a, b) => b.fraction - a.fraction);
  const last = [Infinity, Infinity];
  const rows = new Array<number>(fractions.length).fill(0);
  for (const { fraction, i } of order) {
    const row = last[0] - fraction >= gap ? 0 : 1;
    rows[i] = row;
    last[row] = fraction;
  }
  return rows;
}
