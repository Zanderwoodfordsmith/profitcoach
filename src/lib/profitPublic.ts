/**
 * Profit levers v3, the public page: the BCA Targets tab for an owner's own
 * business, a month at a time. Seven growth numbers take traffic down to gross
 * profit; overheads come off to leave profit. The owner gives last year's
 * sales and profit, so overheads are worked out from what they know, and a
 * check says whether their seven numbers add up to the sales they gave.
 */

import { roundTarget } from "./profitTargets";

export type LeverKey =
  | "traffic"
  | "leadRate"
  | "offerRate"
  | "conversion"
  | "timesBought"
  | "averageSale"
  | "margin"
  | "overheads"
  | "years";

/** A month of the business: traffic, leads and sales a month; overheads and marketing £ a month. */
export type Numbers = Record<LeverKey, number> & { marketing: number };

export type Unit = "count" | "percent" | "pounds" | "times" | "years";

export type LeverDef = { key: LeverKey; label: string; hint: string; unit: Unit; lower?: true };

/** In funnel order. The first seven are the growth numbers the "improve all" slider moves. */
export const LEVERS: LeverDef[] = [
  { key: "traffic", label: "Traffic", hint: "People who visit or find you a month", unit: "count" },
  { key: "leadRate", label: "Lead rate", hint: "Traffic that gets in touch", unit: "percent" },
  { key: "offerRate", label: "Offer rate", hint: "Leads you send a price, quote or proposal", unit: "percent" },
  { key: "conversion", label: "Conversion rate", hint: "Offers that buy", unit: "percent" },
  { key: "timesBought", label: "Times they buy", hint: "Purchases per customer a year", unit: "times" },
  { key: "averageSale", label: "Average sale", hint: "What one order is worth", unit: "pounds" },
  { key: "margin", label: "Gross margin", hint: "Kept from each £1 after direct costs", unit: "percent" },
  { key: "overheads", label: "Overheads", hint: "Wages, rent and the rest, a month", unit: "pounds", lower: true },
  { key: "years", label: "Years they stay", hint: "How long a customer keeps buying", unit: "years" },
];

export const GROWTH: LeverKey[] = ["traffic", "leadRate", "offerRate", "conversion", "timesBought", "averageSale", "margin"];

export const leverOf = (key: LeverKey) => LEVERS.find((lever) => lever.key === key)!;
export const isLower = (key: LeverKey) => Boolean(leverOf(key).lower);

/** Last year, in the owner's words. */
export type LastYear = { sales: number; profit: number };

/** The run sheet's example: about £2M sales and £400k profit. Overheads come from these. */
export const EXAMPLE_YEAR: LastYear = { sales: 2_000_000, profit: 400_000 };
/** Marketing a month in the example: ads, agencies, events. */
export const EXAMPLE_MARKETING = 5_000;
export const EXAMPLE: Omit<Numbers, "overheads" | "marketing"> = {
  traffic: 2_000,
  leadRate: 0.01,
  offerRate: 0.5,
  conversion: 0.25,
  timesBought: 3,
  averageSale: 22_000,
  margin: 0.4,
  years: 3,
};

/** Overheads a month from last year: what the gross margin kept, less the profit left. Never below 0. */
export function overheadsFrom(year: LastYear, margin: number, marketing = 0): number {
  return Math.max(0, (year.sales * margin - year.profit) / 12 - marketing);
}

export type Month = {
  traffic: number;
  leads: number;
  offers: number;
  customers: number;
  orders: number;
  sales: number;
  grossProfit: number;
  overheads: number;
  marketing: number;
  profit: number;
};

export function monthOf(n: Numbers): Month {
  const leads = n.traffic * n.leadRate;
  const offers = leads * n.offerRate;
  const customers = offers * n.conversion;
  const orders = customers * n.timesBought;
  const sales = orders * n.averageSale;
  const grossProfit = sales * n.margin;
  return {
    traffic: n.traffic,
    leads,
    offers,
    customers,
    orders,
    sales,
    grossProfit,
    overheads: n.overheads,
    marketing: n.marketing,
    profit: grossProfit - n.overheads - n.marketing,
  };
}

/** Marketing spend for each lead. Null with no leads. */
export function costPerLead(n: Numbers): number | null {
  const leads = n.traffic * n.leadRate;
  return leads > 0 ? n.marketing / leads : null;
}

/** Marketing spend to win one new customer (cost per acquisition). Null with no customers. */
export function costPerCustomer(n: Numbers): number | null {
  const customers = n.traffic * n.leadRate * n.offerRate * n.conversion;
  return customers > 0 ? n.marketing / customers : null;
}

/** Gross profit one customer brings in while they stay: average sale × times a year × margin × years. */
export function lifetimeGross(n: Numbers): number {
  return n.averageSale * n.timesBought * n.margin * n.years;
}

export const profitAYear = (n: Numbers) => monthOf(n).profit * 12;

/** What a £ profit target a year needs, a month, at these numbers: the traffic that makes it, and all it makes. */
export function needsFor(targetAYear: number, n: Numbers): Month {
  const perVisitor = n.leadRate * n.offerRate * n.conversion * n.timesBought * n.averageSale * n.margin;
  const traffic = perVisitor > 0 ? (targetAYear / 12 + n.overheads + n.marketing) / perVisitor : 0;
  return monthOf({ ...n, traffic });
}

/** What hitting one target adds to profit a year, with everything else as it is now. */
export function gainIfHit(n: Numbers, key: LeverKey, target: number): number {
  return profitAYear({ ...n, [key]: target }) - profitAYear(n);
}

function capped(key: LeverKey, value: number): number {
  return leverOf(key).unit === "percent" ? Math.min(value, 1) : value;
}

/** Every growth number better by `share` (0.1 for 10%). Overheads, marketing and years stay. */
export function improvedBy(n: Numbers, share: number): Numbers {
  const next = { ...n };
  for (const key of GROWTH) next[key] = capped(key, n[key] * (1 + share));
  return next;
}

/** Until the owner sets one, a growth number's target is 20% better, and overheads' 10% lower. */
export function defaultTarget(key: LeverKey, now: number): number {
  return isLower(key) ? now * 0.9 : capped(key, now * 1.2);
}

/** Until the owner types their profit, assume 20% of sales before tax: £2M of sales makes £400k. */
export const DEFAULT_PROFIT_SHARE = 0.2;

/** Starting £ profit targets a year from last year's profit, until the owner names their own: 20% more, double, triple. */
export const PROFIT_TARGETS = [
  { key: "need", label: "Need", times: 1.2 },
  { key: "great", label: "Great", times: 2 },
  { key: "amazing", label: "Amazing", times: 3 },
] as const;
export type ProfitTargetKey = (typeof PROFIT_TARGETS)[number]["key"];

export function defaultProfitTargets(profit: number): Record<ProfitTargetKey, number> {
  const base = Math.max(profit, 50_000);
  return Object.fromEntries(PROFIT_TARGETS.map(({ key, times }) => [key, roundTarget(base * times)])) as Record<ProfitTargetKey, number>;
}

/** The drag range for a number: from 0 to well past where it is and its target. Rates stop at 100%. */
export function rangeFor(key: LeverKey, now: number, target: number): { min: number; max: number; step: number } {
  const unit = leverOf(key).unit;
  const top = Math.max(now * 2, target * 1.5, unit === "times" || unit === "years" ? 2 : unit === "percent" ? 0.02 : 10);
  const max = unit === "percent" ? Math.min(niceCeil(top), 1) : niceCeil(top);
  const step = unit === "times" || unit === "years" ? 0.1 : unit === "percent" ? max / 400 : max >= 1000 ? max / 500 : max >= 100 ? 1 : 0.5;
  return { min: 0, max, step };
}

function niceCeil(value: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 2, 5, 10]) if (value <= m * power) return m * power;
  return 10 * power;
}

/** How their seven numbers compare with the sales they gave: within 10% reads as adding up. */
export function salesCheck(n: Numbers, year: LastYear): { modelled: number; said: number; share: number | null; ok: boolean } {
  const modelled = monthOf(n).sales * 12;
  const share = year.sales > 0 ? modelled / year.sales - 1 : null;
  return { modelled, said: year.sales, share, ok: share !== null && Math.abs(share) <= 0.1 };
}

export function leverText(key: LeverKey, value: number): string {
  switch (leverOf(key).unit) {
    case "percent": {
      const points = value * 100;
      return `${points < 10 ? points.toFixed(1).replace(/\.0$/, "") : Math.round(points)}%`;
    }
    case "times":
      return `${value.toFixed(1).replace(/\.0$/, "")}×`;
    case "years":
      return `${value.toFixed(1).replace(/\.0$/, "")} yrs`;
    case "pounds":
      return poundsShort(value);
    default:
      return Math.round(value).toLocaleString("en-GB");
  }
}

/** £7,700, then £146k, then £1.2M. */
export function poundsShort(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "")}M`;
  if (abs >= 10_000) return `${sign}£${Math.round(abs / 1000).toLocaleString("en-GB")}k`;
  return `${sign}£${Math.round(abs).toLocaleString("en-GB")}`;
}

/** One decimal under ten (2.6), whole numbers above (623). */
export function count(value: number): string {
  if (value > 0 && value < 10) return value.toFixed(1).replace(/\.0$/, "");
  return Math.round(value).toLocaleString("en-GB");
}
