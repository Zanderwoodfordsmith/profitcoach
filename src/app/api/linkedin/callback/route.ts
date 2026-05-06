import { NextResponse } from "next/server";
import { decodeAndVerifyLinkedInState } from "@/lib/linkedinOAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
};

type LinkedInUserInfoResponse = {
  sub?: string;
};

function redirectWithStatus(request: Request, status: string) {
  const appBaseUrl =
    process.env.APP_BASE_URL || new URL(request.url).origin || "http://localhost:3000";
  return NextResponse.redirect(
    `${appBaseUrl}/coach/community/members?linkedin=${encodeURIComponent(status)}`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const authError = url.searchParams.get("error") ?? "";

  if (authError) return redirectWithStatus(request, "auth_denied");
  if (!code || !state) return redirectWithStatus(request, "invalid_callback");

  const clientId = process.env.LINKEDIN_CLIENT_ID ?? "";
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? "";
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? "";
  const stateSecret = process.env.LINKEDIN_STATE_SECRET ?? clientSecret;

  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    return redirectWithStatus(request, "server_config_error");
  }

  const parsed = decodeAndVerifyLinkedInState(state, stateSecret);
  if (!parsed) return redirectWithStatus(request, "invalid_state");

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      return redirectWithStatus(request, "token_exchange_failed");
    }

    const tokenJson = (await tokenRes.json()) as LinkedInTokenResponse;
    if (!tokenJson.access_token) {
      return redirectWithStatus(request, "token_missing");
    }

    const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
      cache: "no-store",
    });

    if (!userInfoRes.ok) {
      return redirectWithStatus(request, "userinfo_failed");
    }

    const userInfo = (await userInfoRes.json()) as LinkedInUserInfoResponse;
    if (!userInfo.sub) return redirectWithStatus(request, "userinfo_missing");

    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

    const scope = (tokenJson.scope ?? "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const { error: upsertError } = await supabaseAdmin
      .from("linkedin_member_connections")
      .upsert(
        {
          user_id: parsed.uid,
          linkedin_sub: userInfo.sub,
          access_token: tokenJson.access_token,
          scope,
          token_expires_at: expiresAt,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("linkedin callback upsert error:", upsertError);
      return redirectWithStatus(request, "save_failed");
    }

    return redirectWithStatus(request, "connected");
  } catch (error) {
    console.error("linkedin callback error:", error);
    return redirectWithStatus(request, "callback_failed");
  }
}
