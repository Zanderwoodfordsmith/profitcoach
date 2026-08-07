/**
 * URL query prefill for Let’s Talk / book-call panels.
 *
 * Supported params (any page — `/`, `/bookacall`, `/profit-coach`, `/reviews`, etc.):
 *   phone, first_name, last_name, email, role, timing, investment
 *
 * Aliases: job→role, timeline→timing, name→split into first/last
 *
 * Short values (case-insensitive):
 *   role:       consultant | owner | coach | director | other
 *   timing:     yes | maybe | no
 *   investment: yes | no
 *
 * Exact canonical values also work (URL-encoded), e.g. role=Business%20owner
 *
 * Example email link:
 *   https://yoursite.com/?first_name=Jane&last_name=Smith&email=jane%40example.com
 *     &phone=%2B447911123456&role=consultant&timing=yes&investment=yes
 *
 * Behaviour:
 * - Params are captured into sessionStorage on first load (no popup opens).
 * - They survive in-site navigation for the rest of the browser tab session.
 * - Whenever a Let’s Talk form appears (modal or page), it reads that store + URL.
 */

import {
  INVESTMENT_OPTIONS,
  INVESTMENT_VALUES,
  ROLE_OPTIONS,
  ROLE_VALUES,
  TIMING_OPTIONS,
  TIMING_VALUES,
} from "@/lib/booking/bookCallQualify";

export type ApplyPrefill = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  timing?: string;
  investment?: string;
};

const STORAGE_KEY = "bca:book-call-prefill";

const ROLE_ALIASES: Record<string, string> = {
  consultant: "Consultant",
  owner: "Business owner",
  "business owner": "Business owner",
  "business-owner": "Business owner",
  coach: "Business coach",
  "business coach": "Business coach",
  "business-coach": "Business coach",
  director: "Director / senior leader",
  "senior leader": "Director / senior leader",
  "senior-leader": "Director / senior leader",
  leader: "Director / senior leader",
  other: "Other",
};

const TIMING_ALIASES: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

const INVESTMENT_ALIASES: Record<string, string> = {
  yes: "Yes, that works",
  y: "Yes, that works",
  no: "No, I’m looking for something free or done for me",
  n: "No, I’m looking for something free or done for me",
};

function one(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  if (params instanceof URLSearchParams) {
    const v = params.get(key)?.trim();
    return v || undefined;
  }
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  return raw?.trim() || undefined;
}

function firstOf(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const v = one(params, key);
    if (v) return v;
  }
  return undefined;
}

function normalizeRole(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (ROLE_VALUES.has(trimmed)) return trimmed;
  const alias = ROLE_ALIASES[trimmed.toLowerCase()];
  if (alias && ROLE_VALUES.has(alias)) return alias;
  const byLabel = ROLE_OPTIONS.find(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return byLabel?.value;
}

function normalizeTiming(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (TIMING_VALUES.has(trimmed)) return trimmed;
  const alias = TIMING_ALIASES[trimmed.toLowerCase()];
  if (alias && TIMING_VALUES.has(alias)) return alias;
  const byLabel = TIMING_OPTIONS.find(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return byLabel?.value;
}

function normalizeInvestment(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (INVESTMENT_VALUES.has(trimmed)) return trimmed;
  const alias = INVESTMENT_ALIASES[trimmed.toLowerCase()];
  if (alias && INVESTMENT_VALUES.has(alias)) return alias;
  const byLabel = INVESTMENT_OPTIONS.find(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return byLabel?.value;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Digits-only national length ≥ 7 (same bar as the form). */
export function isPrefillPhoneValid(phone: string | undefined): boolean {
  if (!phone?.trim()) return false;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return false;
  return true;
}

export function isPrefillEmailValid(email: string | undefined): boolean {
  return Boolean(email?.trim() && isValidEmail(email.trim()));
}

export function hasApplyPrefill(prefill: ApplyPrefill): boolean {
  return Object.values(prefill).some((v) => Boolean(v && String(v).trim()));
}

/**
 * Parse book-call query params from a search string, URLSearchParams,
 * or Next.js searchParams record.
 */
export function parseBookCallPrefill(
  input?: string | URLSearchParams | Record<string, string | string[] | undefined> | null,
): ApplyPrefill {
  if (!input) return {};

  const params =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;

  let firstName = firstOf(params, ["first_name", "firstName", "firstname"]);
  let lastName = firstOf(params, ["last_name", "lastName", "lastname"]);
  const fullName = firstOf(params, ["name"]);
  if ((!firstName || !lastName) && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = firstName || parts[0];
    lastName = lastName || parts.slice(1).join(" ") || undefined;
  }

  return {
    phone: firstOf(params, ["phone", "tel", "mobile"]),
    firstName,
    lastName,
    email: firstOf(params, ["email"]),
    role: normalizeRole(firstOf(params, ["role", "job"])),
    timing: normalizeTiming(firstOf(params, ["timing", "timeline"])),
    investment: normalizeInvestment(firstOf(params, ["investment"])),
  };
}

/** Merge two prefills — `override` wins when it has a value. */
export function mergeApplyPrefill(
  base: ApplyPrefill = {},
  override: ApplyPrefill = {},
): ApplyPrefill {
  return {
    phone: override.phone || base.phone,
    firstName: override.firstName || base.firstName,
    lastName: override.lastName || base.lastName,
    email: override.email || base.email,
    role: override.role || base.role,
    timing: override.timing || base.timing,
    investment: override.investment || base.investment,
  };
}

export function readStoredBookCallPrefill(): ApplyPrefill {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ApplyPrefill;
    return {
      phone: parsed.phone?.trim() || undefined,
      firstName: parsed.firstName?.trim() || undefined,
      lastName: parsed.lastName?.trim() || undefined,
      email: parsed.email?.trim() || undefined,
      role: normalizeRole(parsed.role),
      timing: normalizeTiming(parsed.timing),
      investment: normalizeInvestment(parsed.investment),
    };
  } catch {
    return {};
  }
}

export function writeStoredBookCallPrefill(prefill: ApplyPrefill): void {
  if (typeof window === "undefined") return;
  if (!hasApplyPrefill(prefill)) return;
  try {
    const next = mergeApplyPrefill(readStoredBookCallPrefill(), prefill);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Capture URL query into sessionStorage (silent — does not open any UI).
 * Returns the merged store so callers can also seed a form.
 */
export function captureBookCallPrefillFromUrl(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): ApplyPrefill {
  const fromUrl = parseBookCallPrefill(search);
  if (hasApplyPrefill(fromUrl)) writeStoredBookCallPrefill(fromUrl);
  return mergeApplyPrefill(readStoredBookCallPrefill(), fromUrl);
}

/**
 * Full client resolve: session store ← URL ← explicit prop (prop wins).
 * Also writes any new URL values into the store for later pages.
 */
export function resolveBookCallPrefill(prop?: ApplyPrefill): ApplyPrefill {
  const captured = captureBookCallPrefillFromUrl();
  return mergeApplyPrefill(captured, prop ?? {});
}

/** True when every required field is present and valid. */
export function isApplyPrefillComplete(prefill: ApplyPrefill): boolean {
  return Boolean(
    isPrefillPhoneValid(prefill.phone) &&
      prefill.firstName?.trim() &&
      prefill.lastName?.trim() &&
      isPrefillEmailValid(prefill.email) &&
      prefill.role &&
      ROLE_VALUES.has(prefill.role) &&
      prefill.timing &&
      TIMING_VALUES.has(prefill.timing) &&
      prefill.investment &&
      INVESTMENT_VALUES.has(prefill.investment),
  );
}
