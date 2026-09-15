import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import { canonicalizeProspectStatus } from "@/lib/prospectStatus";

/** Added on the Prospects tab — still at Pool status, but they belong here. */
const KEEP_LEAD_SOURCES = new Set([
  "manual",
  "booking",
  "boss_score",
  "boss_pro",
  "ghl",
]);

function isLeadStatus(prospectStatus: string | null | undefined): boolean {
  const status = canonicalizeProspectStatus(prospectStatus);
  return status == null || status === "leads";
}

/** Pool / campaign people who have not moved past the Pool (leads) stage. */
export function isStillInPool(
  contact: {
    id: string;
    prospect_status?: string | null;
    prospect_source?: string | null;
  },
  poolLinkedContactIds: Set<string>
): boolean {
  if (!isLeadStatus(contact.prospect_status)) return false;
  if (poolLinkedContactIds.has(contact.id)) return true;
  const source = contact.prospect_source?.trim() || "";
  if (KEEP_LEAD_SOURCES.has(source)) return false;
  return true;
}

export function excludePoolOnlyContacts<
  T extends {
    id: string;
    prospect_status?: string | null;
    prospect_source?: string | null;
  },
>(contacts: T[], poolLinkedContactIds: Set<string>): T[] {
  return contacts.filter(
    (contact) => !isStillInPool(contact, poolLinkedContactIds)
  );
}

export async function loadPoolLinkedContactIds(
  supabase: SupabaseClient,
  coachId?: string
): Promise<Set<string>> {
  const { data, error } = await fetchAllSupabasePages<{
    contact_id: string | null;
  }>(async (from, to) => {
    let query = supabase
      .from("coach_lead_list_items")
      .select("contact_id")
      .not("contact_id", "is", null)
      .range(from, to);
    if (coachId) query = query.eq("coach_id", coachId);
    return query;
  });
  if (error) throw new Error(error.message ?? "Unable to load pool people.");
  const ids = new Set<string>();
  for (const row of data) {
    if (typeof row.contact_id === "string" && row.contact_id) {
      ids.add(row.contact_id);
    }
  }
  return ids;
}
