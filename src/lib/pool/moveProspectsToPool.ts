import { chunkArray } from "@/lib/chunkArray";
import {
  ensureCoachPool,
  recountLeadListItems,
} from "@/lib/leadLists/audienceLists";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CHUNK = 80;

type ContactMoveRow = {
  id: string;
  coach_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  job_title: string | null;
  linkedin_url: string | null;
};

function asText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Link prospects into the coach Pool and keep their status at Pool,
 * so they leave the Prospects board. Does not delete the contact.
 */
export async function moveProspectsToPool(opts: {
  coachId: string;
  contactIds: string[];
}): Promise<string[]> {
  const ids = [...new Set(opts.contactIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    1000
  );
  if (!ids.length) return [];

  const contacts: ContactMoveRow[] = [];
  for (const chunk of chunkArray(ids, CHUNK)) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select(
        "id, coach_id, full_name, first_name, last_name, email, phone, business_name, job_title, linkedin_url"
      )
      .eq("coach_id", opts.coachId)
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (typeof row.id === "string") contacts.push(row as ContactMoveRow);
    }
  }
  if (!contacts.length) return [];

  const pool = await ensureCoachPool(opts.coachId);
  const contactIds = contacts.map((row) => row.id);
  const alreadyLinked = new Set<string>();
  for (const chunk of chunkArray(contactIds, CHUNK)) {
    const { data, error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .select("contact_id")
      .eq("coach_id", opts.coachId)
      .in("contact_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (typeof row.contact_id === "string" && row.contact_id) {
        alreadyLinked.add(row.contact_id);
      }
    }
  }

  const inserts = contacts
    .filter((row) => !alreadyLinked.has(row.id))
    .map((row) => ({
      list_id: pool.id,
      coach_id: opts.coachId,
      source: "manual",
      contact_id: row.id,
      identity_key: `contact:${row.id}`,
      full_name: asText(row.full_name),
      first_name: asText(row.first_name),
      last_name: asText(row.last_name),
      email: asText(row.email),
      phone: asText(row.phone),
      company: asText(row.business_name),
      job_title: asText(row.job_title),
      linkedin_url: asText(row.linkedin_url),
    }));

  for (const chunk of chunkArray(inserts, CHUNK)) {
    const { error } = await supabaseAdmin.from("coach_lead_list_items").insert(chunk);
    if (!error) continue;
    if (error.code !== "23505") throw new Error(error.message);
    for (const row of chunk) {
      const { error: oneError } = await supabaseAdmin
        .from("coach_lead_list_items")
        .insert(row);
      if (oneError && oneError.code !== "23505") throw new Error(oneError.message);
    }
  }

  if (inserts.length) await recountLeadListItems(pool.id);

  for (const chunk of chunkArray(contactIds, CHUNK)) {
    const { error } = await supabaseAdmin
      .from("contacts")
      .update({ prospect_status: "leads" })
      .eq("coach_id", opts.coachId)
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }

  return contactIds;
}
