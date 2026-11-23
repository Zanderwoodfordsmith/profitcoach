import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Latest app usage timestamp per user from `app_usage_sessions`
 * (page views + heartbeats while the tab is visible).
 * Distinct from auth `last_sign_in_at`, which only updates on sign-in.
 *
 * One small indexed lookup per user, run in parallel. Scanning the table
 * newest-first instead had to read every row whenever a user had never
 * used the app (most coaches), which took ~7s on Admin → Coaches.
 */
export async function loadLastActiveAtByUserId(
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return map;

  const concurrency = 50;
  let next = 0;

  const worker = async () => {
    while (next < ids.length) {
      const uid = ids[next++];
      const { data, error } = await supabaseAdmin
        .from("app_usage_sessions")
        .select("last_activity_at")
        .eq("user_id", uid)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("loadLastActiveAtByUserId error:", error);
        continue;
      }
      const at = (data?.last_activity_at as string | null) ?? null;
      if (at) map.set(uid, at);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker)
  );

  return map;
}
