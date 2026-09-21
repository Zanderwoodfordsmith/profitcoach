import { isMissingColumnError } from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Query param on personalised /assessment links. */
export const ASSESSMENT_INVITE_PARAM = "c";

export function normalizeAssessmentInviteToken(
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value.length > 36 || !UUID_RE.test(value)) return null;
  return value;
}

export type AssessmentInviteContact = {
  id: string;
  coachId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
};

function rowToInviteContact(row: {
  id: string;
  coach_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
}): AssessmentInviteContact {
  return {
    id: row.id,
    coachId: row.coach_id,
    firstName: row.first_name?.trim() || null,
    lastName: row.last_name?.trim() || null,
    fullName: row.full_name?.trim() || null,
    email: row.email?.trim().toLowerCase() || null,
    phone: row.phone?.trim() || null,
    businessName: row.business_name?.trim() || null,
  };
}

const INVITE_CONTACT_COLUMNS =
  "id, coach_id, first_name, last_name, full_name, email, phone, business_name";

/**
 * Load a contact by invite token, scoped to the assessment coach.
 * Returns null when the token is missing, malformed, or belongs to another coach.
 */
export async function findContactByAssessmentInviteToken(input: {
  token: string | null | undefined;
  coachId: string;
}): Promise<AssessmentInviteContact | null> {
  const token = normalizeAssessmentInviteToken(input.token);
  const coachId = input.coachId.trim();
  if (!token || !coachId) return null;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(INVITE_CONTACT_COLUMNS)
    .eq("assessment_invite_token", token)
    .eq("coach_id", coachId)
    .maybeSingle();

  if (error) {
    if (!isMissingColumnError(error)) {
      console.error("assessment invite token lookup failed");
    }
    return null;
  }
  if (!data?.id) return null;
  return rowToInviteContact(
    data as {
      id: string;
      coach_id: string;
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
      business_name?: string | null;
    }
  );
}

/** Token to put on a personalised assessment URL for this contact. */
export async function loadAssessmentInviteToken(
  contactId: string | null | undefined
): Promise<string | null> {
  const id = contactId?.trim();
  if (!id) return null;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("assessment_invite_token")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (!isMissingColumnError(error)) {
      console.error("assessment invite token load failed");
    }
    return null;
  }
  return normalizeAssessmentInviteToken(
    (data as { assessment_invite_token?: string | null } | null)
      ?.assessment_invite_token
  );
}
