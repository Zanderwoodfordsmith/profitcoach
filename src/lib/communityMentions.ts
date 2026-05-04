import type { ProfileNames } from "@/lib/communityProfile";
import { displayNameFromProfile } from "@/lib/communityProfile";

/** Tailwind classes for @mention chips (hyperlink blue; `!` wins over parent `text-slate-*`). */
export const COMMUNITY_MENTION_LINK_CLASS =
  "font-medium !text-blue-600 underline underline-offset-2 decoration-blue-600/40 hover:!text-blue-500 hover:decoration-blue-500";

/** Legacy stored format: @ plus UUID (no brackets). */
export const MENTION_UUID_REGEX =
  /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/**
 * Readable token: [@Display Name](mention:uuid) — used in composers so UUIDs are not shown.
 * Legacy @uuid posts still parse.
 */
export const MENTION_MARKDOWN_REGEX =
  /\[@([^\]]+)\]\(mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

const MENTION_ANY_SOURCE =
  "\\[@([^\\]]+)\\]\\(mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\)|@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";

export function extractMentionUserIds(body: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_ANY_SOURCE, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[2]) ids.add(m[2]);
    else if (m[3]) ids.add(m[3]);
  }
  return [...ids];
}

export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; userId: string; labelFromToken?: string };

export function splitMentionSegments(body: string): MentionSegment[] {
  const re = new RegExp(MENTION_ANY_SOURCE, "gi");
  const out: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", text: body.slice(last, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      out.push({
        kind: "mention",
        userId: m[2],
        labelFromToken: m[1],
      });
    } else if (m[3] !== undefined) {
      out.push({ kind: "mention", userId: m[3] });
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    out.push({ kind: "text", text: body.slice(last) });
  }
  return out;
}

export function bodyPreviewWithoutRawUuids(body: string): string {
  return body
    .replace(new RegExp(MENTION_MARKDOWN_REGEX.source, "gi"), "@$1")
    .replace(new RegExp(MENTION_UUID_REGEX.source, "gi"), "@member");
}

export function buildNameMap(
  profiles: Array<ProfileNames & { id: string }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of profiles) {
    map[p.id] = displayNameFromProfile(p);
  }
  return map;
}
