import { supabaseClient } from "@/lib/supabaseClient";
import { DateTime } from "luxon";
import {
  communityCalendarOccurrenceKey,
  communityCalendarExceptionOccurrenceStart,
  isRecurringCommunityCalendarEvent,
} from "@/lib/communityCalendarTypes";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";

export const COMMUNITY_CALENDAR_EVENT_SELECT =
  "id, created_by, title, description, cover_image_url, starts_at, ends_at, display_timezone, location_kind, location_url, recording_link_url, recording_video_url, is_recurring, recurrence, access_tags, created_at, updated_at";

export const COMMUNITY_CALENDAR_EXCEPTION_SELECT =
  "id, event_id, occurrence_start, cancelled_at, cancellation_reason, recording_link_url, recording_video_url, rescheduled_starts_at, rescheduled_ends_at, omit_from_calendar, created_at";

export type CommunityCalendarData = {
  events: CommunityCalendarEventRow[];
  exceptions: CommunityCalendarEventExceptionRow[];
};

export function mergeCommunityCalendarOccurrenceState(
  occurrence: CommunityCalendarOccurrence,
  event: CommunityCalendarEventRow,
  exception: CommunityCalendarEventExceptionRow | undefined
): CommunityCalendarOccurrence {
  const recurring = isRecurringCommunityCalendarEvent(event);
  const ex =
    exception &&
    communityCalendarOccurrenceKey(exception.event_id, exception.occurrence_start) ===
      communityCalendarOccurrenceKey(
        occurrence.eventId,
        communityCalendarExceptionOccurrenceStart(occurrence)
      )
      ? exception
      : undefined;

  return {
    ...occurrence,
    isCancelled: Boolean(ex?.cancelled_at),
    cancellationReason: ex?.cancellation_reason ?? null,
    recording_link_url: recurring
      ? (ex?.recording_link_url ?? null)
      : (ex?.recording_link_url ?? event.recording_link_url),
    recording_video_url: recurring
      ? (ex?.recording_video_url ?? null)
      : (ex?.recording_video_url ?? event.recording_video_url),
  };
}

export async function loadCommunityCalendarData(): Promise<CommunityCalendarData> {
  const [eventsResult, exceptionsResult] = await Promise.all([
    supabaseClient
      .from("community_calendar_events")
      .select(COMMUNITY_CALENDAR_EVENT_SELECT)
      .order("starts_at", { ascending: true }),
    supabaseClient
      .from("community_calendar_event_exceptions")
      .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;

  return {
    events: (eventsResult.data ?? []) as CommunityCalendarEventRow[],
    exceptions: (exceptionsResult.data ??
      []) as CommunityCalendarEventExceptionRow[],
  };
}

export async function cancelCommunityCalendarOccurrence(
  eventId: string,
  occurrenceStartIso: string,
  cancellationReason?: string | null
): Promise<void> {
  const normalized = DateTime.fromISO(occurrenceStartIso, {
    zone: "utc",
  }).toISO();
  if (!normalized) throw new Error("Invalid occurrence start time");

  const reason = cancellationReason?.trim() || null;

  const { data: existing, error: readError } = await supabaseClient
    .from("community_calendar_event_exceptions")
    .select("recording_link_url, recording_video_url")
    .eq("event_id", eventId)
    .eq("occurrence_start", normalized)
    .maybeSingle();

  if (readError) throw readError;

  const { error } = await supabaseClient
    .from("community_calendar_event_exceptions")
    .upsert(
      {
        event_id: eventId,
        occurrence_start: normalized,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        recording_link_url:
          (existing as { recording_link_url?: string | null } | null)
            ?.recording_link_url ?? null,
        recording_video_url:
          (existing as { recording_video_url?: string | null } | null)
            ?.recording_video_url ?? null,
      },
      { onConflict: "event_id,occurrence_start" }
    );
  if (error) throw error;
}

export async function updateCommunityCalendarCancellationReason(
  eventId: string,
  occurrenceStartIso: string,
  cancellationReason: string | null
): Promise<void> {
  const normalized = DateTime.fromISO(occurrenceStartIso, {
    zone: "utc",
  }).toISO();
  if (!normalized) throw new Error("Invalid occurrence start time");

  const { error } = await supabaseClient
    .from("community_calendar_event_exceptions")
    .update({
      cancellation_reason: cancellationReason?.trim() || null,
    })
    .eq("event_id", eventId)
    .eq("occurrence_start", normalized);
  if (error) throw error;
}

export async function saveCommunityCalendarOccurrenceRecording(
  eventId: string,
  occurrenceStartIso: string,
  recording: {
    recording_link_url: string | null;
    recording_video_url?: string | null;
  }
): Promise<void> {
  const normalized = DateTime.fromISO(occurrenceStartIso, {
    zone: "utc",
  }).toISO();
  if (!normalized) throw new Error("Invalid occurrence start time");

  const { data: existing, error: readError } = await supabaseClient
    .from("community_calendar_event_exceptions")
    .select(
      "id, cancellation_reason, recording_link_url, recording_video_url"
    )
    .eq("event_id", eventId)
    .eq("occurrence_start", normalized)
    .maybeSingle();

  if (readError) throw readError;

  const hasCancellation = Boolean(
    (existing as { cancelled_at?: string | null } | null)?.cancelled_at
  );
  const link = recording.recording_link_url;
  const video =
    recording.recording_video_url !== undefined
      ? recording.recording_video_url
      : ((existing as { recording_video_url?: string | null } | null)
          ?.recording_video_url ?? null);

  if (!link && !video && !hasCancellation) {
    const { error: deleteError } = await supabaseClient
      .from("community_calendar_event_exceptions")
      .delete()
      .eq("event_id", eventId)
      .eq("occurrence_start", normalized);
    if (deleteError) throw deleteError;
    return;
  }

  const { error } = await supabaseClient
    .from("community_calendar_event_exceptions")
    .upsert(
      {
        event_id: eventId,
        occurrence_start: normalized,
        cancelled_at:
          (existing as { cancelled_at?: string | null } | null)?.cancelled_at ??
          null,
        cancellation_reason:
          (existing as { cancellation_reason?: string | null } | null)
            ?.cancellation_reason ?? null,
        recording_link_url: link,
        recording_video_url: video,
      },
      { onConflict: "event_id,occurrence_start" }
    );
  if (error) throw error;
}

export async function deleteCommunityCalendarEventSeries(
  eventId: string
): Promise<void> {
  const { error } = await supabaseClient
    .from("community_calendar_events")
    .delete()
    .eq("id", eventId);
  if (error) throw error;
}
