import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_WEEKDAY_AVAILABILITY,
  type AvailabilityRuleRow,
  type BookingSettingsRow,
} from "@/lib/booking/computeBookingSlots";
import {
  DEFAULT_COACH_CALENDARS,
  mapCoachCalendarRow,
  type CoachCalendarPatch,
  type CoachCalendarRow,
} from "@/lib/booking/coachCalendars";

export type { CoachCalendarRow, CoachCalendarPatch };

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

function slugifyBase(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "coach";
}

/**
 * Admins (and anyone without a coaches row) need a coaches row + slug
 * so booking settings FK and /book/[slug] work for them as themselves.
 */
export async function ensureCoachRowForUser(userId: string): Promise<{
  id: string;
  slug: string;
}> {
  const { data: existing } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.id && (existing.slug as string | null)?.trim()) {
    return { id: existing.id as string, slug: (existing.slug as string).trim() };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, coach_business_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = authData.user?.email?.trim().toLowerCase() ?? "";
  const emailLocal = email.split("@")[0] ?? "";

  const nameBase =
    (profile?.full_name as string | null)?.trim() ||
    (profile?.coach_business_name as string | null)?.trim() ||
    emailLocal ||
    "coach";

  let base = slugifyBase(nameBase.split(/\s+/)[0] || nameBase);
  if (base === "coach" && emailLocal) base = slugifyBase(emailLocal);

  let slug = base;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${base}-${i + 1}`;
    const { data: taken } = await supabaseAdmin
      .from("coaches")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!taken?.id || taken.id === userId) {
      slug = candidate;
      break;
    }
  }

  const { error } = await supabaseAdmin.from("coaches").upsert(
    {
      id: userId,
      slug,
      record_kind: "member",
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("ensureCoachRowForUser:", error);
    throw new Error("Could not create coach profile for booking.");
  }

  return { id: userId, slug };
}

export function mapSettingsRow(
  row: Record<string, unknown> | null | undefined
): BookingSettingsRow {
  if (!row) {
    return { ...DEFAULT_BOOKING_SETTINGS };
  }
  const modeRaw =
    typeof row.location_mode === "string" ? row.location_mode.trim() : "";
  const location_mode =
    modeRaw === "phone" || modeRaw === "custom" || modeRaw === "google_meet"
      ? modeRaw
      : DEFAULT_BOOKING_SETTINGS.location_mode;

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
    location_mode,
    location_phone:
      typeof row.location_phone === "string" && row.location_phone.trim()
        ? row.location_phone.trim()
        : null,
    location_custom:
      typeof row.location_custom === "string" && row.location_custom.trim()
        ? row.location_custom.trim()
        : null,
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
      "timezone, meeting_duration_minutes, buffer_minutes, min_notice_hours, booking_window_days, is_enabled, title, location_mode, location_phone, location_custom"
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
  if (patch.location_mode !== undefined) next.location_mode = patch.location_mode;
  if (patch.location_phone !== undefined) {
    next.location_phone = patch.location_phone;
  }
  if (patch.location_custom !== undefined) {
    next.location_custom = patch.location_custom;
  }

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
      location_mode: next.location_mode,
      location_phone: next.location_phone,
      location_custom: next.location_custom,
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

const CALENDAR_SELECT =
  "id, coach_id, slug, name, description, meeting_duration_minutes, buffer_minutes, min_notice_hours, booking_window_days, is_enabled, is_public, location_mode, location_phone, location_custom, sort_order";

export async function listCoachCalendars(
  coachId: string
): Promise<CoachCalendarRow[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_calendars")
    .select(CALENDAR_SELECT)
    .eq("coach_id", coachId)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("listCoachCalendars:", error);
    return [];
  }
  return (data ?? []).map((r) =>
    mapCoachCalendarRow(r as Record<string, unknown>)
  );
}

export async function loadCoachCalendarBySlug(
  coachId: string,
  calendarSlug: string
): Promise<CoachCalendarRow | null> {
  const clean = calendarSlug.trim().toLowerCase();
  if (!clean) return null;
  const { data } = await supabaseAdmin
    .from("coach_calendars")
    .select(CALENDAR_SELECT)
    .eq("coach_id", coachId)
    .eq("slug", clean)
    .maybeSingle();
  if (!data) return null;
  return mapCoachCalendarRow(data as Record<string, unknown>);
}

export async function loadCoachCalendarById(
  coachId: string,
  calendarId: string
): Promise<CoachCalendarRow | null> {
  const { data } = await supabaseAdmin
    .from("coach_calendars")
    .select(CALENDAR_SELECT)
    .eq("coach_id", coachId)
    .eq("id", calendarId)
    .maybeSingle();
  if (!data) return null;
  return mapCoachCalendarRow(data as Record<string, unknown>);
}

/**
 * Ensure the five default calendars exist. Discovery inherits enablement
 * from coach_booking_settings when present.
 */
export async function ensureDefaultCoachCalendars(
  coachId: string
): Promise<CoachCalendarRow[]> {
  const existing = await listCoachCalendars(coachId);
  if (existing.length >= DEFAULT_COACH_CALENDARS.length) {
    return existing;
  }

  const { settings } = await loadBookingSettingsForCoach(coachId);
  const have = new Set(existing.map((c) => c.slug));

  const toInsert = DEFAULT_COACH_CALENDARS.filter((d) => !have.has(d.slug)).map(
    (d) => {
      const isDiscovery = d.slug === "discovery";
      return {
        coach_id: coachId,
        slug: d.slug,
        name: d.name,
        meeting_duration_minutes: isDiscovery
          ? settings.meeting_duration_minutes
          : d.meeting_duration_minutes,
        buffer_minutes: isDiscovery ? settings.buffer_minutes : 0,
        min_notice_hours: isDiscovery ? settings.min_notice_hours : 24,
        booking_window_days: isDiscovery ? settings.booking_window_days : 14,
        is_enabled: isDiscovery ? settings.is_enabled : false,
        is_public: isDiscovery ? settings.is_enabled : false,
        location_mode: isDiscovery ? settings.location_mode : "google_meet",
        location_phone: isDiscovery ? settings.location_phone : null,
        location_custom: isDiscovery ? settings.location_custom : null,
        sort_order: d.sort_order,
      };
    }
  );

  if (toInsert.length > 0) {
    const { error } = await supabaseAdmin
      .from("coach_calendars")
      .upsert(toInsert, { onConflict: "coach_id,slug" });
    if (error) console.error("ensureDefaultCoachCalendars:", error);
  }

  // Ensure settings row exists for timezone
  await supabaseAdmin.from("coach_booking_settings").upsert(
    {
      coach_id: coachId,
      timezone: settings.timezone,
      is_enabled: settings.is_enabled || existing.some((c) => c.is_enabled),
    },
    { onConflict: "coach_id" }
  );

  return listCoachCalendars(coachId);
}

export async function updateCoachCalendar(
  coachId: string,
  calendarId: string,
  patch: CoachCalendarPatch
): Promise<CoachCalendarRow | null> {
  const current = await loadCoachCalendarById(coachId, calendarId);
  if (!current) return null;

  const next: Record<string, unknown> = {};
  if (patch.name !== undefined) next.name = patch.name.trim() || current.name;
  if (patch.description !== undefined) {
    next.description = patch.description?.trim() || null;
  }
  if (patch.meeting_duration_minutes !== undefined) {
    next.meeting_duration_minutes = patch.meeting_duration_minutes;
  }
  if (patch.buffer_minutes !== undefined) {
    next.buffer_minutes = patch.buffer_minutes;
  }
  if (patch.min_notice_hours !== undefined) {
    next.min_notice_hours = patch.min_notice_hours;
  }
  if (patch.booking_window_days !== undefined) {
    next.booking_window_days = patch.booking_window_days;
  }
  if (patch.is_enabled !== undefined) next.is_enabled = patch.is_enabled;
  if (patch.is_public !== undefined) next.is_public = patch.is_public;
  if (patch.location_mode !== undefined) next.location_mode = patch.location_mode;
  if (patch.location_phone !== undefined) {
    next.location_phone = patch.location_phone?.trim() || null;
  }
  if (patch.location_custom !== undefined) {
    next.location_custom = patch.location_custom?.trim() || null;
  }
  if (patch.sort_order !== undefined) next.sort_order = patch.sort_order;
  if (patch.slug !== undefined) {
    const slug = patch.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) next.slug = slug;
  }

  if (Object.keys(next).length === 0) return current;

  const { error } = await supabaseAdmin
    .from("coach_calendars")
    .update(next)
    .eq("id", calendarId)
    .eq("coach_id", coachId);

  if (error) {
    console.error("updateCoachCalendar:", error);
    throw new Error(error.message || "Could not update calendar.");
  }

  // Keep coach_booking_settings.is_enabled in sync if any calendar is enabled
  const all = await listCoachCalendars(coachId);
  const anyEnabled = all.some((c) => c.is_enabled);
  await supabaseAdmin
    .from("coach_booking_settings")
    .upsert(
      { coach_id: coachId, is_enabled: anyEnabled },
      { onConflict: "coach_id" }
    );

  if (patch.is_enabled === true) {
    await ensureDefaultAvailabilityRules(coachId);
  }

  return loadCoachCalendarById(coachId, calendarId);
}

export async function loadCoachTimezone(coachId: string): Promise<string> {
  const { settings } = await loadBookingSettingsForCoach(coachId);
  return settings.timezone;
}
