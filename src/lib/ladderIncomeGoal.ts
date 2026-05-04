import type { LadderLevelId } from "@/lib/ladder";

/**
 * Monthly recurring revenue bands (same numeric thresholds for $ and £).
 * Platinum is treated as 15,000 up to but not including 20,000; Emerald starts at 20,000.
 */
const BANDS_DESC: Array<{ min: number; levelId: LadderLevelId }> = [
  { min: 100_000, levelId: "black_diamond" },
  { min: 75_000, levelId: "blue_diamond" },
  { min: 50_000, levelId: "diamond" },
  { min: 40_000, levelId: "sapphire" },
  { min: 30_000, levelId: "ruby" },
  { min: 20_000, levelId: "emerald" },
  { min: 15_000, levelId: "platinum" },
  { min: 10_000, levelId: "gold" },
  { min: 5_000, levelId: "silver" },
];

/** First matching band (highest `min` such that income >= min). */
export function monthlyIncomeToLadderLevelId(
  monthlyIncome: number
): LadderLevelId | null {
  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 5_000) {
    return null;
  }
  for (const { min, levelId } of BANDS_DESC) {
    if (monthlyIncome >= min) return levelId;
  }
  return null;
}

/** Suggested input value when restoring from a saved income-based goal. */
export function defaultMonthlyIncomeForLevelId(
  levelId: string | null | undefined
): number | null {
  if (!levelId) return null;
  const row = BANDS_DESC.find((b) => b.levelId === levelId);
  return row ? row.min : null;
}

const WEEKS_PER_MONTH = 4.3;

/**
 * How often to sign a client (weeks), from:
 * `(monthsStay * pricePerMonth) / monthlyIncomeGoal * 4.3`
 */
export function signClientEveryWeeks(params: {
  monthsStay: number;
  pricePerClientMonth: number;
  monthlyIncomeGoal: number;
}): number | null {
  const { monthsStay, pricePerClientMonth, monthlyIncomeGoal } = params;
  if (
    !Number.isFinite(monthsStay) ||
    !Number.isFinite(pricePerClientMonth) ||
    !Number.isFinite(monthlyIncomeGoal) ||
    monthlyIncomeGoal <= 0 ||
    pricePerClientMonth <= 0 ||
    monthsStay <= 0
  ) {
    return null;
  }
  return (monthsStay * pricePerClientMonth) / monthlyIncomeGoal * WEEKS_PER_MONTH;
}

export function formatWeeksInterval(weeks: number): string {
  if (!Number.isFinite(weeks) || weeks < 0) return "—";
  if (weeks < 1) return "< 1 week";
  const rounded = Math.round(weeks);
  return `${rounded} week${rounded === 1 ? "" : "s"}`;
}

export function parseMoneyInput(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
