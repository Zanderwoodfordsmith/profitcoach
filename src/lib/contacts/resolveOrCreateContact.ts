import {
  tryInsertContactStripping,
  tryUpdateContactStripping,
} from "@/lib/contactSchemaSafeInsert";
import {
  findContactByIdentity,
  normalizeContactEmail,
  normalizeContactLinkedInProviderId,
  normalizeContactLinkedInUrl,
  preferLinkedInUrl,
  type ContactIdentityInput,
} from "@/lib/contacts/identity";
import {
  linkedInIdentityIncomplete,
  parseLinkedInIdentity,
  resolveLinkedInIdentityPair,
} from "@/lib/contacts/linkedinIdentity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ResolveOrCreateContactInput = ContactIdentityInput & {
  coachId: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  jobTitle?: string | null;
  photoUrl?: string | null;
  crmContactId?: string | null;
  type?: "prospect" | "client";
  prospectSource?: string | null;
  prospectStatus?: string | null;
  /** When set, resolve missing vanity↔provider half via Unipile. */
  unipileAccountId?: string | null;
  /** Extra fields merged into insert/update (e.g. company_website). */
  extra?: Record<string, unknown>;
};

export type ResolveOrCreateContactResult = {
  contactId: string;
  created: boolean;
  matchedBy:
    | "linkedin"
    | "linkedin_provider"
    | "email"
    | "phone"
    | null;
};

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  return false;
}

/** Fill blank survivor fields only — never overwrite existing non-empty values. */
export function buildAbsorbPatch(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (isEmpty(value)) continue;
    if (!isEmpty(existing[key])) continue;
    patch[key] = value;
  }
  return patch;
}

/**
 * Find an existing contact by LinkedIn provider → URL → email → phone and
 * absorb new fields into blanks, or insert a new row.
 */
export async function resolveOrCreateContact(
  input: ResolveOrCreateContactInput
): Promise<ResolveOrCreateContactResult> {
  const email = normalizeContactEmail(input.email);
  const phone = input.phone?.trim() || null;

  let pair = parseLinkedInIdentity({
    linkedinUrl: input.linkedinUrl,
    providerId: input.linkedinProviderId,
  });
  if (
    linkedInIdentityIncomplete(pair) &&
    input.unipileAccountId &&
    (pair.providerId || pair.linkedinUrl)
  ) {
    pair = await resolveLinkedInIdentityPair({
      linkedinUrl: pair.linkedinUrl,
      providerId: pair.providerId,
      publicIdentifier: pair.publicIdentifier,
      unipileAccountId: input.unipileAccountId,
    });
  }

  const linkedinUrl = normalizeContactLinkedInUrl(pair.linkedinUrl);
  const linkedinProviderId =
    normalizeContactLinkedInProviderId(pair.providerId) ||
    normalizeContactLinkedInProviderId(input.linkedinProviderId);

  const match = await findContactByIdentity(input.coachId, {
    email,
    phone,
    linkedinUrl,
    linkedinProviderId,
  });

  const typedFields: Record<string, unknown> = {
    full_name: input.fullName?.trim() || null,
    first_name: input.firstName?.trim() || null,
    last_name: input.lastName?.trim() || null,
    email,
    phone,
    linkedin_url: linkedinUrl,
    linkedin_provider_id: linkedinProviderId,
    business_name: input.businessName?.trim() || null,
    job_title: input.jobTitle?.trim() || null,
    photo_url: input.photoUrl?.trim() || null,
    crm_contact_id: input.crmContactId?.trim() || null,
  };
  if (input.prospectStatus) {
    typedFields.prospect_status = input.prospectStatus;
  }
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      typedFields[k] = v;
    }
  }

  if (match) {
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("id", match.id)
      .maybeSingle();

    const existingRow = (existing as Record<string, unknown>) ?? {};
    const patch = buildAbsorbPatch(existingRow, typedFields);

    // Always upgrade obfuscated LinkedIn URL → vanity when we learn it.
    const preferredUrl = preferLinkedInUrl(
      existingRow.linkedin_url as string | null,
      linkedinUrl
    );
    if (
      preferredUrl &&
      preferredUrl !== (existingRow.linkedin_url as string | null)
    ) {
      patch.linkedin_url = preferredUrl;
    }
    if (
      linkedinProviderId &&
      !existingRow.linkedin_provider_id
    ) {
      patch.linkedin_provider_id = linkedinProviderId;
    }

    if (Object.keys(patch).length > 0) {
      await tryUpdateContactStripping(match.id, patch);
    }
    return {
      contactId: match.id,
      created: false,
      matchedBy: match.matchedBy,
    };
  }

  const insertPayload: Record<string, unknown> = {
    coach_id: input.coachId,
    type: input.type ?? "prospect",
    ...Object.fromEntries(
      Object.entries(typedFields).filter(([, v]) => v !== undefined)
    ),
  };
  if (input.prospectSource && (input.type ?? "prospect") === "prospect") {
    insertPayload.prospect_source = input.prospectSource;
  }
  if (!insertPayload.full_name) {
    insertPayload.full_name =
      [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
      email ||
      "Unknown";
  }
  if (!insertPayload.prospect_status && (input.type ?? "prospect") === "prospect") {
    insertPayload.prospect_status = input.prospectStatus ?? "new";
  }

  const { data, error } = await tryInsertContactStripping(insertPayload);
  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create contact.");
  }
  return { contactId: data.id, created: true, matchedBy: null };
}
