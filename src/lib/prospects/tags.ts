import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeProspectTags } from "@/lib/prospects/tagNormalize";
export {
  MAX_PROSPECT_TAG_LENGTH,
  MAX_PROSPECT_TAGS,
  normalizeProspectTag,
  normalizeProspectTags,
} from "@/lib/prospects/tagNormalize";

export function parseProspectTags(value: unknown): string[] {
  return normalizeProspectTags(value);
}

export async function listCoachProspectTags(coachId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("prospect_tags")
    .eq("coach_id", coachId)
    .eq("type", "prospect");

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return [];
    console.error("listCoachProspectTags:", error);
    return [];
  }

  return normalizeProspectTags(
    (data ?? []).flatMap((row) =>
      Array.isArray(row.prospect_tags) ? row.prospect_tags : []
    )
  );
}
