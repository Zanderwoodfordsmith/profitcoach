export const MEETING_LOCATION_MODES = [
  "google_meet",
  "zoom",
  "phone",
  "custom",
] as const;

export type MeetingLocationMode = (typeof MEETING_LOCATION_MODES)[number];

export function isMeetingLocationMode(
  value: string | null | undefined
): value is MeetingLocationMode {
  return (
    value === "google_meet" ||
    value === "zoom" ||
    value === "phone" ||
    value === "custom"
  );
}

export function parseMeetingLocationMode(
  value: unknown,
  fallback: MeetingLocationMode = "google_meet"
): MeetingLocationMode {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return isMeetingLocationMode(trimmed) ? trimmed : fallback;
}
