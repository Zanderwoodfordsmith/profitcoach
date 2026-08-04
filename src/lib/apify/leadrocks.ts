import { createHash } from "crypto";
import { ApifyClient } from "apify-client";
import { LEAD_FINDER_MAX_ITEMS } from "@/lib/leadFinder/constants";

export { LEAD_FINDER_MAX_ITEMS };

const DEFAULT_ACTOR = "rigelbytes/leadrocks-scraper";

export type LeadFinderSearchInput = {
  /** Exact LeadRocks category slug(s) — preferred for Apify fills */
  categories?: string[];
  searchQuery?: string;
  states?: string[];
  locations?: string[];
  jobTitles?: string[];
  /** Job title must match none of these (ilike) */
  jobTitleExcludes?: string[];
  industries?: string[];
  /** Company name must match at least one (ilike) */
  companies?: string[];
  /** Company name must match none of these (ilike) */
  companyExcludes?: string[];
  teamSizes?: string[];
  revenueRanges?: string[];
  /** Require these contact fields to be present (AND). */
  requireContacts?: Array<"email" | "phone" | "linkedin">;
  /** @deprecated use teamSizes */
  teamSize?: string;
  /** @deprecated use revenueRanges */
  revenueRange?: string;
  maxItems?: number;
  /** 1-based page for local corpus pagination */
  page?: number;
  pageSize?: number;
};

export type NormalizedLeadrocksLead = {
  dedupeKey: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
  linkedinUrl: string | null;
  company: string | null;
  companyWebsite: string | null;
  location: string | null;
  state: string | null;
  industry: string | null;
  category: string | null;
  categorySlug: string | null;
  teamSize: string | null;
  revenueRange: string | null;
  raw: Record<string, unknown>;
};

export class LeadrocksError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "invalid_input" | "scrape_failed"
  ) {
    super(message);
    this.name = "LeadrocksError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function emailsFromList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const s = asString(item);
      if (s) out.push(s);
      continue;
    }
    const rec = asRecord(item);
    const email = asString(rec?.email);
    if (email) out.push(email);
  }
  return out;
}

function pickSecondDistinct(
  primary: string | null,
  candidates: Array<string | null>
): string | null {
  const primaryKey = primary?.trim().toLowerCase() ?? null;
  for (const c of candidates) {
    const s = asString(c);
    if (!s) continue;
    if (primaryKey && s.toLowerCase() === primaryKey) continue;
    return s;
  }
  return null;
}

export function buildLeadDedupeKey(input: {
  email?: string | null;
  linkedinUrl?: string | null;
  fullName?: string | null;
  company?: string | null;
}): string {
  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const li = input.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, "");
  if (li) return `linkedin:${li}`;
  const name = (input.fullName ?? "").trim().toLowerCase();
  const company = (input.company ?? "").trim().toLowerCase();
  const hash = createHash("sha256")
    .update(`${name}|${company}`)
    .digest("hex")
    .slice(0, 24);
  return `nameco:${hash}`;
}

export function normalizeLeadrocksItem(raw: unknown): NormalizedLeadrocksLead | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const workEmails = emailsFromList(rec.workEmails);
  const directEmails = emailsFromList(rec.directEmails);
  const email =
    asString(rec.email) ?? workEmails[0] ?? directEmails[0] ?? null;
  const email2 = pickSecondDistinct(email, [
    workEmails[1] ?? null,
    directEmails[0] ?? null,
    workEmails[0] ?? null,
    asString(rec.email2),
  ]);
  const linkedinUrl = asString(rec.linkedinUrl) ?? asString(rec.linkedin);
  const joinedName = [asString(rec.firstName), asString(rec.lastName)]
    .filter(Boolean)
    .join(" ");
  const fullName = asString(rec.fullName) ?? (joinedName || null);
  const company = asString(rec.company) ?? asString(rec.companyName);
  const phones = Array.isArray(rec.phones)
    ? rec.phones.map((p) => asString(p)).filter((p): p is string => Boolean(p))
    : [];
  const phone = asString(rec.phone) ?? phones[0] ?? null;
  const phone2 = pickSecondDistinct(phone, [
    phones[1] ?? null,
    asString(rec.phone2),
    asString(rec.companyPhone),
  ]);

  if (!fullName && !email && !linkedinUrl && !company) return null;

  return {
    dedupeKey: buildLeadDedupeKey({
      email,
      linkedinUrl,
      fullName,
      company,
    }),
    fullName,
    firstName: asString(rec.firstName),
    lastName: asString(rec.lastName),
    jobTitle: asString(rec.jobTitle) ?? asString(rec.title),
    email,
    email2,
    phone,
    phone2,
    linkedinUrl,
    company,
    companyWebsite: asString(rec.companyWebsite) ?? asString(rec.website),
    location: asString(rec.location),
    state: asString(rec.state),
    industry: asString(rec.industry),
    category: asString(rec.category),
    categorySlug: asString(rec.categorySlug),
    teamSize: asString(rec.teamSize),
    revenueRange: asString(rec.revenueRange),
    raw: rec,
  };
}

export function clampLeadFinderMaxItems(n: unknown): number {
  const parsed = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(parsed) || parsed < 1) return LEAD_FINDER_MAX_ITEMS;
  return Math.min(LEAD_FINDER_MAX_ITEMS, Math.floor(parsed));
}

export async function scrapeLeadrocksLeads(
  input: LeadFinderSearchInput
): Promise<NormalizedLeadrocksLead[]> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new LeadrocksError(
      "Server is not configured with APIFY_TOKEN.",
      "not_configured"
    );
  }

  const categories = (input.categories ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const searchQuery = input.searchQuery?.trim() ?? "";
  const jobTitles = (input.jobTitles ?? []).map((s) => s.trim()).filter(Boolean);
  const industries = (input.industries ?? []).map((s) => s.trim()).filter(Boolean);
  const companies = (input.companies ?? []).map((s) => s.trim()).filter(Boolean);
  const states = (input.states ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const locations = (input.locations ?? []).map((s) => s.trim()).filter(Boolean);

  if (categories.length === 0 && !searchQuery) {
    throw new LeadrocksError(
      "Pick at least one LeadRocks category (e.g. seo, trucking, business_coach).",
      "invalid_input"
    );
  }

  const maxItems = clampLeadFinderMaxItems(input.maxItems);
  const actorId =
    process.env.APIFY_LEADROCKS_ACTOR?.trim() || DEFAULT_ACTOR;
  const client = new ApifyClient({ token });

  const runInput: Record<string, unknown> = {
    maxItems,
  };
  if (categories.length) runInput.categories = categories;
  if (searchQuery) runInput.searchQueries = [searchQuery];
  // Actor requires categories or searchQueries
  if (!runInput.categories && !runInput.searchQueries) {
    runInput.searchQueries = categories.length ? categories : [searchQuery];
  }
  if (states.length) runInput.states = states;
  if (locations.length) runInput.locations = locations;
  if (jobTitles.length) runInput.jobTitles = jobTitles;
  if (industries.length) runInput.industries = industries;
  if (companies.length) runInput.companies = companies;

  let run;
  try {
    run = await client.actor(actorId).call(runInput, { waitSecs: 300 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "LeadRocks scrape failed.";
    throw new LeadrocksError(message, "scrape_failed");
  }

  if (!run?.defaultDatasetId) {
    throw new LeadrocksError("Apify run finished without a dataset.", "scrape_failed");
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: maxItems + 5,
  });

  const leads: NormalizedLeadrocksLead[] = [];
  for (const item of items) {
    const normalized = normalizeLeadrocksItem(item);
    if (normalized) leads.push(normalized);
  }
  return leads.slice(0, maxItems);
}
