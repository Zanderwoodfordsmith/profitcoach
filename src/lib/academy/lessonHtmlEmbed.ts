/**
 * Lesson HTML embeds let admins drop a self-contained HTML/CSS/JS snippet
 * (e.g. an AI client simulator) into a lesson. The snippet is stored in the
 * lesson markdown as a fenced code block tagged `html-embed`, so it survives
 * markdown storage and the editor round-trip without ever being parsed as live
 * HTML in the document. Coaches see it rendered inside a sandboxed iframe.
 */

/** Fence language used to mark an HTML embed inside lesson markdown. */
export const LESSON_EMBED_LANG = "html-embed";

/** Class on the editor-only placeholder element that stands in for an embed. */
export const LESSON_EMBED_BLOCK_CLASS = "lesson-embed-block";

/** Attribute on the editor placeholder that carries the raw embed HTML. */
export const LESSON_EMBED_ATTR = "data-embed-html";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Longest run of backticks in `text`, used to pick a safe fence length. */
function longestBacktickRun(text: string): number {
  let max = 0;
  const matches = text.match(/`+/g);
  if (matches) {
    for (const run of matches) max = Math.max(max, run.length);
  }
  return max;
}

/** Wrap raw HTML in a fenced `html-embed` code block for storage in markdown. */
export function embedFenceFromHtml(html: string): string {
  const body = html.replace(/\s+$/g, "");
  const fence = "`".repeat(Math.max(3, longestBacktickRun(body) + 1));
  return `${fence}${LESSON_EMBED_LANG}\n${body}\n${fence}`;
}

/**
 * Editor-only placeholder shown in the WYSIWYG in place of the live embed.
 * The raw HTML rides along in a data attribute so it can be edited and
 * round-tripped back to a fence (see htmlToLessonMarkdown).
 */
export function embedPlaceholderHtml(html: string): string {
  const chars = html.trim().length;
  return (
    `<div class="${LESSON_EMBED_BLOCK_CLASS}" ${LESSON_EMBED_ATTR}="${escapeHtml(html)}" contenteditable="false">` +
    `<span class="lesson-embed-block__icon" aria-hidden="true">&lt;/&gt;</span>` +
    `<span class="lesson-embed-block__title">Interactive HTML embed</span>` +
    `<span class="lesson-embed-block__hint">${chars} characters · click to edit</span>` +
    `</div>`
  );
}
