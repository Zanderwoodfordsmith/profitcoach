import { parseIsoDate, toIsoDate } from "@/lib/scorecardWeeks";

/** Mon–Fri (UK business days). */
export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/** Add `days` UK business days after `start` (exclusive of same-day counting). */
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

/**
 * Stripe pending balance lands in the bank 2 business days after the as-of date.
 * e.g. balance checked Friday → arrives Tuesday; checked Saturday → arrives Tuesday.
 */
export function stripePayoutBankDate(asOfDateIso: string): string | null {
  const asOf = parseIsoDate(asOfDateIso);
  if (!asOf) return null;
  return toIsoDate(addBusinessDays(asOf, 2));
}

export function formatShortDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
