/**
 * Invented numbers are the costliest mistake Ava can make: a prospect checks
 * the profile, the number is not there, trust is gone. This finds every number
 * in a piece of copy that makes a claim (money, percentages, anything over 10
 * that is not a time of day or a call length) and looks for it in the facts
 * the writer was given. Pure, so it is cheap to run on every output.
 */

export type NumberUnit = "money" | "percent" | "plain";

export type FoundNumber = {
  raw: string;
  value: number;
  unit: NumberUnit;
};

const NUMBER_RE =
  /(?:([£$€])\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?(?:k|m|bn|million|billion|thousand)\b)?(\s?(?:%|percent\b|per cent\b))?/gi;

const SCALE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  million: 1e6,
  bn: 1e9,
  billion: 1e9,
};

/** Durations and clock times that describe the message itself, not a result. */
const NOT_A_CLAIM_AFTER = /^\s?-?\s?(minutes?|mins?|hours?|hrs?|am|pm|a\.m|p\.m|st|nd|rd|th|️⃣|️)/i;

function stripPlaceholders(text: string): string {
  // [square bracket] prompts and {tokens} are for the coach to fill, not claims.
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\{\{?[^{}]*\}?\}/g, " ");
}

/** Every number in the text with its value. `claimsOnly` drops the ones that cannot be a claim. */
export function extractNumbers(text: string, opts: { claimsOnly?: boolean } = {}): FoundNumber[] {
  const source = opts.claimsOnly ? stripPlaceholders(text) : text;
  const out: FoundNumber[] = [];
  for (const m of source.matchAll(NUMBER_RE)) {
    const [raw, currency, digits, scaleRaw, percent] = m;
    const index = m.index ?? 0;
    const before = source.slice(Math.max(0, index - 1), index);
    // Part of a word or a time ("Q3", "10:30", "M&E2").
    if (/[a-z0-9:]/i.test(before) && !currency) continue;
    const after = source.slice(index + raw.length, index + raw.length + 12);
    if (/^:\d/.test(after)) continue;
    const base = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const scaleKey = (scaleRaw ?? "").trim().toLowerCase();
    const value = base * (SCALE[scaleKey] ?? 1);
    const unit: NumberUnit = percent ? "percent" : currency || scaleKey ? "money" : "plain";
    if (opts.claimsOnly) {
      if (unit === "plain" && value <= 10) continue;
      if (unit === "plain" && NOT_A_CLAIM_AFTER.test(after)) continue;
    }
    out.push({ raw: raw.trim(), value, unit });
  }
  return out;
}

function sameNumber(a: FoundNumber, b: FoundNumber): boolean {
  if ((a.unit === "percent") !== (b.unit === "percent")) return false;
  const tolerance = Math.max(Math.abs(a.value), Math.abs(b.value)) * 0.01;
  return Math.abs(a.value - b.value) <= tolerance;
}

export type GroundingReport = {
  /** In none of the facts: an invented number unless proven otherwise. */
  unsupported: FoundNumber[];
  /** Only in an earlier section Ava wrote, not in the coach's own facts. */
  upstreamOnly: FoundNumber[];
  checked: number;
};

/**
 * facts: what the coach told us and what we imported (the source of truth).
 * upstream: sections Ava wrote earlier (a number only there is suspect, not proven invented).
 * canon: BCA's own method text, whose numbers anyone may quote (3-minute scorecard, 10% margin).
 */
export function groundNumbers(text: string, sources: { facts: string; upstream?: string; canon?: string }): GroundingReport {
  const found = extractNumbers(text, { claimsOnly: true });
  const facts = [...extractNumbers(sources.facts), ...extractNumbers(sources.canon ?? "")];
  const upstream = extractNumbers(sources.upstream ?? "");
  const unsupported: FoundNumber[] = [];
  const upstreamOnly: FoundNumber[] = [];
  for (const n of found) {
    if (facts.some((f) => sameNumber(n, f))) continue;
    if (upstream.some((f) => sameNumber(n, f))) upstreamOnly.push(n);
    else unsupported.push(n);
  }
  const dedupe = (list: FoundNumber[]) => [...new Map(list.map((n) => [n.raw, n])).values()];
  return { unsupported: dedupe(unsupported), upstreamOnly: dedupe(upstreamOnly), checked: found.length };
}

/** Lower-cased word list for overlap checks. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9£$%']+/g) ?? []).filter((w) => w.length > 1);
}

/** Share of the quote's words found in the source text, 0 to 1. */
export function overlap(quote: string, source: string): number {
  const q = words(quote);
  if (!q.length) return 0;
  const s = new Set(words(source));
  return q.filter((w) => s.has(w)).length / q.length;
}
