import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Returns a usable JWT for same-origin API routes. Refreshes the session when
 * the client has no access_token in memory (common right after load).
 */
export async function getValidSupabaseAccessToken(): Promise<string | null> {
  const {
    data: { session: first },
  } = await supabaseClient.auth.getSession();
  if (first?.access_token) return first.access_token;

  const { data, error } = await supabaseClient.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
