import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";

const EXPIRY_SKEW_MS = 60_000;

function sessionUsable(session: Session | null): session is Session {
  if (!session?.user || !session.access_token) return false;
  if (!session.expires_at) return true;
  return session.expires_at * 1000 > Date.now() + EXPIRY_SKEW_MS;
}

/**
 * Resolves the browser Supabase session after navigation or first paint.
 * `getSession()` can return null while auth restores from storage, and can
 * also hand back an expired JWT. Refresh before using it as Bearer.
 */
export async function resolveSupabaseBrowserSession(): Promise<Session | null> {
  const {
    data: { session: first },
  } = await supabaseClient.auth.getSession();
  if (sessionUsable(first)) return first;

  const { data: refreshed, error: refreshError } =
    await supabaseClient.auth.refreshSession();
  if (!refreshError && refreshed.session?.user) return refreshed.session;

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();
  if (userError || !user) return null;

  const {
    data: { session: again },
  } = await supabaseClient.auth.getSession();
  return again?.user ? again : null;
}

/**
 * Returns a usable JWT for same-origin API routes. Refreshes the session when
 * the client has no access_token in memory or the cached JWT is expired.
 */
export async function getValidSupabaseAccessToken(): Promise<string | null> {
  const session = await resolveSupabaseBrowserSession();
  return session?.access_token ?? null;
}
