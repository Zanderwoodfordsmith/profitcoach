import {
  canonicalLinkedInProfileUrl,
  isObfuscatedLinkedInUrl,
  isVanityLinkedInUrl,
  nameCompanyIdentityKey,
  normalizePublicLinkedInUrl,
  salesNavDedupeKey,
  samePersonNameCompany,
} from "@/lib/salesNavigator/leadIdentity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type LeadrocksLeadMatch = {
  id: string;
  email: string | null;
  phone: string | null;
  email_2: string | null;
  phone_2: string | null;
  linkedin_url: string | null;
  company: string | null;
  company_website: string | null;
  job_title: string | null;
  location: string | null;
  team_size: string | null;
  revenue_range: string | null;
  industry: string | null;
};

type CacheRow = LeadrocksLeadMatch & {
  dedupe_key: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  raw: Record<string, unknown> | null;
};

type ProspectMatchInput = {
  linkedin_url?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
};

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
    } else if (u.includes("://linkedin.com")) {
      variants.add(u.replace("://linkedin.com", "://www.linkedin.com"));
    }
  }
  return [...variants];
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

function pickPhone(row: CacheRow): string | null {
  return preferText(row.phone, null) ?? preferText(row.phone_2, null);
}

function pickEmail(row: CacheRow): string | null {
  return preferText(row.email, null) ?? preferText(row.email_2, null);
}

function findInCandidates(
  input: ProspectMatchInput,
  candidates: CacheRow[]
): CacheRow | null {
  const li = normalizePublicLinkedInUrl(input.linkedin_url);
  if (li) {
    for (const row of candidates) {
      const rowLi = normalizePublicLinkedInUrl(row.linkedin_url);
      if (rowLi && rowLi === li) return row;
      const memberUrl = row.raw?.sales_nav_member_url;
      if (
        typeof memberUrl === "string" &&
        normalizePublicLinkedInUrl(memberUrl) === li
      ) {
        return row;
      }
      if (
        input.linkedin_url &&
        isObfuscatedLinkedInUrl(input.linkedin_url) &&
        typeof memberUrl === "string" &&
        memberUrl.toLowerCase() === input.linkedin_url.trim().toLowerCase()
      ) {
        return row;
      }
    }
  }

  const personInput = {
    firstName: input.first_name,
    lastName: input.last_name,
    fullName: input.full_name,
    company: input.business_name,
  };

  for (const row of candidates) {
    if (samePersonNameCompany(personInput, row)) return row;
  }

  return null;
}

async function fetchCandidates(
  input: ProspectMatchInput
): Promise<CacheRow[]> {
  const byId = new Map<string, CacheRow>();
  const select =
    "id, dedupe_key, full_name, first_name, last_name, job_title, email, phone, email_2, phone_2, linkedin_url, company, company_website, location, team_size, revenue_range, industry, raw";

  const linkedin = input.linkedin_url?.trim();
  if (linkedin) {
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(select)
      .in("linkedin_url", linkedinUrlVariants(linkedin));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id as string, row as CacheRow);
  }

  const dedupeKeys = new Set<string>();
  const key = salesNavDedupeKey({
    linkedinUrl: input.linkedin_url,
    firstName: input.first_name,
    lastName: input.last_name,
    fullName: input.full_name,
    company: input.business_name,
  });
  if (key) dedupeKeys.add(key);
  const legacyNameCo = nameCompanyIdentityKey({
    fullName: input.full_name,
    company: input.business_name,
  });
  if (legacyNameCo) dedupeKeys.add(legacyNameCo);

  if (dedupeKeys.size > 0) {
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(select)
      .in("dedupe_key", [...dedupeKeys]);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id as string, row as CacheRow);
  }

  const company = input.business_name?.trim();
  if (company) {
    const { data, error } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(select)
      .eq("company", company)
      .limit(100);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id as string, row as CacheRow);
  }

  return [...byId.values()];
}

export type ProspectLeadrocksEnrichment = {
  email: string | null;
  phone: string | null;
  job_title: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  company_website: string | null;
  team_size: string | null;
  revenue_range: string | null;
  industry: string | null;
  location: string | null;
  leadrocks_id: string;
};

export function enrichmentPatchFromLeadrocks(
  contact: ProspectMatchInput,
  lead: CacheRow
): ProspectLeadrocksEnrichment {
  const incomingLi =
    canonicalLinkedInProfileUrl(contact.linkedin_url) ??
    contact.linkedin_url?.trim() ??
    null;
  const existingLi =
    canonicalLinkedInProfileUrl(lead.linkedin_url) ??
    lead.linkedin_url?.trim() ??
    null;
  const incomingIsObfuscated = isObfuscatedLinkedInUrl(contact.linkedin_url);
  const keepExistingVanity =
    incomingIsObfuscated && isVanityLinkedInUrl(existingLi);
  const linkedin_url = keepExistingVanity
    ? existingLi
    : incomingLi ?? existingLi;

  return {
    email: pickEmail(lead),
    phone: pickPhone(lead),
    job_title: preferText(lead.job_title, null),
    business_name: preferText(lead.company, contact.business_name),
    linkedin_url,
    company_website: lead.company_website?.trim() || null,
    team_size: lead.team_size?.trim() || null,
    revenue_range: lead.revenue_range?.trim() || null,
    industry: lead.industry?.trim() || null,
    location: lead.location?.trim() || null,
    leadrocks_id: lead.id,
  };
}

export async function matchLeadrocksLeadForProspect(
  input: ProspectMatchInput
): Promise<LeadrocksLeadMatch | null> {
  const candidates = await fetchCandidates(input);
  return findInCandidates(input, candidates);
}

export async function enrichProspectFromLeadrocks(
  input: ProspectMatchInput
): Promise<ProspectLeadrocksEnrichment | null> {
  const candidates = await fetchCandidates(input);
  const match = findInCandidates(input, candidates);
  if (!match) return null;
  return enrichmentPatchFromLeadrocks(input, match);
}
