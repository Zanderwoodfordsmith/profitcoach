import { createHmac, timingSafeEqual } from "crypto";

export type LinkedInOAuthState = {
  uid: string;
  nonce: string;
  iat: number;
  exp: number;
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

export function encodeLinkedInState(
  payload: LinkedInOAuthState,
  secret: string
): string {
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function decodeAndVerifyLinkedInState(
  rawState: string,
  secret: string
): LinkedInOAuthState | null {
  const [payloadB64, sigB64] = rawState.split(".");
  if (!payloadB64 || !sigB64) return null;

  const expected = sign(payloadB64, secret);
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(sigB64);
  if (expectedBuf.length !== gotBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, gotBuf)) return null;

  try {
    const payloadRaw = fromBase64Url(payloadB64).toString("utf8");
    const parsed = JSON.parse(payloadRaw) as LinkedInOAuthState;
    if (!parsed?.uid || !parsed?.nonce || !parsed?.exp || !parsed?.iat) {
      return null;
    }
    if (Date.now() / 1000 > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
