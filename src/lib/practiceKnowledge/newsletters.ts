import type { BlueprintBlock } from "./types";

const LIBRARY_KEY = /^content:nl-[a-z0-9]{6,12}(?:-cover|-inbox|-post|-inmail|-article)?$/;

export function isNewsletterLibraryKey(key: string): boolean {
  return LIBRARY_KEY.test(key);
}

const STANDING_LABELS = new Set(["name", "who it is for", "how often", "call to action", "the analogy"]);

/** A line about the newsletter itself. That belongs in Newsletter info, not in an issue. */
function isSeriesBlurb(text: string): boolean {
  const line = text.toLowerCase();
  return /per issue|each issue|this newsletter|plain-english read|plain english read|one idea per/.test(line);
}

/** The issue is the article. Name, audience, cadence and the close live in Newsletter info. */
export function stripStandingFacts(blocks: BlueprintBlock[]): BlueprintBlock[] {
  const out: BlueprintBlock[] = [];
  let seenHeading = false;
  for (const block of blocks) {
    if (block.type === "heading") seenHeading = true;
    if (!seenHeading && (block.type === "lede" || block.type === "paragraph") && isSeriesBlurb(block.text)) continue;
    if (block.type !== "pairs") {
      out.push(block);
      continue;
    }
    const items = block.items.filter((item) => !STANDING_LABELS.has(item.label.trim().toLowerCase()));
    if (items.length) out.push({ ...block, items });
  }
  return out;
}

export function isNewsletterOverviewKey(key: string): boolean {
  return key === "content:newsletter" || key === "content:analogy" || key === "content:kpis" || /^content:nl-[a-z0-9]{6,12}$/.test(key);
}

/** The topic of an issue, from its first heading. */
export function issueHeading(blocks: BlueprintBlock[] | undefined, fallback: string): string {
  if (!blocks?.length) return fallback;
  for (const block of blocks) {
    if (block.type === "heading" && block.text.trim() && !/next six issues/i.test(block.text)) {
      return block.text.trim().slice(0, 80);
    }
  }
  return fallback;
}

/** List title: the Name line, otherwise the first heading. */
export function newsletterTitle(blocks: BlueprintBlock[] | undefined, fallback: string): string {
  if (!blocks?.length) return fallback;
  for (const block of blocks) {
    if (block.type !== "pairs") continue;
    const name = block.items.find((item) => item.label.trim().toLowerCase() === "name")?.value.trim();
    if (name) return name.slice(0, 80);
  }
  for (const block of blocks) {
    if ((block.type === "heading" || block.type === "lede") && block.text.trim()) {
      return block.text.trim().slice(0, 80);
    }
  }
  return fallback;
}
