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

/**
 * Mon/Thu schedule: allow a recording that starts well before or after the
 * scheduled slot so time drift (e.g. 1pm calendar vs 4pm actual) still attaches.
 */
const MATCH_BEFORE_START_MS = 8 * 60 * 60 * 1000;
const MATCH_AFTER_END_MS = 8 * 60 * 60 * 1000;
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
  /** When Momentum's recording was also copied onto same-day Win The Week. */
  mirroredToEventId?: string;
  mirroredToEventTitle?: string;
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

function isMonthlyMomentumTitle(title: string): boolean {
  return /monthly\s+momentum/i.test(title);
}

function isWinTheWeekTitle(title: string): boolean {
  return /win\s+the\s+week/i.test(title);
}

function occurrenceLocalDayKey(occurrence: CommunityCalendarOccurrence): string | null {
  const zone = occurrence.display_timezone?.trim() || "UTC";
  return DateTime.fromISO(occurrence.startsAtIso, { zone: "utc" })
    .setZone(zone)
    .toISODate();
}

function sameOccurrenceLocalDay(
  a: CommunityCalendarOccurrence,
  b: CommunityCalendarOccurrence
): boolean {
  const aKey = occurrenceLocalDayKey(a);
  const bKey = occurrenceLocalDayKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

/**
 * On first Mondays, Monthly Momentum and Win The Week often share one continuous
 * Zoom recording. We copy Momentum's link onto WTW; if a second recording later
 * arrives, treat that mirrored WTW link as replaceable.
 */
function isMirroredWinTheWeekLink(
  winTheWeek: CommunityCalendarOccurrence,
  sameDayOccurrences: CommunityCalendarOccurrence[]
): boolean {
  if (!isWinTheWeekTitle(winTheWeek.title)) return false;
  const wtwUrl = winTheWeek.recording_link_url?.trim();
  if (!wtwUrl) return false;
  return sameDayOccurrences.some(
    (other) =>
      isMonthlyMomentumTitle(other.title) &&
      other.recording_link_url?.trim() === wtwUrl
  );
}

function sameLocalCalendarDay(
  meetingStartMs: number,
  occurrence: CommunityCalendarOccurrence
): boolean {
  const zone = occurrence.display_timezone?.trim() || "UTC";
  const meetingLocal = DateTime.fromMillis(meetingStartMs, { zone: "utc" }).setZone(
    zone
  );
  const occurrenceLocal = DateTime.fromISO(occurrence.startsAtIso, {
    zone: "utc",
  }).setZone(zone);
  if (!meetingLocal.isValid || !occurrenceLocal.isValid) return false;
  return meetingLocal.hasSame(occurrenceLocal, "day");
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
  const sameDay = sameLocalCalendarDay(meetingStartMs, occurrence);

  const locationMeetingId = occurrence.location_url
    ? extractZoomMeetingIdFromUrl(occurrence.location_url)
    : null;
  const meetingIdMatch =
    Boolean(meetingId) &&
    Boolean(locationMeetingId) &&
    meetingId === locationMeetingId;

  // Accept: Zoom meeting ID match, ±8h of the slot, or same local calendar day.
  if (!inTimeWindow && !sameDay && !meetingIdMatch) return null;

  let score = 0;
  if (meetingIdMatch) score += 1000;
  if (sameDay) score += 200;
  if (inTimeWindow) {
    const midpoint = (startsAtMs + endsAtMs) / 2;
    const distance = Math.abs(meetingStartMs - midpoint);
    score += Math.max(0, 500 - distance / 60_000);
  }
  return score;
}

/**
 * When several same-day calls match (e.g. first-Monday Monthly Momentum then
 * Win The Week), assign recordings in chronological event order: the earliest
 * occurrence still missing a recording gets the next webhook.
 */
function pickAmongSameDayCandidates(
  candidates: ScoredOccurrence[],
  meetingStartMs: number
): ScoredOccurrence | { ambiguous: ScoredOccurrence[] } | null {
  const sameDayOccs = candidates.map((c) => c.occurrence);
  const open = candidates.filter(
    (c) =>
      !occurrenceHasRecording(c.occurrence) ||
      isMirroredWinTheWeekLink(c.occurrence, sameDayOccs)
  );
  const pool = open.length > 0 ? open : candidates;

  const byDay = new Map<string, ScoredOccurrence[]>();
  for (const entry of pool) {
    const dayKey = occurrenceLocalDayKey(entry.occurrence);
    if (!dayKey) continue;
    const list = byDay.get(dayKey) ?? [];
    list.push(entry);
    byDay.set(dayKey, list);
  }

  const meetingDayKeys = [...byDay.keys()].filter((dayKey) => {
    const sample = byDay.get(dayKey)?.[0];
    if (!sample) return false;
    return sameLocalCalendarDay(meetingStartMs, sample.occurrence);
  });

  if (meetingDayKeys.length === 1) {
    const sameDay = byDay.get(meetingDayKeys[0]) ?? [];
    if (sameDay.length >= 1) {
      sameDay.sort(
        (a, b) =>
          Date.parse(a.occurrence.startsAtIso) -
          Date.parse(b.occurrence.startsAtIso)
      );
      return sameDay[0];
    }
  }

  pool.sort((a, b) => b.score - a.score);
  const best = pool[0];
  const second = pool[1];
  if (!best) return null;
  if (second && best.score - second.score < 50) {
    return { ambiguous: pool.slice(0, 3) };
  }
  return best;
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

  return pickAmongSameDayCandidates(scored, meetingStartMs);
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
  const sameDayOccs = occurrences.filter((other) =>
    sameOccurrenceLocalDay(other, occurrence)
  );
  const existingLink = occurrence.recording_link_url?.trim();
  const canReplaceMirroredWinTheWeek =
    Boolean(existingLink) &&
    existingLink !== recording.shareUrl &&
    isMirroredWinTheWeekLink(occurrence, sameDayOccs);

  if (occurrenceHasRecording(occurrence) && !canReplaceMirroredWinTheWeek) {
    if (existingLink === recording.shareUrl) {
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

  let mirroredToEventId: string | undefined;
  let mirroredToEventTitle: string | undefined;

  // First-Monday combined session: one Zoom recording covers Momentum + WTW.
  // Copy the link onto Win The Week when that slot is still empty.
  if (isMonthlyMomentumTitle(occurrence.title)) {
    const winTheWeekOcc = sameDayOccs.find(
      (other) =>
        isWinTheWeekTitle(other.title) &&
        !other.isCancelled &&
        !occurrenceHasRecording(other)
    );
    if (winTheWeekOcc) {
      const winTheWeekEvent = events.find((e) => e.id === winTheWeekOcc.eventId);
      if (winTheWeekEvent) {
        await attachRecordingToOccurrence(
          supabase,
          winTheWeekOcc,
          winTheWeekEvent,
          recording.shareUrl
        );
        mirroredToEventId = winTheWeekOcc.eventId;
        mirroredToEventTitle = winTheWeekOcc.title;
      }
    }
  }

  return {
    status: "attached",
    eventId: occurrence.eventId,
    occurrenceStartIso: occurrenceStart,
    eventTitle: occurrence.title,
    mirroredToEventId,
    mirroredToEventTitle,
  };
}
