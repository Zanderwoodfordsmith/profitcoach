import { recountLeadListItems } from "@/lib/leadLists/audienceLists";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MappedGoogleMapsPlace } from "@/lib/googleMaps/mapPlaceToPool";
import {
  normalizeGooglePlaceId,
  poolIdentityKey,
} from "@/lib/pool/identity";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

function asRaw(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function applyGoogleMapsFindPersonResults(opts: {
  coachId: string;
  listId: string;
  itemIds: string[];
  places: MappedGoogleMapsPlace[];
}): Promise<{ updated: number }> {
  if (!opts.itemIds.length) return { updated: 0 };
  const { data: items, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select(
      "id, place_id, linkedin_url, email, phone, website, identity_key, raw, first_name, last_name, full_name, job_title"
    )
    .eq("coach_id", opts.coachId)
    .eq("list_id", opts.listId)
    .in("id", opts.itemIds);
  if (error) throw new Error(error.message);

  const byPlace = new Map<string, MappedGoogleMapsPlace>();
  for (const place of opts.places) {
    if (place.placeId) byPlace.set(place.placeId, place);
  }

  let updated = 0;
  for (const item of items ?? []) {
    const placeId = normalizeGooglePlaceId(
      typeof item.place_id === "string" ? item.place_id : null
    );
    if (!placeId) continue;
    const place = byPlace.get(placeId);
    const lead = place?.lead;
    if (!lead) continue;

    const linkedin =
      lead.linkedinUrl ??
      normalizeLinkedInProfileUrl(String(item.linkedin_url ?? ""));
    const next = {
      first_name: lead.firstName ?? item.first_name,
      last_name: lead.lastName ?? item.last_name,
      full_name: lead.fullName ?? item.full_name,
      job_title: lead.jobTitle ?? item.job_title,
      linkedin_url: linkedin,
      email: lead.email ?? item.email,
      phone: lead.phone ?? item.phone,
      website: place.website ?? item.website,
      place_id: placeId,
    };
    const identity = poolIdentityKey(next);
    const raw = asRaw(item.raw);
    const { error: updateError } = await supabaseAdmin
      .from("coach_lead_list_items")
      .update({
        ...next,
        identity_key: identity,
        raw: {
          ...raw,
          google_maps_person: {
            found_at: new Date().toISOString(),
            job_title: lead.jobTitle,
          },
        },
      })
      .eq("id", item.id)
      .eq("coach_id", opts.coachId);
    if (updateError) {
      if (updateError.code === "23505") continue;
      throw new Error(updateError.message);
    }
    updated += 1;
  }
  await recountLeadListItems(opts.listId);
  return { updated };
}
