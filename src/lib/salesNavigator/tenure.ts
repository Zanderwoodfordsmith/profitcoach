/**
 * Tenure helpers for Sales Nav Short scrapes ↔ Sales Nav YEARS_AT_CURRENT_COMPANY buckets.
 */

import type { SalesNavYearsAtCompanyId } from "@/lib/salesNavigator/buildSalesNavSearchUrl";

function asNonNegInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.floor(v);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

/** Total months from a LinkedIn/HarvestAPI tenure object (`numYears` + `numMonths`). */
export function tenureTotalMonths(
  tenure: Record<string, unknown> | null | undefined
): number | null {
  if (!tenure) return null;
  if (!("numYears" in tenure) && !("numMonths" in tenure)) return null;
  return asNonNegInt(tenure.numYears) * 12 + asNonNegInt(tenure.numMonths);
}

/**
 * Map months-at-company to Sales Nav bucket ids (verified from live URLs):
 * 1 Less than 1 year · 2 1 to 2 years · 3 3 to 5 · 4 6 to 10 · 5 More than 10.
 */
export function yearsAtCompanyBucketFromMonths(
  months: number | null | undefined
): SalesNavYearsAtCompanyId | null {
  if (months == null || !Number.isFinite(months) || months < 0) return null;
  if (months < 12) return "1";
  if (months < 36) return "2"; // 1–2 years (through month 35)
  if (months < 72) return "3"; // 3–5 years
  if (months < 120) return "4"; // 6–10 years
  return "5";
}
