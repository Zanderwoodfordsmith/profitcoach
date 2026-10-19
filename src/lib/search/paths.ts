import { VAULT_COURSE_IDS } from "@/lib/academy/vaultIds";
import { communityPostPath } from "@/lib/communityPostSlug";
import {
  seekSecondsForTranscriptHit,
  type SearchClassroomItem,
  type SearchCommunityItem,
  type SearchMemberItem,
  type SearchTab,
} from "./types";

export type SearchPrefix = "/admin" | "/coach";

export function searchPrefix(pathname: string): SearchPrefix {
  return pathname.startsWith("/admin") ? "/admin" : "/coach";
}

/** Vault lessons live under their own hub; everything else is Classroom. */
export function lessonPath(prefix: SearchPrefix, courseId: string, lessonId: string): string {
  const hub = VAULT_COURSE_IDS.has(courseId) ? "vault" : "classroom";
  return `${prefix}/academy/${hub}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

/** Lesson hit, opened at the matched chapter and just before the matched words. */
export function searchLessonHref(prefix: SearchPrefix, item: SearchClassroomItem): string {
  if (!item.course_id || !item.lesson_id) return `${prefix}/academy/classroom`;
  const base = lessonPath(prefix, item.course_id, item.lesson_id);
  const params = new URLSearchParams();
  if (item.chapter_id) params.set("chapter", item.chapter_id);
  if (item.transcript_match && item.transcript_seconds != null) {
    params.set("t", String(seekSecondsForTranscriptHit(item.transcript_seconds)));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Lesson Q&A posts open on their lesson; the rest open in Community. */
export function searchPostHref(prefix: SearchPrefix, post: SearchCommunityItem): string {
  if (post.post_scope === "lesson_qa" && post.lesson_path) {
    return post.lesson_path.startsWith("/") ? post.lesson_path : `/${post.lesson_path}`;
  }
  return communityPostPath(`${prefix}/community`, { title: post.title });
}

export function searchMemberHref(prefix: SearchPrefix, member: SearchMemberItem): string {
  return member.slug
    ? `/directory/${encodeURIComponent(member.slug)}`
    : `${prefix}/community/members`;
}

/** The full results page for a query, on one tab. */
export function searchResultsHref(prefix: SearchPrefix, q: string, tab?: SearchTab): string {
  const params = new URLSearchParams({ q });
  if (tab && tab !== "classroom") params.set("tab", tab);
  return `${prefix}/search?${params}`;
}
