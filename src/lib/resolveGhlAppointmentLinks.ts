import { extractGhlCalendarIdFromEmbed } from "@/lib/extractGhlCalendarIdFromEmbed";
import type { GhlAppointmentMatchStatus } from "@/lib/ghlAppointmentWebhook";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ResolvedGhlAppointmentLinks = {
  coachId: string | null;
  contactId: string | null;
  assessmentId: string | null;
  matchStatus: GhlAppointmentMatchStatus;
};

async function lookupCoachByLocationId(
  locationId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("crm_location_id", locationId)
    .maybeSingle();

  if (error) {
    console.warn("ghl webhook coach lookup by location:", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

async function lookupCoachByCalendarId(
  calendarId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id, calendar_embed_code, ghl_calendar_id")
    .eq("ghl_calendar_id", calendarId)
    .limit(2);

  if (error?.code === "42703") {
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from("coaches")
      .select("id, calendar_embed_code")
      .not("calendar_embed_code", "is", null)
      .limit(500);

    if (fallbackError) {
      console.warn("ghl webhook coach lookup by calendar:", fallbackError);
      return null;
    }

    for (const row of fallbackData ?? []) {
      const embedId = extractGhlCalendarIdFromEmbed(
        (row as { calendar_embed_code?: string | null }).calendar_embed_code
      );
      if (embedId === calendarId) {
        return (row as { id: string }).id;
      }
    }
    return null;
  }

  if (error) {
    console.warn("ghl webhook coach lookup by calendar:", error);
    return null;
  }

  if (data?.length === 1) {
    return (data[0] as { id: string }).id;
  }

  if ((data?.length ?? 0) > 1) {
    console.warn(
      `ghl webhook calendar id ${calendarId} matched multiple coaches`
    );
    return (data![0] as { id: string }).id;
  }

  const { data: embedRows, error: embedError } = await supabaseAdmin
    .from("coaches")
    .select("id, calendar_embed_code")
    .not("calendar_embed_code", "is", null)
    .limit(500);

  if (embedError) {
    console.warn("ghl webhook coach embed scan:", embedError);
    return null;
  }

  for (const row of embedRows ?? []) {
    const embedId = extractGhlCalendarIdFromEmbed(
      (row as { calendar_embed_code?: string | null }).calendar_embed_code
    );
    if (embedId === calendarId) {
      return (row as { id: string }).id;
    }
  }

  return null;
}

async function lookupContactByCoachAndEmail(
  coachId: string,
  email: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("coach_id", coachId)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.warn("ghl webhook contact lookup:", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

async function lookupLatestAssessmentId(
  contactId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("assessments")
    .select("id, completed_at")
    .eq("contact_id", contactId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("ghl webhook assessment lookup:", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

export async function resolveGhlAppointmentLinks(input: {
  ghlLocationId: string | null;
  ghlCalendarId: string | null;
  prospectEmail: string | null;
}): Promise<ResolvedGhlAppointmentLinks> {
  let coachId: string | null = null;

  if (input.ghlLocationId) {
    coachId = await lookupCoachByLocationId(input.ghlLocationId);
  }

  if (!coachId && input.ghlCalendarId) {
    coachId = await lookupCoachByCalendarId(input.ghlCalendarId);
  }

  if (!coachId) {
    return {
      coachId: null,
      contactId: null,
      assessmentId: null,
      matchStatus: "unmatched_coach",
    };
  }

  if (!input.prospectEmail) {
    return {
      coachId,
      contactId: null,
      assessmentId: null,
      matchStatus: "unmatched_contact",
    };
  }

  const contactId = await lookupContactByCoachAndEmail(
    coachId,
    input.prospectEmail
  );

  if (!contactId) {
    return {
      coachId,
      contactId: null,
      assessmentId: null,
      matchStatus: "unmatched_contact",
    };
  }

  const assessmentId = await lookupLatestAssessmentId(contactId);

  return {
    coachId,
    contactId,
    assessmentId,
    matchStatus: "matched",
  };
}
