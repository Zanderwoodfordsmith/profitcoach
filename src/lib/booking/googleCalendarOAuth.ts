import { createHmac, timingSafeEqual } from "crypto";

export type GoogleCalendarOAuthState = {
  uid: string;
  nonce: string;
  iat: number;
  exp: number;
  /** Relative path to return after connect, e.g. /coach/funnel-settings */
  returnTo: string;
};

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

export function encodeGoogleCalendarState(
  payload: GoogleCalendarOAuthState,
  secret: string
): string {
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function decodeAndVerifyGoogleCalendarState(
  rawState: string,
  secret: string
): GoogleCalendarOAuthState | null {
  const [payloadB64, sigB64] = rawState.split(".");
  if (!payloadB64 || !sigB64) return null;

  const expected = sign(payloadB64, secret);
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(sigB64);
  if (expectedBuf.length !== gotBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, gotBuf)) return null;

  try {
    const payloadRaw = fromBase64Url(payloadB64).toString("utf8");
    const parsed = JSON.parse(payloadRaw) as GoogleCalendarOAuthState;
    if (!parsed?.uid || !parsed?.nonce || !parsed?.exp || !parsed?.iat) {
      return null;
    }
    if (Date.now() / 1000 > parsed.exp) return null;
    const returnTo =
      typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")
        ? parsed.returnTo
        : "/coach/calls";
    return { ...parsed, returnTo };
  } catch {
    return null;
  }
}

export function googleCalendarEnv() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? "";
  const stateSecret =
    process.env.GOOGLE_CALENDAR_STATE_SECRET ?? clientSecret;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function isGoogleCalendarConfigured(): boolean {
  const { clientId, clientSecret, redirectUri, stateSecret } =
    googleCalendarEnv();
  return Boolean(clientId && clientSecret && redirectUri && stateSecret);
}

/** Scopes: list calendars, free/busy, create events (+ Meet). */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");
