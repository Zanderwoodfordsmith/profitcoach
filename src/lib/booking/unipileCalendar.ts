import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  listOutreachAccounts,
  type OutreachAccountRow,
} from "@/lib/unipile/outreachAccounts";
import {
  calendarFeatureErrorMessage,
  createUnipileCalendarEvent,
  eventTimeToIso,
  getUnipileCalendarEvent,
  isUnipileCalendarFeatureError,
  listUnipileCalendarEvents,
  listUnipileCalendars,
  mapUnipileCalendarsToListItems,
  patchUnipileCalendarEvent,
  pickDefaultUnipileCalendar,
  type UnipileCalendarListItem,
} from "@/lib/unipile/calendars";
import { isUnipileConfigured } from "@/lib/unipile/client";
import { normalizeUnipileProvider } from "@/lib/unipile/providers";

export type BusyInterval = {
  starts_at: string;
  ends_at: string;
  id?: string;
  title?: string;
  all_day?: boolean;
};

export type UnipileCalendarPrefs = {
  coach_id: string;
  unipile_account_id: string;
  busy_calendar_ids: string[];
  event_calendar_id: string;
};

export type CalendarMailingProvider = "GOOGLE" | "OUTLOOK";

export type CoachCalendarStatus = {
  configured: boolean;
  connected: boolean;
  provider: CalendarMailingProvider | null;
  email: string | null;
  outreach_account_id: string | null;
  unipile_account_id: string | null;
  calendars: UnipileCalendarListItem[];
  busy_calendar_ids: string[];
  event_calendar_id: string;
  is_booking_source: boolean;
  calendar_error: string | null;
};

export type CreateBookingEventInput = {
  coachId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  guestEmail: string;
  guestName: string;
  timezone: string;
  locationMode: "google_meet" | "phone" | "custom";
  locationPhone?: string | null;
  locationCustom?: string | null;
};

export type CreateBookingEventResult = {
  eventId: string;
  calendarId: string;
  hangoutLink: string | null;
  htmlLink: string | null;
  location: string | null;
};

type CalendarContext = {
  account: OutreachAccountRow;
  provider: CalendarMailingProvider;
  busyCalendarIds: string[];
  eventCalendarId: string;
};

function asCalendarProvider(
  provider: string | null | undefined
): CalendarMailingProvider | null {
  const p = normalizeUnipileProvider(provider);
  if (p === "GOOGLE" || p === "OUTLOOK") return p;
  return null;
}

export async function listOkCalendarAccounts(
  coachId: string
): Promise<OutreachAccountRow[]> {
  const accounts = await listOutreachAccounts(coachId);
  return accounts.filter((row) => {
    const provider = asCalendarProvider(row.provider);
    return (
      Boolean(provider) &&
      (row.status || "").toUpperCase() === "OK" &&
      Boolean(row.unipile_account_id?.trim())
    );
  });
}

export async function loadUnipileCalendarPrefs(
  coachId: string
): Promise<UnipileCalendarPrefs | null> {
  const { data } = await supabaseAdmin
    .from("coach_unipile_calendar_prefs")
    .select("coach_id, unipile_account_id, busy_calendar_ids, event_calendar_id")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!data?.unipile_account_id) return null;
  return {
    coach_id: data.coach_id as string,
    unipile_account_id: String(data.unipile_account_id),
    busy_calendar_ids: Array.isArray(data.busy_calendar_ids)
      ? (data.busy_calendar_ids as string[])
      : [],
    event_calendar_id:
      typeof data.event_calendar_id === "string"
        ? data.event_calendar_id.trim()
        : "",
  };
}

export async function upsertUnipileCalendarPrefs(input: {
  coachId: string;
  unipileAccountId: string;
  busyCalendarIds: string[];
  eventCalendarId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("coach_unipile_calendar_prefs").upsert(
    {
      coach_id: input.coachId,
      unipile_account_id: input.unipileAccountId,
      busy_calendar_ids: input.busyCalendarIds,
      event_calendar_id: input.eventCalendarId,
    },
    { onConflict: "coach_id" }
  );
  if (error) throw new Error(error.message);
}

export async function deleteUnipileCalendarPrefsForAccount(
  coachId: string,
  unipileAccountId: string
): Promise<void> {
  await supabaseAdmin
    .from("coach_unipile_calendar_prefs")
    .delete()
    .eq("coach_id", coachId)
    .eq("unipile_account_id", unipileAccountId);
}

function pickAccount(
  accounts: OutreachAccountRow[],
  preferredUnipileId?: string | null,
  provider?: CalendarMailingProvider | null
): OutreachAccountRow | null {
  if (provider) {
    return (
      accounts.find((row) => asCalendarProvider(row.provider) === provider) ??
      null
    );
  }
  if (preferredUnipileId) {
    const match = accounts.find(
      (row) => row.unipile_account_id === preferredUnipileId
    );
    if (match) return match;
  }
  return (
    accounts.find((row) => asCalendarProvider(row.provider) === "GOOGLE") ??
    accounts.find((row) => asCalendarProvider(row.provider) === "OUTLOOK") ??
    null
  );
}

async function persistDefaultPrefs(
  coachId: string,
  account: OutreachAccountRow,
  calendars: Awaited<ReturnType<typeof listUnipileCalendars>>["data"]
): Promise<{ busyCalendarIds: string[]; eventCalendarId: string }> {
  const picked = pickDefaultUnipileCalendar(calendars ?? []);
  const eventCalendarId = picked?.id ?? "";
  const busyCalendarIds = eventCalendarId ? [eventCalendarId] : [];
  if (eventCalendarId) {
    await upsertUnipileCalendarPrefs({
      coachId,
      unipileAccountId: account.unipile_account_id,
      busyCalendarIds,
      eventCalendarId,
    });
  }
  return { busyCalendarIds, eventCalendarId };
}

export async function loadCoachCalendarStatus(input: {
  coachId: string;
  provider?: CalendarMailingProvider | null;
}): Promise<CoachCalendarStatus> {
  const configured = isUnipileConfigured();
  const empty: CoachCalendarStatus = {
    configured,
    connected: false,
    provider: input.provider ?? null,
    email: null,
    outreach_account_id: null,
    unipile_account_id: null,
    calendars: [],
    busy_calendar_ids: [],
    event_calendar_id: "",
    is_booking_source: false,
    calendar_error: null,
  };
  if (!configured) return empty;

  const [accounts, prefs] = await Promise.all([
    listOkCalendarAccounts(input.coachId),
    loadUnipileCalendarPrefs(input.coachId),
  ]);
  const account = pickAccount(
    accounts,
    prefs?.unipile_account_id,
    input.provider ?? null
  );
  if (!account) return { ...empty, configured: true };

  const provider = asCalendarProvider(account.provider);
  const bookingAccount = pickAccount(accounts, prefs?.unipile_account_id, null);
  const prefsMatchAccount =
    prefs?.unipile_account_id === account.unipile_account_id;
  const isBookingSource = prefs
    ? prefsMatchAccount
    : bookingAccount?.id === account.id;

  const listed = await listUnipileCalendars(account.unipile_account_id);
  if (!listed.ok) {
    return {
      ...empty,
      configured: true,
      connected: true,
      provider,
      email: account.display_name,
      outreach_account_id: account.id,
      unipile_account_id: account.unipile_account_id,
      is_booking_source: Boolean(isBookingSource),
      calendar_error: isUnipileCalendarFeatureError(listed)
        ? calendarFeatureErrorMessage(listed)
        : listed.error || "Could not load calendars.",
      busy_calendar_ids:
        prefsMatchAccount && prefs ? prefs.busy_calendar_ids : [],
      event_calendar_id:
        prefsMatchAccount && prefs ? prefs.event_calendar_id : "",
    };
  }

  let busyCalendarIds =
    prefsMatchAccount && prefs ? prefs.busy_calendar_ids : [];
  let eventCalendarId =
    prefsMatchAccount && prefs ? prefs.event_calendar_id : "";

  const knownIds = new Set((listed.data ?? []).map((cal) => cal.id));
  const prefsUsable =
    prefsMatchAccount &&
    Boolean(eventCalendarId) &&
    knownIds.has(eventCalendarId) &&
    busyCalendarIds.some((id) => knownIds.has(id));

  const shouldSeedDefaults =
    (listed.data ?? []).length > 0 &&
    ((!prefs && bookingAccount?.id === account.id) ||
      (prefsMatchAccount && !prefsUsable));

  if (shouldSeedDefaults) {
    const defaults = await persistDefaultPrefs(
      input.coachId,
      account,
      listed.data
    );
    busyCalendarIds = defaults.busyCalendarIds;
    eventCalendarId = defaults.eventCalendarId;
  } else if (!prefsMatchAccount) {
    const picked = pickDefaultUnipileCalendar(listed.data ?? []);
    eventCalendarId = picked?.id ?? "";
    busyCalendarIds = eventCalendarId ? [eventCalendarId] : [];
  }

  return {
    configured: true,
    connected: true,
    provider,
    email: account.display_name,
    outreach_account_id: account.id,
    unipile_account_id: account.unipile_account_id,
    calendars: mapUnipileCalendarsToListItems(listed.data ?? []),
    busy_calendar_ids: busyCalendarIds,
    event_calendar_id: eventCalendarId,
    is_booking_source: Boolean(
      prefsMatchAccount || (!prefs && bookingAccount?.id === account.id)
    ),
    calendar_error: null,
  };
}

type CalendarContextResult =
  | { ok: true; ctx: CalendarContext }
  | { ok: false; connected: boolean; error: string | null };

async function resolveCalendarContext(
  coachId: string
): Promise<CalendarContextResult> {
  const [accounts, prefs] = await Promise.all([
    listOkCalendarAccounts(coachId),
    loadUnipileCalendarPrefs(coachId),
  ]);
  const account = pickAccount(accounts, prefs?.unipile_account_id, null);
  if (!account) {
    return { ok: false, connected: false, error: null };
  }
  const provider = asCalendarProvider(account.provider);
  if (!provider) {
    return { ok: false, connected: false, error: null };
  }

  if (
    prefs &&
    prefs.unipile_account_id === account.unipile_account_id &&
    prefs.event_calendar_id &&
    prefs.busy_calendar_ids.length > 0
  ) {
    return {
      ok: true,
      ctx: {
        account,
        provider,
        busyCalendarIds: prefs.busy_calendar_ids,
        eventCalendarId: prefs.event_calendar_id,
      },
    };
  }

  const listed = await listUnipileCalendars(account.unipile_account_id);
  if (!listed.ok) {
    console.error("unipile calendar list failed:", listed.status, listed.error);
    return {
      ok: false,
      connected: true,
      error: isUnipileCalendarFeatureError(listed)
        ? calendarFeatureErrorMessage(listed)
        : listed.error || "Could not load calendars.",
    };
  }
  const defaults = await persistDefaultPrefs(coachId, account, listed.data);
  if (!defaults.eventCalendarId) {
    return {
      ok: false,
      connected: true,
      error: "No writable calendar was found on this Google/Outlook account.",
    };
  }
  return {
    ok: true,
    ctx: {
      account,
      provider,
      busyCalendarIds: defaults.busyCalendarIds,
      eventCalendarId: defaults.eventCalendarId,
    },
  };
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export type UnipileBusyLoad = {
  intervals: BusyInterval[];
  connected: boolean;
  calendar_error: string | null;
};

export async function loadUnipileBusyForRange(input: {
  coachId: string;
  timeMin: string;
  timeMax: string;
}): Promise<UnipileBusyLoad> {
  const resolved = await resolveCalendarContext(input.coachId);
  if (!resolved.ok) {
    return {
      intervals: [],
      connected: resolved.connected,
      calendar_error: resolved.error,
    };
  }
  const ctx = resolved.ctx;
  if (ctx.busyCalendarIds.length === 0) {
    return { intervals: [], connected: true, calendar_error: null };
  }

  const windowStart = Date.parse(input.timeMin);
  const windowEnd = Date.parse(input.timeMax);
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
    return { intervals: [], connected: true, calendar_error: null };
  }

  const lookbackStart = new Date(windowStart - 24 * 60 * 60 * 1000).toISOString();
  const out: BusyInterval[] = [];
  let eventError: string | null = null;

  for (const calendarId of ctx.busyCalendarIds) {
    const listed = await listUnipileCalendarEvents({
      accountId: ctx.account.unipile_account_id,
      calendarId,
      start: lookbackStart,
      end: input.timeMax,
      expandRecurring: true,
    });
    if (!listed.ok) {
      console.error(
        "unipile calendar events failed:",
        listed.status,
        listed.error,
        calendarId
      );
      eventError = isUnipileCalendarFeatureError(listed)
        ? calendarFeatureErrorMessage(listed)
        : listed.error || "Could not load calendar events.";
      continue;
    }
    for (const event of listed.data ?? []) {
      if (event.is_cancelled || event.transparency === "transparent") continue;
      const starts = eventTimeToIso(event.start);
      const ends = eventTimeToIso(event.end);
      if (!starts || !ends) continue;
      const startMs = Date.parse(starts);
      const endMs = Date.parse(ends);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      if (!intervalsOverlap(startMs, endMs, windowStart, windowEnd)) continue;
      const allDay =
        Boolean(event.is_all_day) || endMs - startMs >= 20 * 60 * 60 * 1000;
      out.push({
        id: `${calendarId}:${event.id}:${starts}`,
        starts_at: starts,
        ends_at: ends,
        title: event.title?.trim() || "Busy",
        all_day: allDay,
      });
    }
  }
  return {
    intervals: out,
    connected: true,
    calendar_error: out.length === 0 ? eventError : null,
  };
}

export async function fetchUnipileBusyIntervals(input: {
  coachId: string;
  timeMin: string;
  timeMax: string;
}): Promise<BusyInterval[]> {
  const loaded = await loadUnipileBusyForRange(input);
  return loaded.intervals;
}

function withJoinInDescription(description: string, joinUrl: string | null): string {
  const trimmed = description.trim();
  if (!joinUrl?.trim()) return trimmed;
  const join = joinUrl.trim();
  if (trimmed.includes(join)) return trimmed;
  return [`Join: ${join}`, trimmed].filter(Boolean).join("\n\n");
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForConferenceUrl(input: {
  accountId: string;
  calendarId: string;
  eventId: string;
}): Promise<string | null> {
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) await wait(400);
    const got = await getUnipileCalendarEvent({
      accountId: input.accountId,
      calendarId: input.calendarId,
      eventId: input.eventId,
    });
    const url = got.data?.conference?.url?.trim();
    if (got.ok && url) return url;
  }
  return null;
}

export async function createUnipileBookingEvent(
  input: CreateBookingEventInput
): Promise<CreateBookingEventResult | null> {
  const resolved = await resolveCalendarContext(input.coachId);
  if (!resolved.ok) return null;
  const ctx = resolved.ctx;

  const wantConference = input.locationMode === "google_meet";
  const conferenceProvider =
    wantConference && ctx.provider === "GOOGLE"
      ? "google_meet"
      : wantConference && ctx.provider === "OUTLOOK"
        ? "teams"
        : null;

  let location: string | null = null;
  let knownJoinUrl: string | null = null;
  if (input.locationMode === "phone" && input.locationPhone?.trim()) {
    location = `Phone: ${input.locationPhone.trim()}`;
  } else if (input.locationMode === "custom" && input.locationCustom?.trim()) {
    knownJoinUrl = input.locationCustom.trim();
    location = knownJoinUrl;
  }

  const description = withJoinInDescription(input.description, knownJoinUrl);
  const created = await createUnipileCalendarEvent({
    accountId: ctx.account.unipile_account_id,
    calendarId: ctx.eventCalendarId,
    title: input.title,
    body: description,
    location: location ?? undefined,
    start: { date_time: input.startsAt, time_zone: input.timezone },
    end: { date_time: input.endsAt, time_zone: input.timezone },
    attendees: input.guestEmail.trim()
      ? [{ email: input.guestEmail.trim() }]
      : [],
    notify: true,
    transparency: "opaque",
    conference: conferenceProvider
      ? { provider: conferenceProvider }
      : undefined,
  });

  if (!created.ok || !created.data?.event_id) {
    console.error(
      "unipile create calendar event failed:",
      created.status,
      created.error
    );
    return null;
  }

  const eventId = created.data.event_id;
  let hangoutLink: string | null = null;
  if (conferenceProvider) {
    hangoutLink = await waitForConferenceUrl({
      accountId: ctx.account.unipile_account_id,
      calendarId: ctx.eventCalendarId,
      eventId,
    });
    if (!hangoutLink) {
      console.warn("unipile conference url missing after create:", {
        eventId,
        calendarId: ctx.eventCalendarId,
        provider: conferenceProvider,
      });
    }
  }

  const joinUrl = hangoutLink ?? knownJoinUrl;
  const finalDescription = withJoinInDescription(description, joinUrl);
  const finalLocation = joinUrl ?? location;
  if (
    (joinUrl && finalDescription !== description) ||
    (finalLocation && finalLocation !== location)
  ) {
    await patchUnipileCalendarEvent({
      accountId: ctx.account.unipile_account_id,
      calendarId: ctx.eventCalendarId,
      eventId,
      body: finalDescription,
      location: finalLocation ?? undefined,
    });
  }

  return {
    eventId,
    calendarId: ctx.eventCalendarId,
    hangoutLink,
    htmlLink: hangoutLink,
    location: finalLocation,
  };
}
