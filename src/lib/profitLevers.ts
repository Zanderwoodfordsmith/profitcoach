/**
 * Profit levers: the money moment in the BOSS Score Review, as a tool. Six
 * numbers an owner knows roughly, how they multiply into sales and gross
 * profit, and what small moves on each are worth. Pure maths, so the page
 * and its tests share it.
 */

export type LeverKey = "leads" | "meetingRate" | "winRate" | "averageSale" | "timesBought" | "margin";

export type Levers = Record<LeverKey, number>;

export type LeverDef = {
  key: LeverKey;
  label: string;
  /** One plain line on what to ask the owner. */
  ask: string;
  unit: "count" | "percent" | "pounds" | "times";
};

/** The five that make sales, in funnel order, then margin, which turns sales into profit. */
export const LEVERS: LeverDef[] = [
  { key: "leads", label: "Leads a month", ask: "New enquiries in a normal month", unit: "count" },
  { key: "meetingRate", label: "Become a meeting or quote", ask: "Out of every 10 leads, how many get a meeting or quote?", unit: "percent" },
  { key: "winRate", label: "Meetings or quotes that buy", ask: "Out of every 10 quotes, how many say yes?", unit: "percent" },
  { key: "averageSale", label: "Average sale", ask: "What's a typical order or job worth?", unit: "pounds" },
  { key: "timesBought", label: "Times a customer buys a year", ask: "How often does a customer buy from you in a year?", unit: "times" },
  { key: "margin", label: "Gross margin", ask: "What's left of each £1 after the direct costs?", unit: "percent" },
];

export const SALES_LEVERS: LeverKey[] = ["leads", "meetingRate", "winRate", "averageSale", "timesBought"];

/** The run sheet's worked example: £1.98M sales a year. */
export const EXAMPLE: Levers = {
  leads: 20,
  meetingRate: 0.5,
  winRate: 0.25,
  averageSale: 22_000,
  timesBought: 3,
  margin: 0.4,
};

/** Every box in the pyramid, worked out from the six levers. */
export type Results = {
  leadsAYear: number;
  /** Leads that end up buying: meeting rate × win rate. */
  conversion: number;
  customers: number;
  /** What one customer spends in a year: average sale × times they buy. */
  customerValue: number;
  sales: number;
  grossProfit: number;
};

export function resultsOf(levers: Levers): Results {
  const leadsAYear = levers.leads * 12;
  const conversion = levers.meetingRate * levers.winRate;
  const customers = leadsAYear * conversion;
  const customerValue = levers.averageSale * levers.timesBought;
  const sales = customers * customerValue;
  return { leadsAYear, conversion, customers, customerValue, sales, grossProfit: sales * levers.margin };
}

/** A rate can't pass 100%. */
function capped(key: LeverKey, value: number): number {
  return LEVERS.find((lever) => lever.key === key)?.unit === "percent" ? Math.min(value, 1) : value;
}

/** Every sales lever moved by the same share, e.g. 0.1 for 10% better on each. Margin stays. */
export function eachBetterBy(levers: Levers, share: number): Levers {
  const next = { ...levers };
  for (const key of SALES_LEVERS) next[key] = capped(key, levers[key] * (1 + share));
  return next;
}

/**
 * How much better each of the five sales levers has to get, all by the same
 * share, for sales to reach `goal`. Null when there's nothing to grow from.
 */
export function shareForGoal(levers: Levers, goal: number): number | null {
  const now = resultsOf(levers).sales;
  if (now <= 0 || goal <= 0) return null;
  return Math.pow(goal / now, 1 / SALES_LEVERS.length) - 1;
}

/** The drag range for one lever: rates run 0 to 100%, the rest from 0 to well past where they are now. */
export function rangeFor(key: LeverKey, now: number): { min: number; max: number; step: number } {
  const unit = LEVERS.find((lever) => lever.key === key)?.unit;
  if (unit === "percent") return { min: 0, max: 1, step: 0.005 };
  const max = niceCeil(Math.max(now * 2.5, unit === "times" ? 2 : 10));
  const step = unit === "times" ? 0.1 : max >= 1000 ? max / 500 : max >= 100 ? 1 : 0.5;
  return { min: 0, max, step };
}

/** The next round number up: 1, 2 or 5 times a power of ten. */
function niceCeil(value: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 2, 5, 10]) if (value <= m * power) return m * power;
  return 10 * power;
}

/** Change from `from` to `to` as a share, e.g. 0.61 for 61% more. Null when `from` is 0. */
export function change(from: number, to: number): number | null {
  return from > 0 ? to / from - 1 : null;
}

const gbp = (digits: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** £1.98M, £240k, £24,200. Short enough for a box in the pyramid. */
export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (abs >= 100_000) return `£${Math.round(value / 1000)}k`;
  return gbp(0).format(value);
}

export function formatLever(key: LeverKey, value: number): string {
  switch (LEVERS.find((lever) => lever.key === key)?.unit) {
    case "percent":
      return `${round(value * 100, 1)}%`;
    case "pounds":
      return formatMoney(value);
    case "times":
      return `${round(value, 1)}×`;
    default:
      return `${round(value, 1)}`;
  }
}

/** +61%, -8%. */
export function formatChange(share: number | null): string {
  if (share === null) return "";
  const pct = round(share * 100, Math.abs(share) < 0.1 ? 1 : 0);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}
