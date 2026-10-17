/**
 * Section comment threads on the Blueprint, shared by the API and the page.
 * One thread per section ("page:id"). The coach is one side; BCA and Ava are the other.
 */

export type CommentAuthorSide = "coach" | "bca" | "ava";
export type CommentReaderSide = "coach" | "bca";

export type SectionComment = {
  id: string;
  section_key: string;
  author_id: string | null;
  author_side: CommentAuthorSide;
  author_name: string;
  author_avatar_url: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar_url: string | null;
  body: string;
  created_at: string;
  /** Set when the author edits the wording. */
  updated_at: string | null;
};

/** Someone a comment can be handed to: the coach on this blueprint, Pam, or Zander. */
export type CommentPerson = {
  id: string;
  name: string;
  avatar_url: string | null;
  side: "coach" | "bca";
};

/** Edit and delete belong to the author. Anyone in the thread can assign it. */
export function commentCapabilities(
  comment: Pick<SectionComment, "author_id" | "author_side">,
  viewerId: string | null
): { edit: boolean; delete: boolean; assign: boolean } {
  const own = Boolean(viewerId && comment.author_id && comment.author_id === viewerId && comment.author_side !== "ava");
  return { edit: own, delete: own, assign: Boolean(viewerId) };
}

/** Section key to when this side last opened that thread. */
export type CommentReads = Record<string, string>;

export const COMMENT_MAX_LENGTH = 4000;

/** Ava's notes are for people on both sides: a nudge for the coach, a hand-over for BCA. */
function fromOtherSide(comment: Pick<SectionComment, "author_side">, side: CommentReaderSide): boolean {
  if (comment.author_side === "ava") return true;
  return side === "coach" ? comment.author_side !== "coach" : comment.author_side === "coach";
}

/** Written by the other side (or Ava) since this side last opened the thread. */
export function isUnread(
  comment: Pick<SectionComment, "author_side" | "created_at">,
  side: CommentReaderSide,
  readAt: string | null | undefined
): boolean {
  if (!fromOtherSide(comment, side)) return false;
  if (!readAt) return true;
  return Date.parse(comment.created_at) > Date.parse(readAt);
}

export type ThreadSummary = { total: number; unread: number; last_at: string | null };

/** Per section: how many comments, how many unread for this side, and when the last one came in. */
export function summariseThreads(
  comments: Pick<SectionComment, "section_key" | "author_side" | "created_at">[],
  side: CommentReaderSide,
  reads: CommentReads
): Record<string, ThreadSummary> {
  const out: Record<string, ThreadSummary> = {};
  for (const comment of comments) {
    const item = (out[comment.section_key] ??= { total: 0, unread: 0, last_at: null });
    item.total += 1;
    if (isUnread(comment, side, reads[comment.section_key])) item.unread += 1;
    if (!item.last_at || Date.parse(comment.created_at) > Date.parse(item.last_at)) item.last_at = comment.created_at;
  }
  return out;
}
