import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { normalizePoolEmail } from "@/lib/pool/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const LEAD_LIST_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_LIST_ITEMS_PER_REQUEST = 250;
export const MAX_POOL_ITEMS_TOTAL = 25_000;
/** Named lists used to be the inventory, so they were capped at 1,000.
 * Pool is the inventory now; a named list is a bag of the same size. */
export const MAX_LIST_ITEMS_TOTAL = MAX_POOL_ITEMS_TOTAL;
export const MAX_POOL_ITEMS_PER_REQUEST = 2_500;

export const AUDIENCE_LIST_KINDS = ["audience", "blacklist", "pool"] as const;
export type AudienceListKind = (typeof AUDIENCE_LIST_KINDS)[number];

export const AUDIENCE_ITEM_SOURCES = [
  "lead_finder",
  "connections",
  "sales_nav_csv",
  "sales_nav",
  "manual",
  "search",
  "google_maps",
] as const;
export type AudienceItemSource = (typeof AUDIENCE_ITEM_SOURCES)[number];

export type AudienceListSummary = {
  id: string;
  name: string;
  kind: AudienceListKind;
  source: string;
  item_count: number;
  updated_at: string | null;
  created_at: string | null;
  /** True when this list was created by a pool bulk import. */
  from_pool_import: boolean;
};

export type AudienceListPerson = {
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  linkedin_provider_id: string | null;
  email?: string | null;
  phone?: string | null;
  source: AudienceItemSource;
};

export type AudienceListItemRow = {
  id: string;
  list_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  source: string;
  created_at: string | null;
  in_campaign?: boolean;
};

export function isLeadListUuid(value: string): boolean {
  return LEAD_LIST_UUID_RE.test(value);
}

export function normalizeAudienceKind(
  value: string | null | undefined
): AudienceListKind {
  if (value === "blacklist") return "blacklist";
  if (value === "pool") return "pool";
  return "audience";
}

export function listItemCapForKind(kind: AudienceListKind): number {
  return kind === "pool" ? MAX_POOL_ITEMS_TOTAL : MAX_LIST_ITEMS_TOTAL;
}

export function isAudienceItemSource(value: string): value is AudienceItemSource {
  return (AUDIENCE_ITEM_SOURCES as readonly string[]).includes(value);
}

export function audienceItemSourceLabel(source: string): string {
  switch (source) {
    case "sales_nav":
    case "sales_nav_csv":
      return "Sales Nav";
    case "lead_finder":
      return "Lead Finder";
    case "connections":
      return "Connections";
    case "search":
      return "Search";
    case "google_maps":
      return "Google Maps";
    case "manual":
      return "Added";
    case "mixed":
      return "Mixed";
    default:
      return "List";
  }
}

export function displayListPersonName(input: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = input.full_name?.trim();
  if (full) return full;
  const joined = [input.first_name, input.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return joined || "Unnamed";
}

export function splitPersonName(fullName: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: null, last_name: null };
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

export function parsePastedAudienceLines(text: string): AudienceListPerson[] {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const people: AudienceListPerson[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parts = line.split(/,|\t/).map((part) => part.trim());
    const url = normalizeLinkedInProfileUrl(parts[0] || line);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    people.push({
      linkedin_url: url,
      first_name: parts[1] || null,
      last_name: parts[2] || null,
      company: parts[3] || null,
      title: parts[4] || null,
      linkedin_provider_id: null,
      source: "manual",
    });
  }
  return people;
}

export function mapAudiencePeopleInput(
  raw: unknown,
  source: AudienceItemSource,
  max = MAX_POOL_ITEMS_PER_REQUEST
): AudienceListPerson[] {
  if (!Array.isArray(raw)) return [];
  const people: AudienceListPerson[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const first =
      typeof row.first_name === "string" ? row.first_name.trim() || null : null;
    const last =
      typeof row.last_name === "string" ? row.last_name.trim() || null : null;
    const full =
      typeof row.full_name === "string" ? row.full_name.trim() : "";
    const split = !first && !last ? splitPersonName(full) : null;
    people.push({
      linkedin_url: url,
      first_name: first ?? split?.first_name ?? null,
      last_name: last ?? split?.last_name ?? null,
      company:
        typeof row.company === "string" ? row.company.trim() || null : null,
      title:
        typeof row.title === "string"
          ? row.title.trim() || null
          : typeof row.job_title === "string"
            ? row.job_title.trim() || null
            : null,
      linkedin_provider_id:
        typeof row.linkedin_provider_id === "string"
          ? row.linkedin_provider_id.trim() || null
          : null,
      source: isAudienceItemSource(String(row.source ?? ""))
        ? (row.source as AudienceItemSource)
        : source,
      email:
        typeof row.email === "string" ? row.email.trim() || null : null,
      phone:
        typeof row.phone === "string" ? row.phone.trim() || null : null,
    });
  }
  return people.slice(0, max);
}

export function sortAudienceLists(
  lists: AudienceListSummary[]
): AudienceListSummary[] {
  const rank = (kind: AudienceListKind) =>
    kind === "blacklist" ? 0 : kind === "pool" ? 1 : 2;
  return [...lists].sort((a, b) => {
    const kindDelta = rank(a.kind) - rank(b.kind);
    if (kindDelta !== 0) return kindDelta;
    const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bt - at;
  });
}

export function mapLeadListToSummary(row: {
  id: string;
  name?: string | null;
  kind?: string | null;
  source?: string | null;
  item_count?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
  filters?: unknown;
}): AudienceListSummary {
  const filters =
    row.filters && typeof row.filters === "object" && !Array.isArray(row.filters)
      ? (row.filters as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    name: (row.name ?? "").trim() || "Untitled list",
    kind: normalizeAudienceKind(row.kind),
    source: row.source ?? "manual",
    item_count: Number(row.item_count ?? 0),
    updated_at: row.updated_at ?? null,
    created_at: row.created_at ?? null,
    from_pool_import: filters?.from_pool_import === true,
  };
}

/** Short day stamp for import tabs, e.g. "14 Sep". */
export function poolImportListDateStamp(now = new Date()): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  return `${now.getDate()} ${months[now.getMonth()]}`;
}

/** Default name for a pool bulk-import list tab. */
export function defaultPoolImportListName(
  kind: "sales_nav" | "google_maps",
  now = new Date()
): string {
  const stamp = poolImportListDateStamp(now);
  return kind === "google_maps" ? `Maps · ${stamp}` : `Sales Nav · ${stamp}`;
}

const MAX_AUDIENCE_LIST_NAME_LENGTH = 120;

const LEAD_LIST_ITEM_COPY_FIELDS = [
  "source",
  "leadrocks_id",
  "full_name",
  "first_name",
  "last_name",
  "job_title",
  "company",
  "linkedin_url",
  "email",
  "phone",
  "team_size",
  "revenue_range",
  "industry",
  "match_reason",
  "raw",
  "place_id",
  "website",
  "identity_key",
  "tags",
] as const;

/** Unique copy name for duplicated audience / import list tabs. */
export function uniqueAudienceListCopyName(
  sourceName: string,
  existingNames: string[]
): string {
  const used = new Set(
    existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
  );
  const label = sourceName.trim() || "List";
  const base = `${label} copy`.slice(0, MAX_AUDIENCE_LIST_NAME_LENGTH);
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` ${n}`;
    const candidate = `${base.slice(0, MAX_AUDIENCE_LIST_NAME_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`.slice(0, MAX_AUDIENCE_LIST_NAME_LENGTH);
}

export async function ensureCoachBlacklist(
  coachId: string
): Promise<AudienceListSummary> {
  const { data: existing } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("*")
    .eq("coach_id", coachId)
    .eq("kind", "blacklist")
    .maybeSingle();
  if (existing) return mapLeadListToSummary(existing);

  const { data: created, error } = await supabaseAdmin
    .from("coach_lead_lists")
    .insert({
      coach_id: coachId,
      name: "Blacklist",
      source: "manual",
      kind: "blacklist",
      filters: { system: true },
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("coach_lead_lists")
        .select("*")
        .eq("coach_id", coachId)
        .eq("kind", "blacklist")
        .maybeSingle();
      if (raced) return mapLeadListToSummary(raced);
    }
    throw new Error(error.message);
  }
  return mapLeadListToSummary(created);
}

export async function loadBlacklistedLinkedInUrls(
  coachId: string
): Promise<Set<string>> {
  const { data: list } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "blacklist")
    .maybeSingle();
  if (!list?.id) return new Set();

  const items = await loadAllListItemRows<{ linkedin_url: string | null }>(
    coachId,
    list.id,
    "linkedin_url"
  );

  const urls = new Set<string>();
  for (const item of items) {
    const url = normalizeLinkedInProfileUrl(String(item.linkedin_url ?? ""));
    if (url) urls.add(url);
  }
  return urls;
}

export async function loadBlacklistedEmails(
  coachId: string
): Promise<Set<string>> {
  const { data: list } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "blacklist")
    .maybeSingle();
  if (!list?.id) return new Set();

  const items = await loadAllListItemRows<{ email: string | null }>(
    coachId,
    list.id,
    "email"
  );

  const emails = new Set<string>();
  for (const item of items) {
    const email = normalizePoolEmail(
      typeof item.email === "string" ? item.email : null
    );
    if (email) emails.add(email);
  }
  return emails;
}

export async function loadEnrolledLinkedInUrls(
  coachId: string
): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("linkedin_url")
    .eq("coach_id", coachId);

  const urls = new Set<string>();
  for (const row of data ?? []) {
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (url) urls.add(url);
  }
  return urls;
}

/** Emails already on any campaign lead for this coach (contact email or metadata). */
export async function loadEnrolledEmails(
  coachId: string
): Promise<Set<string>> {
  const { data: leads } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("contact_id, metadata")
    .eq("coach_id", coachId);

  const emails = new Set<string>();
  const contactIds: string[] = [];
  for (const row of leads ?? []) {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const fromMeta = normalizePoolEmail(
      typeof meta.email === "string" ? meta.email : null
    );
    if (fromMeta) emails.add(fromMeta);
    if (typeof row.contact_id === "string" && row.contact_id) {
      contactIds.push(row.contact_id);
    }
  }

  const uniqueContactIds = [...new Set(contactIds)].slice(0, 2000);
  if (uniqueContactIds.length) {
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("email")
      .eq("coach_id", coachId)
      .in("id", uniqueContactIds);
    for (const contact of contacts ?? []) {
      const email = normalizePoolEmail(
        typeof contact.email === "string" ? contact.email : null
      );
      if (email) emails.add(email);
    }
  }
  return emails;
}

export async function recountLeadListItems(listId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);
  if (error) throw new Error(error.message);
  const itemCount = count ?? 0;
  await supabaseAdmin
    .from("coach_lead_lists")
    .update({
      item_count: itemCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId);
  return itemCount;
}

export async function loadOwnedLeadList(
  coachId: string,
  listId: string
): Promise<{
  id: string;
  name: string | null;
  kind: AudienceListKind;
  source: string;
  item_count: number | null;
} | null> {
  const { data } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id, name, kind, source, item_count")
    .eq("id", listId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    kind: normalizeAudienceKind(data.kind),
    source: data.source ?? "manual",
    item_count: data.item_count,
  };
}

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadAllListItemRows<T>(
  coachId: string,
  listId: string,
  columns: string
): Promise<T[]> {
  const page = await fetchAllSupabasePages<T>(
    async (from, to) => {
      const result = await supabaseAdmin
        .from("coach_lead_list_items")
        .select(columns)
        .eq("coach_id", coachId)
        .eq("list_id", listId)
        .range(from, to);
      return {
        data: (result.data ?? null) as T[] | null,
        error: result.error,
      };
    },
    1000,
    MAX_POOL_ITEMS_TOTAL
  );
  if (page.error) {
    throw new Error(page.error.message || "Unable to load list items.");
  }
  return page.data;
}

async function existingUrlsOnList(
  coachId: string,
  listId: string
): Promise<Set<string>> {
  const data = await loadAllListItemRows<{ linkedin_url: string | null }>(
    coachId,
    listId,
    "linkedin_url"
  );
  const urls = new Set<string>();
  for (const row of data) {
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (url) urls.add(url);
  }
  return urls;
}

export async function insertPeopleOnList(opts: {
  coachId: string;
  listId: string;
  kind: AudienceListKind;
  people: AudienceListPerson[];
}): Promise<{ added: number; skipped: number; blacklisted: number }> {
  const cap = listItemCapForKind(opts.kind);
  const currentCount = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", opts.listId);
  const already = currentCount.count ?? 0;
  const room = Math.max(0, cap - already);
  if (room === 0) {
    return { added: 0, skipped: opts.people.length, blacklisted: 0 };
  }

  const existing = await existingUrlsOnList(opts.coachId, opts.listId);
  const blacklisted =
    opts.kind === "blacklist"
      ? new Set<string>()
      : await loadBlacklistedLinkedInUrls(opts.coachId);

  let skipped = 0;
  let blocked = 0;
  const rows: Record<string, unknown>[] = [];
  for (const person of opts.people) {
    if (existing.has(person.linkedin_url)) {
      skipped += 1;
      continue;
    }
    if (blacklisted.has(person.linkedin_url)) {
      blocked += 1;
      continue;
    }
    if (rows.length >= room) {
      skipped += 1;
      continue;
    }
    existing.add(person.linkedin_url);
    rows.push({
      list_id: opts.listId,
      coach_id: opts.coachId,
      source: person.source,
      leadrocks_id: null,
      full_name: displayListPersonName(person),
      first_name: person.first_name,
      last_name: person.last_name,
      job_title: person.title,
      company: person.company,
      linkedin_url: person.linkedin_url,
      email: person.email ?? null,
      phone: person.phone ?? null,
      identity_key: `li:${person.linkedin_url}`,
      match_reason:
        person.source === "search" ? "LinkedIn search" : "Added to pool",
      raw: person.linkedin_provider_id
        ? { linkedin_provider_id: person.linkedin_provider_id }
        : {},
    });
  }

  for (const chunk of toChunks(rows, 100)) {
    const { error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .insert(chunk);
    if (error) {
      // Concurrent imports into the same pool can race the unique index.
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
  }

  return { added: rows.length, skipped, blacklisted: blocked };
}

/**
 * Ensure the coach has a pool list.
 * Backfill from legacy audience lists only when the pool is first created,
 * or when `backfill: true` is passed — never on every Pool GET.
 */
export async function ensureCoachPool(
  coachId: string,
  opts?: { backfill?: boolean }
): Promise<AudienceListSummary> {
  const { data: existing } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id, name, kind, source, item_count, updated_at, created_at, filters")
    .eq("coach_id", coachId)
    .eq("kind", "pool")
    .maybeSingle();

  if (existing) {
    if (opts?.backfill) {
      await backfillPoolFromAudienceLists(coachId, existing.id as string);
      const itemCount = await recountLeadListItems(existing.id as string);
      return { ...mapLeadListToSummary(existing), item_count: itemCount };
    }
    return mapLeadListToSummary(existing);
  }

  const pool = await createCoachPool(coachId);
  await backfillPoolFromAudienceLists(coachId, pool.id);
  const itemCount = await recountLeadListItems(pool.id);
  return { ...pool, item_count: itemCount };
}

async function createCoachPool(coachId: string): Promise<AudienceListSummary> {
  const { data: created, error } = await supabaseAdmin
    .from("coach_lead_lists")
    .insert({
      coach_id: coachId,
      name: "Pool",
      source: "mixed",
      kind: "pool",
      filters: { system: true },
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("coach_lead_lists")
        .select("*")
        .eq("coach_id", coachId)
        .eq("kind", "pool")
        .maybeSingle();
      if (raced) return mapLeadListToSummary(raced);
    }
    throw new Error(error.message);
  }
  return mapLeadListToSummary(created);
}

/** Empty named audience list for coaches (campaigns / import snapshots). */
export async function createCoachAudienceList(opts: {
  coachId: string;
  name: string;
  source?: string;
  filters?: Record<string, unknown>;
}): Promise<AudienceListSummary> {
  const name = opts.name.trim().slice(0, MAX_AUDIENCE_LIST_NAME_LENGTH);
  if (!name) throw new Error("Give this list a name.");
  const { data, error } = await supabaseAdmin
    .from("coach_lead_lists")
    .insert({
      coach_id: opts.coachId,
      name,
      source: opts.source ?? "manual",
      kind: "audience",
      filters: opts.filters ?? {},
      item_count: 0,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not create list.");
  }
  return mapLeadListToSummary(data);
}

/**
 * Copy people from one owned list onto another (pool → audience, or list → list).
 * Skips rows already present on the target by identity_key.
 */
export async function copyLeadListItems(opts: {
  coachId: string;
  sourceListId: string;
  targetListId: string;
  itemIds: string[];
}): Promise<{ added: number; skipped: number; itemCount: number }> {
  if (opts.sourceListId === opts.targetListId) {
    throw new Error("Pick a different list.");
  }
  const itemIds = [...new Set(opts.itemIds.filter(isLeadListUuid))].slice(
    0,
    MAX_LIST_ITEMS_PER_REQUEST
  );
  if (!itemIds.length) throw new Error("Select people to add.");

  const [source, target] = await Promise.all([
    loadOwnedLeadList(opts.coachId, opts.sourceListId),
    loadOwnedLeadList(opts.coachId, opts.targetListId),
  ]);
  if (!source) throw new Error("Source list not found.");
  if (!target) throw new Error("List not found.");
  if (target.kind === "blacklist") {
    throw new Error("Use Blacklist to move people there.");
  }
  if (target.kind === "pool") {
    throw new Error("People already live in the pool. Add them to a named list.");
  }

  const cap = listItemCapForKind(target.kind);
  const { count: currentCount, error: countError } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", opts.targetListId);
  if (countError) throw new Error(countError.message);
  const room = Math.max(0, cap - (currentCount ?? 0));
  if (room === 0) {
    return { added: 0, skipped: itemIds.length, itemCount: currentCount ?? 0 };
  }

  const existingKeys = await loadAllListItemRows<{
    identity_key: string | null;
  }>(opts.coachId, opts.targetListId, "identity_key");
  const usedKeys = new Set(
    existingKeys
      .map((row) =>
        typeof row.identity_key === "string" ? row.identity_key : null
      )
      .filter((key): key is string => Boolean(key))
  );

  const { data: itemsRaw, error: itemsError } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select(LEAD_LIST_ITEM_COPY_FIELDS.join(", "))
    .eq("coach_id", opts.coachId)
    .eq("list_id", opts.sourceListId)
    .in("id", itemIds);
  if (itemsError) throw new Error(itemsError.message);

  const items = (itemsRaw ?? []) as unknown as Array<Record<string, unknown>>;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    const identityKey =
      typeof item.identity_key === "string" && item.identity_key
        ? item.identity_key
        : null;
    if (identityKey && usedKeys.has(identityKey)) {
      skipped += 1;
      continue;
    }
    if (rows.length >= room) {
      skipped += 1;
      continue;
    }
    if (identityKey) usedKeys.add(identityKey);
    rows.push({
      ...item,
      list_id: opts.targetListId,
      coach_id: opts.coachId,
    });
  }
  skipped += Math.max(0, itemIds.length - items.length);

  for (const chunk of toChunks(rows, 100)) {
    const { error: insertError } = await supabaseAdmin
      .from("coach_lead_list_items")
      .insert(chunk);
    if (insertError) throw new Error(insertError.message);
  }

  const itemCount = await recountLeadListItems(opts.targetListId);
  return { added: rows.length, skipped, itemCount };
}

/**
 * Remove people from a named list by matching identity_keys of selected
 * items on another list (usually the pool).
 */
export async function removeMatchingLeadListItems(opts: {
  coachId: string;
  sourceListId: string;
  targetListId: string;
  itemIds: string[];
}): Promise<{ removed: number; itemCount: number }> {
  if (opts.sourceListId === opts.targetListId) {
    throw new Error("Pick a different list.");
  }
  const itemIds = [...new Set(opts.itemIds.filter(isLeadListUuid))].slice(
    0,
    MAX_LIST_ITEMS_PER_REQUEST
  );
  if (!itemIds.length) throw new Error("Select people to remove.");

  const [source, target] = await Promise.all([
    loadOwnedLeadList(opts.coachId, opts.sourceListId),
    loadOwnedLeadList(opts.coachId, opts.targetListId),
  ]);
  if (!source) throw new Error("Source list not found.");
  if (!target) throw new Error("List not found.");
  if (target.kind !== "audience") {
    throw new Error(
      target.kind === "blacklist"
        ? "Use Blacklist actions for the blacklist."
        : "Pick a named list to remove from."
    );
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("identity_key, linkedin_url, place_id, email")
    .eq("coach_id", opts.coachId)
    .eq("list_id", opts.sourceListId)
    .in("id", itemIds);
  if (itemsError) throw new Error(itemsError.message);

  const identityKeys = new Set<string>();
  for (const item of items ?? []) {
    if (typeof item.identity_key === "string" && item.identity_key) {
      identityKeys.add(item.identity_key);
      continue;
    }
    if (typeof item.linkedin_url === "string" && item.linkedin_url) {
      identityKeys.add(`li:${item.linkedin_url}`);
    } else if (typeof item.place_id === "string" && item.place_id) {
      identityKeys.add(`place:${item.place_id}`);
    } else if (typeof item.email === "string" && item.email) {
      identityKeys.add(`email:${item.email.toLowerCase()}`);
    }
  }
  if (!identityKeys.size) {
    return {
      removed: 0,
      itemCount: Number(target.item_count ?? 0),
    };
  }

  const keys = [...identityKeys];
  const { data: matches, error: matchError } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id")
    .eq("coach_id", opts.coachId)
    .eq("list_id", opts.targetListId)
    .in("identity_key", keys);
  if (matchError) throw new Error(matchError.message);

  const matchIds = (matches ?? [])
    .map((row) => row.id as string)
    .filter(isLeadListUuid);
  if (!matchIds.length) {
    return {
      removed: 0,
      itemCount: Number(target.item_count ?? 0),
    };
  }

  const { error: deleteError } = await supabaseAdmin
    .from("coach_lead_list_items")
    .delete()
    .eq("coach_id", opts.coachId)
    .eq("list_id", opts.targetListId)
    .in("id", matchIds);
  if (deleteError) throw new Error(deleteError.message);

  const itemCount = await recountLeadListItems(opts.targetListId);
  return { removed: matchIds.length, itemCount };
}

/**
 * Duplicate an audience list (including pool import tabs) with all people.
 * Pool and blacklist lists cannot be duplicated.
 */
export async function duplicateCoachAudienceList(opts: {
  coachId: string;
  listId: string;
}): Promise<AudienceListSummary> {
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id, name, kind, source, filters")
    .eq("id", opts.listId)
    .eq("coach_id", opts.coachId)
    .maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!source) throw new Error("List not found.");

  const kind = normalizeAudienceKind(source.kind);
  if (kind !== "audience") {
    throw new Error(
      kind === "blacklist"
        ? "The blacklist cannot be duplicated."
        : "The pool cannot be duplicated."
    );
  }

  const { data: nameRows } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("name")
    .eq("coach_id", opts.coachId)
    .eq("kind", "audience");
  const copyName = uniqueAudienceListCopyName(
    String(source.name ?? ""),
    (nameRows ?? []).map((row) => String(row.name ?? ""))
  );

  const filters =
    source.filters &&
    typeof source.filters === "object" &&
    !Array.isArray(source.filters)
      ? (source.filters as Record<string, unknown>)
      : {};

  const created = await createCoachAudienceList({
    coachId: opts.coachId,
    name: copyName,
    source: source.source ?? "manual",
    filters,
  });

  const items = await loadAllListItemRows<{ id: string }>(
    opts.coachId,
    opts.listId,
    "id"
  );

  const itemIds = items.map((row) => row.id).filter(isLeadListUuid);
  for (const chunk of toChunks(itemIds, MAX_LIST_ITEMS_PER_REQUEST)) {
    if (!chunk.length) continue;
    await copyLeadListItems({
      coachId: opts.coachId,
      sourceListId: opts.listId,
      targetListId: created.id,
      itemIds: chunk,
    });
  }

  const itemCount = await recountLeadListItems(created.id);
  return { ...created, item_count: itemCount };
}

async function backfillPoolFromAudienceLists(
  coachId: string,
  poolId: string
): Promise<void> {
  const { data: audienceLists } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "audience");
  const listIds = (audienceLists ?? []).map((row) => row.id as string);
  if (!listIds.length) return;

  const { data: items } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select(
      "full_name, first_name, last_name, job_title, company, linkedin_url, email, phone, source, raw"
    )
    .eq("coach_id", coachId)
    .in("list_id", listIds);

  const people = mapAudiencePeopleInput(
    (items ?? []).map((row) => ({
      linkedin_url: row.linkedin_url,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: row.full_name,
      company: row.company,
      title: row.job_title,
      email: row.email,
      phone: row.phone,
      source: row.source,
      linkedin_provider_id:
        row.raw && typeof row.raw === "object"
          ? (row.raw as Record<string, unknown>).linkedin_provider_id
          : null,
    })),
    "manual",
    MAX_POOL_ITEMS_TOTAL
  );
  if (!people.length) return;
  await insertPeopleOnList({
    coachId,
    listId: poolId,
    kind: "pool",
    people,
  });
}
