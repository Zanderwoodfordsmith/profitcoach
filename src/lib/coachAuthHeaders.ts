import { supabaseClient } from "@/lib/supabaseClient";

const COACH_STORAGE_KEY = "boss_impersonate_coach";

/** Read view-as coach id from sessionStorage (for non-React helpers). */
export function getStoredImpersonatingCoachId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COACH_STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Bearer + optional x-impersonate-coach-id for coach-scoped APIs.
 * Pass an explicit id from React context when available; otherwise falls back
 * to sessionStorage so module-level helpers (wizard API) stay in sync.
 */
export async function getCoachAuthHeaders(
  impersonatingCoachId?: string | null
): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };

  const id =
    (impersonatingCoachId && impersonatingCoachId.trim()) ||
    getStoredImpersonatingCoachId();
  if (id) {
    headers["x-impersonate-coach-id"] = id;
  }

  return headers;
}
