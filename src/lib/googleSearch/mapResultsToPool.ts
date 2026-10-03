import { clampGoogleSearchMaxResults } from "@/lib/googleSearch/cost";
import { splitPersonName } from "@/lib/leadLists/audienceLists";
import {
  normalizePoolEmail,
  normalizePoolPhone,
  normalizePoolWebsite,
} from "@/lib/pool/identity";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

export type MappedGoogleSearchLead = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  company: string | null;
};

export type MappedGoogleSearchResult = {
  title: string;
  company: string;
  website: string;
  host: string;
  description: string | null;
  query: string | null;
  position: number | null;
  lead: MappedGoogleSearchLead | null;
};

/** Directories and platforms. A ranking page here is not the business. */
const DIRECTORY_HOSTS = [
  "google.com",
  "youtube.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "wikipedia.org",
  "yelp.com",
  "yelp.co.uk",
  "yellowpages.com",
  "yell.com",
  "tripadvisor.com",
  "tripadvisor.co.uk",
  "trustpilot.com",
  "bbb.org",
  "checkatrade.com",
  "bark.com",
  "thumbtack.com",
  "angi.com",
  "angieslist.com",
  "houzz.com",
  "houzz.co.uk",
  "pinterest.com",
  "reddit.com",
  "amazon.com",
  "amazon.co.uk",
  "ebay.com",
  "ebay.co.uk",
  "glassdoor.com",
  "glassdoor.co.uk",
  "indeed.com",
  "indeed.co.uk",
  "crunchbase.com",
  "zoominfo.com",
  "clutch.co",
  "foursquare.com",
  "opentable.com",
  "booking.com",
  "expedia.com",
  "hotels.com",
  "apple.com",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
  if (typeof value === "string") {
    const one = value.trim();
    return one ? [one] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

export function isGoogleSearchDirectoryHost(host: string): boolean {
  const normalized = host.replace(/^www\./i, "").toLowerCase();
  if (!normalized) return true;
  if (normalized === "google.com" || normalized.endsWith(".google.com")) return true;
  if (/^google\.[a-z.]+$/.test(normalized)) return true;
  return DIRECTORY_HOSTS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

function companyName(
  title: string,
  host: string,
  leadCompany: string | null
): string {
  if (leadCompany) return leadCompany;
  const head = title.split(/\s+[|–—]\s+|\s+-\s+/)[0]?.trim() ?? "";
  if (head.length >= 2 && head.length <= 80 && !/^https?:/i.test(head)) {
    return head;
  }
  return host;
}

function firstEmail(rec: Record<string, unknown>): string | null {
  const direct =
    normalizePoolEmail(asString(rec.email)) ??
    normalizePoolEmail(asString(rec.workEmail));
  if (direct) return direct;
  for (const item of asStringList(rec.emails)) {
    const email = normalizePoolEmail(item);
    if (email) return email;
  }
  return null;
}

function firstPhone(rec: Record<string, unknown>): string | null {
  const direct =
    normalizePoolPhone(asString(rec.mobileNumber)) ??
    normalizePoolPhone(asString(rec.phone)) ??
    normalizePoolPhone(asString(rec.phoneNumber));
  if (direct) return direct;
  for (const item of asStringList(rec.phones)) {
    const phone = normalizePoolPhone(item);
    if (phone) return phone;
  }
  return null;
}

function mapLead(value: unknown): MappedGoogleSearchLead | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const linkedinUrl =
    normalizeLinkedInProfileUrl(asString(rec.linkedinProfile) ?? "") ??
    normalizeLinkedInProfileUrl(asString(rec.linkedinUrl) ?? "") ??
    normalizeLinkedInProfileUrl(asString(rec.linkedin) ?? "") ??
    normalizeLinkedInProfileUrl(asString(rec.linkedIn) ?? "");
  const fullName =
    asString(rec.fullName) ??
    asString(rec.name) ??
    ([asString(rec.firstName), asString(rec.lastName)]
      .filter(Boolean)
      .join(" ")
      .trim() ||
      null);
  const split = splitPersonName(fullName);
  const email = firstEmail(rec);
  const phone = firstPhone(rec);
  if (!fullName && !linkedinUrl && !email) return null;
  return {
    fullName,
    firstName: asString(rec.firstName) ?? split.first_name,
    lastName: asString(rec.lastName) ?? split.last_name,
    jobTitle: asString(rec.jobTitle) ?? asString(rec.title) ?? asString(rec.headline),
    email,
    phone,
    linkedinUrl,
    company: asString(rec.companyName) ?? asString(rec.company) ?? asString(rec.organization),
  };
}

function leadsFrom(rec: Record<string, unknown>): MappedGoogleSearchLead[] {
  const buckets = [
    rec.leadsEnrichment,
    rec.leads,
    rec.businessLeads,
    rec.lead,
  ];
  const out: MappedGoogleSearchLead[] = [];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      for (const item of bucket) {
        const lead = mapLead(item);
        if (lead) out.push(lead);
      }
    } else {
      const lead = mapLead(bucket);
      if (lead) out.push(lead);
    }
  }
  return out;
}

function queryFrom(rec: Record<string, unknown>): string | null {
  const search = asRecord(rec.searchQuery);
  return asString(search?.term) ?? asString(rec.query);
}

function mapOrganic(
  value: unknown,
  query: string | null
): MappedGoogleSearchResult | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const url = asString(rec.url);
  if (!url || url.includes("google.com/search")) return null;
  const host = normalizePoolWebsite(url);
  if (!host || isGoogleSearchDirectoryHost(host)) return null;
  const title = asString(rec.title) ?? host;
  const lead = leadsFrom(rec)[0] ?? null;
  const position =
    typeof rec.position === "number" && Number.isFinite(rec.position)
      ? rec.position
      : null;
  return {
    title,
    company: companyName(title, host, lead?.company ?? null),
    website: url,
    host,
    description: asString(rec.description),
    query: query ?? queryFrom(rec),
    position,
    lead,
  };
}

function attachSpareLeads(
  results: MappedGoogleSearchResult[],
  spare: MappedGoogleSearchLead[]
) {
  for (const lead of spare) {
    const unmatched = results.find((result) => !result.lead);
    if (unmatched) unmatched.lead = lead;
  }
}

export function mapGoogleSearchDatasetItems(
  items: unknown[]
): MappedGoogleSearchResult[] {
  const results: MappedGoogleSearchResult[] = [];
  for (const item of items) {
    const rec = asRecord(item);
    if (!rec) continue;
    const query = queryFrom(rec);
    if (Array.isArray(rec.organicResults)) {
      const page: MappedGoogleSearchResult[] = [];
      for (const organic of rec.organicResults) {
        const mapped = mapOrganic(organic, query);
        if (mapped) page.push(mapped);
      }
      const nested = new Set(page.map((row) => row.lead).filter(Boolean));
      const spare = leadsFrom(rec).filter((lead) => !nested.has(lead));
      attachSpareLeads(page, spare);
      results.push(...page);
      continue;
    }
    const mapped = mapOrganic(rec, query);
    if (mapped) results.push(mapped);
  }
  return results;
}

export function limitGoogleSearchResults(
  results: MappedGoogleSearchResult[],
  maxResults: number
): MappedGoogleSearchResult[] {
  const cap = clampGoogleSearchMaxResults(maxResults);
  const out: MappedGoogleSearchResult[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const key = result.host.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
    if (out.length >= cap) break;
  }
  return out;
}
