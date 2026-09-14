import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import {
  displayListPersonName,
  loadBlacklistedLinkedInUrls,
  recountLeadListItems,
} from "@/lib/leadLists/audienceLists";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeGooglePlaceId,
  poolIdentityKey,
  type PoolRecordInput,
} from "@/lib/pool/identity";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import type { MappedGoogleMapsPlace } from "@/lib/googleMaps/mapPlaceToPool";

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function mappedPlaceToPoolRecord(
  place: MappedGoogleMapsPlace
): PoolRecordInput {
  const lead = place.lead;
  const linkedinUrl = lead?.linkedinUrl ?? null;
  const fullName = lead?.fullName ?? place.title;
  return {
    source: "google_maps",
    full_name: fullName,
    first_name: lead?.firstName ?? null,
    last_name: lead?.lastName ?? null,
    job_title: lead?.jobTitle ?? place.category,
    company: place.title,
    linkedin_url: linkedinUrl,
    email: lead?.email ?? place.email,
    phone: lead?.phone ?? place.phone,
    website: place.website,
    place_id: place.placeId,
    match_reason: "Google Maps",
    raw: {
      google_maps: {
        place_id: place.placeId,
        address: place.address,
        category: place.category,
        instagrams: place.instagrams,
        facebooks: place.facebooks,
        company_linkedins: place.companyLinkedIns,
      },
    },
  };
}

async function loadPoolDedupe(opts: { coachId: string; listId: string }) {
  const page = await fetchAllSupabasePages(async (from, to) =>
    supabaseAdmin
      .from("coach_lead_list_items")
      .select("identity_key, place_id, linkedin_url")
      .eq("coach_id", opts.coachId)
      .eq("list_id", opts.listId)
      .range(from, to)
  );
  if (page.error) throw new Error(page.error.message || "Unable to load pool.");
  const identityKeys = new Set<string>();
  const placeIds = new Set<string>();
  const linkedinUrls = new Set<string>();
  for (const row of page.data) {
    const identity =
      typeof row.identity_key === "string" ? row.identity_key.trim() : "";
    if (identity) identityKeys.add(identity);
    const placeId = normalizeGooglePlaceId(
      typeof row.place_id === "string" ? row.place_id : null
    );
    if (placeId) placeIds.add(placeId);
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (url) linkedinUrls.add(url);
  }
  return { identityKeys, placeIds, linkedinUrls };
}

export async function insertPoolRecords(opts: {
  coachId: string;
  listId: string;
  records: PoolRecordInput[];
  cap: number;
}): Promise<{
  added: number;
  skipped: number;
  blacklisted: number;
  invalid: number;
}> {
  const currentCount = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", opts.listId);
  const already = currentCount.count ?? 0;
  const room = Math.max(0, opts.cap - already);
  if (room === 0) {
    return {
      added: 0,
      skipped: opts.records.length,
      blacklisted: 0,
      invalid: 0,
    };
  }

  const existing = await loadPoolDedupe({
    coachId: opts.coachId,
    listId: opts.listId,
  });
  const blacklistedUrls = await loadBlacklistedLinkedInUrls(opts.coachId);

  let skipped = 0;
  let blocked = 0;
  let invalid = 0;
  let inserted = 0;
  const rows: Record<string, unknown>[] = [];
  for (const record of opts.records) {
    const identity = poolIdentityKey(record);
    if (!identity) {
      invalid += 1;
      continue;
    }
    const linkedin = normalizeLinkedInProfileUrl(record.linkedin_url ?? "");
    const placeId = normalizeGooglePlaceId(record.place_id);
    if (linkedin && blacklistedUrls.has(linkedin)) {
      blocked += 1;
      continue;
    }
    if (
      existing.identityKeys.has(identity) ||
      (linkedin && existing.linkedinUrls.has(linkedin)) ||
      (placeId && existing.placeIds.has(placeId))
    ) {
      skipped += 1;
      continue;
    }
    if (rows.length >= room) {
      skipped += 1;
      continue;
    }
    existing.identityKeys.add(identity);
    if (linkedin) existing.linkedinUrls.add(linkedin);
    if (placeId) existing.placeIds.add(placeId);
    rows.push({
      list_id: opts.listId,
      coach_id: opts.coachId,
      source: record.source,
      leadrocks_id: null,
      full_name: displayListPersonName({
        full_name: record.full_name,
        first_name: record.first_name,
        last_name: record.last_name,
      }),
      first_name: record.first_name,
      last_name: record.last_name,
      job_title: record.job_title,
      company: record.company,
      linkedin_url: linkedin,
      email: record.email,
      phone: record.phone,
      website: record.website,
      place_id: placeId,
      identity_key: identity,
      match_reason: record.match_reason ?? "Added to pool",
      raw: record.raw ?? {},
    });
  }

  for (const chunk of toChunks(rows, 100)) {
    const { error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .insert(chunk);
    if (!error) {
      inserted += chunk.length;
      continue;
    }
    if (error.code !== "23505") throw new Error(error.message);
    for (const row of chunk) {
      const { error: oneError } = await supabaseAdmin
        .from("coach_lead_list_items")
        .insert(row);
      if (!oneError) {
        inserted += 1;
        continue;
      }
      if (oneError.code === "23505") skipped += 1;
      else throw new Error(oneError.message);
    }
  }

  return {
    added: inserted,
    skipped,
    blacklisted: blocked,
    invalid,
  };
}

export async function flushGoogleMapsPlacesToPool(opts: {
  coachId: string;
  listId: string;
  places: MappedGoogleMapsPlace[];
  cap: number;
}): Promise<{ added: number; skipped: number; peopleFound: number }> {
  const records = opts.places.map(mappedPlaceToPoolRecord);
  const result = await insertPoolRecords({
    coachId: opts.coachId,
    listId: opts.listId,
    records,
    cap: opts.cap,
  });
  await recountLeadListItems(opts.listId);
  return {
    added: result.added,
    skipped: result.skipped,
    peopleFound: records.filter((row) => row.linkedin_url).length,
  };
}
