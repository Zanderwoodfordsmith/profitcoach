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

type NativeBookingRecord = {
  id: string;
  contact_id: string | null;
  coach_id: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  kind: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
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

function mapNativeBookingRow(
  row: NativeBookingRecord,
  coachById: Record<
    string,
    { full_name: string | null; coach_business_name: string | null }
  >
): CallRow {
  const contact = row.contacts ?? null;
  const coach = row.coach_id ? coachById[row.coach_id] : undefined;
  const kindLabel =
    row.kind === "discovery"
      ? "Discovery call"
      : row.kind?.trim() || "Booking";

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
    calendar_name: "Native booking",
    title: kindLabel,
    status_normalized: row.status === "noshow" ? "noshow" : row.status,
    status_raw: row.status,
    start_time: row.starts_at ?? null,
    end_time: row.ends_at ?? null,
    match_status: row.contact_id ? "matched" : "unmatched_contact",
  };
}

async function loadGhlRows(
  supabase: SupabaseClient,
  coachId?: string | null
): Promise<AppointmentRecord[]> {
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

  if (coachId) {
    query = query.eq("coach_id", coachId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || isMissingColumnError(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []) as AppointmentRecord[];
}

async function loadNativeBookingRows(
  supabase: SupabaseClient,
  coachId?: string | null
): Promise<NativeBookingRecord[]> {
  let query = supabase
    .from("bookings")
    .select(
      `
        id,
        contact_id,
        coach_id,
        prospect_name,
        prospect_email,
        prospect_phone,
        kind,
        status,
        starts_at,
        ends_at,
        contacts ( full_name, email, business_name, phone )
      `
    )
    .order("starts_at", { ascending: false, nullsFirst: true });

  if (coachId) {
    query = query.eq("coach_id", coachId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || isMissingColumnError(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []) as NativeBookingRecord[];
}

export async function loadCallTableRows(
  supabase: SupabaseClient,
  options?: { coachId?: string | null }
): Promise<CallRow[]> {
  const [ghlRows, nativeRows] = await Promise.all([
    loadGhlRows(supabase, options?.coachId),
    loadNativeBookingRows(supabase, options?.coachId),
  ]);

  const coachIds = Array.from(
    new Set(
      [...ghlRows, ...nativeRows]
        .map((row) => row.coach_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const coachById = await loadCoachProfilesById(supabase, coachIds);

  const merged = [
    ...ghlRows.map((row) => mapAppointmentRow(row, coachById)),
    ...nativeRows.map((row) => mapNativeBookingRow(row, coachById)),
  ];

  merged.sort((a, b) => {
    const at = a.start_time ? Date.parse(a.start_time) : 0;
    const bt = b.start_time ? Date.parse(b.start_time) : 0;
    return bt - at;
  });

  return merged;
}
