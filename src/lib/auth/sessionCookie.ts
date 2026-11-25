/**
 * Sign-in also kept in a cookie (job 292, step 1), so the server can know who
 * is asking when it sends a page and, later, include their data with it.
 *
 * The browser session (localStorage) stays the source of truth: this cookie
 * only mirrors its access token and is rewritten whenever Supabase signs in,
 * refreshes the token or signs out. It holds nothing localStorage doesn't
 * already hold, and the server still verifies the token before trusting it.
 */
export const SESSION_COOKIE = "pc-access-token";

type MirroredSession = { access_token: string; expires_at?: number } | null;

export function writeSessionCookie(session: MirroredSession): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (!session?.access_token) {
    document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  const maxAge = session.expires_at
    ? Math.max(0, Math.floor(session.expires_at - Date.now() / 1000))
    : 3600;
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
