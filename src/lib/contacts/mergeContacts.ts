import {
  normalizeContactEmail,
  normalizeContactLinkedInProviderId,
  normalizeContactLinkedInUrl,
  normalizeContactPhone,
  type ContactIdentityRow,
} from "@/lib/contacts/identity";
import { linkedInProviderIdFromUrl } from "@/lib/contacts/linkedinIdentity";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const REPOINT_TABLES: { table: string; column?: string }[] = [
  { table: "messaging_conversations" },
  { table: "linkedin_campaign_leads" },
  { table: "coach_action_items" },
  { table: "coach_revenue_lines" },
  { table: "ghl_appointments" },
  { table: "assessments" },
  { table: "client_coaching_sessions" },
  { table: "client_playbook_unlocks" },
  { table: "coach_chats" },
  { table: "coach_chat_folders" },
  { table: "bookings" },
];

export type MergeContactsResult = {
  survivorId: string;
  mergedId: string;
  repointed: Record<string, number>;
};

function preferString(
  survivor: string | null | undefined,
  loser: string | null | undefined
): string | null {
  const s = survivor?.trim() || null;
  if (s) return s;
  return loser?.trim() || null;
}

/**
 * Merge `mergedId` into `survivorId` for the same coach:
 * fill blank survivor fields, repoint FKs, delete loser.
 */
export async function mergeContacts(input: {
  coachId: string;
  survivorId: string;
  mergedId: string;
}): Promise<MergeContactsResult> {
  const { coachId, survivorId, mergedId } = input;
  if (survivorId === mergedId) {
    throw new Error("Cannot merge a contact into itself.");
  }

  const { data: rows, error } = await selectContactsWithOptionalPhone<{
    id: string;
    coach_id: string;
    type: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    business_name: string | null;
    job_title: string | null;
    photo_url: string | null;
    crm_contact_id: string | null;
    company_website: string | null;
    prospect_status: string | null;
    prospect_source: string | null;
    prospect_tags: string[] | null;
    prospect_funnel: string | null;
  }>(
    async (columns) =>
      supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("coach_id", coachId)
        .in("id", [survivorId, mergedId]),
    "id, coach_id, type, full_name, email",
    [
      "first_name",
      "last_name",
      "linkedin_url",
      "business_name",
      "job_title",
      "photo_url",
      "crm_contact_id",
      "company_website",
      "prospect_status",
      "prospect_source",
      "prospect_tags",
      "prospect_funnel",
    ]
  );

  if (error) throw new Error("Unable to load contacts for merge.");
  const survivor = rows.find((r) => r.id === survivorId);
  const loser = rows.find((r) => r.id === mergedId);
  if (!survivor || !loser) {
    throw new Error("Both contacts must belong to this coach.");
  }

  // Clear unique keys on loser first so survivor can absorb them.
  await tryUpdateContactStripping(mergedId, {
    email: null,
    linkedin_url: null,
    crm_contact_id: null,
  });

  const survivorTags = Array.isArray(survivor.prospect_tags)
    ? survivor.prospect_tags
    : [];
  const loserTags = Array.isArray(loser.prospect_tags) ? loser.prospect_tags : [];
  const mergedTags = Array.from(
    new Set(
      [...survivorTags, ...loserTags]
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  );

  const fieldPatch: Record<string, unknown> = {
    full_name: preferString(survivor.full_name, loser.full_name),
    first_name: preferString(survivor.first_name, loser.first_name),
    last_name: preferString(survivor.last_name, loser.last_name),
    email: preferString(survivor.email, loser.email),
    phone: preferString(survivor.phone, loser.phone),
    linkedin_url: preferString(survivor.linkedin_url, loser.linkedin_url),
    business_name: preferString(survivor.business_name, loser.business_name),
    job_title: preferString(survivor.job_title, loser.job_title),
    photo_url: preferString(survivor.photo_url, loser.photo_url),
    crm_contact_id: preferString(survivor.crm_contact_id, loser.crm_contact_id),
    company_website: preferString(
      survivor.company_website,
      loser.company_website
    ),
    prospect_status: preferString(
      survivor.prospect_status,
      loser.prospect_status
    ),
    prospect_source: preferString(
      survivor.prospect_source,
      loser.prospect_source
    ),
    prospect_funnel: preferString(
      survivor.prospect_funnel,
      loser.prospect_funnel
    ),
  };
  if (mergedTags.length > 0) {
    fieldPatch.prospect_tags = mergedTags;
  }
  // Prefer client over prospect when either is a client.
  if (survivor.type === "client" || loser.type === "client") {
    fieldPatch.type = "client";
  }

  const { error: updateError } = await tryUpdateContactStripping(
    survivorId,
    fieldPatch
  );
  if (updateError) {
    throw new Error(updateError.message || "Unable to update survivor contact.");
  }

  const repointed: Record<string, number> = {};

  // Unique (contact_id, playbook_ref) — drop loser rows that would collide.
  {
    const { data: survivorUnlocks } = await supabaseAdmin
      .from("client_playbook_unlocks")
      .select("playbook_ref")
      .eq("contact_id", survivorId);
    const refs = new Set(
      (survivorUnlocks ?? []).map((r) => r.playbook_ref as string)
    );
    if (refs.size > 0) {
      await supabaseAdmin
        .from("client_playbook_unlocks")
        .delete()
        .eq("contact_id", mergedId)
        .in("playbook_ref", [...refs]);
    }
  }

  for (const { table, column = "contact_id" } of REPOINT_TABLES) {
    const { data: updated, error: repointError } = await supabaseAdmin
      .from(table)
      .update({ [column]: survivorId })
      .eq(column, mergedId)
      .select("id");
    if (repointError) {
      // Table may not exist / column missing — skip quietly.
      if (
        repointError.code === "42P01" ||
        repointError.code === "42703" ||
        repointError.code === "PGRST204" ||
        repointError.code === "PGRST205"
      ) {
        continue;
      }
      console.warn(`mergeContacts repoint ${table}:`, repointError.message);
      continue;
    }
    if (updated?.length) {
      repointed[table] = updated.length;
    }
  }

  // Denormalized conversation display fields from survivor.
  await supabaseAdmin
    .from("messaging_conversations")
    .update({
      prospect_name: fieldPatch.full_name ?? survivor.full_name,
      prospect_email: fieldPatch.email ?? survivor.email,
      prospect_phone: fieldPatch.phone ?? survivor.phone,
      prospect_linkedin_url: fieldPatch.linkedin_url ?? survivor.linkedin_url,
      prospect_business_name:
        fieldPatch.business_name ?? survivor.business_name,
      prospect_avatar_url: fieldPatch.photo_url ?? survivor.photo_url,
    })
    .eq("contact_id", survivorId);

  // Hide empty CRM shell threads when a real Unipile thread exists for this contact.
  const { data: survivorThreads } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, unipile_chat_id, last_preview, unread_count, hidden_at")
    .eq("coach_id", coachId)
    .eq("contact_id", survivorId)
    .is("hidden_at", null);

  const hasProviderThread = (survivorThreads ?? []).some(
    (row) => Boolean(row.unipile_chat_id)
  );
  if (hasProviderThread) {
    const shellIds = (survivorThreads ?? [])
      .filter(
        (row) =>
          !row.unipile_chat_id &&
          !(row.last_preview || "").trim() &&
          !(row.unread_count || 0)
      )
      .map((row) => row.id as string);
    if (shellIds.length) {
      await supabaseAdmin
        .from("messaging_conversations")
        .update({ hidden_at: new Date().toISOString() })
        .in("id", shellIds);
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("contacts")
    .delete()
    .eq("id", mergedId)
    .eq("coach_id", coachId);

  if (deleteError) {
    throw new Error(deleteError.message || "Unable to delete merged contact.");
  }

  return { survivorId, mergedId, repointed };
}

/** Contacts sharing email, phone, or LinkedIn with this one. */
export async function findDuplicateContactsFor(
  coachId: string,
  contactId: string
): Promise<ContactIdentityRow[]> {
  const { data: selfRows, error } =
    await selectContactsWithOptionalPhone<ContactIdentityRow>(
      async (columns) =>
        supabaseAdmin
          .from("contacts")
          .select(columns)
          .eq("id", contactId)
          .eq("coach_id", coachId),
      "id, full_name, email",
      [
        "linkedin_url",
        "linkedin_provider_id",
        "first_name",
        "last_name",
        "business_name",
        "type",
        "created_at",
      ]
    );
  if (error || !selfRows[0]) return [];
  const self = selfRows[0];

  const email = normalizeContactEmail(self.email);
  const phone = normalizeContactPhone(self.phone);
  const linkedin = normalizeContactLinkedInUrl(self.linkedin_url);
  const providerId =
    normalizeContactLinkedInProviderId(self.linkedin_provider_id) ||
    linkedInProviderIdFromUrl(self.linkedin_url);
  if (!email && !phone && !linkedin && !providerId) return [];

  const { data: all, error: allError } =
    await selectContactsWithOptionalPhone<ContactIdentityRow>(
      async (columns) =>
        supabaseAdmin.from("contacts").select(columns).eq("coach_id", coachId),
      "id, full_name, email",
      [
        "linkedin_url",
        "linkedin_provider_id",
        "first_name",
        "last_name",
        "business_name",
        "type",
        "created_at",
      ]
    );
  if (allError) return [];

  const dupes: ContactIdentityRow[] = [];
  const phoneOnlyHits: ContactIdentityRow[] = [];
  for (const row of all) {
    if (row.id === contactId) continue;
    const sameEmail =
      email && normalizeContactEmail(row.email) === email;
    const samePhone =
      phone && normalizeContactPhone(row.phone) === phone;
    const sameLinkedIn =
      linkedin && normalizeContactLinkedInUrl(row.linkedin_url) === linkedin;
    const rowProvider =
      normalizeContactLinkedInProviderId(row.linkedin_provider_id) ||
      linkedInProviderIdFromUrl(row.linkedin_url);
    const sameProvider =
      providerId && rowProvider && providerId === rowProvider;
    if (sameEmail || sameLinkedIn || sameProvider) {
      dupes.push(row);
      continue;
    }
    if (samePhone) phoneOnlyHits.push(row);
  }
  // Shared office lines can match dozens of contacts — only suggest merge
  // when phone overlap looks like a real 1:1 duplicate.
  if (phoneOnlyHits.length > 0 && phoneOnlyHits.length <= 3) {
    dupes.push(...phoneOnlyHits);
  }
  return dupes;
}
