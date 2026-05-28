import TurndownService from "turndown";

import { serializeAccordionElement, LESSON_ACCORDION_CLASS } from "./lessonAccordion";
import { readElementTextColor, coloredTextHtml } from "./lessonTextColor";
import { normalizeImportedLessonMarkdown } from "./importLessonMarkdown";

let turndown: TurndownService | null = null;

function configureLessonTurndown(service: TurndownService): void {
  service.keep(["a"]);
  service.remove(["style", "script", "meta", "head"]);

  service.addRule("lessonTextColor", {
    filter(node) {
      if (node.nodeName !== "SPAN" && node.nodeName !== "FONT") return false;
      return Boolean(readElementTextColor(node as HTMLElement));
    },
    replacement(content, node) {
      const color = readElementTextColor(node as HTMLElement);
      if (!color) return content;
      return coloredTextHtml(content, color);
    },
  });

  service.addRule("lessonAccordion", {
    filter(node) {
      return (
        node.nodeName === "DETAILS" &&
        (node as HTMLElement).classList.contains(LESSON_ACCORDION_CLASS)
      );
    },
    replacement(_content, node) {
      return serializeAccordionElement(node as HTMLDetailsElement);
    },
  });
}

function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      emDelimiter: "*",
      codeBlockStyle: "fenced",
    });
    configureLessonTurndown(turndown);
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
