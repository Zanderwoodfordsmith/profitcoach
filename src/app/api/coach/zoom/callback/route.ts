import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  decodeAndVerifyZoomOAuthState,
  zoomBasicAuthHeader,
  zoomOAuthEnv,
  zoomRedirectUri,
  zoomSuccessPath,
} from "@/lib/booking/zoomOAuth";
import {
  fetchZoomUser,
  upsertZoomConnection,
} from "@/lib/booking/zoomMeetings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

function redirectWithStatus(request: Request, path: string) {
  const requestOrigin = new URL(request.url).origin;
  const appBaseUrl = requestOrigin || getAppBaseUrl(request);
  return NextResponse.redirect(new URL(path, appBaseUrl).toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const authError = url.searchParams.get("error") ?? "";

  const fallback = "/coach/calls?tab=settings&zoom=invalid_callback";

  if (authError) {
    return redirectWithStatus(
      request,
      `/coach/calls?tab=settings&zoom=denied`
    );
  }
  if (!code || !state) {
    return redirectWithStatus(request, fallback);
  }

  const { clientId, clientSecret, stateSecret } = zoomOAuthEnv();
  if (!clientId || !clientSecret || !stateSecret) {
    return redirectWithStatus(
      request,
      "/coach/calls?tab=settings&zoom=server_config_error"
    );
  }

  const parsed = decodeAndVerifyZoomOAuthState(state, stateSecret);
  if (!parsed) {
    return redirectWithStatus(request, fallback.replace("invalid_callback", "invalid_state"));
  }

  const redirectUri = zoomRedirectUri(request);
  let tokenJson: TokenResponse;
  try {
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: zoomBasicAuthHeader(clientId, clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: parsed.codeVerifier,
      }),
      cache: "no-store",
    });
    if (!tokenRes.ok) {
      console.error("zoom token exchange failed:", tokenRes.status);
      return redirectWithStatus(
        request,
        zoomSuccessPath(parsed, "token_exchange_failed")
      );
    }
    tokenJson = (await tokenRes.json()) as TokenResponse;
  } catch (error) {
    console.error("zoom token exchange exception:", error);
    return redirectWithStatus(
      request,
      zoomSuccessPath(parsed, "token_exchange_failed")
    );
  }

  if (!tokenJson.access_token) {
    return redirectWithStatus(
      request,
      zoomSuccessPath(parsed, "token_missing")
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("coach_zoom_connections")
    .select("refresh_token")
    .eq("coach_id", parsed.uid)
    .maybeSingle();
  const refreshToken =
    tokenJson.refresh_token ||
    (typeof existing?.refresh_token === "string"
      ? existing.refresh_token
      : null);
  if (!refreshToken) {
    return redirectWithStatus(
      request,
      zoomSuccessPath(parsed, "token_missing")
    );
  }

  const user = await fetchZoomUser(tokenJson.access_token);
  const saved = await upsertZoomConnection({
    coachId: parsed.uid,
    accessToken: tokenJson.access_token,
    refreshToken,
    expiresIn: tokenJson.expires_in,
    scope: tokenJson.scope ?? null,
    zoomUserId: user?.id?.trim() || null,
    zoomEmail: user?.email?.trim() || null,
  });
  if (saved.error) {
    return redirectWithStatus(request, zoomSuccessPath(parsed, "save_failed"));
  }

  return redirectWithStatus(request, zoomSuccessPath(parsed, "connected"));
}
