import {
  linkedInProviderIdFromUrl,
  normalizeLinkedInProviderId,
  preferLinkedInUrl,
} from "@/lib/contacts/linkedinIdentity";
import { normalizeLinkedInProfileUrl } from "@/lib/linkedin/normalizeProfileUrl";
import { phoneMatchKey } from "@/lib/messaging/knownContacts";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ContactIdentityInput = {
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  linkedinProviderId?: string | null;
};

export type ContactIdentityMatch = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
  matchedBy: "linkedin" | "linkedin_provider" | "email" | "phone";
};

export type ContactIdentityRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  linkedin_provider_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  job_title?: string | null;
  crm_contact_id?: string | null;
  photo_url?: string | null;
  type?: string | null;
  created_at?: string | null;
};

export function normalizeContactEmail(
  raw: string | null | undefined
): string | null {
  const v = raw?.trim().toLowerCase();
  return v || null;
}

export function normalizeContactPhone(
  raw: string | null | undefined
): string | null {
  return phoneMatchKey(raw);
}

export function normalizeContactLinkedInUrl(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  return normalizeLinkedInProfileUrl(raw);
}

export function normalizeContactLinkedInProviderId(
  raw: string | null | undefined
): string | null {
  return (
    normalizeLinkedInProviderId(raw) || linkedInProviderIdFromUrl(raw)
  );
}

type IdentityIndex = {
  byLinkedIn: Map<string, ContactIdentityRow>;
  byProviderId: Map<string, ContactIdentityRow>;
  byEmail: Map<string, ContactIdentityRow>;
  byPhone: Map<string, ContactIdentityRow>;
};

function buildIdentityIndex(rows: ContactIdentityRow[]): IdentityIndex {
  const byLinkedIn = new Map<string, ContactIdentityRow>();
  const byProviderId = new Map<string, ContactIdentityRow>();
  const byEmail = new Map<string, ContactIdentityRow>();
  const byPhone = new Map<string, ContactIdentityRow>();

  for (const row of rows) {
    const li = normalizeContactLinkedInUrl(row.linkedin_url);
    if (li && !byLinkedIn.has(li)) byLinkedIn.set(li, row);
    const provider =
      normalizeContactLinkedInProviderId(row.linkedin_provider_id) ||
      linkedInProviderIdFromUrl(row.linkedin_url);
    if (provider && !byProviderId.has(provider)) {
      byProviderId.set(provider, row);
    }
    const email = normalizeContactEmail(row.email);
    if (email && !byEmail.has(email)) byEmail.set(email, row);
    const phone = normalizeContactPhone(row.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, row);
  }

  return { byLinkedIn, byProviderId, byEmail, byPhone };
}

function toMatch(
  row: ContactIdentityRow,
  matchedBy: ContactIdentityMatch["matchedBy"]
): ContactIdentityMatch {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    linkedin_url: row.linkedin_url,
    linkedin_provider_id: row.linkedin_provider_id ?? null,
    matchedBy,
  };
}

/**
 * Match order: LinkedIn provider id → LinkedIn URL → email → phone.
 * Provider id bridges vanity vs ACo… URLs for the same person.
 */
export function matchContactIdentity(
  index: IdentityIndex,
  input: ContactIdentityInput
): ContactIdentityMatch | null {
  const provider =
    normalizeContactLinkedInProviderId(input.linkedinProviderId) ||
    linkedInProviderIdFromUrl(input.linkedinUrl);
  if (provider) {
    const hit = index.byProviderId.get(provider);
    if (hit) return toMatch(hit, "linkedin_provider");
  }
  const linkedin = normalizeContactLinkedInUrl(input.linkedinUrl);
  if (linkedin) {
    const hit = index.byLinkedIn.get(linkedin);
    if (hit) return toMatch(hit, "linkedin");
  }
  const email = normalizeContactEmail(input.email);
  if (email) {
    const hit = index.byEmail.get(email);
    if (hit) return toMatch(hit, "email");
  }
  const phone = normalizeContactPhone(input.phone);
  if (phone) {
    const hit = index.byPhone.get(phone);
    if (hit) return toMatch(hit, "phone");
  }
  return null;
}

export async function loadContactIdentityIndex(
  coachId: string
): Promise<IdentityIndex> {
  const { data, error } = await selectContactsWithOptionalPhone<ContactIdentityRow>(
    async (columns) =>
      supabaseAdmin.from("contacts").select(columns).eq("coach_id", coachId),
    "id, full_name, email",
    [
      "linkedin_url",
      "linkedin_provider_id",
      "first_name",
      "last_name",
      "business_name",
      "job_title",
      "crm_contact_id",
      "photo_url",
      "type",
      "created_at",
    ]
  );
  if (error) {
    console.error("contact identity index:", error.message);
    return {
      byLinkedIn: new Map(),
      byProviderId: new Map(),
      byEmail: new Map(),
      byPhone: new Map(),
    };
  }
  return buildIdentityIndex(data);
}

export async function findContactByIdentity(
  coachId: string,
  input: ContactIdentityInput
): Promise<ContactIdentityMatch | null> {
  const provider =
    normalizeContactLinkedInProviderId(input.linkedinProviderId) ||
    linkedInProviderIdFromUrl(input.linkedinUrl);
  const linkedin = normalizeContactLinkedInUrl(input.linkedinUrl);
  const email = normalizeContactEmail(input.email);
  const phone = normalizeContactPhone(input.phone);
  if (!provider && !linkedin && !email && !phone) return null;

  if (provider) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, phone, linkedin_url, linkedin_provider_id")
      .eq("coach_id", coachId)
      .eq("linkedin_provider_id", provider)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return toMatch(data as ContactIdentityRow, "linkedin_provider");
    }
    // Legacy rows may only have ACo… stored as linkedin_url.
    const asUrl = `https://www.linkedin.com/in/${encodeURIComponent(provider)}/`;
    const { data: byUrl } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, phone, linkedin_url, linkedin_provider_id")
      .eq("coach_id", coachId)
      .eq("linkedin_url", asUrl)
      .limit(1)
      .maybeSingle();
    if (byUrl?.id) {
      return toMatch(byUrl as ContactIdentityRow, "linkedin_provider");
    }
  }

  if (linkedin) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, phone, linkedin_url, linkedin_provider_id")
      .eq("coach_id", coachId)
      .eq("linkedin_url", linkedin)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return toMatch(data as ContactIdentityRow, "linkedin");
    }
  }

  if (email) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, phone, linkedin_url, linkedin_provider_id")
      .eq("coach_id", coachId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return toMatch(data as ContactIdentityRow, "email");
    }
  }

  if (phone) {
    const index = await loadContactIdentityIndex(coachId);
    return matchContactIdentity(index, { phone: input.phone });
  }

  return null;
}

export { preferLinkedInUrl };
