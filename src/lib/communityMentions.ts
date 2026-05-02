import type { ProfileNames } from "@/lib/communityProfile";
import { displayNameFromProfile } from "@/lib/communityProfile";

/** Stored format: @ plus UUID (no brackets). */
export const MENTION_UUID_REGEX =
  /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

export function extractMentionUserIds(body: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_UUID_REGEX.source, "gi");
  while ((m = re.exec(body)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; userId: string };

export function splitMentionSegments(body: string): MentionSegment[] {
  const re = new RegExp(MENTION_UUID_REGEX.source, "gi");
  const out: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", text: body.slice(last, m.index) });
    }
    out.push({ kind: "mention", userId: m[1] });
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    out.push({ kind: "text", text: body.slice(last) });
  }
  return out;
}

export function bodyPreviewWithoutRawUuids(body: string): string {
  return body.replace(
    /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    "@member"
  );
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
