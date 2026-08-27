import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clampLeadFinderMaxItems,
  LEAD_FINDER_MAX_ITEMS,
  LeadrocksError,
  scrapeLeadrocksLeads,
  type LeadFinderSearchInput,
  type NormalizedLeadrocksLead,
} from "@/lib/apify/leadrocks";
import { LEAD_FINDER_MAX_PAGE_SIZE, LEAD_FINDER_PAGE_SIZE } from "@/lib/leadFinder/constants";
import {
  LOCAL_UK_OWNERS_CATEGORY_SLUG,
  LOCAL_UK_OWNERS_EXPORTED_AT,
  LOCAL_US_OWNERS_CATEGORY_SLUG,
} from "@/lib/leadFinder/leadrocksOptions";
import type { LeadReveal, LeadTeaser } from "@/lib/leadFinder/types";
import {
  maskEmailHint,
  formatLeadPhone,
  maskPhoneHint,
  parseWebsiteCheckStatus,
} from "@/lib/leadFinder/display";

export { LEAD_FINDER_MAX_ITEMS, LEAD_FINDER_PAGE_SIZE };
export type { LeadReveal, LeadTeaser };

const LEAD_SELECT =
  "id, full_name, first_name, last_name, job_title, email, email_2, phone, phone_2, linkedin_url, company, company_website, location, state, industry, category, category_slug, team_size, revenue_range, months_at_company, months_in_role, years_at_company_bucket, exported_at, raw";

/** Fallback select before email_2 / phone_2 / exported_at / tenure migrations. */
const LEAD_SELECT_LEGACY =
  "id, full_name, first_name, last_name, job_title, email, phone, linkedin_url, company, company_website, location, state, industry, category, category_slug, team_size, revenue_range, raw";

type LeadrocksLeadRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  email_2?: string | null;
  phone: string | null;
  phone_2?: string | null;
  linkedin_url: string | null;
  company: string | null;
  company_website: string | null;
  location: string | null;
  state: string | null;
  industry: string | null;
  category: string | null;
  category_slug: string | null;
  team_size: string | null;
  revenue_range: string | null;
  months_at_company?: number | null;
  months_in_role?: number | null;
  years_at_company_bucket?: string | null;
  exported_at?: string | null;
  raw?: Record<string, unknown> | null;
};

function rawString(
  raw: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const v = raw?.[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function rowEmail2(row: LeadrocksLeadRow): string | null {
  return row.email_2?.trim() || rawString(row.raw, "email_2");
}

function rowPhone2(row: LeadrocksLeadRow): string | null {
  return row.phone_2?.trim() || rawString(row.raw, "phone_2");
}

function rowExportedAt(row: LeadrocksLeadRow): string | null {
  const col = row.exported_at?.trim();
  if (col) return col.slice(0, 10);
  return rawString(row.raw, "exported_at");
}

function formatExportDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function corpusExportDate(rows: LeadrocksLeadRow[]): string {
  const dates = [
    ...new Set(
      rows.map(rowExportedAt).filter((d): d is string => Boolean(d))
    ),
  ].sort();
  return dates[dates.length - 1] ?? LOCAL_UK_OWNERS_EXPORTED_AT;
}

function corpusFreshnessNote(rows: LeadrocksLeadRow[]): string {
  return `Results from local UK business-owner database (LeadRocks export ${formatExportDate(corpusExportDate(rows))} · no Apify).`;
}

function rowToTeaser(row: LeadrocksLeadRow): LeadTeaser {
  const email = row.email?.trim() || null;
  const email2 = rowEmail2(row);
  const phone = formatLeadPhone(row.phone, {
    location: row.location,
    state: row.state,
  });
  const phone2 = formatLeadPhone(rowPhone2(row), {
    location: row.location,
    state: row.state,
  });
  return {
    id: row.id,
    fullName: row.full_name,
    jobTitle: row.job_title,
    company: row.company,
    companyWebsite: row.company_website?.trim() || null,
    websiteStatus: parseWebsiteCheckStatus(row.raw),
    location: row.location,
    state: row.state,
    industry: row.industry,
    category: row.category,
    teamSize: row.team_size,
    revenueRange: row.revenue_range,
    yearsAtCompanyBucket: row.years_at_company_bucket?.trim() || null,
    monthsAtCompany:
      typeof row.months_at_company === "number" ? row.months_at_company : null,
    hasEmail: Boolean(email || email2),
    hasPhone: Boolean(phone || phone2),
    hasLinkedIn: Boolean(row.linkedin_url?.trim()),
    emailHint: maskEmailHint(email ?? email2),
    phoneHint: maskPhoneHint(phone ?? phone2, {
      location: row.location,
      state: row.state,
    }),
  };
}

function rowToReveal(row: LeadrocksLeadRow): LeadReveal {
  return {
    ...rowToTeaser(row),
    email: row.email,
    email2: rowEmail2(row),
    phone: formatLeadPhone(row.phone, {
      location: row.location,
      state: row.state,
    }),
    phone2: formatLeadPhone(rowPhone2(row), {
      location: row.location,
      state: row.state,
    }),
    linkedinUrl: row.linkedin_url,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

function hasValues(list?: string[]): boolean {
  return (list ?? []).some((s) => s.trim().length > 0);
}

function isLocalCorpusOnly(input: LeadFinderSearchInput): boolean {
  const tenureBuckets = (input.yearsAtCompanyBuckets ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  // Tenure only exists on Sales Nav cache rows — never Apify-fill for this.
  if (tenureBuckets.length > 0) return true;

  const categories = (input.categories ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (categories.length === 0) {
    // Free-form filter search against our imported DB — never burn Apify credits.
    return true;
  }
  return (
    categories.length === 1 &&
    (categories[0] === LOCAL_UK_OWNERS_CATEGORY_SLUG ||
      categories[0] === LOCAL_US_OWNERS_CATEGORY_SLUG)
  );
}

let leadSelectColumns = LEAD_SELECT;

async function selectLeads(
  build: (columns: string) => Promise<{ data: unknown; error: { message: string } | null }>
): Promise<LeadrocksLeadRow[]> {
  let result = await build(leadSelectColumns);
  if (
    result.error?.message?.includes("email_2") ||
    result.error?.message?.includes("phone_2") ||
    result.error?.message?.includes("exported_at") ||
    result.error?.message?.includes("months_at_company") ||
    result.error?.message?.includes("months_in_role") ||
    result.error?.message?.includes("years_at_company_bucket")
  ) {
    leadSelectColumns = LEAD_SELECT_LEGACY;
    result = await build(leadSelectColumns);
  }
  if (result.error) {
    throw new LeadrocksError(
      `Cache query failed: ${result.error.message}`,
      "scrape_failed"
    );
  }
  return (result.data ?? []) as LeadrocksLeadRow[];
}

async function queryCachedLeads(
  input: LeadFinderSearchInput,
  limit: number
): Promise<LeadrocksLeadRow[]> {
  return selectLeads(async (columns) => {
    let q = supabaseAdmin.from("leadrocks_leads").select(columns);
    q = applyLeadFilters(q, input);
    return q.order("last_seen_at", { ascending: false }).limit(limit);
  });
}

async function queryCachedLeadsPage(
  input: LeadFinderSearchInput,
  page: number,
  pageSize: number
): Promise<{ rows: LeadrocksLeadRow[]; total: number; page: number; pageSize: number }> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safeSize =
    Number.isFinite(pageSize) && pageSize >= 1
      ? Math.min(LEAD_FINDER_MAX_PAGE_SIZE, Math.floor(pageSize))
      : LEAD_FINDER_PAGE_SIZE;
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  const countQuery = applyLeadFilters(
    supabaseAdmin
      .from("leadrocks_leads")
      .select("id", { count: "exact", head: true }),
    input
  );
  const { count, error: countError } = await countQuery;
  if (countError) {
    throw new LeadrocksError(
      `Cache count failed: ${countError.message}`,
      "scrape_failed"
    );
  }
  const total = count ?? 0;
  if (total === 0) {
    return { rows: [], total: 0, page: safePage, pageSize: safeSize };
  }

  const rows = await selectLeads(async (columns) => {
    let q = supabaseAdmin.from("leadrocks_leads").select(columns);
    q = applyLeadFilters(q, input);
    return q.order("last_seen_at", { ascending: false }).range(from, to);
  });

  return { rows, total, page: safePage, pageSize: safeSize };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLeadFilters(q: any, input: LeadFinderSearchInput): any {
  const jobTitles = (input.jobTitles ?? []).map((s) => s.trim()).filter(Boolean);
  const jobTitleExcludes = (input.jobTitleExcludes ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const industries = (input.industries ?? []).map((s) => s.trim()).filter(Boolean);
  const companies = (input.companies ?? []).map((s) => s.trim()).filter(Boolean);
  const companyExcludes = (input.companyExcludes ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const states = (input.states ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const locations = (input.locations ?? []).map((s) => s.trim()).filter(Boolean);
  const searchQuery = input.searchQuery?.trim();

  const escapeIlike = (s: string) => s.replace(/[%_]/g, "\\$&");

  if (states.length === 1) {
    q = q.eq("state", states[0]);
  } else if (states.length > 1) {
    q = q.in("state", states);
  }

  if (jobTitles.length === 1) {
    q = q.ilike("job_title", `%${escapeIlike(jobTitles[0])}%`);
  } else if (jobTitles.length > 1) {
    q = q.or(
      jobTitles.map((t) => `job_title.ilike.%${escapeIlike(t)}%`).join(",")
    );
  }
  for (const ex of jobTitleExcludes) {
    q = q.not("job_title", "ilike", `%${escapeIlike(ex)}%`);
  }

  if (industries.length === 1) {
    q = q.ilike("industry", `%${escapeIlike(industries[0])}%`);
  } else if (industries.length > 1) {
    q = q.or(
      industries.map((t) => `industry.ilike.%${escapeIlike(t)}%`).join(",")
    );
  }

  if (companies.length === 1) {
    q = q.ilike("company", `%${escapeIlike(companies[0])}%`);
  } else if (companies.length > 1) {
    q = q.or(
      companies.map((t) => `company.ilike.%${escapeIlike(t)}%`).join(",")
    );
  }
  for (const ex of companyExcludes) {
    q = q.not("company", "ilike", `%${escapeIlike(ex)}%`);
  }

  if (locations.length === 1) {
    q = q.ilike("location", `%${escapeIlike(locations[0])}%`);
  } else if (locations.length > 1) {
    q = q.or(
      locations.map((loc) => `location.ilike.%${escapeIlike(loc)}%`).join(",")
    );
  }

  if (searchQuery) {
    q = q.or(
      [
        `category.ilike.%${escapeIlike(searchQuery)}%`,
        `category_slug.ilike.%${escapeIlike(searchQuery)}%`,
        `industry.ilike.%${escapeIlike(searchQuery)}%`,
        `job_title.ilike.%${escapeIlike(searchQuery)}%`,
        `company.ilike.%${escapeIlike(searchQuery)}%`,
      ].join(",")
    );
  }

  const categories = (input.categories ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (categories.length === 1) {
    q = q.eq("category_slug", categories[0]);
  } else if (categories.length > 1) {
    q = q.in("category_slug", categories);
  }

  const teamSizes = [
    ...(input.teamSizes ?? []),
    ...(input.teamSize?.trim() ? [input.teamSize.trim()] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (teamSizes.length === 1) {
    q = q.ilike("team_size", `%${escapeIlike(teamSizes[0])}%`);
  } else if (teamSizes.length > 1) {
    q = q.or(
      teamSizes.map((t) => `team_size.ilike.%${escapeIlike(t)}%`).join(",")
    );
  }

  const yearsAtBuckets = (input.yearsAtCompanyBuckets ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (yearsAtBuckets.length === 1) {
    q = q.eq("years_at_company_bucket", yearsAtBuckets[0]!);
  } else if (yearsAtBuckets.length > 1) {
    q = q.in("years_at_company_bucket", yearsAtBuckets);
  }

  const revenueRanges = [
    ...(input.revenueRanges ?? []),
    ...(input.revenueRange?.trim() ? [input.revenueRange.trim()] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (revenueRanges.length === 1) {
    q = q.ilike("revenue_range", `%${escapeIlike(revenueRanges[0])}%`);
  } else if (revenueRanges.length > 1) {
    q = q.or(
      revenueRanges
        .map((t) => `revenue_range.ilike.%${escapeIlike(t)}%`)
        .join(",")
    );
  }

  const requireContacts = [...new Set(input.requireContacts ?? [])];
  for (const kind of requireContacts) {
    if (kind === "email") {
      q = q.not("email", "is", null).neq("email", "");
    } else if (kind === "phone") {
      q = q.not("phone", "is", null).neq("phone", "");
    } else if (kind === "linkedin") {
      q = q.not("linkedin_url", "is", null).neq("linkedin_url", "");
    }
  }

  return q;
}

async function fetchLeadsByDedupeKeys(
  keys: string[]
): Promise<LeadrocksLeadRow[]> {
  if (keys.length === 0) return [];
  return selectLeads(async (columns) =>
    supabaseAdmin
      .from("leadrocks_leads")
      .select(columns)
      .in("dedupe_key", keys)
  );
}

function stampCategory(
  leads: NormalizedLeadrocksLead[],
  input: LeadFinderSearchInput
): NormalizedLeadrocksLead[] {
  const slug = (input.categories ?? [])
    .map((s) => s.trim().toLowerCase())
    .find(Boolean);
  if (!slug) return leads;
  return leads.map((lead) => ({
    ...lead,
    categorySlug: lead.categorySlug ?? slug,
    category: lead.category ?? slug,
  }));
}

async function upsertLeads(leads: NormalizedLeadrocksLead[]): Promise<void> {
  if (leads.length === 0) return;
  const now = new Date().toISOString();
  const rows = leads.map((lead) => {
    const raw = { ...lead.raw };
    if (lead.email2) raw.email_2 = lead.email2;
    if (lead.phone2) raw.phone_2 = lead.phone2;
    return {
      dedupe_key: lead.dedupeKey,
      full_name: lead.fullName,
      first_name: lead.firstName,
      last_name: lead.lastName,
      job_title: lead.jobTitle,
      email: lead.email,
      phone: lead.phone,
      linkedin_url: lead.linkedinUrl,
      company: lead.company,
      company_website: lead.companyWebsite,
      location: lead.location,
      state: lead.state,
      industry: lead.industry,
      category: lead.category,
      category_slug: lead.categorySlug,
      team_size: lead.teamSize,
      revenue_range: lead.revenueRange,
      raw,
      source: "leadrocks_apify",
      last_seen_at: now,
    };
  });

  const { error } = await supabaseAdmin.from("leadrocks_leads").upsert(rows, {
    onConflict: "dedupe_key",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new LeadrocksError(
      `Failed to cache leads: ${error.message}`,
      "scrape_failed"
    );
  }
}

/** Successively loosen filters that often zero sparse geo lists (esp. UK). */
function buildApifyAttempts(input: LeadFinderSearchInput): Array<{
  input: LeadFinderSearchInput;
  dropped: string[];
}> {
  const attempts: Array<{ input: LeadFinderSearchInput; dropped: string[] }> = [
    { input, dropped: [] },
  ];

  if (hasValues(input.jobTitles)) {
    attempts.push({
      input: { ...input, jobTitles: [] },
      dropped: ["job titles"],
    });
  }

  if (hasValues(input.locations) || hasValues(input.states)) {
    attempts.push({
      input: { ...input, jobTitles: [], locations: [], states: [] },
      dropped: [
        ...(hasValues(input.jobTitles) ? ["job titles"] : []),
        ...(hasValues(input.locations) || hasValues(input.states)
          ? ["location"]
          : []),
      ],
    });
  }

  // Dedupe identical attempts
  const seen = new Set<string>();
  return attempts.filter((a) => {
    const key = JSON.stringify({
      c: a.input.categories,
      j: a.input.jobTitles,
      l: a.input.locations,
      s: a.input.states,
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type LeadFinderSearchResult = {
  leads: LeadTeaser[];
  /** Matches already in our DB before this Apify fill */
  fromCache: number;
  /** Leads fetched from Apify this request (what we paid for) */
  fromApify: number;
  requested: number;
  /** Exact match count in DB */
  totalMatched: number;
  page: number;
  pageSize: number;
  totalPages: number;
  cacheOnly: boolean;
  /** Filters we had to drop to get any LeadRocks hits */
  relaxedFilters?: string[];
  note?: string | null;
  /** LeadRocks CSV export date (YYYY-MM-DD) when searching the local corpus */
  dataExportedAt?: string | null;
};

/**
 * Search our lead cache first. Local UK owners corpus returns one page at a
 * time (default 100) plus the exact total match count.
 */
export async function searchLeadFinder(
  input: LeadFinderSearchInput,
  options?: { forceApify?: boolean }
): Promise<LeadFinderSearchResult> {
  const forceApify = Boolean(options?.forceApify);
  const localOnly = isLocalCorpusOnly(input);

  if (localOnly && forceApify) {
    throw new LeadrocksError(
      "Force Apify only works with a LeadRocks list slug — the UK owners database is local CSV, not an Apify category.",
      "invalid_input"
    );
  }

  if (localOnly) {
    const pageSize = input.pageSize ?? LEAD_FINDER_PAGE_SIZE;
    const { rows, total, page, pageSize: size } = await queryCachedLeadsPage(
      input,
      input.page ?? 1,
      pageSize
    );
    if (total === 0) {
      throw new LeadrocksError(
        "No leads in the local UK owners database matched those filters. Try a broader industry, city, or team size.",
        "invalid_input"
      );
    }
    const totalPages = Math.max(1, Math.ceil(total / size));
    return {
      leads: rows.map(rowToTeaser),
      fromCache: rows.length,
      fromApify: 0,
      requested: size,
      totalMatched: total,
      page,
      pageSize: size,
      totalPages,
      cacheOnly: true,
      note: corpusFreshnessNote(rows),
      dataExportedAt: corpusExportDate(rows),
    };
  }

  const requested = clampLeadFinderMaxItems(input.maxItems);
  const cacheBefore = forceApify ? [] : await queryCachedLeads(input, requested);
  if (cacheBefore.length >= requested) {
    return {
      leads: cacheBefore.slice(0, requested).map(rowToTeaser),
      fromCache: Math.min(cacheBefore.length, requested),
      fromApify: 0,
      requested,
      totalMatched: cacheBefore.length,
      page: 1,
      pageSize: requested,
      totalPages: 1,
      cacheOnly: true,
      note: null,
      dataExportedAt: null,
    };
  }

  const need = requested - cacheBefore.length;
  const attempts = buildApifyAttempts({ ...input, maxItems: need });
  let scraped: NormalizedLeadrocksLead[] = [];
  let relaxedFilters: string[] = [];
  let usedInput = attempts[0]?.input ?? input;

  for (const attempt of attempts) {
    scraped = await scrapeLeadrocksLeads({
      ...attempt.input,
      maxItems: need,
    });
    if (scraped.length > 0) {
      usedInput = attempt.input;
      relaxedFilters = attempt.dropped;
      break;
    }
  }

  scraped = stampCategory(scraped, usedInput);
  await upsertLeads(scraped);

  const cacheIds = new Set(cacheBefore.map((r) => r.id));
  const scrapedRows = await fetchLeadsByDedupeKeys(
    scraped.map((l) => l.dedupeKey)
  );
  const merged: LeadrocksLeadRow[] = [...cacheBefore];
  for (const row of scrapedRows) {
    if (!cacheIds.has(row.id)) merged.push(row);
  }

  if (merged.length === 0) {
    throw new LeadrocksError(
      "LeadRocks returned no people for that list with these filters. Many lists are US-heavy and UK + specific titles often match nothing. Try a different list, drop job titles, or search US.",
      "invalid_input"
    );
  }

  const note =
    relaxedFilters.length > 0
      ? `Exact filters matched nothing, so we dropped ${relaxedFilters.join(" + ")} to find people still on this list.`
      : null;

  const pageLeads = merged.slice(0, requested);
  return {
    leads: pageLeads.map(rowToTeaser),
    fromCache: cacheBefore.length,
    fromApify: scraped.length,
    requested,
    totalMatched: merged.length,
    page: 1,
    pageSize: requested,
    totalPages: 1,
    cacheOnly: scraped.length === 0,
    relaxedFilters: relaxedFilters.length ? relaxedFilters : undefined,
    note,
    dataExportedAt: null,
  };
}

/**
 * Cheap, informational inventory count against the local leads cache — never
 * triggers an Apify fill. Used by First Campaign Setup to show "we hold N of
 * these" without gating the coach's ICP choice on it.
 */
export async function countLeadFinderMatches(
  input: Pick<
    LeadFinderSearchInput,
    "industries" | "jobTitles" | "locations" | "teamSizes" | "revenueRanges" | "searchQuery"
  >
): Promise<number> {
  try {
    const countQuery = applyLeadFilters(
      supabaseAdmin.from("leadrocks_leads").select("id", { count: "exact", head: true }),
      input as LeadFinderSearchInput
    );
    const { count, error } = await countQuery;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function revealLeadFinderLeads(
  ids: string[]
): Promise<LeadReveal[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    LEAD_FINDER_MAX_ITEMS
  );
  if (unique.length === 0) return [];

  const rows = await selectLeads(async (columns) =>
    supabaseAdmin.from("leadrocks_leads").select(columns).in("id", unique)
  );

  return rows.map(rowToReveal);
}
