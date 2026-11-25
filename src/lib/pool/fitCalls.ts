/**
 * Check fit (job 285, 25 Nov): the coach sorts people one at a time (swipe,
 * arrow keys or buttons). Good, Bad, VIP (a VIP tag and Good) or Blacklist
 * (Bad and onto the blacklist), each with an optional reason, and Undo. Their
 * calls teach Ava (coachExamples in fitCheck), then she re-sorts the rest.
 */

import { insertPeopleOnList, mapAudiencePeopleInput, recountLeadListItems } from "@/lib/leadLists/audienceLists";
import { normalizeProspectTags } from "@/lib/prospects/tags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

import { asFitLabel, type FitLabel } from "./fit";

export type FitCall = "good" | "bad" | "vip" | "blacklist";
export const VIP_TAG = "VIP";

export function asFitCall(value: unknown): FitCall | null {
  return value === "good" || value === "bad" || value === "vip" || value === "blacklist" ? value : null;
}

/** How they were before a call, so Undo puts it back. */
export type FitBefore = { fit: FitLabel | null; fit_by: "ava" | "person" | null; fit_why: string | null; tags: string[] };

export function asFitBefore(value: unknown): FitBefore | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const fitBy = v.fit_by === "ava" || v.fit_by === "person" ? v.fit_by : null;
  return {
    fit: asFitLabel(v.fit),
    fit_by: fitBy,
    fit_why: typeof v.fit_why === "string" ? v.fit_why.slice(0, 200) : null,
    tags: normalizeProspectTags(v.tags),
  };
}

type ItemRow = {
  id: string;
  identity_key: string | null;
  fit: string | null;
  fit_by: string | null;
  fit_why: string | null;
  tags: unknown;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
};

async function loadItem(coachId: string, itemId: string): Promise<ItemRow> {
  const { data, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id, identity_key, fit, fit_by, fit_why, tags, full_name, first_name, last_name, job_title, company, linkedin_url")
    .eq("coach_id", coachId)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That person isn't on your lists any more.");
  return data as ItemRow;
}

/** Writes to every row for this person (they can be on the Pool and several lists). */
async function updatePerson(coachId: string, item: ItemRow, patch: Record<string, unknown>): Promise<void> {
  let q = supabaseAdmin.from("coach_lead_list_items").update(patch).eq("coach_id", coachId);
  q = item.identity_key ? q.eq("identity_key", item.identity_key) : q.eq("id", item.id);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

function withTag(tags: string[], tag: string): string[] {
  return tags.some((t) => t.toLowerCase() === tag.toLowerCase()) ? tags : [...tags, tag];
}

async function blacklistId(coachId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "blacklist")
    .maybeSingle();
  if (!data?.id) throw new Error("Blacklist is missing.");
  return data.id as string;
}

function cleanReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const text = reason.replace(/\s+/g, " ").trim().slice(0, 160);
  return text || null;
}

/** One call on one person. Returns how they were, for Undo. */
export async function makeFitCall(
  coachId: string,
  itemId: string,
  call: FitCall,
  reason?: unknown
): Promise<{ before: FitBefore }> {
  const item = await loadItem(coachId, itemId);
  const tags = normalizeProspectTags(item.tags);
  const before: FitBefore = {
    fit: asFitLabel(item.fit),
    fit_by: item.fit_by === "ava" || item.fit_by === "person" ? item.fit_by : null,
    fit_why: item.fit_why,
    tags,
  };
  const fit: FitLabel = call === "good" || call === "vip" ? "good" : "bad";
  const why = cleanReason(reason) ?? (call === "vip" ? "VIP" : call === "blacklist" ? "Blacklisted" : null);
  await updatePerson(coachId, item, {
    fit,
    fit_why: why,
    fit_by: "person",
    fit_at: new Date().toISOString(),
    ...(call === "vip" ? { tags: withTag(tags, VIP_TAG) } : {}),
  });

  // Blacklist keeps them where they are (marked Bad) and adds them to the blacklist, so Undo is simple.
  if (call === "blacklist" && item.linkedin_url) {
    const listId = await blacklistId(coachId);
    const people = mapAudiencePeopleInput(
      [
        {
          linkedin_url: item.linkedin_url,
          first_name: item.first_name,
          last_name: item.last_name,
          full_name: item.full_name,
          company: item.company,
          title: item.job_title,
        },
      ],
      "manual"
    );
    await insertPeopleOnList({ coachId, listId, kind: "blacklist", people });
    await recountLeadListItems(listId);
  }
  return { before };
}

/** The optional "why" after a call. Only on the coach's own call. */
export async function setFitReason(coachId: string, itemId: string, reason: unknown): Promise<void> {
  const item = await loadItem(coachId, itemId);
  if (item.fit_by !== "person") return;
  await updatePerson(coachId, item, { fit_why: cleanReason(reason) });
}

/** Undo: puts their fit and tags back, and takes them off the blacklist if that was the call. */
export async function undoFitCall(coachId: string, itemId: string, call: FitCall, before: FitBefore): Promise<void> {
  const item = await loadItem(coachId, itemId);
  await updatePerson(coachId, item, {
    fit: before.fit,
    fit_by: before.fit_by,
    fit_why: before.fit_why,
    fit_at: before.fit_by ? new Date().toISOString() : null,
    ...(call === "vip" ? { tags: before.tags } : {}),
  });
  if (call === "blacklist" && item.linkedin_url) {
    const listId = await blacklistId(coachId);
    const url = normalizeLinkedInProfileUrl(item.linkedin_url);
    const urls = [...new Set([item.linkedin_url, url].filter((u): u is string => Boolean(u)))];
    const { error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .delete()
      .eq("coach_id", coachId)
      .eq("list_id", listId)
      .in("linkedin_url", urls);
    if (error) throw new Error(error.message);
    await recountLeadListItems(listId);
  }
}
