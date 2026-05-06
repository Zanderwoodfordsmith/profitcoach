import { NextResponse } from "next/server";
import { decodeAndVerifyLinkedInState } from "@/lib/linkedinOAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
};

type LinkedInUserInfoResponse = {
  sub?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function redirectWithStatus(request: Request, status: string) {
  const appBaseUrl =
    process.env.APP_BASE_URL || new URL(request.url).origin || "http://localhost:3000";
  return NextResponse.redirect(
    `${appBaseUrl}/admin/linkedin?linkedin=${encodeURIComponent(status)}`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const authError = url.searchParams.get("error") ?? "";
  const authErrorDescription = url.searchParams.get("error_description") ?? "";

  if (authError) {
    const suffix = authErrorDescription ? "_with_description" : "";
    return redirectWithStatus(request, `auth_denied_${authError}${suffix}`);
  }
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

  let tokenJson: LinkedInTokenResponse;
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
      const raw = await tokenRes.text().catch(() => "");
      console.error("linkedin callback token exchange failed:", tokenRes.status, raw);
      return redirectWithStatus(request, `token_exchange_failed_${tokenRes.status}`);
    }
    tokenJson = (await tokenRes.json()) as LinkedInTokenResponse;
  } catch (error) {
    console.error("linkedin callback token exchange exception:", error);
    return redirectWithStatus(request, "token_exchange_exception");
  }

  if (!tokenJson.access_token) {
    return redirectWithStatus(request, "token_missing");
  }

  // Prefer OIDC id_token claim `sub` to avoid userinfo endpoint inconsistencies.
  let linkedInSub = "";
  if (tokenJson.id_token) {
    const payload = decodeJwtPayload(tokenJson.id_token);
    const maybeSub = typeof payload?.sub === "string" ? payload.sub : "";
    if (maybeSub) linkedInSub = maybeSub;
  }

  if (!linkedInSub) {
    let userInfo: LinkedInUserInfoResponse;
    try {
      const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
        },
        cache: "no-store",
      });
      if (!userInfoRes.ok) {
        const raw = await userInfoRes.text().catch(() => "");
        console.error("linkedin callback userinfo failed:", userInfoRes.status, raw);
        return redirectWithStatus(request, `userinfo_failed_${userInfoRes.status}`);
      }
      const raw = await userInfoRes.text().catch(() => "");
      try {
        userInfo = JSON.parse(raw) as LinkedInUserInfoResponse;
      } catch (error) {
        console.error("linkedin callback userinfo parse failed:", raw, error);
        return redirectWithStatus(request, "userinfo_parse_failed");
      }
    } catch (error) {
      console.error("linkedin callback userinfo exception:", error);
      return redirectWithStatus(request, "userinfo_exception");
    }
    linkedInSub = userInfo.sub ?? "";
  }

  if (!linkedInSub) return redirectWithStatus(request, "userinfo_missing");

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
        linkedin_sub: linkedInSub,
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
}
