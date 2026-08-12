import {
  LinkedInProfileError,
  scrapeLinkedInProfile,
  normalizeLinkedInProfileUrl,
  type LinkedInProfileSnapshot,
} from "@/lib/apify/linkedinProfile";
import {
  tryInsertContactStripping,
  tryUpdateContactStripping,
} from "@/lib/contactSchemaSafeInsert";
import {
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type UpsertClientFromLinkedInResult = {
  contactId: string;
  created: boolean;
  linkedinUrl: string;
  snapshot: LinkedInProfileSnapshot;
};

function resolveName(snapshot: LinkedInProfileSnapshot): string {
  const fromParts = [snapshot.firstName, snapshot.lastName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const full = (snapshot.fullName ?? fromParts).trim();
  return full;
}

function resolveJobTitle(snapshot: LinkedInProfileSnapshot): string | null {
  const current = snapshot.experiences.find((e) => !e.end || /present/i.test(e.end));
  const title = current?.title ?? snapshot.experiences[0]?.title ?? null;
  if (title) return normalizeProspectLabel(title);
  const headline = snapshot.headline?.trim();
  if (!headline) return null;
  return normalizeProspectLabel(headline.slice(0, 200));
}

function resolveBusiness(snapshot: LinkedInProfileSnapshot): string | null {
  const current = snapshot.experiences.find((e) => !e.end || /present/i.test(e.end));
  const company =
    current?.company ?? snapshot.experiences[0]?.company ?? null;
  return normalizeProspectLabel(company);
}

/**
 * Scrape a LinkedIn profile URL and upsert a client contact for the coach.
 * Match order: linkedin_url → insert (does not overwrite prospects as clients).
 */
export async function upsertClientFromLinkedIn(
  coachId: string,
  linkedinUrlInput: string
): Promise<UpsertClientFromLinkedInResult> {
  const linkedinUrl = normalizeLinkedInProfileUrl(linkedinUrlInput);
  if (!linkedinUrl) {
    throw new LinkedInProfileError(
      "Enter a valid LinkedIn profile URL (linkedin.com/in/…).",
      "invalid_url"
    );
  }

  const { snapshot } = await scrapeLinkedInProfile(linkedinUrl);
  const fullNameRaw = resolveName(snapshot);
  if (!fullNameRaw) {
    throw new Error("LinkedIn profile did not include a name.");
  }

  const { first_name: firstName, last_name: lastName } =
    splitFullName(fullNameRaw);
  const fullName =
    [normalizeProspectPersonName(firstName), normalizeProspectPersonName(lastName)]
      .filter(Boolean)
      .join(" ")
      .trim() || fullNameRaw;

  const jobTitle = resolveJobTitle(snapshot);
  const businessName = resolveBusiness(snapshot);
  const headline = normalizeProspectLabel(snapshot.headline ?? null);
  const location = normalizeProspectLabel(snapshot.location ?? null);
  const photoUrl = snapshot.photoUrl?.trim() || null;

  const { data: byLinkedIn, error: liError } = await supabaseAdmin
    .from("contacts")
    .select("id, type")
    .eq("coach_id", coachId)
    .eq("linkedin_url", linkedinUrl)
    .maybeSingle();

  if (liError && liError.code !== "PGRST116") {
    if (liError.code !== "42703" && liError.code !== "PGRST204") {
      throw new Error("Unable to look up contact by LinkedIn URL.");
    }
  }

  const existingId = (byLinkedIn?.id as string | undefined) ?? null;
  const existingType = (byLinkedIn?.type as string | undefined) ?? null;

  if (existingId && existingType === "prospect") {
    throw new Error(
      "This LinkedIn profile is already a prospect. Convert them to a client from the prospects workspace, or use a different URL."
    );
  }

  const patch: Record<string, unknown> = {
    full_name: fullName,
    first_name: normalizeProspectPersonName(firstName),
    last_name: normalizeProspectPersonName(lastName),
    job_title: jobTitle,
    business_name: businessName,
    linkedin_url: linkedinUrl,
    headline,
    location,
    photo_url: photoUrl,
    type: "client",
  };

  if (existingId) {
    const { error } = await tryUpdateContactStripping(existingId, patch);
    if (error) throw new Error(error.message || "Unable to update client.");
    return { contactId: existingId, created: false, linkedinUrl, snapshot };
  }

  const { data, error } = await tryInsertContactStripping({
    coach_id: coachId,
    ...patch,
  });
  if (error || !data?.id) {
    throw new Error(error?.message || "Unable to create client.");
  }

  return { contactId: data.id, created: true, linkedinUrl, snapshot };
}
