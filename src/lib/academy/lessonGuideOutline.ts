/**
 * Section outline for the Guide tab, so a long written walkthrough can be
 * skimmed and jumped around.
 *
 * Slugs are derived from the heading text alone (no de-duplication counter) so
 * that `AcademyMarkdown`, which renders each heading in isolation, and this
 * outline always agree on the anchor.
 */

import { normalizeLessonMarkdown } from "./normalizeLessonMarkdown";

export type LessonGuideHeading = {
  level: 1 | 2 | 3;
  text: string;
  slug: string;
};

/**
 * Strip inline markdown so a heading reads as a plain label. Safe to pass either
 * markdown source or already-rendered text, so slugs computed while rendering
 * and slugs computed from the source always agree.
 */
export function headingLabel(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:\s]+$/, "")
    .trim();
}

export function headingSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

/** Every H1–H3 heading of a guide, ignoring anything inside fenced code blocks. */
export function lessonGuideOutline(markdown: string): LessonGuideHeading[] {
  if (!markdown.trim()) return [];

  const lines = normalizeLessonMarkdown(markdown).split("\n");
  const headings: LessonGuideHeading[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!match) continue;

    const text = headingLabel(match[2]);
    if (!text) continue;

    headings.push({
      level: match[1].length as 1 | 2 | 3,
      text,
      slug: headingSlug(text),
    });
  }

  return headings;
}

/** Headings that swallowed an image caption on import, not real sections. */
const CAPTION_NOISE =
  /\.(jpe?g|png|gif|webp|svg)\b|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Long enough to read as a section name, short enough to scan in a list. */
const MAX_LABEL_CHARS = 70;

function shortenLabel(text: string): string {
  if (text.length <= MAX_LABEL_CHARS) return text;
  const cut = text.slice(0, MAX_LABEL_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The headings that read as this guide's sections.
 *
 * Imported lessons are inconsistent about depth — many use `###` throughout with
 * a stray `##` in the middle — so the section level is whichever depth is
 * actually carrying the structure, plus anything shallower.
 */
export function lessonGuideSections(
  headings: LessonGuideHeading[]
): LessonGuideHeading[] {
  if (headings.length === 0) return [];

  const counts = new Map<number, number>();
  for (const h of headings) counts.set(h.level, (counts.get(h.level) ?? 0) + 1);

  const levels = [...counts.keys()].sort((a, b) => a - b);
  const deepest =
    levels.find((level) => (counts.get(level) ?? 0) >= 3) ??
    levels[levels.length - 1];

  return headings
    .filter((h) => h.level <= deepest && !CAPTION_NOISE.test(h.text))
    .map((h) => ({ ...h, text: shortenLabel(h.text) }));
}
