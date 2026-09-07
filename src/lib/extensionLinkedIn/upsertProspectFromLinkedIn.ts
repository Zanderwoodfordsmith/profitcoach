import { normalizeLinkedInProfileUrl } from "@/lib/apify/linkedinProfile";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import { splitFullName } from "@/lib/splitFullName";

const EXTENSION_STATUSES = new Set(["new", "contacted", "follow_up"]);

export type LinkedInProspectInput = {
  linkedinUrl: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
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
  return normalizeProspectLabel(headline.slice(0, 200));
}

/**
 * Upsert a pipeline prospect from a LinkedIn profile scrape.
 * Match order: linkedin_url → email → phone → insert.
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

  let prospectStatus: string | null = null;
  if (input.prospectStatus != null && String(input.prospectStatus).trim()) {
    const status = String(input.prospectStatus).trim().toLowerCase();
    if (!EXTENSION_STATUSES.has(status)) {
      throw new Error("Invalid prospect status.");
    }
    prospectStatus = status;
  }

  const result = await resolveOrCreateContact({
    coachId,
    linkedinUrl,
    email: input.email,
    phone: input.phone,
    fullName,
    firstName: normalizeProspectPersonName(firstName),
    lastName: normalizeProspectPersonName(lastName),
    jobTitle: resolveJobTitle(input),
    businessName: normalizeProspectLabel(input.businessName ?? null),
    photoUrl: input.photoUrl,
    type: "prospect",
    prospectSource: "linkedin",
    prospectStatus: prospectStatus ?? undefined,
  });

  return {
    contactId: result.contactId,
    created: result.created,
    linkedinUrl,
  };
}
