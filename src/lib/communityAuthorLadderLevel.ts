import { supabaseClient } from "@/lib/supabaseClient";
import { deriveCurrentLevelId } from "@/lib/ladder";

/** Highest achieved ladder level id per user (from community_ladder_achievements). */
export async function fetchHighestAchievedLevelByUserIds(
  userIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(userIds)].filter(Boolean);
  for (const id of unique) map.set(id, null);
  if (unique.length === 0) return map;

  const { data, error } = await supabaseClient
    .from("community_ladder_achievements")
    .select("user_id, level_id")
    .in("user_id", unique);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Community] ladder achievements:", error.message);
    }
    return map;
  }

  const byUser = new Map<string, { level_id: string }[]>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    const lid = row.level_id as string;
    const arr = byUser.get(uid) ?? [];
    arr.push({ level_id: lid });
    byUser.set(uid, arr);
  }
  for (const id of unique) {
    map.set(id, deriveCurrentLevelId(byUser.get(id) ?? []));
  }

  const { data: visibilityRows, error: visibilityError } = await supabaseClient
    .from("profiles")
    .select("id, show_ladder_level_on_profile")
    .in("id", unique);

  if (visibilityError) {
    // Backward compatible while the migration is rolling out.
    if (visibilityError.code === "42703") return map;
    if (process.env.NODE_ENV === "development") {
      console.warn("[Community] ladder visibility:", visibilityError.message);
    }
    return map;
  }

  const visibleByUser = new Map<string, boolean>();
  for (const row of visibilityRows ?? []) {
    visibleByUser.set(
      row.id as string,
      Boolean((row as { show_ladder_level_on_profile?: boolean | null }).show_ladder_level_on_profile)
    );
  }

  for (const id of unique) {
    if (!visibleByUser.get(id)) {
      map.set(id, null);
    }
  }
  return map;
}
