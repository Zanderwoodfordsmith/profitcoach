import TurndownService from "turndown";

import { normalizeImportedLessonMarkdown } from "./importLessonMarkdown";

let turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      emDelimiter: "*",
      codeBlockStyle: "fenced",
    });
    turndown.keep(["a"]);
    turndown.remove(["style", "script", "meta", "head"]);
  }
  return turndown;
}

/** True when clipboard HTML looks like rich text (Google Docs, Word, etc.). */
export function clipboardHasRichHtml(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed || !/<[a-z][\s\S]*>/i.test(trimmed)) return false;
  return /<(p|div|h[1-6]|ul|ol|li|table|span|b|strong|i|em|a)\b/i.test(trimmed);
}

/** Convert pasted HTML (e.g. from Google Docs) to lesson markdown. */
export function htmlToLessonMarkdown(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, "");

  let md = getTurndown().turndown(cleaned);
  md = md.replace(/\n{3,}/g, "\n\n");
  return normalizeImportedLessonMarkdown(md);
}

/**
 * Best-effort markdown from clipboard: prefer HTML (Docs) then plain markdown.
 * Returns null to use the browser default paste (plain text only).
 */
export function clipboardToLessonMarkdown(html: string, plain: string): string | null {
  if (html.trim() && clipboardHasRichHtml(html)) {
    const fromHtml = htmlToLessonMarkdown(html);
    if (fromHtml.trim()) return fromHtml;
  }

  const trimmedPlain = plain.trim();
  if (!trimmedPlain) return null;

  const looksLikeMarkdown =
    /^#{1,6}\s/m.test(trimmedPlain) ||
    /\*\*[^*]+\*\*/.test(trimmedPlain) ||
    /^\s*[-*+]\s/m.test(trimmedPlain) ||
    /^\s*\d+\.\s/m.test(trimmedPlain) ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmedPlain);

  if (looksLikeMarkdown) {
    return normalizeImportedLessonMarkdown(trimmedPlain);
  }

  return null;
}
