"use client";

import { activityOf, useCoachThreads, type ProjectThread } from "@/components/jobs/useCoachThreads";
import { blueprintPage, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { commentPage } from "@/lib/practiceKnowledge/pageChat";
import type { SectionComment } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { supportChatWaitingOn, unreadStaffReplyCount } from "@/lib/support/tickets";

import { useSectionComments } from "./comments/SectionCommentsContext";

export type InboxItem =
  | { kind: "page"; key: string; page: BlueprintLink; last: SectionComment | null; unread: number; at: string }
  | { kind: "question"; key: string; thread: ProjectThread; unread: number; at: string };

export type InboxQuestion = { thread: ProjectThread; unread: number; at: string; count: number };

/**
 * The Blueprint Inbox (job 26, 4 Nov): only what needs the coach. A page chat
 * shows while it has messages they haven't read; a chat with BCA shows while
 * BCA has the last word, until the coach replies or ticks it "Seen" (5 Nov).
 * Also every question they've asked BCA, open ones first.
 */
export function useBlueprintInbox({ asCoach = false }: { asCoach?: boolean } = {}) {
  const comments = useSectionComments();
  // Support's chats look shows BCA viewing as a coach what's waiting for the coach, not for BCA.
  const pageThreads = (asCoach ? comments?.coachThreads : null) ?? comments?.threads ?? {};
  const { coachId, coach, threads, setThreads, loading } = useCoachThreads();

  // Page chats: unread per page, and the newest message on it.
  const pages = new Map<string, { unread: number; last: SectionComment | null }>();
  for (const [key, thread] of Object.entries(pageThreads)) {
    const slug = commentPage(key);
    if (!slug || !thread.unread) continue;
    const item = pages.get(slug) ?? { unread: 0, last: null };
    item.unread += thread.unread;
    pages.set(slug, item);
  }
  for (const comment of comments?.comments ?? []) {
    const item = pages.get(commentPage(comment.section_key) ?? "");
    if (item && (!item.last || comment.created_at > item.last.created_at)) item.last = comment;
  }

  const questions: InboxQuestion[] = threads
    .map((thread) => ({
      thread,
      unread: coachId ? unreadStaffReplyCount(thread, thread.replies, coachId) : 0,
      at: activityOf(thread.replies)?.lastAt ?? thread.created_at,
      count: thread.replies.length,
    }))
    .sort((a, b) => {
      const doneA = a.thread.status === "resolved" ? 1 : 0;
      const doneB = b.thread.status === "resolved" ? 1 : 0;
      return doneA - doneB || (a.at < b.at ? 1 : -1);
    });

  const items: InboxItem[] = [
    ...[...pages.entries()].flatMap(([slug, item]): InboxItem[] => {
      const page = blueprintPage(slug);
      return page
        ? [{ kind: "page", key: `page:${slug}`, page, last: item.last, unread: item.unread, at: item.last?.created_at ?? "" }]
        : [];
    }),
    ...questions
      .filter((q) => q.unread > 0 || supportChatWaitingOn(q.thread, q.thread.replies) === "coach")
      .map((q): InboxItem => ({ kind: "question", key: `question:${q.thread.id}`, thread: q.thread, unread: q.unread, at: q.at })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  // For the menu: unread messages, the same unit as each page's own number, so the
  // Inbox always equals the pages added up. A question waiting on the coach with
  // nothing unread counts once.
  const count = items.reduce((n, item) => n + Math.max(item.unread, 1), 0);

  return { items, count, questions, threads, setThreads, coach, coachId, loading: loading || !comments?.side };
}
