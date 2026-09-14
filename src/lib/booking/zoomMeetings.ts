import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isZoomOAuthConfigured,
  zoomBasicAuthHeader,
  zoomOAuthEnv,
} from "@/lib/booking/zoomOAuth";

type ZoomTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type ZoomUser = {
  id?: string;
  email?: string;
};

type ZoomMeetingCreateResponse = {
  id?: number | string;
  join_url?: string;
};

export type ZoomConnectionStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
};

type ZoomConnectionRow = {
  coach_id: string;
  zoom_user_id: string | null;
  zoom_email: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
};

const ZOOM_API = "https://api.zoom.us/v2";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

function parseConnection(row: Record<string, unknown>): ZoomConnectionRow {
  return {
    coach_id: String(row.coach_id),
    zoom_user_id: typeof row.zoom_user_id === "string" ? row.zoom_user_id : null,
    zoom_email: typeof row.zoom_email === "string" ? row.zoom_email : null,
    access_token: String(row.access_token),
    refresh_token:
      typeof row.refresh_token === "string" ? row.refresh_token : null,
    token_expires_at:
      typeof row.token_expires_at === "string" ? row.token_expires_at : null,
  };
}

async function loadZoomConnection(
  coachId: string
): Promise<ZoomConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("coach_zoom_connections")
    .select(
      "coach_id, zoom_user_id, zoom_email, access_token, refresh_token, token_expires_at"
    )
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error || !data) return null;
  return parseConnection(data as Record<string, unknown>);
}

async function refreshAccessToken(
  refreshToken: string
): Promise<ZoomTokenResponse | null> {
  const { clientId, clientSecret } = zoomOAuthEnv();
  if (!clientId || !clientSecret) return null;

  const res = await fetch(ZOOM_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: zoomBasicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("zoom token refresh failed:", res.status);
    return null;
  }
  return (await res.json()) as ZoomTokenResponse;
}

export async function loadZoomConnectionStatus(
  coachId: string
): Promise<ZoomConnectionStatus> {
  const configured = isZoomOAuthConfigured();
  const conn = await loadZoomConnection(coachId);
  if (!conn) {
    return { configured, connected: false, email: null };
  }
  return {
    configured,
    connected: true,
    email: conn.zoom_email,
  };
}

export async function getValidZoomAccessToken(
  coachId: string
): Promise<string | null> {
  const conn = await loadZoomConnection(coachId);
  if (!conn) return null;

  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) return conn.access_token;

  if (!conn.refresh_token) {
    console.error("zoom: token expired and no refresh_token", coachId);
    return null;
  }

  const refreshed = await refreshAccessToken(conn.refresh_token);
  if (!refreshed?.access_token) {
    // Another request may have rotated the refresh token already.
    const again = await loadZoomConnection(coachId);
    if (
      again?.access_token &&
      again.token_expires_at &&
      new Date(again.token_expires_at).getTime() > Date.now() + 60_000
    ) {
      return again.access_token;
    }
    return null;
  }

  await supabaseAdmin
    .from("coach_zoom_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || conn.refresh_token,
      token_expires_at: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : conn.token_expires_at,
      scope: refreshed.scope ?? undefined,
    })
    .eq("coach_id", coachId);

  return refreshed.access_token;
}

export async function fetchZoomUser(
  accessToken: string
): Promise<ZoomUser | null> {
  const res = await fetch(`${ZOOM_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("zoom users/me failed:", res.status);
    return null;
  }
  return (await res.json()) as ZoomUser;
}

export async function upsertZoomConnection(input: {
  coachId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  scope?: string | null;
  zoomUserId: string | null;
  zoomEmail: string | null;
}): Promise<{ error: string | null }> {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;
  const { error } = await supabaseAdmin.from("coach_zoom_connections").upsert(
    {
      coach_id: input.coachId,
      zoom_user_id: input.zoomUserId,
      zoom_email: input.zoomEmail,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: expiresAt,
      scope: input.scope ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "coach_id" }
  );
  if (error) {
    console.error("zoom connection upsert:", error.message);
    return { error: "Could not save Zoom connection." };
  }
  return { error: null };
}

export async function deleteZoomConnection(coachId: string): Promise<void> {
  const conn = await loadZoomConnection(coachId);
  const { clientId, clientSecret } = zoomOAuthEnv();
  const token = conn?.refresh_token || conn?.access_token;
  if (token && clientId && clientSecret) {
    try {
      await fetch("https://zoom.us/oauth/revoke", {
        method: "POST",
        headers: {
          Authorization: zoomBasicAuthHeader(clientId, clientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token }),
        cache: "no-store",
      });
    } catch (error) {
      console.error("zoom token revoke:", error);
    }
  }
  await supabaseAdmin
    .from("coach_zoom_connections")
    .delete()
    .eq("coach_id", coachId);
}

export type CreatedZoomMeeting = {
  meetingId: string;
  joinUrl: string;
};

export async function createZoomBookingMeeting(input: {
  coachId: string;
  topic: string;
  startsAt: string;
  endsAt: string;
}): Promise<CreatedZoomMeeting | null> {
  const accessToken = await getValidZoomAccessToken(input.coachId);
  if (!accessToken) return null;

  const duration = Math.max(
    1,
    Math.round(
      (new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) /
        60_000
    )
  );

  const res = await fetch(`${ZOOM_API}/users/me/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic.slice(0, 200),
      type: 2,
      start_time: new Date(input.startsAt).toISOString().replace(/\.\d{3}Z$/, "Z"),
      duration,
      timezone: "UTC",
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        approval_type: 2,
        audio: "both",
        auto_recording: "cloud",
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const retried = await fetch(`${ZOOM_API}/users/me/meetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: input.topic.slice(0, 200),
        type: 2,
        start_time: new Date(input.startsAt)
          .toISOString()
          .replace(/\.\d{3}Z$/, "Z"),
        duration,
        timezone: "UTC",
        settings: {
          join_before_host: true,
          waiting_room: false,
          mute_upon_entry: true,
          approval_type: 2,
          audio: "both",
        },
      }),
      cache: "no-store",
    });
    if (!retried.ok) {
      console.error("zoom create meeting failed:", retried.status);
      return null;
    }
    const created = (await retried.json()) as ZoomMeetingCreateResponse;
    const meetingId = created.id != null ? String(created.id) : "";
    const joinUrl = created.join_url?.trim() ?? "";
    if (!meetingId || !joinUrl) return null;
    return { meetingId, joinUrl };
  }
  const created = (await res.json()) as ZoomMeetingCreateResponse;
  const meetingId = created.id != null ? String(created.id) : "";
  const joinUrl = created.join_url?.trim() ?? "";
  if (!meetingId || !joinUrl) return null;
  return { meetingId, joinUrl };
}

export async function deleteZoomBookingMeeting(input: {
  coachId: string;
  meetingId: string;
}): Promise<void> {
  const meetingId = input.meetingId.trim();
  if (!meetingId) return;
  const accessToken = await getValidZoomAccessToken(input.coachId);
  if (!accessToken) return;
  const res = await fetch(
    `${ZOOM_API}/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  if (!res.ok && res.status !== 404) {
    console.error("zoom delete meeting failed:", res.status);
  }
}
