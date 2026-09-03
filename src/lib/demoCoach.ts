import {
  DEMO_COACH_LABEL,
  DEMO_COACH_SLUG,
} from "@/lib/primaryCoach";
import { supabaseClient } from "@/lib/supabaseClient";

export { DEMO_COACH_LABEL, DEMO_COACH_SLUG };

let cachedDemoCoachId: string | null = null;

/** Resolve the QA demo coach id (admin-only). Cached for the session. */
export async function resolveDemoCoachId(): Promise<string | null> {
  if (cachedDemoCoachId) return cachedDemoCoachId;
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  const res = await fetch(
    `/api/admin/coaches/${encodeURIComponent(DEMO_COACH_SLUG)}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    coach?: { id?: string };
    id?: string;
  };
  const id = body.coach?.id?.trim() || body.id?.trim() || null;
  if (id) cachedDemoCoachId = id;
  return id;
}
