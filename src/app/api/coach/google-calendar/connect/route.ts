import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  encodeGoogleCalendarState,
  googleCalendarEnv,
  GOOGLE_CALENDAR_SCOPES,
  isGoogleCalendarConfigured,
} from "@/lib/booking/googleCalendarOAuth";
import { ensureCoachRowForUser } from "@/lib/booking/bookingService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireSelfUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return { error: "Missing access token." as const, userId: null };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: user.id as string, role: profile.role as string };
}

export async function GET(request: Request) {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Calendar OAuth is not configured. Add GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.",
      },
      { status: 503 }
    );
  }

  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    await ensureCoachRowForUser(auth.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const returnToParam = url.searchParams.get("returnTo")?.trim() || "";
  const defaultReturn =
    auth.role === "admin" ? "/admin/funnel-settings" : "/coach/funnel-settings";
  const returnTo =
    returnToParam.startsWith("/") && !returnToParam.startsWith("//")
      ? returnToParam
      : defaultReturn;

  const { clientId, redirectUri, stateSecret } = googleCalendarEnv();
  const now = Math.floor(Date.now() / 1000);
  const state = encodeGoogleCalendarState(
    {
      uid: auth.userId,
      nonce: randomBytes(12).toString("hex"),
      iat: now,
      exp: now + 60 * 10,
      returnTo,
    },
    stateSecret
  );

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ url: authUrl.toString() });
}
