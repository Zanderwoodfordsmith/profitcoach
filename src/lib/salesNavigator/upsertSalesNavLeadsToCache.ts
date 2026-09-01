/**
 * Upsert Sales Navigator Short scrapes into the shared leadrocks_leads pool.
 * Match: LinkedIn /in/ URL first, then first+last+company (or full name+company).
 * Preserves existing email/phone; team_size only when the search had a single headcount.
 */

import type { SalesNavImportedLead } from "@/lib/apify/salesNavigatorTypes";
import {
  canonicalLinkedInProfileUrl,
  isObfuscatedLinkedInUrl,
  isVanityLinkedInUrl,
  nameCompanyIdentityKey,
  normalizePublicLinkedInUrl,
  salesNavDedupeKey,
  samePersonNameCompany,
} from "@/lib/salesNavigator/leadIdentity";
import { teamSizeFromSalesNavUrl } from "@/lib/salesNavigator/parseSalesNavFilters";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CacheRow = {
  id: string;
  dedupe_key: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  company: string | null;
  location: string | null;
  team_size: string | null;
  source: string;
  raw: Record<string, unknown> | null;
};

export type UpsertSalesNavCacheResult = {
  inserted: number;
  updated: number;
  skipped: number;
  teamSizeFromFilter: string | null;
};

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function preferText(
  incoming: string | null | undefined,
  existing: string | null | undefined
): string | null {
  const next = incoming?.trim();
  if (next) return next;
  const prev = existing?.trim();
  return prev || null;
}

function linkedinUrlVariants(url: string): string[] {
  const normalized = normalizePublicLinkedInUrl(url);
  const variants = new Set<string>();
  for (const u of [url.trim(), normalized].filter(Boolean) as string[]) {
    variants.add(u);
    variants.add(u.replace(/\/+$/, ""));
    variants.add(u.toLowerCase());
    variants.add(u.replace(/\/+$/, "").toLowerCase());
    if (u.includes("://www.")) {
      variants.add(u.replace("://www.", "://"));
      variants.add(u.replace("://www.", "://").toLowerCase());
    } else if (u.includes("://linkedin.com")) {
      variants.add(u.replace("://linkedin.com", "://www.linkedin.com"));
      variants.add(
        u.replace("://linkedin.com", "://www.linkedin.com").toLowerCase()
      );
    }
  }
  return [...variants];
}

async function fetchExistingCandidates(opts: {
  linkedinUrls: string[];
  dedupeKeys: string[];
  companies: string[];
}): Promise<CacheRow[]> {
  const byId = new Map<string, CacheRow>();

  for (const chunk of toChunks(opts.linkedinUrls, 80)) {
    if (chunk.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(
        "id, dedupe_key, full_name, first_name, last_name, job_title, email, phone, linkedin_url, company, location, team_size, source, raw"
      )
      .in("linkedin_url", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id, row as CacheRow);
  }

  for (const chunk of toChunks(opts.dedupeKeys, 80)) {
    if (chunk.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(
        "id, dedupe_key, full_name, first_name, last_name, job_title, email, phone, linkedin_url, company, location, team_size, source, raw"
      )
      .in("dedupe_key", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id, row as CacheRow);
  }

  // Name+company fallback: load candidates sharing a company in this batch.
  for (const chunk of toChunks(opts.companies, 40)) {
    if (chunk.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(
        "id, dedupe_key, full_name, first_name, last_name, job_title, email, phone, linkedin_url, company, location, team_size, source, raw"
      )
      .in("company", chunk)
      .limit(500);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id, row as CacheRow);
  }

  return [...byId.values()];
}

function findMatch(
  lead: SalesNavImportedLead,
  candidates: CacheRow[],
  usedIds: Set<string>
): CacheRow | null {
  const li = normalizePublicLinkedInUrl(lead.linkedinUrl);
  if (li) {
    for (const row of candidates) {
      if (usedIds.has(row.id)) continue;
      const rowLi = normalizePublicLinkedInUrl(row.linkedin_url);
      if (rowLi && rowLi === li) return row;
    }
  }

  for (const row of candidates) {
    if (usedIds.has(row.id)) continue;
    if (samePersonNameCompany(lead, row)) return row;
  }

  return null;
}

export async function upsertSalesNavLeadsToCache(opts: {
  leads: SalesNavImportedLead[];
  salesNavUrl?: string | null;
}): Promise<UpsertSalesNavCacheResult> {
  const leads = opts.leads.filter((l) => l.fullName || l.linkedinUrl);
  const teamSizeFromFilter = teamSizeFromSalesNavUrl(opts.salesNavUrl);
  if (leads.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, teamSizeFromFilter };
  }

  const linkedinUrls = new Set<string>();
  const dedupeKeys = new Set<string>();
  const companies = new Set<string>();

  for (const lead of leads) {
    if (lead.linkedinUrl) {
      for (const v of linkedinUrlVariants(lead.linkedinUrl)) linkedinUrls.add(v);
    }
    const key = salesNavDedupeKey(lead);
    if (key) dedupeKeys.add(key);
    // Also probe LeadRocks-style nameco keys (fullName|company).
    const legacyNameCo = nameCompanyIdentityKey({
      fullName: lead.fullName,
      company: lead.company,
    });
    if (legacyNameCo) dedupeKeys.add(legacyNameCo);
    if (lead.company?.trim()) companies.add(lead.company.trim());
  }

  const candidates = await fetchExistingCandidates({
    linkedinUrls: [...linkedinUrls],
    dedupeKeys: [...dedupeKeys],
    companies: [...companies],
  });

  const now = new Date().toISOString();
  const scrapedDate = now.slice(0, 10);
  const usedIds = new Set<string>();
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];
  let skipped = 0;

  for (const lead of leads) {
    const match = findMatch(lead, candidates, usedIds);
    if (match) {
      usedIds.add(match.id);
      const raw =
        match.raw && typeof match.raw === "object" && !Array.isArray(match.raw)
          ? { ...match.raw }
          : {};
      raw.last_sales_nav_scrape_at = now;
      if (opts.salesNavUrl) raw.last_sales_nav_url = opts.salesNavUrl;
      if (lead.headline) raw.headline = lead.headline;
      if (lead.photoUrl) raw.photo_url = lead.photoUrl;
      if (lead.tenureLabel) raw.tenure_label = lead.tenureLabel;
      if (lead.raw) raw.sales_nav = lead.raw;

      // Don't clobber a human-readable vanity URL with a Sales Nav member-id
      // URL — keep the vanity URL and stash the member-id form alongside it.
      const incomingLi =
        canonicalLinkedInProfileUrl(lead.linkedinUrl) ??
        lead.linkedinUrl?.trim() ??
        null;
      const existingLi =
        canonicalLinkedInProfileUrl(match.linkedin_url) ??
        match.linkedin_url?.trim() ??
        null;
      const incomingIsObfuscated = isObfuscatedLinkedInUrl(lead.linkedinUrl);
      const keepExistingVanity =
        incomingIsObfuscated && isVanityLinkedInUrl(existingLi);
      const nextLinkedInUrl = keepExistingVanity
        ? existingLi
        : incomingLi ?? existingLi;
      if (incomingIsObfuscated && incomingLi) {
        raw.sales_nav_member_url = incomingLi;
      }

      const patch: Record<string, unknown> = {
        full_name: preferText(lead.fullName, match.full_name),
        first_name: preferText(lead.firstName, match.first_name),
        last_name: preferText(lead.lastName, match.last_name),
        job_title: preferText(lead.jobTitle, match.job_title),
        company: preferText(lead.company, match.company),
        location: preferText(lead.location, match.location),
        linkedin_url: nextLinkedInUrl,
        email: preferText(lead.email, match.email),
        last_seen_at: now,
        exported_at: scrapedDate,
        raw,
      };
      if (teamSizeFromFilter) patch.team_size = teamSizeFromFilter;
      if (lead.monthsAtCompany != null) {
        patch.months_at_company = lead.monthsAtCompany;
      }
      if (lead.monthsInRole != null) {
        patch.months_in_role = lead.monthsInRole;
      }
      if (lead.yearsAtCompanyBucket) {
        patch.years_at_company_bucket = lead.yearsAtCompanyBucket;
      }

      toUpdate.push({ id: match.id, patch });
      continue;
    }

    const dedupeKey = salesNavDedupeKey(lead);
    if (!dedupeKey) {
      skipped += 1;
      continue;
    }

    toInsert.push({
      dedupe_key: dedupeKey,
      full_name: lead.fullName,
      first_name: lead.firstName,
      last_name: lead.lastName,
      job_title: lead.jobTitle,
      email: lead.email,
      phone: null,
      linkedin_url:
        canonicalLinkedInProfileUrl(lead.linkedinUrl) ?? lead.linkedinUrl,
      company: lead.company,
      location: lead.location,
      team_size: teamSizeFromFilter,
      months_at_company: lead.monthsAtCompany,
      months_in_role: lead.monthsInRole,
      years_at_company_bucket: lead.yearsAtCompanyBucket,
      source: "sales_nav",
      first_seen_at: now,
      last_seen_at: now,
      exported_at: scrapedDate,
      raw: {
        headline: lead.headline,
        photo_url: lead.photoUrl,
        tenure_label: lead.tenureLabel,
        last_sales_nav_scrape_at: now,
        last_sales_nav_url: opts.salesNavUrl ?? null,
        sales_nav_member_url: isObfuscatedLinkedInUrl(lead.linkedinUrl)
          ? canonicalLinkedInProfileUrl(lead.linkedinUrl) ??
            lead.linkedinUrl?.trim() ??
            null
          : null,
        sales_nav: lead.raw ?? {},
      },
    });
  }

  for (const chunk of toChunks(toInsert, 100)) {
    if (chunk.length === 0) continue;
    const { error } = await supabaseAdmin.from("leadrocks_leads").upsert(chunk, {
      onConflict: "dedupe_key",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`Shared lead cache insert failed: ${error.message}`);
  }

  for (const { id, patch } of toUpdate) {
    const { error } = await supabaseAdmin
      .from("leadrocks_leads")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(`Shared lead cache update failed: ${error.message}`);
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    skipped,
    teamSizeFromFilter,
  };
}
