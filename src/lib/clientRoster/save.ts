import { clientRosterToContactPatch, type ClientRosterPatch } from "@/lib/clientRoster/fields";
import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export class ClientSaveError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Add a client to a coach's roster (or update the matching person).
 * Shared by the single "Add client" form and the bulk import.
 */
export async function saveRosterClient(
  coachId: string,
  fields: ClientRosterPatch & { fullName: string }
): Promise<{ contactId: string; created: boolean }> {
  if (fields.linkedinUrl) {
    const { data: hit, error: hitError } = await supabaseAdmin
      .from("contacts")
      .select("id, type")
      .eq("coach_id", coachId)
      .eq("linkedin_url", fields.linkedinUrl)
      .maybeSingle();
    if (hitError && hitError.code !== "PGRST116" && hitError.code !== "42703" && hitError.code !== "PGRST204") {
      throw new ClientSaveError("Unable to look up that LinkedIn profile.", 400);
    }
    if (hit?.type === "prospect") {
      throw new ClientSaveError(
        "This LinkedIn profile is already a prospect. Convert them from Prospects when they become a client.",
        409
      );
    }
  }

  const { first_name, last_name } = splitFullName(fields.fullName);
  const resolved = await resolveOrCreateContact({
    coachId,
    fullName: fields.fullName,
    firstName: first_name,
    lastName: last_name,
    businessName: fields.businessName,
    linkedinUrl: fields.linkedinUrl,
    type: "client",
  });

  const { data: row, error: rowError } = await supabaseAdmin
    .from("contacts")
    .select("id, type, coach_id")
    .eq("id", resolved.contactId)
    .maybeSingle();
  if (rowError || !row || row.coach_id !== coachId) throw new ClientSaveError("Unable to save client.", 400);
  if (row.type === "prospect") {
    throw new ClientSaveError("This person is already a prospect. Convert them from Prospects when they become a client.", 409);
  }

  const dbPatch = clientRosterToContactPatch(fields);
  dbPatch.type = "client";
  if (!resolved.created) {
    // Don't blank out what's already there with empty cells.
    for (const [key, value] of Object.entries(dbPatch)) {
      if (key !== "type" && (value === null || value === undefined || value === "")) delete dbPatch[key];
    }
  }
  const saved = await tryUpdateContactStripping(resolved.contactId, dbPatch);
  if (saved.error || !saved.data?.id) throw new ClientSaveError("Unable to save client.", 400);
  return { contactId: resolved.contactId, created: resolved.created };
}
