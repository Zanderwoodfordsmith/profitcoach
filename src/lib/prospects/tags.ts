import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const MAX_PROSPECT_TAGS = 20;
export const MAX_PROSPECT_TAG_LENGTH = 32;

export function normalizeProspectTag(raw: string): string | null {
  const tag = raw.replace(/\s+/g, " ").trim();
  if (!tag) return null;
  return tag.slice(0, MAX_PROSPECT_TAG_LENGTH);
}

export function normalizeProspectTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const tag = normalizeProspectTag(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_PROSPECT_TAGS) break;
  }
  return tags;
}

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
