import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  createPkceVerifier,
  encodeZoomOAuthState,
  isZoomOAuthConfigured,
  parseZoomOAuthReturnTo,
  pkceChallenge,
  zoomOAuthEnv,
  zoomRedirectUri,
  ZOOM_OAUTH_SCOPES,
} from "@/lib/booking/zoomOAuth";
import {
  requireCoachOrAdmin,
  resolveCoachTarget,
} from "@/lib/booking/resolveCoachTarget";

function returnPrefixFromRequest(request: Request): "/coach" | "/admin" {
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/coach/") || referer.includes("/coach?")) return "/coach";
  return "/admin";
}

export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin(request);
  if (auth.error || !auth.userId || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  if (!isZoomOAuthConfigured()) {
    return NextResponse.json(
      { error: "Zoom OAuth is not configured on this environment yet." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  let target: Awaited<ReturnType<typeof resolveCoachTarget>>;
  try {
    target = await resolveCoachTarget({
      auth: { userId: auth.userId, role: auth.role },
      forSlug: url.searchParams.get("forSlug"),
      impersonateCoachId: auth.impersonateCoachId,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }
  if (!target.isSelf) {
    return NextResponse.json(
      { error: "Sign in as this coach to connect Zoom." },
      { status: 403 }
    );
  }

  const { clientId, stateSecret } = zoomOAuthEnv();
  const redirectUri = zoomRedirectUri(request);
  const now = Math.floor(Date.now() / 1000);
  const codeVerifier = createPkceVerifier();
  const state = encodeZoomOAuthState(
    {
      uid: target.coach.id,
      nonce: randomBytes(12).toString("hex"),
      iat: now,
      exp: now + 60 * 10,
      returnTo: parseZoomOAuthReturnTo(url.searchParams.get("returnTo")),
      returnPrefix: returnPrefixFromRequest(request),
      codeVerifier,
    },
    stateSecret
  );

  const authUrl = new URL("https://zoom.us/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", ZOOM_OAUTH_SCOPES);
  authUrl.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.json({ url: authUrl.toString() });
}
