import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Latest app usage timestamp per user from `app_usage_sessions`
 * (page views + heartbeats while the tab is visible).
 * Distinct from auth `last_sign_in_at`, which only updates on sign-in.
 */
export async function loadLastActiveAtByUserId(
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const idChunkSize = 100;
  const pageSize = 1000;

  for (let i = 0; i < userIds.length; i += idChunkSize) {
    const chunk = userIds.slice(i, i + idChunkSize);
    const pending = new Set(chunk);
    let from = 0;

    while (pending.size > 0) {
      const { data, error } = await supabaseAdmin
        .from("app_usage_sessions")
        .select("user_id, last_activity_at")
        .in("user_id", chunk)
        .order("last_activity_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("loadLastActiveAtByUserId error:", error);
        break;
      }
      if (!data?.length) break;

      for (const row of data) {
        const uid = row.user_id as string;
        const at = row.last_activity_at as string | null;
        if (!uid || !at || !pending.has(uid)) continue;
        // Rows are newest-first, so first hit is the max for that user.
        map.set(uid, at);
        pending.delete(uid);
      }

      if (data.length < pageSize) break;
      from += pageSize;
      if (from > 50_000) break;
    }
  }

  return map;
}
