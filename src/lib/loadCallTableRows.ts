import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "./contactsSchemaSafeSelect";
import type { CallRow } from "./callRow";

type AppointmentRecord = {
  id: string;
  contact_id: string | null;
  coach_id: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  calendar_name: string | null;
  title: string | null;
  status_normalized: string;
  status_raw: string | null;
  start_time: string | null;
  end_time: string | null;
  match_status: string;
  contacts?: {
    full_name?: string | null;
    email?: string | null;
    business_name?: string | null;
    phone?: string | null;
  } | null;
};

async function loadCoachProfilesById(
  supabase: SupabaseClient,
  coachIds: string[]
): Promise<
  Record<string, { full_name: string | null; coach_business_name: string | null }>
> {
  if (coachIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, coach_business_name")
    .in("id", coachIds);

  if (error) {
    console.warn("loadCoachProfilesById:", error);
    return {};
  }

  const byId: Record<
    string,
    { full_name: string | null; coach_business_name: string | null }
  > = {};
  for (const row of data ?? []) {
    byId[row.id] = {
      full_name: row.full_name ?? null,
      coach_business_name: row.coach_business_name ?? null,
    };
  }
  return byId;
}

function mapAppointmentRow(
  row: AppointmentRecord,
  coachById: Record<
    string,
    { full_name: string | null; coach_business_name: string | null }
  >
): CallRow {
  const contact = row.contacts ?? null;
  const coach = row.coach_id ? coachById[row.coach_id] : undefined;

  return {
    id: row.id,
    contact_id: row.contact_id,
    coach_id: row.coach_id,
    coach_name: coach?.full_name ?? null,
    coach_business_name: coach?.coach_business_name ?? null,
    prospect_name:
      contact?.full_name?.trim() ||
      row.prospect_name?.trim() ||
      "Unknown prospect",
    prospect_email: contact?.email ?? row.prospect_email ?? null,
    prospect_phone: contact?.phone ?? row.prospect_phone ?? null,
    business_name: contact?.business_name ?? null,
    calendar_name: row.calendar_name ?? null,
    title: row.title ?? null,
    status_normalized: row.status_normalized,
    status_raw: row.status_raw ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    match_status: row.match_status,
  };
}

export async function loadCallTableRows(
  supabase: SupabaseClient,
  options?: { coachId?: string | null }
): Promise<CallRow[]> {
  let query = supabase
    .from("ghl_appointments")
    .select(
      `
        id,
        contact_id,
        coach_id,
        prospect_name,
        prospect_email,
        prospect_phone,
        calendar_name,
        title,
        status_normalized,
        status_raw,
        start_time,
        end_time,
        match_status,
        contacts ( full_name, email, business_name, phone )
      `
    )
    .order("start_time", { ascending: false, nullsFirst: true });

  if (options?.coachId) {
    query = query.eq("coach_id", options.coachId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01" || isMissingColumnError(error)) {
      return [];
    }
    throw error;
  }

  const appointments = (data ?? []) as AppointmentRecord[];
  const coachIds = Array.from(
    new Set(
      appointments
        .map((row) => row.coach_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const coachById = await loadCoachProfilesById(supabase, coachIds);

  return appointments.map((row) => mapAppointmentRow(row, coachById));
}
