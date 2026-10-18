/**
 * Prospect tag normalising, safe for the browser (tag storage stays in tags.ts).
 */

export const MAX_PROSPECT_TAG_LENGTH = 32;

export function normalizeProspectTag(raw: string): string | null {
  const tag = raw.replace(/\s+/g, " ").trim();
  if (!tag) return null;
  return tag.slice(0, MAX_PROSPECT_TAG_LENGTH);
}

export const MAX_PROSPECT_TAGS = 20;

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
