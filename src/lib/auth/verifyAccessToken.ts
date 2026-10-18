import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type VerifiedUser = { id: string; email: string | null };

/**
 * Checks a signed-in user's Supabase access token.
 *
 * The project signs tokens with an ES256 key, so `getClaims` checks the
 * signature and expiry locally against the cached public key instead of
 * calling Supabase Auth on every API request (it falls back to that call on
 * its own for older HS256 tokens). Trade-off: a token from a session that was
 * signed out elsewhere keeps working until it expires (an hour at most).
 * Roles are still read fresh from `profiles` by the callers.
 */
export async function verifyAccessToken(token: string | null | undefined): Promise<VerifiedUser | null> {
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims?.sub || claims.role !== "authenticated") return null;
    return { id: claims.sub, email: typeof claims.email === "string" && claims.email ? claims.email : null };
  } catch {
    return null;
  }
}

/** The Bearer token from an Authorization header, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token || null;
}
