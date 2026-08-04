/**
 * LinkedIn Sales Navigator lead search via Apify (cookie-authenticated).
 * Default actor: harvestapi/linkedin-sales-navigator-lead-search-cookie
 *
 * Server-only — do not import from client components (pulls in apify-client/dns).
 */

import { ApifyClient } from "apify-client";
import {
  SALES_NAV_DEFAULT_TAKE_PAGES,
  SALES_NAV_MAX_TAKE_PAGES,
  type SalesNavImportedLead,
} from "@/lib/apify/salesNavigatorTypes";

export {
  SALES_NAV_DEFAULT_TAKE_PAGES,
  SALES_NAV_MAX_TAKE_PAGES,
  type SalesNavImportedLead,
} from "@/lib/apify/salesNavigatorTypes";

const DEFAULT_ACTOR =
  "harvestapi/linkedin-sales-navigator-lead-search-cookie";

export class SalesNavScrapeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "invalid_input"
      | "scrape_failed"
      | "empty_result"
  ) {
    super(message);
    this.name = "SalesNavScrapeError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function locationText(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  const rec = asRecord(value);
  if (!rec) return null;
  const parsed = asRecord(rec.parsed);
  return (
    asString(rec.linkedinText) ??
    asString(parsed?.text) ??
    asString(rec.text) ??
    asString(rec.default)
  );
}

function currentCompany(rec: Record<string, unknown>): string | null {
  const current = rec.currentPosition;
  if (Array.isArray(current) && current[0]) {
    const first = asRecord(current[0]);
    if (first) return asString(first.companyName) ?? asString(first.company);
  }
  const experience = Array.isArray(rec.experience) ? rec.experience : [];
  const firstExp = asRecord(experience[0]);
  if (firstExp) {
    return asString(firstExp.companyName) ?? asString(firstExp.company);
  }
  return asString(rec.companyName) ?? asString(rec.company);
}

function currentTitle(rec: Record<string, unknown>): string | null {
  const experience = Array.isArray(rec.experience) ? rec.experience : [];
  const firstExp = asRecord(experience[0]);
  if (firstExp) {
    return (
      asString(firstExp.position) ??
      asString(firstExp.title) ??
      asString(firstExp.jobTitle)
    );
  }
  return (
    asString(rec.jobTitle) ??
    asString(rec.title) ??
    asString(rec.headline)
  );
}

function profileUrl(rec: Record<string, unknown>): string | null {
  const direct =
    asString(rec.linkedinUrl) ??
    asString(rec.profileUrl) ??
    asString(rec.url);
  if (direct) return direct;
  const slug = asString(rec.publicIdentifier) ?? asString(rec.publicId);
  if (slug) return `https://www.linkedin.com/in/${slug}`;
  return null;
}

export function normalizeSalesNavItem(item: unknown): SalesNavImportedLead | null {
  const rec = asRecord(item);
  if (!rec) return null;
  if (rec.succeeded === false) return null;
  if (asString(rec.error)) return null;

  const firstName = asString(rec.firstName);
  const lastName = asString(rec.lastName);
  const fullName =
    asString(rec.fullName) ??
    asString(rec.name) ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  const linkedinUrl = profileUrl(rec);
  if (!fullName && !linkedinUrl) return null;

  return {
    fullName,
    firstName,
    lastName,
    jobTitle: currentTitle(rec),
    company: currentCompany(rec),
    linkedinUrl,
    location: locationText(rec.location),
    email: asString(rec.email) ?? asString(rec.emails),
    headline: asString(rec.headline),
    raw: rec,
  };
}

function normalizeCookieInput(cookie: string): string {
  const trimmed = cookie.trim();
  if (!trimmed) {
    throw new SalesNavScrapeError(
      "Paste your LinkedIn cookies (Cookie-Editor → Export → JSON).",
      "invalid_input"
    );
  }
  // Accept already-stringified JSON array, raw JSON array, or li_at=… cookie string.
  if (trimmed.startsWith("[")) return trimmed;
  if (trimmed.startsWith('"[')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function isSalesNavSearchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return false;
    return u.pathname.includes("/sales/search/people");
  } catch {
    return false;
  }
}

export type ScrapeSalesNavSearchInput = {
  salesNavUrl: string;
  cookie: string;
  userAgent?: string;
  /** Search pages to scrape (25 leads/page). Clamped to SALES_NAV_MAX_TAKE_PAGES. */
  takePages?: number;
};

export type ScrapeSalesNavSearchResult = {
  leads: SalesNavImportedLead[];
  scrapedCount: number;
  takePages: number;
};

export async function scrapeSalesNavSearch(
  input: ScrapeSalesNavSearchInput
): Promise<ScrapeSalesNavSearchResult> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new SalesNavScrapeError(
      "Server is not configured with APIFY_TOKEN.",
      "not_configured"
    );
  }

  const salesNavUrl = input.salesNavUrl.trim();
  if (!isSalesNavSearchUrl(salesNavUrl)) {
    throw new SalesNavScrapeError(
      "Provide a Sales Navigator people-search URL (linkedin.com/sales/search/people…).",
      "invalid_input"
    );
  }

  const cookie = normalizeCookieInput(input.cookie);
  const takePages = Math.min(
    SALES_NAV_MAX_TAKE_PAGES,
    Math.max(1, Math.floor(input.takePages ?? SALES_NAV_DEFAULT_TAKE_PAGES))
  );

  const actorId =
    process.env.APIFY_SALES_NAV_ACTOR?.trim() || DEFAULT_ACTOR;
  const client = new ApifyClient({ token });

  const runInput: Record<string, unknown> = {
    profileScraperMode: "Short",
    salesNavUrl,
    cookie,
    startPage: 1,
    takePages,
  };
  const ua = input.userAgent?.trim();
  if (ua) runInput.userAgent = ua;

  let run;
  try {
    // Cookie scrapes can be slow — allow several minutes.
    run = await client.actor(actorId).call(runInput, { waitSecs: 420 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sales Navigator scrape failed.";
    throw new SalesNavScrapeError(message, "scrape_failed");
  }

  if (!run?.defaultDatasetId) {
    throw new SalesNavScrapeError(
      "Apify run finished without a dataset.",
      "scrape_failed"
    );
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: takePages * 25 + 10,
  });

  const leads = items
    .map(normalizeSalesNavItem)
    .filter((l): l is SalesNavImportedLead => Boolean(l));

  if (leads.length === 0) {
    const errItem = items[0] ? asRecord(items[0]) : null;
    const detail =
      asString(errItem?.error) ??
      "No leads returned. Check cookies are fresh, Sales Nav is active, and the search URL is valid.";
    throw new SalesNavScrapeError(detail, "empty_result");
  }

  return { leads, scrapedCount: leads.length, takePages };
}
