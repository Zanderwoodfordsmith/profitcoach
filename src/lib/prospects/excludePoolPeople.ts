import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import {
  isInboundProspectSource,
  isPoolImportSource,
} from "@/lib/prospectSourceKind";
import { canonicalizeProspectStatus } from "@/lib/prospectStatus";

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
    prospect_funnel?: string | null;
  },
  poolLinkedContactIds: Set<string>
): boolean {
  if (!isLeadStatus(contact.prospect_status)) return false;
  if (poolLinkedContactIds.has(contact.id)) return true;
  if (isInboundProspectSource(contact.prospect_source, contact.prospect_funnel)) {
    return false;
  }
  // Campaign / list imports stay on Pool. Unknown / legacy sources stay on
  // Prospects — otherwise scorecard fills and old manual adds vanish.
  return isPoolImportSource(contact.prospect_source);
}

export function excludePoolOnlyContacts<
  T extends {
    id: string;
    prospect_status?: string | null;
    prospect_source?: string | null;
    prospect_funnel?: string | null;
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
