/**
 * Derive a short Overview from a long written guide.
 *
 * Imported lessons put the whole walkthrough in `body_markdown`, which then
 * renders squeezed beside the actions column on the Overview tab. The
 * walkthrough belongs on the Guide tab, and Overview should say what the lesson
 * is and what the guide covers.
 *
 * The lead sentence is lifted from the lesson's own framing section ("What Is
 * This", "Summary", "Objective", …) so the wording stays the author's.
 */

import {
  lessonGuideOutline,
  lessonGuideSections,
  type LessonGuideHeading,
} from "./lessonGuideOutline";
import { normalizeLessonMarkdown } from "./normalizeLessonMarkdown";

/** Sections that introduce a lesson rather than instruct. */
const FRAMING_HEADING =
  /^(what is this|what'?s this|what it is|what is it|summary|overview|objective|objectives|purpose|introduction|intro|why is (this|it) important|why it'?s important)\b/;

/** Sections that are navigation or housekeeping, not part of the substance. */
const SKIPPED_SECTION = /^(resources?|time.?stamps?|timestamps)\b/;

const MAX_LEAD_WORDS = 80;
const MAX_SECTIONS = 12;

type Block = { heading: LessonGuideHeading | null; body: string[] };

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Split a guide into its heading/body blocks, keeping code fences intact. */
function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [{ heading: null, body: [] }];
  const headings = lessonGuideOutline(markdown);
  let headingIndex = 0;
  let inFence = false;

  for (const line of normalizeLessonMarkdown(markdown).split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;

    const match = inFence ? null : /^#{1,3}\s+/.exec(line);
    if (match) {
      blocks.push({ heading: headings[headingIndex] ?? null, body: [] });
      headingIndex += 1;
      continue;
    }
    if (!inFence && /^#{4,6}\s+/.test(line)) {
      blocks.push({ heading: null, body: [] });
      continue;
    }
    blocks[blocks.length - 1].body.push(line);
  }

  return blocks;
}

/** Paragraphs of prose in a block — no lists, images, tables, or quotes. */
function proseParagraphs(body: string[]): string[] {
  return body
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !/^[-*+>|#]/.test(p) &&
        !/^\d+[.)]\s/.test(p) &&
        !/^!\[/.test(p) &&
        !/^\[[^\]]*\]\(/.test(p) &&
        !/^```/.test(p)
    );
}

/** Whole sentences up to the word budget, so the lead never trails off. */
function trimToSentences(paragraph: string): string {
  if (wordCount(paragraph) <= MAX_LEAD_WORDS) return paragraph;

  const sentences = paragraph.match(/[^.!?]+[.!?]+[\s"']*|[^.!?]+$/g) ?? [paragraph];
  let lead = "";
  for (const sentence of sentences) {
    if (lead && wordCount(lead + sentence) > MAX_LEAD_WORDS) break;
    lead += sentence;
  }
  return (lead || sentences[0]).trim();
}

/**
 * The lesson's own opening line: prose before the first heading, else the
 * framing section, else the first prose paragraph in the document.
 */
function leadParagraph(blocks: Block[]): string {
  const candidates: string[][] = [];

  const preamble = proseParagraphs(blocks[0]?.body ?? []);
  if (preamble.length > 0) candidates.push(preamble);

  for (const block of blocks) {
    const label = block.heading?.text.toLowerCase();
    if (!label || !FRAMING_HEADING.test(label)) continue;
    const paragraphs = proseParagraphs(block.body);
    if (paragraphs.length > 0) candidates.push(paragraphs);
  }

  for (const block of blocks) {
    const paragraphs = proseParagraphs(block.body);
    if (paragraphs.length > 0) candidates.push(paragraphs);
  }

  // A paragraph that doesn't finish its sentence is a lead-in to a list or an
  // image, not a summary — prefer one that stands on its own.
  const complete = (text: string) => wordCount(text) >= 8 && /[.!?]["')\]]?$/.test(text);
  const chosen =
    candidates.find((paragraphs) => complete(paragraphs[0])) ??
    candidates.find((paragraphs) => wordCount(paragraphs[0]) >= 12);

  if (!chosen) return "";
  return trimToSentences(chosen[0]).replace(/[ \t]+$/gm, "").trim();
}

export type LessonOverviewDraft = {
  markdown: string;
  leadWords: number;
  sections: string[];
};

/** Build the short Overview that replaces a guide-length body. */
export function lessonOverviewFromGuide(guideMarkdown: string): LessonOverviewDraft {
  const blocks = toBlocks(guideMarkdown);
  const lead = leadParagraph(blocks);

  const sections = lessonGuideSections(lessonGuideOutline(guideMarkdown))
    .map((h) => h.text)
    .filter((text) => !SKIPPED_SECTION.test(text.toLowerCase()))
    .filter((text) => !FRAMING_HEADING.test(text.toLowerCase()))
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, MAX_SECTIONS);

  const parts: string[] = [];
  if (lead) parts.push(lead);
  if (sections.length > 1) {
    parts.push("**In this guide**");
    parts.push(sections.map((text) => `- ${text}`).join("\n"));
  }

  return {
    markdown: parts.join("\n\n"),
    leadWords: wordCount(lead),
    sections,
  };
}
