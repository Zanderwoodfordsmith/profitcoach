import { NextResponse } from "next/server";
import {
  decodeAndVerifyGoogleCalendarState,
  googleCalendarEnv,
} from "@/lib/booking/googleCalendarOAuth";
import { listGoogleCalendars } from "@/lib/booking/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function redirectWithStatus(
  request: Request,
  returnTo: string,
  status: string
) {
  // Prefer the host that served the callback (fixes local 3000 vs 3002 APP_BASE_URL drift).
  const requestOrigin = new URL(request.url).origin;
  const configured = process.env.APP_BASE_URL?.trim();
  const appBaseUrl = requestOrigin || configured || "http://localhost:3002";
  const path = returnTo.startsWith("/") ? returnTo : "/coach/calls";
  const target = new URL(path, appBaseUrl);
  target.searchParams.set("google_calendar", status);
  return NextResponse.redirect(target.toString());
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const authError = url.searchParams.get("error") ?? "";

  const fallbackReturn = "/coach/calls";

  if (authError) {
    return redirectWithStatus(request, fallbackReturn, `denied_${authError}`);
  }
  if (!code || !state) {
    return redirectWithStatus(request, fallbackReturn, "invalid_callback");
  }

  const { clientId, clientSecret, redirectUri, stateSecret } =
    googleCalendarEnv();
  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    return redirectWithStatus(request, fallbackReturn, "server_config_error");
  }

  const parsed = decodeAndVerifyGoogleCalendarState(state, stateSecret);
  if (!parsed) {
    return redirectWithStatus(request, fallbackReturn, "invalid_state");
  }

  let tokenJson: TokenResponse;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!tokenRes.ok) {
      const raw = await tokenRes.text().catch(() => "");
      console.error("google calendar token exchange failed:", tokenRes.status, raw);
      return redirectWithStatus(
        request,
        parsed.returnTo,
        `token_exchange_failed_${tokenRes.status}`
      );
    }
    tokenJson = (await tokenRes.json()) as TokenResponse;
  } catch (error) {
    console.error("google calendar token exchange exception:", error);
    return redirectWithStatus(request, parsed.returnTo, "token_exchange_exception");
  }

  if (!tokenJson.access_token) {
    return redirectWithStatus(request, parsed.returnTo, "token_missing");
  }

  let email: string | null = null;
  let accountId: string | null = null;
  if (tokenJson.id_token) {
    const payload = decodeJwtPayload(tokenJson.id_token);
    if (typeof payload?.email === "string") email = payload.email;
    if (typeof payload?.sub === "string") accountId = payload.sub;
  }

  if (!email) {
    try {
      const userRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          cache: "no-store",
        }
      );
      if (userRes.ok) {
        const info = (await userRes.json()) as { email?: string; id?: string };
        email = info.email ?? null;
        accountId = info.id ?? accountId;
      }
    } catch {
      /* optional */
    }
  }

  let busyIds: string[] = ["primary"];
  let eventCalendarId = "primary";
  try {
    const calendars = await listGoogleCalendars(tokenJson.access_token);
    const primary = calendars.find((c) => c.primary) ?? calendars[0];
    if (primary) {
      busyIds = [primary.id];
      eventCalendarId = primary.id;
    }
  } catch (error) {
    console.error("google calendar list on connect:", error);
  }

  // Keep existing refresh_token if Google omitted it on re-consent.
  const { data: existing } = await supabaseAdmin
    .from("coach_google_calendar_connections")
    .select("refresh_token, busy_calendar_ids, event_calendar_id")
    .eq("coach_id", parsed.uid)
    .maybeSingle();

  const refreshToken =
    tokenJson.refresh_token ||
    (existing?.refresh_token as string | null) ||
    null;

  if (!refreshToken) {
    console.error("google calendar: no refresh_token on connect", parsed.uid);
    return redirectWithStatus(request, parsed.returnTo, "missing_refresh_token");
  }

  const existingBusy = Array.isArray(existing?.busy_calendar_ids)
    ? (existing!.busy_calendar_ids as string[])
    : [];
  if (existingBusy.length > 0) busyIds = existingBusy;
  if (
    typeof existing?.event_calendar_id === "string" &&
    existing.event_calendar_id.trim()
  ) {
    eventCalendarId = existing.event_calendar_id.trim();
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : null;

  const { error: upsertError } = await supabaseAdmin
    .from("coach_google_calendar_connections")
    .upsert(
      {
        coach_id: parsed.uid,
        google_account_email: email,
        google_account_id: accountId,
        access_token: tokenJson.access_token,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        scope: tokenJson.scope ?? null,
        busy_calendar_ids: busyIds,
        event_calendar_id: eventCalendarId,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "coach_id" }
    );

  if (upsertError) {
    console.error("google calendar upsert:", upsertError);
    return redirectWithStatus(request, parsed.returnTo, "save_failed");
  }

  return redirectWithStatus(request, parsed.returnTo, "connected");
}
