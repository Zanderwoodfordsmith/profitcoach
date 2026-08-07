import { DateTime } from "luxon";

import {
  coachHasFeature,
  resolveCoachAccessForUserId,
  type CoachAccessSnapshot,
} from "@/lib/coachAccess/resolveCoachAccess";
import { calendarEventLockedForTier } from "@/lib/coachAccess/tiers";
import { expandCommunityCalendar } from "@/lib/communityCalendarExpand";
import {
  COMMUNITY_CALENDAR_EVENT_SELECT,
  COMMUNITY_CALENDAR_EXCEPTION_SELECT,
} from "@/lib/communityCalendarData";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
  CommunityCalendarOccurrence,
} from "@/lib/communityCalendarTypes";
import { httpsFeedToWebcal } from "@/lib/communityCalendarIcs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** How far back/forward the subscribe feed expands recurring series. */
const FEED_PAST_MONTHS = 1;
const FEED_FUTURE_MONTHS = 18;

export function communityCalendarFeedVisibleEvents(
  events: CommunityCalendarEventRow[],
  access: CoachAccessSnapshot
): CommunityCalendarEventRow[] {
  if (!coachHasFeature(access, "calendar.momentum_only")) {
    return [];
  }
  if (!access.enforcementEnabled) {
    return events;
  }
  return events.filter(
    (event) => !calendarEventLockedForTier(event.access_tags, access.tier)
  );
}

export async function loadCommunityCalendarFeedOccurrencesForUser(
  userId: string
): Promise<{
  access: CoachAccessSnapshot;
  occurrences: CommunityCalendarOccurrence[];
}> {
  const access = await resolveCoachAccessForUserId(userId);
  if (!coachHasFeature(access, "calendar.momentum_only")) {
    return { access, occurrences: [] };
  }

  const [eventsResult, exceptionsResult] = await Promise.all([
    supabaseAdmin
      .from("community_calendar_events")
      .select(COMMUNITY_CALENDAR_EVENT_SELECT)
      .order("starts_at", { ascending: true }),
    supabaseAdmin
      .from("community_calendar_event_exceptions")
      .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (exceptionsResult.error) throw exceptionsResult.error;

  const events = communityCalendarFeedVisibleEvents(
    (eventsResult.data ?? []) as CommunityCalendarEventRow[],
    access
  );
  const exceptions = (exceptionsResult.data ??
    []) as CommunityCalendarEventExceptionRow[];

  const now = DateTime.utc();
  const rangeStart = now.minus({ months: FEED_PAST_MONTHS }).startOf("day");
  const rangeEnd = now.plus({ months: FEED_FUTURE_MONTHS }).endOf("day");

  const occurrences = expandCommunityCalendar(
    events,
    rangeStart,
    rangeEnd,
    exceptions
  ).filter((occurrence) => !occurrence.isCancelled);

  return { access, occurrences };
}

export async function ensureCommunityCalendarFeedToken(
  userId: string
): Promise<string> {
  const { data: existing, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("community_calendar_feed_token")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    if (readError.code === "42703" || readError.code === "PGRST204") {
      throw new Error("CALENDAR_FEED_TOKEN_MIGRATION_REQUIRED");
    }
    throw readError;
  }

  const token =
    (existing?.community_calendar_feed_token as string | null)?.trim() ?? "";
  if (token) return token;

  const nextToken = crypto.randomUUID();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ community_calendar_feed_token: nextToken })
    .eq("id", userId)
    .select("community_calendar_feed_token")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "42703" || updateError.code === "PGRST204") {
      throw new Error("CALENDAR_FEED_TOKEN_MIGRATION_REQUIRED");
    }
    throw updateError;
  }

  const saved =
    (updated?.community_calendar_feed_token as string | null)?.trim() ?? "";
  if (!saved) {
    throw new Error("Could not create calendar feed token.");
  }
  return saved;
}

export async function resolveCommunityCalendarFeedUserId(
  token: string
): Promise<string | null> {
  const normalized = token.trim().toLowerCase().replace(/\.ics$/i, "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized
    )
  ) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("community_calendar_feed_token", normalized)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      throw new Error("CALENDAR_FEED_TOKEN_MIGRATION_REQUIRED");
    }
    throw error;
  }

  if (!data?.id) return null;
  if (data.role !== "coach" && data.role !== "admin") return null;
  return data.id as string;
}

export function buildCommunityCalendarFeedUrls(
  token: string,
  baseUrl: string
): {
  httpsUrl: string;
  webcalUrl: string;
} {
  const httpsUrl = `${baseUrl.replace(/\/$/, "")}/api/community/calendar/feed/${token}.ics`;
  return { httpsUrl, webcalUrl: httpsFeedToWebcal(httpsUrl) };
}
