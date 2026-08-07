/** Default calendars seeded for each coach (public book slugs). */
export const DEFAULT_COACH_CALENDARS = [
  {
    slug: "discovery",
    name: "Discovery call",
    meeting_duration_minutes: 15,
    sort_order: 0,
  },
  {
    slug: "value-session",
    name: "Value session",
    meeting_duration_minutes: 45,
    sort_order: 1,
  },
  {
    slug: "follow-up",
    name: "Follow-up",
    meeting_duration_minutes: 30,
    sort_order: 2,
  },
  {
    slug: "coaching",
    name: "Coaching session",
    meeting_duration_minutes: 90,
    sort_order: 3,
  },
  {
    slug: "onboarding",
    name: "Onboarding",
    meeting_duration_minutes: 120,
    sort_order: 4,
  },
] as const;

export type CoachCalendarRow = {
  id: string;
  coach_id: string;
  slug: string;
  name: string;
  description: string | null;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_window_days: number;
  is_enabled: boolean;
  is_public: boolean;
  location_mode: "google_meet" | "phone" | "custom";
  location_phone: string | null;
  location_custom: string | null;
  sort_order: number;
};

export type CoachCalendarPatch = Partial<{
  name: string;
  description: string | null;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_window_days: number;
  is_enabled: boolean;
  is_public: boolean;
  location_mode: "google_meet" | "phone" | "custom";
  location_phone: string | null;
  location_custom: string | null;
  sort_order: number;
  slug: string;
}>;

export function mapCoachCalendarRow(
  row: Record<string, unknown>
): CoachCalendarRow {
  const modeRaw =
    typeof row.location_mode === "string" ? row.location_mode.trim() : "";
  const location_mode =
    modeRaw === "phone" || modeRaw === "custom" || modeRaw === "google_meet"
      ? modeRaw
      : "google_meet";

  return {
    id: String(row.id),
    coach_id: String(row.coach_id),
    slug: String(row.slug),
    name: String(row.name),
    description:
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim()
        : null,
    meeting_duration_minutes:
      typeof row.meeting_duration_minutes === "number"
        ? row.meeting_duration_minutes
        : 15,
    buffer_minutes:
      typeof row.buffer_minutes === "number" ? row.buffer_minutes : 0,
    min_notice_hours:
      typeof row.min_notice_hours === "number" ? row.min_notice_hours : 24,
    booking_window_days:
      typeof row.booking_window_days === "number"
        ? row.booking_window_days
        : 14,
    is_enabled: Boolean(row.is_enabled),
    is_public: Boolean(row.is_public),
    location_mode,
    location_phone:
      typeof row.location_phone === "string" && row.location_phone.trim()
        ? row.location_phone.trim()
        : null,
    location_custom:
      typeof row.location_custom === "string" && row.location_custom.trim()
        ? row.location_custom.trim()
        : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  };
}

/** Settings shape used by slot engine — built from calendar + coach timezone. */
export function calendarToBookingSettings(
  calendar: CoachCalendarRow,
  timezone: string
): {
  timezone: string;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_window_days: number;
  is_enabled: boolean;
  title: string;
  location_mode: "google_meet" | "phone" | "custom";
  location_phone: string | null;
  location_custom: string | null;
} {
  return {
    timezone,
    meeting_duration_minutes: calendar.meeting_duration_minutes,
    buffer_minutes: calendar.buffer_minutes,
    min_notice_hours: calendar.min_notice_hours,
    booking_window_days: calendar.booking_window_days,
    is_enabled: calendar.is_enabled,
    title: calendar.name,
    location_mode: calendar.location_mode,
    location_phone: calendar.location_phone,
    location_custom: calendar.location_custom,
  };
}
