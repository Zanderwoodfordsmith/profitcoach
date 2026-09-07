import { supabaseClient } from "@/lib/supabaseClient";
import {
  DEMO_COACH_LABEL,
  DEMO_COACH_SLUG,
} from "@/lib/primaryCoach";

export { DEMO_COACH_LABEL, DEMO_COACH_SLUG };

const cachedCoachIds = new Map<string, string>();

/** Resolve a coach id by slug (admin-only API). Cached per slug for the session. */
export async function resolveCoachIdBySlug(
  slug: string
): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const cached = cachedCoachIds.get(normalized);
  if (cached) return cached;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;

  const res = await fetch(
    `/api/admin/coaches/${encodeURIComponent(normalized)}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  if (!res.ok) return null;

  const body = (await res.json().catch(() => ({}))) as {
    coach?: { id?: string };
    id?: string;
  };
  const id = body.coach?.id?.trim() || body.id?.trim() || null;
  if (id) cachedCoachIds.set(normalized, id);
  return id;
}

/** Resolve the Zander demo coach id. Cached for the session. */
export async function resolveDemoCoachId(): Promise<string | null> {
  return resolveCoachIdBySlug(DEMO_COACH_SLUG);
}
