import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  googleCalendarEnv,
  isGoogleCalendarConfigured,
} from "@/lib/booking/googleCalendarOAuth";

export type GoogleCalendarConnection = {
  coach_id: string;
  google_account_email: string | null;
  google_account_id: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  busy_calendar_ids: string[];
  event_calendar_id: string;
};

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
};

export type BusyInterval = {
  starts_at: string;
  ends_at: string;
};

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const { clientId, clientSecret } = googleCalendarEnv();
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("google calendar token refresh failed:", res.status, raw);
    return null;
  }

  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function loadGoogleConnection(
  coachId: string
): Promise<GoogleCalendarConnection | null> {
  const { data } = await supabaseAdmin
    .from("coach_google_calendar_connections")
    .select(
      "coach_id, google_account_email, google_account_id, access_token, refresh_token, token_expires_at, scope, busy_calendar_ids, event_calendar_id"
    )
    .eq("coach_id", coachId)
    .maybeSingle();

  if (!data?.access_token) return null;

  return {
    coach_id: data.coach_id as string,
    google_account_email: (data.google_account_email as string | null) ?? null,
    google_account_id: (data.google_account_id as string | null) ?? null,
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string | null) ?? null,
    token_expires_at: (data.token_expires_at as string | null) ?? null,
    scope: (data.scope as string | null) ?? null,
    busy_calendar_ids: Array.isArray(data.busy_calendar_ids)
      ? (data.busy_calendar_ids as string[])
      : [],
    event_calendar_id:
      typeof data.event_calendar_id === "string" && data.event_calendar_id.trim()
        ? data.event_calendar_id.trim()
        : "primary",
  };
}

/** Public-safe connection status (no tokens). */
export async function loadGoogleConnectionPublic(coachId: string): Promise<{
  connected: boolean;
  email: string | null;
  busy_calendar_ids: string[];
  event_calendar_id: string;
  configured: boolean;
} | null> {
  const configured = isGoogleCalendarConfigured();
  const conn = await loadGoogleConnection(coachId);
  if (!conn) {
    return {
      connected: false,
      email: null,
      busy_calendar_ids: [],
      event_calendar_id: "primary",
      configured,
    };
  }
  return {
    connected: true,
    email: conn.google_account_email,
    busy_calendar_ids: conn.busy_calendar_ids,
    event_calendar_id: conn.event_calendar_id,
    configured,
  };
}

export async function getValidGoogleAccessToken(
  coachId: string
): Promise<string | null> {
  const conn = await loadGoogleConnection(coachId);
  if (!conn) return null;

  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;
  const stillValid = expiresAt > Date.now() + 60_000;

  if (stillValid) return conn.access_token;

  if (!conn.refresh_token) {
    console.error("google calendar: token expired and no refresh_token", coachId);
    return null;
  }

  const refreshed = await refreshAccessToken(conn.refresh_token);
  if (!refreshed?.access_token) return null;

  const tokenExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  await supabaseAdmin
    .from("coach_google_calendar_connections")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
    })
    .eq("coach_id", coachId);

  return refreshed.access_token;
}

export async function listGoogleCalendars(
  accessToken: string
): Promise<GoogleCalendarListItem[]> {
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList"
  );
  url.searchParams.set("minAccessRole", "reader");
  url.searchParams.set("showHidden", "false");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("google calendarList failed:", res.status, raw);
    throw new Error("Could not list Google calendars.");
  }

  const body = (await res.json()) as {
    items?: {
      id?: string;
      summary?: string;
      primary?: boolean;
      accessRole?: string;
      backgroundColor?: string;
    }[];
  };

  return (body.items ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id!,
      summary: c.summary?.trim() || c.id!,
      primary: Boolean(c.primary),
      accessRole: c.accessRole ?? "reader",
      backgroundColor: c.backgroundColor,
    }));
}

/**
 * Query FreeBusy for selected calendars; returns busy intervals in UTC ISO.
 */
export async function fetchGoogleBusyIntervals(input: {
  coachId: string;
  timeMin: string;
  timeMax: string;
}): Promise<BusyInterval[]> {
  const conn = await loadGoogleConnection(input.coachId);
  if (!conn || conn.busy_calendar_ids.length === 0) return [];

  const accessToken = await getValidGoogleAccessToken(input.coachId);
  if (!accessToken) return [];

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      items: conn.busy_calendar_ids.map((id) => ({ id })),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("google freeBusy failed:", res.status, raw);
    return [];
  }

  const body = (await res.json()) as {
    calendars?: Record<
      string,
      { busy?: { start?: string; end?: string }[]; errors?: unknown[] }
    >;
  };

  const out: BusyInterval[] = [];
  for (const cal of Object.values(body.calendars ?? {})) {
    for (const b of cal.busy ?? []) {
      if (!b.start || !b.end) continue;
      out.push({ starts_at: b.start, ends_at: b.end });
    }
  }
  return out;
}

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

type GoogleEventConferencePayload = {
  id?: string;
  hangoutLink?: string;
  htmlLink?: string;
  location?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
    createRequest?: {
      status?: { statusCode?: string };
    };
  };
};

function extractHangoutLink(event: GoogleEventConferencePayload): string | null {
  if (event.hangoutLink?.trim()) return event.hangoutLink.trim();
  const video = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video" && e.uri
  );
  return video?.uri?.trim() || null;
}

function meetCreateRequestId(): string {
  return `pc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function patchGoogleEventFields(input: {
  accessToken: string;
  calendarIdEncoded: string;
  eventId: string;
  location?: string | null;
  description?: string | null;
  sendUpdates?: "all" | "none";
}): Promise<boolean> {
  const body: Record<string, string> = {};
  if (input.location?.trim()) body.location = input.location.trim();
  if (input.description != null) body.description = input.description;
  if (Object.keys(body).length === 0) return true;

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${input.calendarIdEncoded}/events/${encodeURIComponent(input.eventId)}`
  );
  url.searchParams.set("sendUpdates", input.sendUpdates ?? "none");
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.warn("google patch event fields failed:", res.status, raw);
    return false;
  }
  return true;
}

function withJoinInDescription(
  description: string,
  joinUrl: string | null
): string {
  const trimmed = description.trim();
  if (!joinUrl?.trim()) return trimmed;
  const join = joinUrl.trim();
  if (trimmed.includes(join)) return trimmed;
  return [`Join: ${join}`, trimmed].filter(Boolean).join("\n\n");
}

async function attachMeetToExistingEvent(input: {
  accessToken: string;
  calendarIdEncoded: string;
  eventId: string;
}): Promise<string | null> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${input.calendarIdEncoded}/events/${encodeURIComponent(input.eventId)}`
  );
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conferenceData: {
        createRequest: {
          requestId: meetCreateRequestId(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("google attach meet failed:", res.status, raw);
    return null;
  }
  const patched = (await res.json()) as GoogleEventConferencePayload;
  return extractHangoutLink(patched);
}

export async function createGoogleBookingEvent(
  input: CreateBookingEventInput
): Promise<CreateBookingEventResult | null> {
  const conn = await loadGoogleConnection(input.coachId);
  if (!conn) return null;

  const accessToken = await getValidGoogleAccessToken(input.coachId);
  if (!accessToken) return null;

  const rawCalendarId = conn.event_calendar_id || "primary";
  const calendarId = encodeURIComponent(rawCalendarId);
  const wantMeet = input.locationMode === "google_meet";

  let location: string | null = null;
  let knownJoinUrl: string | null = null;
  if (input.locationMode === "phone" && input.locationPhone?.trim()) {
    location = `Phone: ${input.locationPhone.trim()}`;
  } else if (input.locationMode === "custom" && input.locationCustom?.trim()) {
    knownJoinUrl = input.locationCustom.trim();
    location = knownJoinUrl;
  }

  const description = withJoinInDescription(input.description, knownJoinUrl);

  const eventBody: Record<string, unknown> = {
    summary: input.title,
    description,
    start: {
      dateTime: input.startsAt,
      timeZone: input.timezone,
    },
    end: {
      dateTime: input.endsAt,
      timeZone: input.timezone,
    },
    attendees: [
      {
        email: input.guestEmail,
        displayName: input.guestName,
      },
    ],
    reminders: {
      useDefault: true,
    },
  };

  if (location) eventBody.location = location;

  if (wantMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: meetCreateRequestId(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  );
  url.searchParams.set("sendUpdates", "all");
  if (wantMeet) {
    url.searchParams.set("conferenceDataVersion", "1");
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
    cache: "no-store",
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("google create event failed:", res.status, raw);
    return null;
  }

  const created = (await res.json()) as GoogleEventConferencePayload;

  if (!created.id) return null;

  let hangoutLink = extractHangoutLink(created);
  const createStatus =
    created.conferenceData?.createRequest?.status?.statusCode ?? null;

  if (wantMeet && !hangoutLink) {
    console.warn("google meet missing after create:", {
      eventId: created.id,
      calendarId: rawCalendarId,
      createStatus,
    });
    hangoutLink = await attachMeetToExistingEvent({
      accessToken,
      calendarIdEncoded: calendarId,
      eventId: created.id,
    });
  }

  const joinUrl = hangoutLink ?? knownJoinUrl;
  const finalDescription = withJoinInDescription(description, joinUrl);
  const finalLocation = joinUrl ?? location;

  // Ensure Location + "Join:" in description on the invite (email confirmations
  // already have the URL; calendar invites were missing it).
  const locationMissing =
    Boolean(finalLocation) &&
    (!created.location?.trim() || created.location.trim() !== finalLocation);
  const descriptionNeedsJoin =
    Boolean(joinUrl) && finalDescription !== description;

  if (finalLocation && (locationMissing || descriptionNeedsJoin)) {
    await patchGoogleEventFields({
      accessToken,
      calendarIdEncoded: calendarId,
      eventId: created.id,
      location: finalLocation,
      description: finalDescription,
      // Re-notify guests when location was missing on the first invite.
      sendUpdates: locationMissing ? "all" : "none",
    });
  }

  if (wantMeet && !hangoutLink) {
    console.error("google meet still missing after retry:", {
      eventId: created.id,
      calendarId: rawCalendarId,
      createStatus,
    });
  }

  return {
    eventId: created.id,
    calendarId: rawCalendarId,
    hangoutLink,
    htmlLink: created.htmlLink ?? null,
    location: finalLocation,
  };
}

export async function deleteGoogleConnection(coachId: string): Promise<void> {
  const conn = await loadGoogleConnection(coachId);
  if (conn?.access_token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.access_token)}`,
        { method: "POST", cache: "no-store" }
      );
    } catch {
      /* best-effort */
    }
  }
  await supabaseAdmin
    .from("coach_google_calendar_connections")
    .delete()
    .eq("coach_id", coachId);
}
