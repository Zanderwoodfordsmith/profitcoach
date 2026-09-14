import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

/**
 * Native Zoom OAuth for coaches (not Unipile).
 *
 * Auth: Authorization Code + PKCE. Session coach_id from requireCoachOrAdmin
 * is the resource owner — never taken from the request body.
 * Tokens live in coach_zoom_connections (service-role). Zoom rotates
 * refresh tokens; we persist the new one on every refresh.
 */

export type ZoomOAuthReturnTo = "settings" | "calls" | "support";

export type ZoomOAuthState = {
  uid: string;
  nonce: string;
  iat: number;
  exp: number;
  returnTo: ZoomOAuthReturnTo;
  returnPrefix: "/coach" | "/admin";
  codeVerifier: string;
};

export const ZOOM_OAUTH_SCOPES = [
  "user:read:user",
  "meeting:write:meeting",
  "meeting:update:meeting",
  "meeting:delete:meeting",
  "cloud_recording:read:recording",
  "cloud_recording:read:list_recording_files",
].join(" ");

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64");
}

function sign(payloadB64: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(payloadB64).digest());
}

export function parseZoomOAuthReturnTo(raw: unknown): ZoomOAuthReturnTo {
  if (raw === "calls" || raw === "support" || raw === "settings") return raw;
  return "calls";
}

export function zoomOAuthEnv() {
  const clientId = process.env.ZOOM_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.ZOOM_REDIRECT_URI?.trim() ?? "";
  const stateSecret =
    process.env.ZOOM_OAUTH_STATE_SECRET?.trim() || clientSecret;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function isZoomOAuthConfigured(): boolean {
  const { clientId, clientSecret, stateSecret } = zoomOAuthEnv();
  return Boolean(clientId && clientSecret && stateSecret);
}

export function zoomRedirectUri(request: Request): string {
  const configured = zoomOAuthEnv().redirectUri;
  if (configured) return configured;
  return `${getAppBaseUrl(request)}/api/coach/zoom/callback`;
}

export function createPkceVerifier(): string {
  return toBase64Url(randomBytes(32));
}

export function pkceChallenge(verifier: string): string {
  return toBase64Url(createHash("sha256").update(verifier).digest());
}

export function encodeZoomOAuthState(
  payload: ZoomOAuthState,
  secret: string
): string {
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function decodeAndVerifyZoomOAuthState(
  rawState: string,
  secret: string
): ZoomOAuthState | null {
  const [payloadB64, sigB64] = rawState.split(".");
  if (!payloadB64 || !sigB64) return null;

  const expected = sign(payloadB64, secret);
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(sigB64);
  if (expectedBuf.length !== gotBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, gotBuf)) return null;

  try {
    const parsed = JSON.parse(
      fromBase64Url(payloadB64).toString("utf8")
    ) as ZoomOAuthState;
    if (
      !parsed?.uid ||
      !parsed?.nonce ||
      !parsed?.exp ||
      !parsed?.iat ||
      !parsed?.codeVerifier
    ) {
      return null;
    }
    if (Date.now() / 1000 > parsed.exp) return null;
    const returnTo = parseZoomOAuthReturnTo(parsed.returnTo);
    const returnPrefix =
      parsed.returnPrefix === "/admin" ? "/admin" : "/coach";
    return { ...parsed, returnTo, returnPrefix };
  } catch {
    return null;
  }
}

export function zoomSuccessPath(state: ZoomOAuthState, status: string): string {
  const flag = `zoom=${encodeURIComponent(status)}`;
  if (state.returnTo === "support") {
    return `/admin/support?tab=settings&${flag}`;
  }
  if (state.returnTo === "settings") {
    return state.returnPrefix === "/coach"
      ? `${state.returnPrefix}/settings?tab=profile&${flag}`
      : `${state.returnPrefix}/account?tab=profile&${flag}`;
  }
  return `${state.returnPrefix}/calls?tab=settings&${flag}`;
}

export function zoomBasicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}
