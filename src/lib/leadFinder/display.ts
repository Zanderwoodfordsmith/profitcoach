import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const UK_NATIONS = new Set([
  "england",
  "scotland",
  "wales",
  "northern ireland",
]);

function normalizePlaceToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/^city and county of\s+/, "")
    .replace(/^city of\s+/, "")
    .replace(/^greater\s+/, "")
    .replace(/\s+city$/, "")
    .replace(/\s+county$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Prefer the cleaner label when two segments describe the same place. */
function preferPlaceLabel(a: string, b: string): string {
  const score = (s: string) => {
    let n = s.length;
    if (/^city and county of\b/i.test(s)) n += 30;
    if (/^city of\b/i.test(s)) n += 20;
    if (/^greater\b/i.test(s)) n += 20;
    if (/\bcity$/i.test(s)) n += 10;
    return n;
  };
  return score(a) <= score(b) ? a : b;
}

function isSameOrAdminOf(base: string, other: string): boolean {
  const a = normalizePlaceToken(base);
  const b = normalizePlaceToken(other);
  if (!a || !b) return true;
  if (a === b) return true;
  // Oxford / Oxfordshire, Cambridge / Cambridgeshire
  if (b === `${a}shire` || a === `${b}shire`) return true;
  if (b.startsWith(a) && b.endsWith("shire") && b.length <= a.length + 6) {
    return true;
  }
  // Glasgow / Glasgow City, Brighton / Brighton And Hove (normalized contains)
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/**
 * Short, non-redundant location for table rows.
 * e.g. "London, Greater London, United Kingdom" → "London, UK"
 *      "Manchester, Manchester, United Kingdom" → "Manchester, UK"
 * When `omitCountry` (single-country filter), drop the UK/US suffix —
 * country lives in the column header instead.
 */
export function formatLeadLocation(
  location: string | null | undefined,
  state?: string | null,
  opts?: { omitCountry?: boolean }
): string {
  const raw = (location?.trim() || state?.trim() || "").trim();
  if (!raw) return "—";

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => {
      if (/^united kingdom$/i.test(p)) return "UK";
      if (/^u\.?k\.?$/i.test(p)) return "UK";
      if (/^united states(?: of america)?$/i.test(p)) return "US";
      if (/^u\.?s\.?a?\.?$/i.test(p)) return "US";
      return p;
    });

  const hasUkMarker =
    parts.some((p) => p === "UK") ||
    parts.some((p) => UK_NATIONS.has(p.toLowerCase()));

  const kept: string[] = [];
  let country: "UK" | "US" | null = null;

  for (const part of parts) {
    if (part === "UK" || part === "US") {
      country = part;
      continue;
    }
    if (hasUkMarker && UK_NATIONS.has(part.toLowerCase())) {
      country = country ?? "UK";
      continue;
    }

    const prev = kept[kept.length - 1];
    if (prev && isSameOrAdminOf(prev, part)) {
      kept[kept.length - 1] = preferPlaceLabel(prev, part);
      continue;
    }

    // Also drop if redundant with any earlier segment (rare 3-part noise)
    const dupIdx = kept.findIndex((k) => isSameOrAdminOf(k, part));
    if (dupIdx >= 0) {
      kept[dupIdx] = preferPlaceLabel(kept[dupIdx], part);
      continue;
    }

    kept.push(part);
  }

  if (hasUkMarker) country = country ?? "UK";

  // UK rows: town/county is enough — one place + UK.
  if (country === "UK" && kept.length > 1) {
    kept.splice(1);
  }

  if (country && !opts?.omitCountry) kept.push(country);

  // Country-only rows with omitCountry → em dash (header already shows 🇬🇧/🇺🇸)
  return kept.join(", ") || "—";
}

/** Ensure company website links work when stored without a scheme. */
export function companyWebsiteHref(
  url: string | null | undefined
): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

/** e.g. joh…@acme.com — enough to know it exists without exposing the inbox. */
export function maskEmailHint(email: string | null | undefined): string | null {
  const v = email?.trim();
  if (!v) return null;
  const at = v.indexOf("@");
  if (at <= 0) return `${v.slice(0, 2)}…`;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  const keep = Math.min(3, local.length);
  return `${local.slice(0, keep)}…@${domain}`;
}

function inferDefaultCountry(
  location?: string | null,
  state?: string | null
): CountryCode | undefined {
  const hay = `${location ?? ""} ${state ?? ""}`.toLowerCase();
  if (
    /\b(united kingdom|england|scotland|wales|northern ireland|\buk\b)\b/.test(
      hay
    )
  ) {
    return "GB";
  }
  if (/\b(united states|usa|\bus\b)\b/.test(hay)) {
    return "US";
  }
  // "City, CA" / "Somewhere, NY" style US locations without country suffix
  if (state?.trim() || /,\s*[A-Z]{2}\s*$/.test(location ?? "")) {
    return "US";
  }
  return undefined;
}

function inferCountryFromDigits(digits: string): CountryCode | undefined {
  if (digits.startsWith("44")) return "GB";
  if (digits.startsWith("1") && digits.length >= 11) return "US";
  return undefined;
}

/**
 * Format a lead phone into international display form (E.164-based),
 * e.g. `447467223433` → `+44 7467 223433`, `02071234567` → `+44 20 7123 4567`.
 */
export function formatLeadPhone(
  phone: string | null | undefined,
  opts?: { location?: string | null; state?: string | null }
): string | null {
  const raw = phone?.trim();
  if (!raw) return null;

  const defaultCountry =
    inferDefaultCountry(opts?.location, opts?.state) ??
    inferCountryFromDigits(raw.replace(/\D/g, ""));

  const attempts: Array<string | { text: string; country?: CountryCode }> = [];

  // Already looks international
  if (raw.startsWith("+")) {
    attempts.push(raw);
  }

  const digits = raw.replace(/\D/g, "");
  if (digits) {
    attempts.push(`+${digits}`);
    if (defaultCountry) {
      attempts.push({ text: digits, country: defaultCountry });
      attempts.push({ text: raw, country: defaultCountry });
    }
  }
  attempts.push(raw);

  for (const attempt of attempts) {
    const parsed =
      typeof attempt === "string"
        ? parsePhoneNumberFromString(attempt)
        : parsePhoneNumberFromString(attempt.text, attempt.country);
    if (parsed && (parsed.isValid() || parsed.isPossible())) {
      return parsed.formatInternational();
    }
  }

  // Last resort: if bare country-code digits, at least add +
  if (/^\d{10,15}$/.test(digits) && (digits.startsWith("44") || digits.startsWith("1"))) {
    return `+${digits}`;
  }

  return raw;
}

/** e.g. +44 74… — format first, then truncate. */
export function maskPhoneHint(
  phone: string | null | undefined,
  opts?: { location?: string | null; state?: string | null }
): string | null {
  const formatted = formatLeadPhone(phone, opts) ?? phone?.trim();
  if (!formatted) return null;
  const compact = formatted.replace(/\s+/g, " ");
  if (compact.length <= 5) return `${compact[0]}…`;
  const keep = Math.min(8, Math.max(5, Math.floor(compact.length * 0.45)));
  return `${compact.slice(0, keep).trimEnd()}…`;
}
