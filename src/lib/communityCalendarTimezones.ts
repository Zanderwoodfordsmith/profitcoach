/** Curated IANA zones for dropdowns (full list is huge). */
export const COMMUNITY_CALENDAR_TIMEZONES: readonly string[] = [
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Denver",
  "America/Caracas",
  "America/Buenos_Aires",
  "Atlantic/Reykjavik",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
] as const;

export function defaultCommunityCalendarTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}
