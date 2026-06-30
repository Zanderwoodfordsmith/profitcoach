import { DateTime } from "luxon";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COMMUNITY_CALENDAR_EVENT_SELECT,
  COMMUNITY_CALENDAR_EXCEPTION_SELECT,
} from "@/lib/communityCalendarData";
import { expandCommunityCalendar } from "@/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import {
  communityCalendarExceptionOccurrenceStart,
  isRecurringCommunityCalendarEvent,
} from "@/lib/communityCalendarTypes";
import {
  extractZoomMeetingIdFromUrl,
  type ParsedZoomRecordingCompleted,
} from "@/lib/zoomWebhook";

/** Allow meetings that start slightly early. */
const MATCH_BEFORE_START_MS = 15 * 60 * 1000;
/** Recordings often finish after the scheduled end time. */
const MATCH_AFTER_END_MS = 60 * 60 * 1000;
const MATCH_SCAN_BUFFER_DAYS = 2;

export type ZoomRecordingCalendarMatchStatus =
  | "attached"
  | "already_set"
  | "unmatched"
  | "ambiguous";

export type ZoomRecordingCalendarMatchResult = {
  status: ZoomRecordingCalendarMatchStatus;
  eventId?: string;
  occurrenceStartIso?: string;
  eventTitle?: string;
  reason?: string;
};

type ScoredOccurrence = {
  occurrence: CommunityCalendarOccurrence;
  event: CommunityCalendarEventRow;
  score: number;
};

function occurrenceHasRecording(occurrence: CommunityCalendarOccurrence): boolean {
  return Boolean(
    occurrence.recording_link_url?.trim() || occurrence.recording_video_url?.trim()
  );
}

function scoreOccurrenceMatch(
  occurrence: CommunityCalendarOccurrence,
  meetingStartMs: number,
  meetingId: string | null
): number | null {
  const startsAtMs = Date.parse(occurrence.startsAtIso);
  const endsAtMs = Date.parse(occurrence.endsAtIso);
  if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs)) return null;

  const windowStart = startsAtMs - MATCH_BEFORE_START_MS;
  const windowEnd = endsAtMs + MATCH_AFTER_END_MS;
  const inTimeWindow =
    meetingStartMs >= windowStart && meetingStartMs <= windowEnd;

  const locationMeetingId = occurrence.location_url
    ? extractZoomMeetingIdFromUrl(occurrence.location_url)
    : null;
  const meetingIdMatch =
    Boolean(meetingId) &&
    Boolean(locationMeetingId) &&
    meetingId === locationMeetingId;

  if (!inTimeWindow && !meetingIdMatch) return null;

  let score = 0;
  if (meetingIdMatch) score += 1000;
  if (inTimeWindow) {
    const midpoint = (startsAtMs + endsAtMs) / 2;
    const distance = Math.abs(meetingStartMs - midpoint);
    score += Math.max(0, 500 - distance / 60_000);
  }
  return score;
}

export function findBestCalendarOccurrenceForZoomRecording(
  events: CommunityCalendarEventRow[],
  occurrences: CommunityCalendarOccurrence[],
  recording: Pick<
    ParsedZoomRecordingCompleted,
    "meetingId" | "startTimeIso"
  >
): ScoredOccurrence | { ambiguous: ScoredOccurrence[] } | null {
  const meetingStartMs = Date.parse(recording.startTimeIso);
  if (Number.isNaN(meetingStartMs)) return null;

  const eventById = new Map(events.map((event) => [event.id, event]));
  const scored: ScoredOccurrence[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.isCancelled) continue;
    const event = eventById.get(occurrence.eventId);
    if (!event) continue;

    const score = scoreOccurrenceMatch(
      occurrence,
      meetingStartMs,
      recording.meetingId
    );
    if (score == null) continue;
    scored.push({ occurrence, event, score });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];

  if (second && best.score - second.score < 50) {
    return { ambiguous: scored.slice(0, 3) };
  }

  return best;
}

async function attachRecordingToOccurrence(
  supabase: SupabaseClient,
  occurrence: CommunityCalendarOccurrence,
  event: CommunityCalendarEventRow,
  shareUrl: string
): Promise<void> {
  const recurring = isRecurringCommunityCalendarEvent(event);
  if (recurring) {
    const occurrenceStart = communityCalendarExceptionOccurrenceStart(occurrence);
    const normalized = DateTime.fromISO(occurrenceStart, {
      zone: "utc",
    }).toISO();
    if (!normalized) throw new Error("Invalid occurrence start time");

    const { data: existing, error: readError } = await supabase
      .from("community_calendar_event_exceptions")
      .select(
        "cancelled_at, cancellation_reason, recording_link_url, recording_video_url"
      )
      .eq("event_id", occurrence.eventId)
      .eq("occurrence_start", normalized)
      .maybeSingle();

    if (readError) throw readError;

    const { error } = await supabase
      .from("community_calendar_event_exceptions")
      .upsert(
        {
          event_id: occurrence.eventId,
          occurrence_start: normalized,
          cancelled_at:
            (existing as { cancelled_at?: string | null } | null)?.cancelled_at ??
            null,
          cancellation_reason:
            (existing as { cancellation_reason?: string | null } | null)
              ?.cancellation_reason ?? null,
          recording_link_url: shareUrl,
          recording_video_url:
            (existing as { recording_video_url?: string | null } | null)
              ?.recording_video_url ?? null,
        },
        { onConflict: "event_id,occurrence_start" }
      );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("community_calendar_events")
    .update({ recording_link_url: shareUrl })
    .eq("id", occurrence.eventId);
  if (error) throw error;
}

export async function attachZoomRecordingToCommunityCalendar(
  supabase: SupabaseClient,
  recording: ParsedZoomRecordingCompleted
): Promise<ZoomRecordingCalendarMatchResult> {
  const meetingStart = DateTime.fromISO(recording.startTimeIso, { zone: "utc" });
  if (!meetingStart.isValid) {
    return { status: "unmatched", reason: "Invalid recording start time." };
  }

  const rangeStart = meetingStart.minus({ days: MATCH_SCAN_BUFFER_DAYS });
  const rangeEnd = meetingStart.plus({ days: MATCH_SCAN_BUFFER_DAYS });

  const [eventsResult, exceptionsResult] = await Promise.all([
    supabase
      .from("community_calendar_events")
      .select(COMMUNITY_CALENDAR_EVENT_SELECT)
      .order("starts_at", { ascending: true }),
    supabase
      .from("community_calendar_event_exceptions")
      .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;

  const events = (eventsResult.data ?? []) as CommunityCalendarEventRow[];
  const occurrences = expandCommunityCalendar(
    events,
    rangeStart,
    rangeEnd,
    exceptionsResult.data ?? []
  );

  const match = findBestCalendarOccurrenceForZoomRecording(
    events,
    occurrences,
    recording
  );

  if (!match) {
    return {
      status: "unmatched",
      reason: "No community calendar occurrence matched this recording.",
    };
  }

  if ("ambiguous" in match) {
    const titles = match.ambiguous
      .map((entry) => entry.occurrence.title)
      .join(", ");
    return {
      status: "ambiguous",
      reason: `Multiple calendar occurrences matched: ${titles}`,
    };
  }

  const { occurrence, event } = match;
  const occurrenceStart = communityCalendarExceptionOccurrenceStart(occurrence);

  if (occurrenceHasRecording(occurrence)) {
    const existing = occurrence.recording_link_url?.trim();
    if (existing === recording.shareUrl) {
      return {
        status: "already_set",
        eventId: occurrence.eventId,
        occurrenceStartIso: occurrenceStart,
        eventTitle: occurrence.title,
        reason: "Recording link already matches.",
      };
    }
    return {
      status: "already_set",
      eventId: occurrence.eventId,
      occurrenceStartIso: occurrenceStart,
      eventTitle: occurrence.title,
      reason: "Calendar occurrence already has a recording link.",
    };
  }

  await attachRecordingToOccurrence(supabase, occurrence, event, recording.shareUrl);

  return {
    status: "attached",
    eventId: occurrence.eventId,
    occurrenceStartIso: occurrenceStart,
    eventTitle: occurrence.title,
  };
}
