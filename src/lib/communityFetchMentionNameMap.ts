import { supabaseClient } from "@/lib/supabaseClient";
import { buildNameMap } from "@/lib/communityMentions";
import type { ProfileNames } from "@/lib/communityProfile";

/** Loads display names for @mention resolution on the feed (and similar). */
export async function fetchCommunityMentionNameMap(
  ids: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, first_name, last_name")
    .in("id", unique);
  if (error) return {};
  return buildNameMap((data ?? []) as Array<ProfileNames & { id: string }>);
}
