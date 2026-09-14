import { unipileFetch, type UnipileResult } from "@/lib/unipile/client";

export type UnipileCalendar = {
  object?: "Calendar";
  id: string;
  name: string;
  description?: string;
  is_read_only: boolean;
  is_owned_by_user: boolean;
  is_default?: boolean;
  is_primary?: boolean;
  access_role?: "owner" | "writer" | "reader" | "freeBusyReader";
  background_color?: string;
};

export type UnipileCalendarEventTime =
  | { date_time: string; time_zone: string }
  | { date: string };

export type UnipileCalendarEvent = {
  object?: "CalendarEvent";
  id: string;
  calendar_id: string;
  title: string;
  body?: string;
  location?: string;
  is_cancelled: boolean;
  is_all_day: boolean;
  start: UnipileCalendarEventTime;
  end: UnipileCalendarEventTime;
  transparency?: "opaque" | "transparent";
  conference?: {
    provider?: "google_meet" | "zoom" | "teams" | "unknown";
    conference_id?: string;
    url?: string;
  };
};

type Paginated<T> = {
  data?: T[];
  next_cursor?: string | null;
};

export type UnipileCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
};

const MAX_PAGES = 20;

function unipileErrorType(result: UnipileResult<unknown>): string | null {
  const raw = result.raw as { type?: string } | null;
  return typeof raw?.type === "string" ? raw.type : null;
}

export function isUnipileCalendarFeatureError(
  result: UnipileResult<unknown>
): boolean {
  const type = unipileErrorType(result) ?? "";
  const blob = `${result.error ?? ""} ${type}`.toLowerCase();
  return (
    type === "errors/disconnected_feature" ||
    type === "errors/feature_not_subscribed" ||
    type === "errors/insufficient_privileges" ||
    type === "errors/invalid_credentials" ||
    type === "errors/expired_credentials" ||
    blob.includes("disconnected_feature") ||
    blob.includes("feature_not_subscribed") ||
    blob.includes("invalid_credentials") ||
    blob.includes("expired_credentials")
  );
}

export function calendarFeatureErrorMessage(
  result: UnipileResult<unknown>
): string {
  const type = unipileErrorType(result) ?? "";
  if (type === "errors/feature_not_subscribed") {
    return "Unipile Calendar isn’t on this workspace plan, so busy times and meeting links can’t load yet.";
  }
  if (
    type === "errors/disconnected_feature" ||
    type === "errors/insufficient_privileges" ||
    type === "errors/invalid_credentials" ||
    type === "errors/expired_credentials"
  ) {
    return "This Google/Outlook connection doesn’t have calendar access. Disconnect and connect again, then approve Calendar.";
  }
  return result.error || "Could not load calendars.";
}

function calendarPath(calendarId: string, suffix = ""): string {
  return `/api/v1/calendars/${encodeURIComponent(calendarId)}${suffix}`;
}

export async function listUnipileCalendars(
  accountId: string
): Promise<UnipileResult<UnipileCalendar[]>> {
  const items: UnipileCalendar[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({
      account_id: accountId,
      limit: "50",
    });
    if (cursor) qs.set("cursor", cursor);
    const result = await unipileFetch<Paginated<UnipileCalendar>>(
      "GET",
      `/api/v1/calendars?${qs.toString()}`
    );
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        error: result.error,
        raw: result.raw,
      };
    }
    items.push(...(result.data?.data ?? []));
    const next = result.data?.next_cursor?.trim();
    if (!next) {
      return { ok: true, status: result.status, data: items, raw: result.raw };
    }
    cursor = next;
  }
  return { ok: true, status: 200, data: items };
}

export function mapUnipileCalendarsToListItems(
  calendars: UnipileCalendar[]
): UnipileCalendarListItem[] {
  return calendars.map((cal) => ({
    id: cal.id,
    summary: cal.name || cal.id,
    primary: Boolean(cal.is_primary || cal.is_default),
    accessRole:
      cal.access_role ??
      (cal.is_owned_by_user
        ? "owner"
        : cal.is_read_only
          ? "reader"
          : "writer"),
  }));
}

export function pickDefaultUnipileCalendar(
  calendars: UnipileCalendar[]
): UnipileCalendar | null {
  const writable = calendars.filter(
    (cal) =>
      !cal.is_read_only &&
      cal.access_role !== "reader" &&
      cal.access_role !== "freeBusyReader"
  );
  const pool = writable.length ? writable : calendars;
  return (
    pool.find((cal) => cal.is_primary) ??
    pool.find((cal) => cal.is_default) ??
    pool.find((cal) => cal.is_owned_by_user) ??
    pool[0] ??
    null
  );
}

export async function listUnipileCalendarEvents(input: {
  accountId: string;
  calendarId: string;
  start: string;
  end: string;
  busy?: boolean;
  expandRecurring?: boolean;
}): Promise<UnipileResult<UnipileCalendarEvent[]>> {
  const items: UnipileCalendarEvent[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({
      account_id: input.accountId,
      start: input.start,
      end: input.end,
      is_cancelled: "false",
      limit: "100",
    });
    if (input.busy) qs.set("busy", "true");
    if (input.expandRecurring !== false) qs.set("expand_recurring", "true");
    if (cursor) qs.set("cursor", cursor);
    const result = await unipileFetch<Paginated<UnipileCalendarEvent>>(
      "GET",
      `${calendarPath(input.calendarId, "/events")}?${qs.toString()}`
    );
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        error: result.error,
        raw: result.raw,
      };
    }
    items.push(...(result.data?.data ?? []));
    const next = result.data?.next_cursor?.trim();
    if (!next) {
      return { ok: true, status: result.status, data: items, raw: result.raw };
    }
    cursor = next;
  }
  return { ok: true, status: 200, data: items };
}

export async function createUnipileCalendarEvent(input: {
  accountId: string;
  calendarId: string;
  title: string;
  body?: string;
  location?: string;
  start: { date_time: string; time_zone: string };
  end: { date_time: string; time_zone: string };
  attendees: { email: string }[];
  notify?: boolean;
  transparency?: "opaque" | "transparent";
  conference?: { provider: "google_meet" | "teams" };
}): Promise<UnipileResult<{ object?: string; event_id: string }>> {
  const qs = new URLSearchParams({ account_id: input.accountId });
  const body: Record<string, unknown> = {
    title: input.title,
    attendees: input.attendees,
    start: input.start,
    end: input.end,
    notify: input.notify !== false,
    transparency: input.transparency ?? "opaque",
    guests_can_modify: false,
  };
  if (input.body) body.body = input.body;
  if (input.location) body.location = input.location;
  if (input.conference) body.conference = { provider: input.conference.provider };
  return unipileFetch<{ object?: string; event_id: string }>(
    "POST",
    `${calendarPath(input.calendarId, "/events")}?${qs.toString()}`,
    body
  );
}

export async function getUnipileCalendarEvent(input: {
  accountId: string;
  calendarId: string;
  eventId: string;
}): Promise<UnipileResult<UnipileCalendarEvent>> {
  const qs = new URLSearchParams({ account_id: input.accountId });
  return unipileFetch<UnipileCalendarEvent>(
    "GET",
    `${calendarPath(input.calendarId, `/events/${encodeURIComponent(input.eventId)}`)}?${qs.toString()}`
  );
}

export async function patchUnipileCalendarEvent(input: {
  accountId: string;
  calendarId: string;
  eventId: string;
  body?: string;
  location?: string;
}): Promise<UnipileResult<UnipileCalendarEvent>> {
  const qs = new URLSearchParams({ account_id: input.accountId });
  const patch: Record<string, unknown> = {};
  if (input.body != null) patch.body = input.body;
  if (input.location != null) patch.location = input.location;
  return unipileFetch<UnipileCalendarEvent>(
    "PATCH",
    `${calendarPath(input.calendarId, `/events/${encodeURIComponent(input.eventId)}`)}?${qs.toString()}`,
    patch
  );
}

export function eventTimeToIso(time: UnipileCalendarEventTime): string | null {
  if ("date_time" in time && time.date_time) return time.date_time;
  if ("date" in time && time.date) return `${time.date}T00:00:00.000Z`;
  return null;
}
