import { DateTime } from "luxon";

/** support@ personal meeting room used for all community calls (`/calls`). */
export const COMMUNITY_ZOOM_RECORDING_MEETING_ID = "7981269644";

export const COMMUNITY_ZOOM_RECORDING_TIMEZONE = "Europe/London";

/**
 * Meeting start must fall in this London window.
 * Covers Monthly Momentum (~15:30) and Win The Week / Profit Coach Training (16:00),
 * with a little room for starting early or a few minutes late.
 */
export const COMMUNITY_ZOOM_RECORDING_START_MINUTES = {
  min: 14 * 60 + 45, // 14:45
  max: 17 * 60, // 17:00
} as const;

/** Skip tiny accidental recordings and all-day leftover meetings when Zoom sends duration. */
export const COMMUNITY_ZOOM_RECORDING_MIN_DURATION_MINUTES = 15;
export const COMMUNITY_ZOOM_RECORDING_MAX_DURATION_MINUTES = 180;

export type CommunityZoomRecordingIngestInput = {
  meetingId: string | null;
  startTimeIso: string;
  durationMinutes: number | null;
};

export type CommunityZoomRecordingIngestResult =
  | { ok: true }
  | { ok: false; reason: string };

function normalizeMeetingId(value: string): string {
  return value.replace(/\D/g, "");
}

function csvValues(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** support@ PMI plus optional comma-separated ZOOM_RECORDING_MEETING_IDS. */
export function communityZoomRecordingAllowedMeetingIds(
  extraCsv?: string
): Set<string> {
  const extra = csvValues(
    extraCsv ?? process.env.ZOOM_RECORDING_MEETING_IDS ?? ""
  ).map(normalizeMeetingId);
  return new Set(
    [COMMUNITY_ZOOM_RECORDING_MEETING_ID, ...extra].filter(Boolean)
  );
}

export function evaluateCommunityZoomRecordingIngest(
  input: CommunityZoomRecordingIngestInput,
  options?: { allowedMeetingIds?: Set<string> }
): CommunityZoomRecordingIngestResult {
  const meetingId = input.meetingId ? normalizeMeetingId(input.meetingId) : "";
  const allowedMeetingIds =
    options?.allowedMeetingIds ?? communityZoomRecordingAllowedMeetingIds();
  if (!meetingId || !allowedMeetingIds.has(meetingId)) {
    return { ok: false, reason: "meeting_not_allowed" };
  }

  const start = DateTime.fromISO(input.startTimeIso, { zone: "utc" }).setZone(
    COMMUNITY_ZOOM_RECORDING_TIMEZONE
  );
  if (!start.isValid) {
    return { ok: false, reason: "invalid_start_time" };
  }

  const minutes = start.hour * 60 + start.minute;
  if (
    minutes < COMMUNITY_ZOOM_RECORDING_START_MINUTES.min ||
    minutes > COMMUNITY_ZOOM_RECORDING_START_MINUTES.max
  ) {
    return { ok: false, reason: "outside_call_window" };
  }

  if (input.durationMinutes != null) {
    if (
      input.durationMinutes < COMMUNITY_ZOOM_RECORDING_MIN_DURATION_MINUTES ||
      input.durationMinutes > COMMUNITY_ZOOM_RECORDING_MAX_DURATION_MINUTES
    ) {
      return { ok: false, reason: "duration_out_of_range" };
    }
  }

  return { ok: true };
}
