import { Marked } from "marked";

import { LESSON_EMBED_LANG, embedPlaceholderHtml } from "./lessonHtmlEmbed";

/**
 * Editor renderer: matches AcademyMarkdown output, except `html-embed` code
 * fences become a non-editable placeholder card (the live embed is only shown
 * to coaches; admins edit the underlying HTML via the embed dialog).
 */
const editorMarked = new Marked({ gfm: true, breaks: true });
editorMarked.use({
  renderer: {
    code(token) {
      if (token.lang === LESSON_EMBED_LANG) {
        return embedPlaceholderHtml(token.text);
      }
      return false;
    },
  },
});

/** Render lesson markdown to HTML for the visual editor (matches AcademyMarkdown output). */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  const html = editorMarked.parse(markdown) as string;
  return html.trim();
}
