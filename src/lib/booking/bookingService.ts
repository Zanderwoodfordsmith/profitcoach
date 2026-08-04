import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_WEEKDAY_AVAILABILITY,
  type AvailabilityRuleRow,
  type BookingSettingsRow,
} from "@/lib/booking/computeBookingSlots";

export type CoachBookPublic = {
  coachId: string;
  slug: string;
  displayName: string;
  settings: BookingSettingsRow;
  rules: AvailabilityRuleRow[];
};

function normalizeTime(t: string): string {
  const trimmed = t.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function mapSettingsRow(
  row: Record<string, unknown> | null | undefined
): BookingSettingsRow {
  if (!row) {
    return { ...DEFAULT_BOOKING_SETTINGS };
  }
  return {
    timezone:
      typeof row.timezone === "string" && row.timezone.trim()
        ? row.timezone.trim()
        : DEFAULT_BOOKING_SETTINGS.timezone,
    meeting_duration_minutes:
      typeof row.meeting_duration_minutes === "number"
        ? row.meeting_duration_minutes
        : DEFAULT_BOOKING_SETTINGS.meeting_duration_minutes,
    buffer_minutes:
      typeof row.buffer_minutes === "number"
        ? row.buffer_minutes
        : DEFAULT_BOOKING_SETTINGS.buffer_minutes,
    min_notice_hours:
      typeof row.min_notice_hours === "number"
        ? row.min_notice_hours
        : DEFAULT_BOOKING_SETTINGS.min_notice_hours,
    booking_window_days:
      typeof row.booking_window_days === "number"
        ? row.booking_window_days
        : DEFAULT_BOOKING_SETTINGS.booking_window_days,
    is_enabled: Boolean(row.is_enabled),
    title:
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : DEFAULT_BOOKING_SETTINGS.title,
  };
}

export async function loadCoachBySlug(
  slug: string
): Promise<{ id: string; slug: string; displayName: string } | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;

  const { data: coach, error } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("slug", clean)
    .maybeSingle();

  if (error || !coach?.id) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, coach_business_name")
    .eq("id", coach.id)
    .maybeSingle();

  const displayName =
    (profile?.coach_business_name as string | null)?.trim() ||
    (profile?.full_name as string | null)?.trim() ||
    clean;

  return {
    id: coach.id as string,
    slug: (coach.slug as string) ?? clean,
    displayName,
  };
}

export async function loadBookingSettingsForCoach(
  coachId: string
): Promise<{ settings: BookingSettingsRow; rules: AvailabilityRuleRow[] }> {
  const { data: settingsRow } = await supabaseAdmin
    .from("coach_booking_settings")
    .select(
      "timezone, meeting_duration_minutes, buffer_minutes, min_notice_hours, booking_window_days, is_enabled, title"
    )
    .eq("coach_id", coachId)
    .maybeSingle();

  const { data: ruleRows } = await supabaseAdmin
    .from("coach_availability_rules")
    .select("weekday, start_time, end_time")
    .eq("coach_id", coachId)
    .order("weekday")
    .order("start_time");

  const rules: AvailabilityRuleRow[] = (ruleRows ?? []).map((r) => ({
    weekday: Number(r.weekday),
    start_time: String(r.start_time),
    end_time: String(r.end_time),
  }));

  return {
    settings: mapSettingsRow(settingsRow as Record<string, unknown> | null),
    rules,
  };
}

export async function loadExistingBookedIntervals(
  coachId: string,
  fromIso: string,
  toIso: string
): Promise<{ starts_at: string; ends_at: string }[]> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("coach_id", coachId)
    .eq("status", "booked")
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso);

  return (data ?? []).map((r) => ({
    starts_at: String(r.starts_at),
    ends_at: String(r.ends_at),
  }));
}

export async function ensureDefaultAvailabilityRules(
  coachId: string
): Promise<void> {
  const { count } = await supabaseAdmin
    .from("coach_availability_rules")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coachId);

  if ((count ?? 0) > 0) return;

  await supabaseAdmin.from("coach_availability_rules").insert(
    DEFAULT_WEEKDAY_AVAILABILITY.map((r) => ({
      coach_id: coachId,
      weekday: r.weekday,
      start_time: normalizeTime(r.start_time),
      end_time: normalizeTime(r.end_time),
    }))
  );
}

export async function upsertBookingSettings(
  coachId: string,
  patch: Partial<BookingSettingsRow> & { rules?: AvailabilityRuleRow[] }
): Promise<{ settings: BookingSettingsRow; rules: AvailabilityRuleRow[] }> {
  const current = await loadBookingSettingsForCoach(coachId);
  const next: BookingSettingsRow = {
    ...current.settings,
  };
  if (patch.timezone !== undefined) next.timezone = patch.timezone;
  if (patch.meeting_duration_minutes !== undefined) {
    next.meeting_duration_minutes = patch.meeting_duration_minutes;
  }
  if (patch.buffer_minutes !== undefined) next.buffer_minutes = patch.buffer_minutes;
  if (patch.min_notice_hours !== undefined) {
    next.min_notice_hours = patch.min_notice_hours;
  }
  if (patch.booking_window_days !== undefined) {
    next.booking_window_days = patch.booking_window_days;
  }
  if (patch.is_enabled !== undefined) next.is_enabled = patch.is_enabled;
  if (patch.title !== undefined) next.title = patch.title;

  const enabling = next.is_enabled && !current.settings.is_enabled;

  await supabaseAdmin.from("coach_booking_settings").upsert(
    {
      coach_id: coachId,
      timezone: next.timezone,
      meeting_duration_minutes: next.meeting_duration_minutes,
      buffer_minutes: next.buffer_minutes,
      min_notice_hours: next.min_notice_hours,
      booking_window_days: next.booking_window_days,
      is_enabled: next.is_enabled,
      title: next.title,
    },
    { onConflict: "coach_id" }
  );

  if (patch.rules) {
    await supabaseAdmin
      .from("coach_availability_rules")
      .delete()
      .eq("coach_id", coachId);

    if (patch.rules.length > 0) {
      await supabaseAdmin.from("coach_availability_rules").insert(
        patch.rules.map((r) => ({
          coach_id: coachId,
          weekday: r.weekday,
          start_time: normalizeTime(r.start_time),
          end_time: normalizeTime(r.end_time),
        }))
      );
    }
  } else if (enabling) {
    await ensureDefaultAvailabilityRules(coachId);
  }

  return loadBookingSettingsForCoach(coachId);
}

export async function findOrCreateProspectContact(input: {
  coachId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("coach_id", input.coachId)
    .eq("email", email)
    .maybeSingle();

  if (existing?.id) {
    const updates: Record<string, unknown> = {};
    if (input.phone?.trim()) updates.phone = input.phone.trim();
    if (input.firstName.trim()) updates.first_name = input.firstName.trim();
    if (input.lastName.trim()) updates.last_name = input.lastName.trim();
    const fullName = `${input.firstName} ${input.lastName}`.trim();
    if (fullName) updates.full_name = fullName;
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("contacts")
        .update(updates)
        .eq("id", existing.id);
    }
    return existing.id as string;
  }

  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const { data: created, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      coach_id: input.coachId,
      email,
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      full_name: fullName || email,
      phone: input.phone?.trim() || null,
      type: "prospect",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("findOrCreateProspectContact:", error);
    return null;
  }
  return (created?.id as string | undefined) ?? null;
}
