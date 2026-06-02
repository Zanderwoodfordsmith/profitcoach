/**
 * Parse a "tab per lesson" Google Docs export (one big markdown file) into
 * per-lesson chunks. Each Google Docs tab becomes a top-level `#` H1; the H1 is
 * the (possibly 50-char-truncated) lesson title and everything until the next
 * lesson H1 is the body.
 *
 * Used by scripts/import-academy-lesson-bodies-from-docs.ts to match each chunk
 * to a legacy-hub lesson and upsert its body_markdown.
 */

import fs from "node:fs";

import { normalizeMatchText } from "./normalizeMatchText";

export type ParsedLessonDoc = {
  /** Cleaned H1 text, may keep a trailing duration like "PRO Energy (44m)". */
  title: string;
  /** Lesson body markdown (title line removed), raw — caller normalizes. */
  bodyMarkdown: string;
  /** Source file basename, for reporting. */
  sourceFile: string;
  /** 1-based line of the title H1, for reporting. */
  sourceLine: number;
};

/** A single `#` H1 (not `##`/`###`). */
function isH1(line: string): boolean {
  return /^#\s+\S/.test(line);
}

function h1Text(line: string): string {
  return line.replace(/^#\s+/, "");
}

/** Strip Google Docs escaping and bold markers from a heading. */
function cleanHeadingText(raw: string): string {
  return raw
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Two headings are "the same lesson" (handles `Lesson 4: X` vs `X`, durations). */
function titlesSimilar(a: string, b: string): boolean {
  const strip = (s: string) =>
    normalizeMatchText(s.replace(/^lesson\s+\d+\s*[:.\-]?\s*/i, ""));
  const na = strip(a);
  const nb = strip(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Drop leading blank lines + a leading H1 that just repeats the lesson title. */
function stripLeadingDuplicateTitle(bodyLines: string[], title: string): string[] {
  const lines = [...bodyLines];
  const dropLeadingBlanks = () => {
    while (lines.length && lines[0].trim() === "") lines.shift();
  };
  dropLeadingBlanks();
  while (lines.length && isH1(lines[0])) {
    const heading = cleanHeadingText(h1Text(lines[0]));
    if (titlesSimilar(heading, title)) {
      lines.shift();
      dropLeadingBlanks();
    } else {
      break;
    }
  }
  return lines;
}

/**
 * Split one document's markdown into lessons.
 *
 * Consecutive H1s separated only by blank lines (e.g. a tab title followed by a
 * redundant `# **Lesson 4: …**` heading) are merged into a single lesson rather
 * than creating an empty lesson.
 */
export function parseLessonDocMarkdown(
  markdown: string,
  sourceFile = "(inline)"
): ParsedLessonDoc[] {
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  const h1Indices: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isH1(lines[i])) h1Indices.push(i);
  }
  if (h1Indices.length === 0) return [];

  // Decide which H1s actually begin a new lesson (vs. a merged duplicate title).
  const lessonStartIndices: number[] = [];
  for (let k = 0; k < h1Indices.length; k += 1) {
    const idx = h1Indices[k];
    if (k === 0) {
      lessonStartIndices.push(idx);
      continue;
    }
    const prevIdx = h1Indices[k - 1];
    const between = lines.slice(prevIdx + 1, idx);
    const onlyBlank = between.every((l) => l.trim() === "");
    if (!onlyBlank) lessonStartIndices.push(idx);
  }

  const lessons: ParsedLessonDoc[] = [];
  for (let m = 0; m < lessonStartIndices.length; m += 1) {
    const titleLine = lessonStartIndices[m];
    const nextTitleLine = lessonStartIndices[m + 1] ?? lines.length;

    const title = cleanHeadingText(h1Text(lines[titleLine]));
    if (!title) continue;

    const bodyLines = stripLeadingDuplicateTitle(
      lines.slice(titleLine + 1, nextTitleLine),
      title
    );
    const bodyMarkdown = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

    lessons.push({
      title,
      bodyMarkdown,
      sourceFile,
      sourceLine: titleLine + 1,
    });
  }

  return lessons;
}

/** Read a markdown file from disk and parse it into lessons. */
export function parseLessonDocFile(filePath: string): ParsedLessonDoc[] {
  const markdown = fs.readFileSync(filePath, "utf8");
  const base = filePath.split("/").pop() ?? filePath;
  return parseLessonDocMarkdown(markdown, base);
}
