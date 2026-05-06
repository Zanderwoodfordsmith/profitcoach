import { defaultUrlTransform } from "react-markdown";
import type { UrlTransform } from "react-markdown";
import { bodyPreviewWithoutRawUuids, MENTION_UUID_REGEX } from "@/lib/communityMentions";

/** Markdown source for display: normalizes legacy `@uuid` mentions into link form the parser understands. */
export function prepareCommunityPostMarkdownSource(
  body: string,
  nameById: Record<string, string>
): string {
  return body.replace(MENTION_UUID_REGEX, (_m, uuid: string) => {
    const raw = nameById[uuid] ?? "member";
    const name = raw.replace(/[[\]]/g, "");
    return `[@${name}](mention:${uuid})`;
  });
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
 * Plain-ish text for feed cards: resolves mention tokens, then strips common
 * markdown so previews do not show raw `#` or `**`.
 */
export function communityPostCardPreview(body: string): string {
  const base = bodyPreviewWithoutRawUuids(body);
  return stripInlineMarkdownForCommunityPreviewFragment(base).trim();
}
