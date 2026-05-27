import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Render lesson markdown to HTML for the visual editor (matches AcademyMarkdown output). */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  const html = marked.parse(markdown) as string;
  return html.trim();
}
