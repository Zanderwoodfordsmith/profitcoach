import type { JSONContent } from "@tiptap/react";
import { parseInline, serializeInline, type InlineSpan } from "@/lib/practiceKnowledge/inline";
import { withoutIssueNumber } from "@/lib/practiceKnowledge/newsletters";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

/**
 * A newsletter issue as one free-form document (the Newsletter tab's editor),
 * and back to the Blueprint blocks it is stored as. The "Subject:" line is the
 * title, the cover is its own picture, and anything that isn't article text
 * (the Format line, a planning table and its heading) is kept as it was, unseen.
 */
export type NewsletterDoc = {
  title: string | null;
  cover: string | null;
  /** Blocks the editor doesn't show. Saved back in front of the article, unchanged. */
  kept: BlueprintBlock[];
  content: JSONContent;
};

const SUBJECT = /^\s*subject:\s*/i;

/** A number or dash typed at the start of a line ("1. ", "2) ", "- ", "• "). In a real list it would show twice. */
export const LINE_MARKER = /^\s*(?:\d+[.)]|[-*•–])\s+/;

/** Block types the editor shows. The rest are kept as they were. */
const ARTICLE = new Set<BlueprintBlock["type"]>(["image", "heading", "lede", "paragraph", "message", "bullets", "numbered", "quote"]);

/** Text with **bold**, _italic_, ~~struck~~ and [linked](https://…) words, as editor nodes. */
function inlineNodes(text: string): JSONContent[] {
  const content: JSONContent[] = [];
  for (const span of parseInline(text)) {
    const marks: JSONContent["marks"] = [];
    if (span.href) marks.push({ type: "link", attrs: { href: span.href } });
    if (span.bold) marks.push({ type: "bold" });
    if (span.italic) marks.push({ type: "italic" });
    if (span.strike) marks.push({ type: "strike" });
    span.text.split("\n").forEach((line, i) => {
      if (i > 0) content.push({ type: "hardBreak" });
      if (line) content.push(marks.length ? { type: "text", text: line, marks } : { type: "text", text: line });
    });
  }
  return content;
}

function paragraph(text: string): JSONContent {
  const content = inlineNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function paragraphs(text: string): JSONContent[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/^\n+|\n+$/g, ""))
    .filter((part) => part.trim())
    .map(paragraph);
}

function list(type: "bulletList" | "orderedList", items: string[]): JSONContent {
  return { type, content: items.map((item) => ({ type: "listItem", content: [paragraph(item.replace(LINE_MARKER, ""))] })) };
}

export function blocksToDoc(blocks: BlueprintBlock[], { withTitle }: { withTitle: boolean }): NewsletterDoc {
  let title: string | null = null;
  let cover: string | null = null;
  const kept: BlueprintBlock[] = [];
  const nodes: JSONContent[] = [];

  /** Takes the "Subject:" line off the front of the first text, once. */
  const takeSubject = (text: string): string => {
    if (!withTitle || title !== null) return text;
    const [first, ...rest] = text.split("\n");
    if (!SUBJECT.test(first ?? "")) return text;
    title = (first ?? "").replace(SUBJECT, "").trim();
    return rest.join("\n");
  };

  blocks.forEach((block, i) => {
    switch (block.type) {
      case "image":
        if (block.cover && cover === null) cover = block.url;
        else nodes.push({ type: "image", attrs: { src: block.url, alt: block.alt ?? null, href: block.href ?? null } });
        break;
      case "heading": {
        const next = blocks[i + 1];
        // A heading straight over a message is only its label ("The first issue"): the message becomes the article.
        if (next?.type === "message") break;
        // A heading over a table or the like stays with it, out of the article.
        if (next && !ARTICLE.has(next.type)) {
          kept.push(block);
          break;
        }
        nodes.push({ type: "heading", attrs: { level: block.level === 3 ? 3 : 2 }, content: inlineNodes(block.text) });
        break;
      }
      case "lede":
      case "paragraph":
        nodes.push(...paragraphs(takeSubject(block.text)));
        break;
      case "message":
        nodes.push(...paragraphs(takeSubject(block.body)));
        break;
      case "bullets":
        nodes.push(list("bulletList", block.items));
        break;
      case "numbered":
        nodes.push(list("orderedList", block.items));
        break;
      case "quote":
        nodes.push({ type: "blockquote", content: paragraphs(block.cite ? `${block.text}\n\n${block.cite}` : block.text) });
        break;
      default:
        kept.push(block);
    }
  });

  let finalTitle: string | null = title;
  if (withTitle) {
    // An issue that opens with its own title as a heading ("Issue 2: Channels…"): that heading is the title, not the text.
    const first = nodes[0];
    if (first?.type === "heading") {
      const text = inline(first).trim();
      const same = (a: string) => withoutIssueNumber(a).toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (finalTitle === null) {
        finalTitle = text;
        nodes.shift();
      } else if (same(text) === same(finalTitle)) {
        nodes.shift();
      }
    }
    if (finalTitle) finalTitle = withoutIssueNumber(finalTitle);
  }

  return { title: finalTitle, cover, kept, content: { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] } };
}

/** Editor nodes back to text, with their marks written as light Markdown. */
function inline(node: JSONContent | undefined): string {
  const spans: InlineSpan[] = (node?.content ?? []).map((child) => {
    if (child.type === "hardBreak") return { text: "\n" };
    const span: InlineSpan = { text: child.text ?? "" };
    for (const mark of child.marks ?? []) {
      if (mark.type === "bold") span.bold = true;
      if (mark.type === "italic") span.italic = true;
      if (mark.type === "strike") span.strike = true;
      if (mark.type === "link" && typeof mark.attrs?.href === "string") span.href = mark.attrs.href;
    }
    return span;
  });
  return serializeInline(spans);
}

function itemText(item: JSONContent): string {
  return (item.content ?? []).map(inline).join("\n").trim();
}

export function docToBlocks(
  content: JSONContent,
  { title, cover, kept }: { title: string | null; cover: string | null; kept: BlueprintBlock[] }
): BlueprintBlock[] {
  const out: BlueprintBlock[] = [];
  if (cover) out.push({ type: "image", url: cover, cover: true });
  out.push(...kept);
  if (title?.trim()) out.push({ type: "paragraph", text: `Subject: ${title.trim()}` });
  for (const node of content.content ?? []) {
    switch (node.type) {
      case "paragraph": {
        const text = inline(node);
        if (text.trim()) out.push({ type: "paragraph", text });
        break;
      }
      case "heading": {
        const text = inline(node).trim();
        if (text) out.push(node.attrs?.level === 3 ? { type: "heading", text, level: 3 } : { type: "heading", text });
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? []).map((item) => itemText(item).replace(LINE_MARKER, "")).filter(Boolean);
        if (items.length) out.push({ type: node.type === "bulletList" ? "bullets" : "numbered", items });
        break;
      }
      case "blockquote": {
        const text = (node.content ?? []).map(inline).filter((t) => t.trim()).join("\n\n");
        if (text) out.push({ type: "quote", text });
        break;
      }
      case "image": {
        const src = String(node.attrs?.src ?? "");
        if (src)
          out.push({
            type: "image",
            url: src,
            ...(node.attrs?.alt ? { alt: String(node.attrs.alt) } : {}),
            ...(node.attrs?.href ? { href: String(node.attrs.href) } : {}),
          });
        break;
      }
      default:
        break;
    }
  }
  return out;
}
