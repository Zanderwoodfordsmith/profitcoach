import { supabaseClient } from "@/lib/supabaseClient";
import { DateTime } from "luxon";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
} from "@/lib/communityCalendarTypes";

export const COMMUNITY_CALENDAR_EVENT_SELECT =
  "id, created_by, title, description, cover_image_url, starts_at, ends_at, display_timezone, location_kind, location_url, recording_link_url, recording_video_url, is_recurring, recurrence, created_at, updated_at";

export const COMMUNITY_CALENDAR_EXCEPTION_SELECT =
  "id, event_id, occurrence_start, cancellation_reason, created_at";

export type CommunityCalendarData = {
  events: CommunityCalendarEventRow[];
  exceptions: CommunityCalendarEventExceptionRow[];
};

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

  const { error } = await supabaseClient
    .from("community_calendar_event_exceptions")
    .upsert(
      {
        event_id: eventId,
        occurrence_start: normalized,
        cancellation_reason: reason,
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

export async function deleteCommunityCalendarEventSeries(
  eventId: string
): Promise<void> {
  const { error } = await supabaseClient
    .from("community_calendar_events")
    .delete()
    .eq("id", eventId);
  if (error) throw error;
}
