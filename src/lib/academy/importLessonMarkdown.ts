/**
 * Normalizes markdown pasted or imported from Google Docs / Disco exports
 * so headings, lists, and links render correctly in AcademyMarkdown.
 */
export function normalizeImportedLessonMarkdown(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Google Docs often escapes punctuation: \! \- \> etc.
  text = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");

  // Normalize bold markers with spaces: ** text ** → **text**
  text = text.replace(/\*\*\s+([^*]+?)\s+\*\*/g, "**$1**");

  // Collapse 3+ blank lines to 2
  text = text.replace(/\n{4,}/g, "\n\n\n");

  return text.trim();
}

/** If the doc starts with a single # heading, use it as the lesson title and drop it from the body. */
export function splitTitleFromImportedMarkdown(markdown: string): {
  title: string | null;
  body: string;
} {
  const normalized = normalizeImportedLessonMarkdown(markdown);
  const lines = normalized.split("\n");
  const first = lines[0]?.trim() ?? "";

  const h1 = first.match(/^#\s+(.+)$/);
  if (!h1) {
    return { title: null, body: normalized };
  }

  const title = h1[1]
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();

  const body = lines.slice(1).join("\n").replace(/^\n+/, "").trim();
  return { title: title || null, body };
}

/** Insert converted markdown at the textarea caret, or replace all content. */
export function applyImportedMarkdownToEditor(input: {
  current: string;
  imported: string;
  selectionStart: number;
  selectionEnd: number;
}): string {
  const { current, imported, selectionStart, selectionEnd } = input;
  if (!current.trim()) return imported;
  if (!imported.trim()) return current;
  const hasSelection = selectionStart !== selectionEnd;
  if (hasSelection) {
    return current.slice(0, selectionStart) + imported + current.slice(selectionEnd);
  }
  const replace = window.confirm(
    "Replace the current lesson content with what you pasted? Click Cancel to append instead."
  );
  return replace ? imported : `${current.trimEnd()}\n\n${imported}`;
}

export async function readMarkdownFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
    throw new Error("Please choose a .md or .txt file.");
  }
  const text = await file.text();
  if (!text.trim()) {
    throw new Error("That file is empty.");
  }
  return text;
}
