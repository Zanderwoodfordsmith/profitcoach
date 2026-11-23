/**
 * Fit on every person (job 278, 23 Nov): Good, OK or Bad. Ava sets it as
 * people come in; the coach or BCA can change it. Blacklist is the fourth
 * option and stays its own list (never messaged, on any list). Campaigns skip
 * Bad and take Good before OK.
 */

import type { BadgeTone } from "@/components/ui/Badge";

export type FitLabel = "good" | "ok" | "bad";

export const FIT_OPTIONS: { key: FitLabel; label: string; short: string; tone: BadgeTone; hint: string }[] = [
  { key: "good", label: "Good fit", short: "Good", tone: "green", hint: "Owns or runs a firm right in the market. Messaged first." },
  { key: "ok", label: "OK fit", short: "OK", tone: "amber", hint: "Probably right, but the title or company is unclear. Messaged after Good." },
  { key: "bad", label: "Bad fit", short: "Bad", tone: "red", hint: "Not a fit. Never added to a campaign." },
];

export function asFitLabel(value: unknown): FitLabel | null {
  return value === "good" || value === "ok" || value === "bad" ? value : null;
}

export function fitOption(fit: FitLabel) {
  return FIT_OPTIONS.find((option) => option.key === fit)!;
}

/** A whole list's word from its 10-person check: 7 or more fit is Good, 4 to 6 OK, under 4 Bad. */
export function listFitLabel(fit: number, checked: number): FitLabel {
  const share = checked ? fit / checked : 0;
  return share >= 0.7 ? "good" : share >= 0.4 ? "ok" : "bad";
}

/** Good first, then OK, then people nobody has checked yet, Bad last (same order as fit_rank in the database). */
export function fitRank(fit: FitLabel | null | undefined): number {
  return fit === "good" ? 0 : fit === "ok" ? 1 : fit === "bad" ? 3 : 2;
}
