import { normalizeLinkedInProfileUrl } from "@/lib/apify/linkedinProfile";
import { tryInsertContactStripping, tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EXTENSION_STATUSES = new Set(["new", "contacted", "follow_up"]);

export type LinkedInProspectInput = {
  linkedinUrl: string;
  fullName: string;
  email?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  headline?: string | null;
  location?: string | null;
  about?: string | null;
  photoUrl?: string | null;
  prospectStatus?: string | null;
};

export type UpsertLinkedInProspectResult = {
  contactId: string;
  created: boolean;
  linkedinUrl: string;
};

function resolveJobTitle(input: LinkedInProspectInput): string | null {
  const fromTitle = normalizeProspectLabel(input.jobTitle ?? null);
  if (fromTitle) return fromTitle;
  const headline = input.headline?.trim();
  if (!headline) return null;
  // Headline often "Title at Company" — keep full headline as job_title fallback.
  return normalizeProspectLabel(headline.slice(0, 200));
}

/**
 * Upsert a pipeline prospect from a LinkedIn profile scrape.
 * Match order: linkedin_url → email (if provided) → insert.
 */
export async function upsertProspectFromLinkedIn(
  coachId: string,
  input: LinkedInProspectInput
): Promise<UpsertLinkedInProspectResult> {
  const linkedinUrl = normalizeLinkedInProfileUrl(input.linkedinUrl);
  if (!linkedinUrl) {
    throw new Error("Invalid LinkedIn profile URL.");
  }

  const fullNameRaw = input.fullName?.trim();
  if (!fullNameRaw) {
    throw new Error("Please provide prospect name.");
  }

  const { first_name: firstName, last_name: lastName } =
    splitFullName(fullNameRaw);
  const fullName =
    [normalizeProspectPersonName(firstName), normalizeProspectPersonName(lastName)]
      .filter(Boolean)
      .join(" ")
      .trim() || fullNameRaw;

  const email = input.email?.trim().toLowerCase() || null;
  const jobTitle = resolveJobTitle(input);
  const businessName = normalizeProspectLabel(input.businessName ?? null);
  let prospectStatus: string | null = null;
  if (input.prospectStatus != null && String(input.prospectStatus).trim()) {
    const status = String(input.prospectStatus).trim().toLowerCase();
    if (!EXTENSION_STATUSES.has(status)) {
      throw new Error("Invalid prospect status.");
    }
    prospectStatus = status;
  }

  const { data: byLinkedIn, error: liError } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("coach_id", coachId)
    .eq("linkedin_url", linkedinUrl)
    .maybeSingle();

  if (liError && liError.code !== "PGRST116") {
    // Column missing until migration — fall through to email/insert without URL match.
    if (liError.code !== "42703" && liError.code !== "PGRST204") {
      throw new Error("Unable to look up prospect by LinkedIn URL.");
    }
  }

  let existingId = (byLinkedIn?.id as string | undefined) ?? null;

  if (!existingId && email) {
    const { data: byEmail, error: emailError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("coach_id", coachId)
      .eq("email", email)
      .maybeSingle();
    if (emailError) {
      throw new Error("Unable to look up prospect by email.");
    }
    existingId = (byEmail?.id as string | undefined) ?? null;
  }

  const patch: Record<string, unknown> = {
    full_name: fullName,
    first_name: normalizeProspectPersonName(firstName),
    last_name: normalizeProspectPersonName(lastName),
    job_title: jobTitle,
    business_name: businessName,
    linkedin_url: linkedinUrl,
    type: "prospect",
  };
  if (email) patch.email = email;
  if (prospectStatus) patch.prospect_status = prospectStatus;

  if (existingId) {
    const { error } = await tryUpdateContactStripping(existingId, patch);
    if (error) throw new Error(error.message || "Unable to update prospect.");
    return { contactId: existingId, created: false, linkedinUrl };
  }

  const insertPayload: Record<string, unknown> = {
    coach_id: coachId,
    ...patch,
    prospect_status: prospectStatus ?? "new",
  };

  const { data, error } = await tryInsertContactStripping(insertPayload);
  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create prospect.");
  }

  return { contactId: data.id, created: true, linkedinUrl };
}
