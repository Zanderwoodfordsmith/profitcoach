/**
 * The lead hover card (23 Nov): who someone is and what their company does,
 * so a coach can tell at a glance whether a business is right.
 *
 * The person comes from the shared Sales Nav lead cache (nothing fetched).
 * The company comes from linkedin_companies; the first hover on a company
 * looks it up once with the coach's LinkedIn account (a company page, never
 * the person's profile, so nobody sees a profile view) and every coach shares it.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unipileFetch } from "@/lib/unipile/client";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

export type LeadCompany = {
  name: string | null;
  description: string | null;
  industry: string | null;
  /** Staff on LinkedIn, e.g. 74. */
  employeeCount: number | null;
  /** LinkedIn's band, e.g. "51 to 200". */
  employeeRange: string | null;
  website: string | null;
  founded: string | null;
  headOffice: string | null;
  profileUrl: string | null;
};

export type LeadCard = {
  headline: string | null;
  photoUrl: string | null;
  location: string | null;
  /** Their LinkedIn About section. */
  about: string | null;
  /** Time in current role, e.g. "9 yrs in role". */
  tenure: string | null;
  company: LeadCompany | null;
};

/** Looked-up companies older than this are fetched again. */
const COMPANY_FRESH_DAYS = 90;
const COMPANY_ID_RE = /^\d{1,20}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, max = 4000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function tenureLabel(sn: Record<string, unknown> | null): string | null {
  const positions = Array.isArray(sn?.current_positions) ? sn.current_positions : [];
  const tenure = asRecord(asRecord(positions[0])?.tenure_at_role);
  const years = typeof tenure?.years === "number" ? tenure.years : 0;
  const months = typeof tenure?.months === "number" ? tenure.months : 0;
  if (years >= 1) return `${years} yr${years === 1 ? "" : "s"} in role`;
  if (months >= 1) return `${months} mo${months === 1 ? "" : "s"} in role`;
  return null;
}

/** The spellings a profile URL is stored under across imports. */
export function linkedinUrlVariants(url: string): string[] {
  const variants = new Set<string>();
  const normalized = normalizeLinkedInProfileUrl(url);
  for (const u of [url.trim(), normalized].filter(Boolean) as string[]) {
    const bare = u.replace(/\/+$/, "");
    for (const v of [bare, bare.toLowerCase()]) {
      variants.add(v);
      variants.add(`${v}/`);
    }
  }
  return [...variants];
}

type CompanyRow = {
  company_id: string;
  name: string | null;
  description: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  website: string | null;
  founded: string | null;
  head_office: string | null;
  profile_url: string | null;
  found: boolean;
  fetched_at: string;
};

function companyOf(row: CompanyRow): LeadCompany | null {
  if (!row.found) return null;
  return {
    name: row.name,
    description: row.description,
    industry: row.industry,
    employeeCount: row.employee_count,
    employeeRange: row.employee_range,
    website: row.website,
    founded: row.founded,
    headOffice: row.head_office,
    profileUrl: row.profile_url,
  };
}

function rowFromUnipile(companyId: string, d: Record<string, unknown>): Omit<CompanyRow, "fetched_at"> {
  const range = asRecord(d.employee_count_range);
  const from = typeof range?.from === "number" ? range.from : null;
  const to = typeof range?.to === "number" ? range.to : null;
  const locations = Array.isArray(d.locations) ? d.locations.map(asRecord).filter(Boolean) : [];
  const hq = (locations.find((l) => l?.is_headquarter) ?? locations[0]) as Record<string, unknown> | undefined;
  const city = asString(hq?.city, 80);
  const industry = Array.isArray(d.industry) ? asString(d.industry[0], 120) : asString(d.industry, 120);
  const founded = asString(d.foundation_date, 20)?.match(/\d{4}/)?.[0] ?? null;
  return {
    company_id: companyId,
    name: asString(d.name, 200),
    description: asString(d.description, 3000) ?? asString(d.tagline, 300),
    industry,
    employee_count: typeof d.employee_count === "number" ? d.employee_count : null,
    employee_range: from != null ? (to != null ? `${from} to ${to}` : `${from}+`) : null,
    website: asString(d.website, 300),
    founded,
    // LinkedIn sends cities in capitals ("LONDON").
    head_office: city ? city.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    profile_url: asString(d.profile_url, 300),
    found: true,
  };
}

/** What the company does: from the shared table, or looked up once with the coach's LinkedIn. */
export async function loadCompany(coachId: string, companyId: string | null): Promise<LeadCompany | null> {
  if (!companyId || !COMPANY_ID_RE.test(companyId)) return null;

  const { data } = await supabaseAdmin
    .from("linkedin_companies")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  const stored = data as CompanyRow | null;
  const fresh = stored && Date.now() - new Date(stored.fetched_at).getTime() < COMPANY_FRESH_DAYS * 86_400_000;
  if (stored && fresh) return companyOf(stored);

  const account = await getOkLinkedInAccount(coachId).catch(() => null);
  const accountId = account?.unipile_account_id?.trim();
  if (!accountId) return stored ? companyOf(stored) : null;

  const qs = new URLSearchParams({ account_id: accountId });
  const res = await unipileFetch<Record<string, unknown>>(
    "GET",
    `/api/v1/linkedin/company/${encodeURIComponent(companyId)}?${qs.toString()}`,
    undefined,
    { timeoutMs: 12_000 }
  );
  if (!res.ok) {
    // 404: no page. Remember that; anything else (limits, LinkedIn down) try another day.
    if (res.status === 404) {
      await supabaseAdmin
        .from("linkedin_companies")
        .upsert({ company_id: companyId, found: false, fetched_at: new Date().toISOString() });
    }
    return stored ? companyOf(stored) : null;
  }
  const row = { ...rowFromUnipile(companyId, res.data ?? {}), fetched_at: new Date().toISOString() };
  await supabaseAdmin.from("linkedin_companies").upsert(row);
  return companyOf(row);
}

/** The person from the shared Sales Nav cache, plus their company. */
export async function loadLeadCard(
  coachId: string,
  input: { linkedinUrl: string | null; companyId?: string | null }
): Promise<LeadCard> {
  let sn: Record<string, unknown> | null = null;
  let raw: Record<string, unknown> | null = null;
  let cacheLocation: string | null = null;
  if (input.linkedinUrl) {
    const { data } = await supabaseAdmin
      .from("leadrocks_leads")
      .select("location, raw")
      .in("linkedin_url", linkedinUrlVariants(input.linkedinUrl))
      .order("last_seen_at", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as { location: string | null; raw: unknown } | undefined;
    raw = asRecord(row?.raw);
    sn = asRecord(raw?.sales_nav);
    cacheLocation = row?.location ?? null;
  }
  const positions = Array.isArray(sn?.current_positions) ? sn.current_positions : [];
  const companyId = input.companyId || asString(asRecord(positions[0])?.company_id, 20);

  return {
    headline: asString(sn?.headline, 400) ?? asString(raw?.headline, 400),
    photoUrl: asString(sn?.profile_picture_url_large, 600) ?? asString(sn?.profile_picture_url, 600) ?? asString(raw?.photo_url, 600),
    location: asString(sn?.location, 120) ?? cacheLocation,
    about: asString(sn?.summary),
    tenure: tenureLabel(sn),
    company: await loadCompany(coachId, companyId ?? null).catch(() => null),
  };
}
