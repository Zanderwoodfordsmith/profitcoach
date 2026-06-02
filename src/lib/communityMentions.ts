import type { ProfileNames } from "@/lib/communityProfile";
import { displayNameFromProfile } from "@/lib/communityProfile";

/** Tailwind classes for @mention chips (hyperlink blue; `!` wins over parent `text-slate-*`). */
export const COMMUNITY_MENTION_LINK_CLASS =
  "font-medium !text-blue-600 underline underline-offset-2 decoration-blue-600/40 hover:!text-blue-500 hover:decoration-blue-500";

/** Member @mention chips: blue is enough to signal a link, so no underline. */
export const COMMUNITY_USER_MENTION_LINK_CLASS =
  "font-medium !text-blue-600 hover:!text-blue-500";

/** Academy areas a lesson/course mention can point at. */
export type AcademyArea = "classroom" | "programs";

const ACADEMY_AREA_BASE: Record<AcademyArea, string> = {
  classroom: "/coach/academy/classroom",
  programs: "/coach/academy/programs",
};

/** Legacy stored format: @ plus UUID (no brackets). */
export const MENTION_UUID_REGEX =
  /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/**
 * Member token: [@Display Name](mention:uuid) — used in composers so UUIDs are
 * not shown. Kept for callers that only care about member mentions.
 */
export const MENTION_MARKDOWN_REGEX =
  /\[@([^\]]+)\]\(mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

/**
 * Any mention token: [<@…>Label](mention:<target>).
 * `@` = member, `@@` = lesson, `@@@` = course. Target encodes the entity:
 *   - member: `uuid`
 *   - lesson: `lesson:courseId:lessonId`
 *   - course: `course:courseId`
 */
export const MENTION_TOKEN_REGEX =
  /\[(@{1,3})([^\]]+)\]\(mention:([^)\s]+)\)/gi;

/** Token form OR legacy bare `@uuid`. Groups: 1 prefix, 2 label, 3 target, 4 legacyUuid. */
const MENTION_ANY_SOURCE =
  "\\[(@{1,3})([^\\]]+)\\]\\(mention:([^)\\s]+)\\)" +
  "|@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MentionEntityType = "user" | "lesson" | "course";

export type ParsedMentionTarget =
  | { type: "user"; userId: string }
  | { type: "lesson"; area: AcademyArea; courseId: string; lessonId: string }
  | { type: "course"; area: AcademyArea; courseId: string }
  | null;

/**
 * Decodes a `mention:` target string into a typed entity reference. Formats:
 *   - `uuid`
 *   - `lesson:<area>:<courseId>:<lessonId>` (legacy `lesson:<courseId>:<lessonId>` ⇒ classroom)
 *   - `course:<area>:<courseId>` (legacy `course:<courseId>` ⇒ classroom)
 */
export function parseMentionTarget(target: string): ParsedMentionTarget {
  if (UUID_RE.test(target)) {
    return { type: "user", userId: target };
  }
  if (target.startsWith("lesson:")) {
    const parts = target.slice("lesson:".length).split(":");
    if (parts[0] === "classroom" || parts[0] === "programs") {
      const area = parts[0];
      const courseId = parts[1] ?? "";
      const lessonId = parts.slice(2).join(":");
      if (!courseId || !lessonId) return null;
      return { type: "lesson", area, courseId, lessonId };
    }
    const courseId = parts[0] ?? "";
    const lessonId = parts.slice(1).join(":");
    if (!courseId || !lessonId) return null;
    return { type: "lesson", area: "classroom", courseId, lessonId };
  }
  if (target.startsWith("course:")) {
    const parts = target.slice("course:".length).split(":");
    if (parts[0] === "classroom" || parts[0] === "programs") {
      const area = parts[0];
      const courseId = parts.slice(1).join(":");
      if (!courseId) return null;
      return { type: "course", area, courseId };
    }
    const courseId = parts.join(":");
    if (!courseId) return null;
    return { type: "course", area: "classroom", courseId };
  }
  return null;
}

/** Builds the `mention:` target string for a typed entity reference. */
export function buildMentionTarget(
  ref:
    | { type: "user"; userId: string }
    | { type: "lesson"; area: AcademyArea; courseId: string; lessonId: string }
    | { type: "course"; area: AcademyArea; courseId: string }
): string {
  if (ref.type === "user") return ref.userId;
  if (ref.type === "lesson") {
    return `lesson:${ref.area}:${ref.courseId}:${ref.lessonId}`;
  }
  return `course:${ref.area}:${ref.courseId}`;
}

/** Number of leading `@` characters used in the composer display for an entity type. */
export function atPrefixForMentionType(type: MentionEntityType): string {
  if (type === "lesson") return "@@";
  if (type === "course") return "@@@";
  return "@";
}

export function lessonMentionHref(
  area: AcademyArea,
  courseId: string,
  lessonId: string
): string {
  return `${ACADEMY_AREA_BASE[area]}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

export function courseMentionHref(area: AcademyArea, courseId: string): string {
  return `${ACADEMY_AREA_BASE[area]}/${encodeURIComponent(courseId)}`;
}

/** Resolves the navigation href for a parsed mention target, if any. */
export function mentionTargetHref(target: ParsedMentionTarget): string | null {
  if (!target) return null;
  if (target.type === "lesson") {
    return lessonMentionHref(target.area, target.courseId, target.lessonId);
  }
  if (target.type === "course") {
    return courseMentionHref(target.area, target.courseId);
  }
  return null;
}

/** Returns only the member (user) ids referenced by a body. */
export function extractMentionUserIds(body: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_ANY_SOURCE, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[3] !== undefined) {
      const parsed = parseMentionTarget(m[3]);
      if (parsed?.type === "user") ids.add(parsed.userId);
    } else if (m[4]) {
      ids.add(m[4]);
    }
  }
  return [...ids];
}

export type MentionSegment =
  | { kind: "text"; text: string }
  | {
      kind: "mention";
      mentionType: MentionEntityType;
      /** Member id (mentionType === "user"). */
      userId?: string;
      /** Academy area (lesson + course mentions). */
      area?: AcademyArea;
      /** Course id (lesson + course mentions). */
      courseId?: string;
      /** Lesson id (lesson mentions). */
      lessonId?: string;
      labelFromToken?: string;
    };

export function splitMentionSegments(body: string): MentionSegment[] {
  const re = new RegExp(MENTION_ANY_SOURCE, "gi");
  const out: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", text: body.slice(last, m.index) });
    }
    if (m[3] !== undefined) {
      const parsed = parseMentionTarget(m[3]);
      const label = m[2];
      if (parsed?.type === "user") {
        out.push({ kind: "mention", mentionType: "user", userId: parsed.userId, labelFromToken: label });
      } else if (parsed?.type === "lesson") {
        out.push({
          kind: "mention",
          mentionType: "lesson",
          area: parsed.area,
          courseId: parsed.courseId,
          lessonId: parsed.lessonId,
          labelFromToken: label,
        });
      } else if (parsed?.type === "course") {
        out.push({
          kind: "mention",
          mentionType: "course",
          area: parsed.area,
          courseId: parsed.courseId,
          labelFromToken: label,
        });
      } else {
        // Unrecognised target: keep raw text so nothing is silently dropped.
        out.push({ kind: "text", text: m[0] });
      }
    } else if (m[4] !== undefined) {
      out.push({ kind: "mention", mentionType: "user", userId: m[4] });
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    out.push({ kind: "text", text: body.slice(last) });
  }
  return out;
}

/** Replaces mention tokens with readable `@…`/`@@…`/`@@@…` text (no raw uuids). */
export function bodyPreviewWithoutRawUuids(body: string): string {
  return body
    .replace(new RegExp(MENTION_TOKEN_REGEX.source, "gi"), "$1$2")
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
