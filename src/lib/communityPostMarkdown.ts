import { defaultUrlTransform } from "react-markdown";
import type { UrlTransform } from "react-markdown";
import { splitTextWithHttpUrls } from "@/lib/communityAutolink";
import {
  MENTION_UUID_REGEX,
  splitMentionSegments,
} from "@/lib/communityMentions";

const MD_FRAGMENT_PLACEHOLDER = "\uE000md";
const MD_FRAGMENT_END = "\uE001";

/** Protect existing markdown links/code from bare-URL autolinking (same detector as feed previews). */
function protectMarkdownFragments(source: string): { text: string; saved: string[] } {
  const saved: string[] = [];
  const protect = (re: RegExp) => {
    source = source.replace(re, (match) => {
      saved.push(match);
      return `${MD_FRAGMENT_PLACEHOLDER}${saved.length - 1}${MD_FRAGMENT_END}`;
    });
  };
  protect(/!?\[[^\]]*]\([^)]*\)/g);
  protect(/<https?:\/\/[^>]+>/gi);
  protect(/`[^`]+`/g);
  return { text: source, saved };
}

function restoreMarkdownFragments(text: string, saved: string[]): string {
  return text.replace(
    new RegExp(`${MD_FRAGMENT_PLACEHOLDER}(\\d+)${MD_FRAGMENT_END}`, "g"),
    (_, index) => saved[Number(index)] ?? ""
  );
}

/** Wrap bare http(s) URLs as markdown links (matches feed/comment autolink behaviour). */
export function autolinkBareHttpUrlsForMarkdown(body: string): string {
  const { text, saved } = protectMarkdownFragments(body);
  const parts = splitTextWithHttpUrls(text);
  const linked = parts
    .map((part) =>
      part.type === "text" ? part.text : `[${part.label}](${part.href})`
    )
    .join("");
  return restoreMarkdownFragments(linked, saved);
}

/** Markdown source for display: normalizes legacy `@uuid` mentions into link form the parser understands. */
export function prepareCommunityPostMarkdownSource(
  body: string,
  nameById: Record<string, string>
): string {
  const withMentions = body.replace(MENTION_UUID_REGEX, (_m, uuid: string) => {
    const raw = nameById[uuid] ?? "member";
    const name = raw.replace(/[[\]]/g, "");
    return `[@${name}](mention:${uuid})`;
  });
  return autolinkBareHttpUrlsForMarkdown(withMentions);
}

/** Keeps `mention:` links intact; otherwise delegates to react-markdown defaults. */
export const communityPostMarkdownUrlTransform: UrlTransform = (value) => {
  if (value.startsWith("mention:")) return value;
  return defaultUrlTransform(value);
};

/**
 * Strips common markdown/list markers from a text fragment (e.g. a segment
 * between mention tokens). Does not resolve mentions.
 */
export function stripInlineMarkdownForCommunityPreviewFragment(s: string): string {
  let x = s;
  x = x.replace(/\[([^\]]*)\]\((?!mention:)[^)]*\)/g, "$1");
  x = x.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  x = x.replace(/^#{1,6}\s+/gm, "");
  x = x.replace(/\*\*([^*]+)\*\*/g, "$1");
  x = x.replace(/\*([^*\n]+)\*/g, "$1");
  x = x.replace(/__([^_]+)__/g, "$1");
  x = x.replace(/_([^_\n]+)_/g, "$1");
  x = x.replace(/`([^`]+)`/g, "$1");
  x = x.replace(/^(\s*)[-*+]\s+/gm, "$1");
  x = x.replace(/^(\s*)\d+\.\s+/gm, "$1");
  x = x.replace(/^>\s?/gm, "");
  return x;
}

/**
 * Plain-ish text for feed cards and notification snippets: shows @DisplayName
 * only (no mention:uuid tokens), then strips common markdown noise.
 */
export function communityPostCardPreview(
  body: string,
  nameById: Record<string, string> = {}
): string {
  return splitMentionSegments(body)
    .map((seg) => {
      if (seg.kind === "mention") {
        const raw =
          seg.labelFromToken ?? nameById[seg.userId] ?? "member";
        return `@${raw.replace(/[[\]]/g, "")}`;
      }
      return stripInlineMarkdownForCommunityPreviewFragment(seg.text);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
