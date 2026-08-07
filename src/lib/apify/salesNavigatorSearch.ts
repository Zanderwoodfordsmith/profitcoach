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
import {
  tenureTotalMonths,
  yearsAtCompanyBucketFromMonths,
} from "@/lib/salesNavigator/tenure";
import { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";

export {
  SALES_NAV_DEFAULT_TAKE_PAGES,
  SALES_NAV_MAX_TAKE_PAGES,
  type SalesNavImportedLead,
} from "@/lib/apify/salesNavigatorTypes";
export { isSalesNavSearchUrl } from "@/lib/salesNavigator/isSalesNavSearchUrl";

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

function firstCurrentPosition(
  rec: Record<string, unknown>
): Record<string, unknown> | null {
  const plural = Array.isArray(rec.currentPositions)
    ? rec.currentPositions
    : null;
  if (plural?.[0]) {
    const first = asRecord(plural[0]);
    if (first) return first;
  }
  const singular = rec.currentPosition;
  if (Array.isArray(singular) && singular[0]) {
    return asRecord(singular[0]);
  }
  if (singular && typeof singular === "object" && !Array.isArray(singular)) {
    return asRecord(singular);
  }
  return null;
}

function currentCompany(rec: Record<string, unknown>): string | null {
  const current = firstCurrentPosition(rec);
  if (current) {
    return asString(current.companyName) ?? asString(current.company);
  }
  const experience = Array.isArray(rec.experience) ? rec.experience : [];
  const firstExp = asRecord(experience[0]);
  if (firstExp) {
    return asString(firstExp.companyName) ?? asString(firstExp.company);
  }
  return asString(rec.companyName) ?? asString(rec.company);
}

function currentTitle(rec: Record<string, unknown>): string | null {
  const current = firstCurrentPosition(rec);
  if (current) {
    return (
      asString(current.title) ??
      asString(current.position) ??
      asString(current.jobTitle)
    );
  }
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

function photoUrl(rec: Record<string, unknown>): string | null {
  return (
    asString(rec.pictureUrl) ??
    asString(rec.profilePicture) ??
    asString(rec.photoUrl) ??
    asString(rec.photo) ??
    asString(rec.profileImageUrl)
  );
}

function formatTenurePart(
  tenure: Record<string, unknown> | null,
  suffix: string
): string | null {
  if (!tenure) return null;
  const years = typeof tenure.numYears === "number" ? tenure.numYears : 0;
  const months = typeof tenure.numMonths === "number" ? tenure.numMonths : 0;
  if (years <= 0 && months <= 0) return null;
  const bits: string[] = [];
  if (years > 0) bits.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) bits.push(`${months} month${months === 1 ? "" : "s"}`);
  return `${bits.join(" ")} ${suffix}`;
}

function tenureLabel(rec: Record<string, unknown>): string | null {
  const current = firstCurrentPosition(rec);
  if (!current) return null;
  const role = formatTenurePart(asRecord(current.tenureAtPosition), "in role");
  const company = formatTenurePart(
    asRecord(current.tenureAtCompany),
    "in company"
  );
  return [role, company].filter(Boolean).join(" · ") || null;
}

function tenureFields(rec: Record<string, unknown>): {
  tenureLabel: string | null;
  monthsAtCompany: number | null;
  monthsInRole: number | null;
  yearsAtCompanyBucket: SalesNavImportedLead["yearsAtCompanyBucket"];
} {
  const current = firstCurrentPosition(rec);
  const monthsAtCompany = tenureTotalMonths(
    asRecord(current?.tenureAtCompany)
  );
  const monthsInRole = tenureTotalMonths(asRecord(current?.tenureAtPosition));
  return {
    tenureLabel: tenureLabel(rec),
    monthsAtCompany,
    monthsInRole,
    yearsAtCompanyBucket: yearsAtCompanyBucketFromMonths(monthsAtCompany),
  };
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

  const tenure = tenureFields(rec);

  return {
    fullName,
    firstName,
    lastName,
    jobTitle: currentTitle(rec),
    company: currentCompany(rec),
    linkedinUrl,
    location: locationText(rec.location),
    email: asString(rec.email) ?? asString(rec.emails),
    headline: asString(rec.headline) ?? asString(rec.summary),
    about: asString(rec.about) ?? asString(rec.summary),
    photoUrl: photoUrl(rec),
    premium: Boolean(rec.premium),
    ...tenure,
    raw: rec,
  };
}

function normalizeCookieInput(cookie: string): string {
  const trimmed = cookie.trim();
  if (!trimmed) {
    throw new SalesNavScrapeError(
      "Paste Cookie-Editor JSON (Export as JSON), or set LINKEDIN_SALES_NAV_COOKIE.",
      "not_configured"
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

function serverSalesNavCookie(): string {
  return (
    process.env.LINKEDIN_SALES_NAV_COOKIE?.trim() ||
    process.env.APIFY_SALES_NAV_COOKIE?.trim() ||
    ""
  );
}

function serverSalesNavUserAgent(): string | undefined {
  const ua =
    process.env.LINKEDIN_SALES_NAV_USER_AGENT?.trim() ||
    process.env.APIFY_SALES_NAV_USER_AGENT?.trim() ||
    "";
  return ua || undefined;
}

export type ScrapeSalesNavSearchInput = {
  salesNavUrl: string;
  /**
   * Admin test override (Cookie-Editor JSON). Falls back to
   * LINKEDIN_SALES_NAV_COOKIE when omitted.
   */
  cookie?: string;
  userAgent?: string;
  /** Search pages to scrape (25 leads/page). Clamped to SALES_NAV_MAX_TAKE_PAGES. */
  takePages?: number;
};

export type ScrapeSalesNavSearchResult = {
  leads: SalesNavImportedLead[];
  scrapedCount: number;
  takePages: number;
};

export type StartSalesNavSearchResult = {
  apifyRunId: string;
  apifyDatasetId: string | null;
  actorId: string;
  takePages: number;
};

function requireApifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new SalesNavScrapeError(
      "Server is not configured with APIFY_TOKEN.",
      "not_configured"
    );
  }
  return token;
}

function resolveActorId(): string {
  return process.env.APIFY_SALES_NAV_ACTOR?.trim() || DEFAULT_ACTOR;
}

function buildRunInput(
  input: ScrapeSalesNavSearchInput
): { runInput: Record<string, unknown>; takePages: number; salesNavUrl: string } {
  const salesNavUrl = input.salesNavUrl.trim();
  if (!isSalesNavSearchUrl(salesNavUrl)) {
    throw new SalesNavScrapeError(
      "Provide a Sales Navigator people-search URL (linkedin.com/sales/search/people…).",
      "invalid_input"
    );
  }

  const cookie = normalizeCookieInput(
    input.cookie?.trim() || serverSalesNavCookie()
  );
  const takePages = Math.min(
    SALES_NAV_MAX_TAKE_PAGES,
    Math.max(1, Math.floor(input.takePages ?? SALES_NAV_DEFAULT_TAKE_PAGES))
  );

  const runInput: Record<string, unknown> = {
    profileScraperMode: "Short",
    salesNavUrl,
    cookie,
    startPage: 1,
    takePages,
  };
  const ua = input.userAgent?.trim() || serverSalesNavUserAgent();
  if (ua) runInput.userAgent = ua;

  return { runInput, takePages, salesNavUrl };
}

function leadsFromDatasetItems(items: unknown[]): SalesNavImportedLead[] {
  return items
    .map(normalizeSalesNavItem)
    .filter((l): l is SalesNavImportedLead => Boolean(l));
}

function emptyResultError(items: unknown[]): SalesNavScrapeError {
  const errItem = items[0] ? asRecord(items[0]) : null;
  const apifyError =
    asString(errItem?.error) ??
    asString(errItem?.message) ??
    asString(errItem?.errorDescription);
  const detail = apifyError
    ? apifyError
    : items.length === 0
      ? "Apify finished but returned 0 profiles. Usually a stale Sales Nav session (re-export Cookie-Editor JSON), or this search has no results — open the same filters in Sales Navigator to check."
      : `Apify returned ${items.length} row(s) we couldn’t read as leads. Open the latest run in Apify Console and check the dataset.`;
  return new SalesNavScrapeError(detail, "empty_result");
}

/** Fire-and-forget Apify run (returns immediately; poll with getApifyRunState). */
export async function startSalesNavSearch(
  input: ScrapeSalesNavSearchInput
): Promise<StartSalesNavSearchResult> {
  const token = requireApifyToken();
  const actorId = resolveActorId();
  const { runInput, takePages } = buildRunInput(input);
  const client = new ApifyClient({ token });

  let run;
  try {
    run = await client.actor(actorId).start(runInput);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sales Navigator scrape failed.";
    throw new SalesNavScrapeError(message, "scrape_failed");
  }

  if (!run?.id) {
    throw new SalesNavScrapeError(
      "Apify did not return a run id.",
      "scrape_failed"
    );
  }

  return {
    apifyRunId: run.id,
    apifyDatasetId: run.defaultDatasetId ?? null,
    actorId,
    takePages,
  };
}

export type ApifyRunState = {
  status: string;
  datasetId: string | null;
  /** Dataset item count when available (may rise while RUNNING). */
  itemCount: number;
};

export async function getApifyRunState(
  apifyRunId: string
): Promise<ApifyRunState> {
  const token = requireApifyToken();
  const client = new ApifyClient({ token });
  const run = await client.run(apifyRunId).get();
  if (!run) {
    throw new SalesNavScrapeError(
      "Apify run not found.",
      "scrape_failed"
    );
  }

  const datasetId = run.defaultDatasetId ?? null;
  let itemCount = 0;
  if (datasetId) {
    try {
      const listed = await client.dataset(datasetId).listItems({
        limit: 0,
        offset: 0,
      });
      itemCount =
        typeof listed.total === "number" && Number.isFinite(listed.total)
          ? listed.total
          : 0;
    } catch {
      itemCount = 0;
    }
  }

  return {
    status: String(run.status ?? "UNKNOWN"),
    datasetId,
    itemCount,
  };
}

export async function fetchSalesNavSearchDataset(opts: {
  datasetId: string;
  takePages: number;
}): Promise<SalesNavImportedLead[]> {
  const token = requireApifyToken();
  const client = new ApifyClient({ token });
  const { items } = await client.dataset(opts.datasetId).listItems({
    limit: opts.takePages * 25 + 10,
  });
  const leads = leadsFromDatasetItems(items);
  if (leads.length === 0) {
    throw emptyResultError(items);
  }
  return leads;
}

/** Blocking scrape (legacy / small sync callers). Prefer start + poll for large imports. */
export async function scrapeSalesNavSearch(
  input: ScrapeSalesNavSearchInput
): Promise<ScrapeSalesNavSearchResult> {
  const token = requireApifyToken();
  const actorId = resolveActorId();
  const { runInput, takePages } = buildRunInput(input);
  const client = new ApifyClient({ token });

  let run;
  try {
    // Cookie scrapes scale with pages — Short mode is ~a few sec/page; leave headroom.
    const waitSecs = Math.min(800, Math.max(420, 90 + takePages * 6));
    run = await client.actor(actorId).call(runInput, { waitSecs });
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

  const leads = await fetchSalesNavSearchDataset({
    datasetId: run.defaultDatasetId,
    takePages,
  });

  return { leads, scrapedCount: leads.length, takePages };
}
