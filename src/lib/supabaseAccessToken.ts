import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Resolves the browser Supabase session after navigation or first paint.
 * `getSession()` alone can briefly return null while auth restores from storage;
 * this follows the same recovery path as `getValidSupabaseAccessToken`.
 */
export async function resolveSupabaseBrowserSession(): Promise<Session | null> {
  const {
    data: { session: first },
  } = await supabaseClient.auth.getSession();
  if (first?.user) return first;

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
 * the client has no access_token in memory (common right after load).
 */
export async function getValidSupabaseAccessToken(): Promise<string | null> {
  const session = await resolveSupabaseBrowserSession();
  return session?.access_token ?? null;
}
