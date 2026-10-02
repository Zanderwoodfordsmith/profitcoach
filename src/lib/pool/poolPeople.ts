import { audienceItemSourceLabel } from "@/lib/leadLists/audienceLists";
import {
  businessNamesMatch,
  formatBusinessLabel,
  formatProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import { SALES_NAV_HEADCOUNT_BANDS } from "@/lib/salesNavigator/headcountBands";

export type PoolPerson = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  /** Sales Nav location, e.g. "Manchester, England, United Kingdom". */
  location: string | null;
  /** Town or city parsed from the address or location. */
  city: string | null;
  /** UK postcode parsed from the address, when present. */
  postcode: string | null;
  /** Company headcount band, e.g. "11-50". */
  team_size: string | null;
  /** Lead industry, or the Google Maps category when industry is blank. */
  industry: string | null;
  place_id: string | null;
  source: string;
  created_at: string | null;
  tags: string[];
  in_campaign: boolean;
  /** Campaigns this person is already enrolled in. */
  campaign_ids: string[];
  blacklisted: boolean;
  /** Can enroll in at least one channel (LinkedIn, email, or WhatsApp). */
  campaignable: boolean;
  linkedinCampaignable: boolean;
  emailCampaignable: boolean;
  whatsappCampaignable: boolean;
  canFindPerson: boolean;
  /** Prospect contact from a previous open; skip the find-or-create round trip. */
  contact_id: string | null;
};

export type PoolStats = {
  total: number;
  addedLast30Days: number;
  inCampaign: number;
  notInCampaign: number;
};

export type PoolColumnKey =
  | "contact_info"
  | "title"
  | "company"
  | "website"
  | "source"
  | "campaign"
  | "created_at"
  | "linkedin"
  | "address"
  | "headcount"
  | "city"
  | "postcode"
  | "industry"
  | "tags";

export type PoolColumnVisibility = Record<PoolColumnKey, boolean>;

export const POOL_TABLE_COLUMN_OPTIONS: Array<{
  key: PoolColumnKey;
  label: string;
}> = [
  { key: "contact_info", label: "Contact Info" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "website", label: "Website" },
  { key: "source", label: "Source" },
  { key: "campaign", label: "Campaign" },
  { key: "created_at", label: "Date added" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "address", label: "Address" },
  { key: "headcount", label: "Headcount" },
  { key: "city", label: "City" },
  { key: "postcode", label: "Postcode" },
  { key: "industry", label: "Industry" },
  { key: "tags", label: "Tags" },
];

export const DEFAULT_POOL_COLUMN_VISIBILITY: PoolColumnVisibility = {
  contact_info: true,
  title: false,
  company: false,
  website: false,
  source: true,
  campaign: true,
  created_at: true,
  linkedin: true,
  address: false,
  headcount: false,
  city: false,
  postcode: false,
  industry: false,
  tags: true,
};

/** Folded into the name cell; hidden unless a saved view opted in after this layout. */
export const POOL_LEAD_FOLDED_COLUMN_KEYS: PoolColumnKey[] = [
  "title",
  "company",
  "website",
];

export const POOL_COLUMN_LAYOUT_VERSION = 3;

export const DEFAULT_POOL_COLUMN_ORDER: PoolColumnKey[] =
  POOL_TABLE_COLUMN_OPTIONS.map((option) => option.key);

export const ALL_POOL_COLUMN_KEYS = DEFAULT_POOL_COLUMN_ORDER;

export type PoolCampaignFilter = "all" | "in_campaign" | "not_in_campaign";
export type PoolSourceFilter = "all" | string;
export type PoolContactFilter =
  | "all"
  | "email"
  | "phone"
  | "both"
  | "none";
export type PoolLinkedInFilter = "all" | "has" | "none";
export type PoolDateAddedFilter =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "older_than_30d";
/** "all" | "none" | a specific tag name */
export type PoolTagFilter = string;
/** Empty means every headcount. "unknown" means no headcount on the row. */
export type PoolHeadcountFilter = string[];

export const POOL_HEADCOUNT_UNKNOWN = "unknown";

export const POOL_HEADCOUNT_FILTER_OPTIONS: Array<{
  key: string;
  label: string;
}> = [
  ...SALES_NAV_HEADCOUNT_BANDS.map((band) => ({
    key: band.label,
    label: band.label,
  })),
  { key: POOL_HEADCOUNT_UNKNOWN, label: "No headcount" },
];

export type PoolSortField = "name" | "company" | "created_at" | "source";
export type PoolSortOrder = "asc" | "desc";

export type PoolGroupField = "source" | "company" | "campaign" | "tags";
export type PoolGroupOrder = "asc" | "desc" | "manual";

export type PersistedPoolGrouping = {
  field: PoolGroupField | null;
  order: PoolGroupOrder;
  manualOrder: Record<string, string[]>;
};

export function defaultPoolGrouping(): PersistedPoolGrouping {
  return { field: null, order: "asc", manualOrder: {} };
}

export const POOL_GROUP_FIELDS: Array<{
  key: PoolGroupField;
  label: string;
}> = [
  { key: "source", label: "Source" },
  { key: "company", label: "Company" },
  { key: "campaign", label: "Campaign" },
  { key: "tags", label: "Tags" },
];

export const POOL_CONTACT_FILTER_OPTIONS: Array<{
  key: PoolContactFilter;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "email", label: "Has email" },
  { key: "phone", label: "Has phone" },
  { key: "both", label: "Has email and phone" },
  { key: "none", label: "No email or phone" },
];

export const POOL_LINKEDIN_FILTER_OPTIONS: Array<{
  key: PoolLinkedInFilter;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "has", label: "Has LinkedIn" },
  { key: "none", label: "No LinkedIn" },
];

export const POOL_DATE_ADDED_FILTER_OPTIONS: Array<{
  key: PoolDateAddedFilter;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "older_than_30d", label: "Older than 30 days" },
];

function startOfLocalDay(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function poolRowMatchesContactFilter(
  row: Pick<PoolPerson, "email" | "phone">,
  filter: PoolContactFilter
): boolean {
  if (filter === "all") return true;
  const hasEmail = Boolean(row.email?.trim());
  const hasPhone = Boolean(row.phone?.trim());
  if (filter === "email") return hasEmail;
  if (filter === "phone") return hasPhone;
  if (filter === "both") return hasEmail && hasPhone;
  return !hasEmail && !hasPhone;
}

export function poolRowMatchesLinkedInFilter(
  row: Pick<PoolPerson, "linkedin_url">,
  filter: PoolLinkedInFilter
): boolean {
  if (filter === "all") return true;
  const hasLinkedIn = Boolean(row.linkedin_url?.trim());
  if (filter === "has") return hasLinkedIn;
  return !hasLinkedIn;
}

export function poolRowMatchesDateAddedFilter(
  row: Pick<PoolPerson, "created_at">,
  filter: PoolDateAddedFilter,
  now = Date.now()
): boolean {
  if (filter === "all") return true;
  if (!row.created_at) return filter === "older_than_30d";
  const created = new Date(row.created_at).getTime();
  if (Number.isNaN(created)) return filter === "older_than_30d";
  const todayStart = startOfLocalDay(new Date(now));
  const ageMs = now - created;
  if (filter === "today") return created >= todayStart;
  if (filter === "7d") return ageMs <= 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return ageMs <= 30 * 24 * 60 * 60 * 1000;
  return ageMs > 30 * 24 * 60 * 60 * 1000;
}

export function poolRowMatchesHeadcountFilter(
  row: Pick<PoolPerson, "team_size">,
  selected: PoolHeadcountFilter
): boolean {
  if (!selected.length) return true;
  const size = row.team_size?.trim() ?? "";
  if (!size) {
    return selected.some((value) => value.toLowerCase() === POOL_HEADCOUNT_UNKNOWN);
  }
  const folded = size.toLowerCase();
  return selected.some((value) => value.toLowerCase() === folded);
}

export function poolRowMatchesCityFilter(
  row: Pick<PoolPerson, "city" | "location" | "address">,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [row.city, row.location, row.address]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function poolRowMatchesPostcodeFilter(
  row: Pick<PoolPerson, "postcode">,
  query: string
): boolean {
  const needle = query.trim();
  if (!needle) return true;
  if (!row.postcode) return false;
  return ukPostcodeMatches(row.postcode, needle);
}

export function poolRowMatchesIndustryFilter(
  row: Pick<PoolPerson, "industry">,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (row.industry ?? "").toLowerCase().includes(needle);
}

export function poolRowMatchesTagFilter(
  row: Pick<PoolPerson, "tags">,
  filter: PoolTagFilter
): boolean {
  const tags = row.tags ?? [];
  if (filter === "all") return true;
  if (filter === "none") return tags.length === 0;
  const key = filter.trim().toLowerCase();
  if (!key) return true;
  return tags.some((tag) => tag.toLowerCase() === key);
}

/** False when the row carries any excluded tag (case-insensitive). */
export function poolRowPassesExcludedTags(
  row: Pick<PoolPerson, "tags">,
  excludeTags: string[]
): boolean {
  if (!excludeTags.length) return true;
  const excluded = new Set(excludeTags.map((tag) => tag.toLowerCase()));
  return !(row.tags ?? []).some((tag) => excluded.has(tag.toLowerCase()));
}

export type PoolGroupSection = {
  key: string;
  label: string;
  people: PoolPerson[];
};

export function poolSourceLabel(source: string): string {
  return audienceItemSourceLabel(source);
}

export function poolAddressFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const maps = (raw as { google_maps?: unknown }).google_maps;
  if (!maps || typeof maps !== "object") return null;
  const address = (maps as { address?: unknown }).address;
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  return trimmed || null;
}

export function poolIndustryFromSources(
  industry: string | null | undefined,
  raw: unknown
): string | null {
  const direct = industry?.trim();
  if (direct) return direct;
  if (!raw || typeof raw !== "object") return null;
  const maps = (raw as { google_maps?: unknown }).google_maps;
  if (!maps || typeof maps !== "object") return null;
  const category = (maps as { category?: unknown }).category;
  if (typeof category !== "string") return null;
  const trimmed = category.trim();
  return trimmed || null;
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

export function formatUkPostcode(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function extractUkPostcode(text: string | null | undefined): string | null {
  const match = text?.match(UK_POSTCODE_RE);
  if (!match?.[1]) return null;
  return formatUkPostcode(match[1]);
}

/**
 * Outward-code match: "M1" hits M1 1AA and M1A, and misses M14.
 * "SW1" hits SW1A. A longer query matches the compact postcode prefix.
 */
export function ukPostcodeMatches(stored: string, query: string): boolean {
  const storedFull = stored.replace(/\s+/g, "").toUpperCase();
  const needle = query.replace(/\s+/g, "").toUpperCase();
  if (!needle || !storedFull) return false;
  const storedOut = storedFull.length > 3 ? storedFull.slice(0, -3) : storedFull;
  if (needle.length > storedOut.length) return storedFull.startsWith(needle);
  if (storedOut === needle) return true;
  if (!storedOut.startsWith(needle)) return false;
  return /^[A-Z]+$/.test(storedOut.slice(needle.length));
}

function cityBesidePostcode(address: string): string | null {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const index = parts.findIndex((part) => UK_POSTCODE_RE.test(part));
  if (index < 0) return null;
  const remainder = parts[index]!
    .replace(UK_POSTCODE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  if (remainder && !/^\d+$/.test(remainder)) return remainder;
  for (let i = index - 1; i >= 0; i -= 1) {
    const prev = parts[i]!;
    if (/^\d/.test(prev)) continue;
    if (UK_POSTCODE_RE.test(prev)) continue;
    return prev;
  }
  return null;
}

function cityFromLocation(location: string | null | undefined): string | null {
  const first = location?.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  const withoutPostcode = first
    .replace(UK_POSTCODE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutPostcode || null;
}

export function poolPlaceFields(input: {
  address?: string | null;
  location?: string | null;
}): { city: string | null; postcode: string | null } {
  const address = input.address?.trim() || "";
  const location = input.location?.trim() || "";
  const postcode = extractUkPostcode(address) ?? extractUkPostcode(location);
  const city =
    (address ? cityBesidePostcode(address) : null) ?? cityFromLocation(location);
  return { city, postcode };
}

export function poolWebsiteHref(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/** Whether a pool row can enroll in a campaign of the given primary channel. */
export function poolRowFitsCampaignChannel(
  row: Pick<
    PoolPerson,
    "linkedinCampaignable" | "emailCampaignable" | "whatsappCampaignable"
  >,
  channel: string | null | undefined
): boolean {
  if (channel === "email") return row.emailCampaignable;
  if (channel === "whatsapp") return row.whatsappCampaignable;
  return row.linkedinCampaignable;
}

export function poolRowIsBusiness(row: PoolPerson): boolean {
  if (row.place_id && !row.linkedin_url) return true;
  return businessNamesMatch(row.full_name, row.company);
}

export function poolDisplayName(row: PoolPerson): string {
  const raw = row.full_name?.trim() || "";
  if (!raw) return "";
  if (poolRowIsBusiness(row)) return formatBusinessLabel(raw) || raw;
  return formatProspectPersonName(raw) || raw;
}

export function poolLeadCompany(row: PoolPerson): string | null {
  const company = formatBusinessLabel(row.company);
  if (!company) return null;
  if (businessNamesMatch(company, poolDisplayName(row))) return null;
  if (businessNamesMatch(company, row.full_name)) return null;
  return company;
}

export function poolGroupIdentity(
  row: PoolPerson,
  field: PoolGroupField
): { key: string; label: string; rank: number } {
  switch (field) {
    case "source": {
      const label = poolSourceLabel(row.source);
      return {
        key: `source:${label.toLowerCase()}`,
        label,
        rank: 0,
      };
    }
    case "company": {
      const label = formatBusinessLabel(row.company) || "No company";
      return {
        key: `company:${label.toLowerCase()}`,
        label,
        rank: row.company?.trim() ? 0 : 1,
      };
    }
    case "campaign": {
      return row.in_campaign
        ? { key: "campaign:yes", label: "In a campaign", rank: 0 }
        : { key: "campaign:no", label: "Not in a campaign", rank: 1 };
    }
    case "tags": {
      const tags = [...(row.tags ?? [])]
        .map((tag) => tag.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      if (!tags.length) {
        return { key: "tags:none", label: "No tags", rank: 1 };
      }
      const label = tags.join(", ");
      return {
        key: `tags:${label.toLowerCase()}`,
        label,
        rank: 0,
      };
    }
  }
}

export function groupPoolRows(
  rows: PoolPerson[],
  field: PoolGroupField,
  order: PoolGroupOrder,
  manualOrder: string[] = []
): PoolGroupSection[] {
  const buckets = new Map<
    string,
    { label: string; rank: number; people: PoolPerson[] }
  >();
  for (const row of rows) {
    const ident = poolGroupIdentity(row, field);
    const existing = buckets.get(ident.key);
    if (existing) existing.people.push(row);
    else {
      buckets.set(ident.key, {
        label: ident.label,
        rank: ident.rank,
        people: [row],
      });
    }
  }
  const sections = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    label: bucket.label,
    rank: bucket.rank,
    people: bucket.people,
  }));
  if (order === "manual") {
    const index = new Map(manualOrder.map((key, i) => [key, i]));
    sections.sort((a, b) => {
      const ai = index.has(a.key) ? (index.get(a.key) as number) : 999;
      const bi = index.has(b.key) ? (index.get(b.key) as number) : 999;
      return ai - bi || a.label.localeCompare(b.label);
    });
  } else {
    sections.sort((a, b) => {
      const rank = a.rank - b.rank;
      if (rank !== 0) return order === "desc" ? -rank : rank;
      const name = a.label.localeCompare(b.label, undefined, {
        sensitivity: "base",
      });
      return order === "desc" ? -name : name;
    });
  }
  return sections.map(({ key, label, people }) => ({ key, label, people }));
}

export function comparePoolPeople(
  a: PoolPerson,
  b: PoolPerson,
  field: PoolSortField,
  order: PoolSortOrder
): number {
  const dir = order === "asc" ? 1 : -1;
  const text = (value: string | null | undefined) =>
    value?.trim().toLowerCase() ?? "";
  const time = (value: string | null | undefined) => {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  let result = 0;
  switch (field) {
    case "company":
      result = text(a.company).localeCompare(text(b.company));
      break;
    case "created_at":
      result = time(a.created_at) - time(b.created_at);
      break;
    case "source":
      result = poolSourceLabel(a.source).localeCompare(poolSourceLabel(b.source));
      break;
    default:
      result = a.full_name.localeCompare(b.full_name, undefined, {
        sensitivity: "base",
      });
  }
  return result * dir;
}
