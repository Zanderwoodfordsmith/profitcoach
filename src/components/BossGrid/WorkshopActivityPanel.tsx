"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronRight, CornerDownRight, Send, X } from "lucide-react";
import {
  formatActivityMessage,
  type WorkshopActivityEvent,
  type WorkshopAuthorRole,
  type WorkshopComment,
  type WorkshopCommentReply,
} from "@/lib/playbookSessionNotes";

type FeedEntry =
  | { kind: "activity"; id: string; createdAt: string; event: WorkshopActivityEvent }
  | { kind: "comment"; id: string; createdAt: string; comment: WorkshopComment };

type ActivityFeedEntry = Extract<FeedEntry, { kind: "activity" }>;
type CommentFeedEntry = Extract<FeedEntry, { kind: "comment" }>;

type FeedSegment =
  | { kind: "comment"; entry: CommentFeedEntry }
  | { kind: "activity"; entry: ActivityFeedEntry }
  | { kind: "activity_group"; id: string; entries: ActivityFeedEntry[] };

/** Activities within this window (ms) are grouped together. */
const ACTIVITY_GROUP_WINDOW_MS = 3 * 60 * 1000;

const COMMENT_MIN_HEIGHT_PX = 32;
const COMMENT_MAX_HEIGHT_RATIO = 0.5;
const COMMENT_MAX_HEIGHT_FALLBACK_PX = 280;

function useAutoGrowTextarea(
  value: string,
  maxHeightPx: number,
  minHeightPx = COMMENT_MIN_HEIGHT_PX
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const cap = maxHeightPx > 0 ? maxHeightPx : COMMENT_MAX_HEIGHT_FALLBACK_PX;
    const next = Math.min(Math.max(el.scrollHeight, minHeightPx), cap);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  }, [value, maxHeightPx, minHeightPx]);

  return ref;
}

function buildFeedSegments(feed: FeedEntry[]): FeedSegment[] {
  const segments: FeedSegment[] = [];
  let index = 0;

  while (index < feed.length) {
    const entry = feed[index];
    if (entry.kind === "comment") {
      segments.push({ kind: "comment", entry });
      index += 1;
      continue;
    }

    const group: ActivityFeedEntry[] = [entry];
    index += 1;

    while (index < feed.length && feed[index].kind === "activity") {
      const prev = group[group.length - 1];
      const next = feed[index] as ActivityFeedEntry;
      const gap = Math.abs(
        new Date(prev.createdAt).getTime() - new Date(next.createdAt).getTime()
      );
      if (gap > ACTIVITY_GROUP_WINDOW_MS) break;
      group.push(next);
      index += 1;
    }

    if (group.length >= 2) {
      segments.push({ kind: "activity_group", id: group.map((e) => e.id).join("-"), entries: group });
    } else {
      segments.push({ kind: "activity", entry: group[0] });
    }
  }

  return segments;
}

function ActivityLine({ entry }: { entry: ActivityFeedEntry }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
        <p className="min-w-0 text-xs leading-snug text-slate-500">
          {entry.event.authorName ? (
            <span className="text-slate-600">{entry.event.authorName} </span>
          ) : null}
          {formatActivityMessage(entry.event)}
        </p>
        <time className="shrink-0 text-[11px] leading-snug text-slate-400">
          {formatActivityWhen(entry.createdAt)}
        </time>
      </div>
    </div>
  );
}

function ActivityGroupBlock({
  groupId,
  entries,
  expanded,
  onToggle,
}: {
  groupId: string;
  entries: ActivityFeedEntry[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const hiddenCount = entries.length - 1;

  return (
    <li className="space-y-1">
      <ActivityLine entry={entries[0]} />
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 py-0.5 pl-3.5 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        aria-expanded={expanded}
        aria-controls={`activity-group-${groupId}`}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        {expanded ? "Show less" : `Show more (${hiddenCount})`}
      </button>
      {expanded ? (
        <ul id={`activity-group-${groupId}`} className="space-y-1">
          {entries.slice(1).map((entry) => (
            <li key={entry.id}>
              <ActivityLine entry={entry} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function formatActivityWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}

function formatCommentWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  const sameDay =
    d.getFullYear() === new Date().getFullYear() &&
    d.getMonth() === new Date().getMonth() &&
    d.getDate() === new Date().getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function displayAuthorName(
  author: WorkshopAuthorRole,
  name?: string
): string {
  return name ?? (author === "coach" ? "Coach" : "Client");
}

function authorInitials(author: WorkshopAuthorRole, name?: string): string {
  const label = displayAuthorName(author, name);
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function CommentAuthorAvatar({
  author,
  name,
  size = "md",
}: {
  author: WorkshopAuthorRole;
  name?: string;
  size?: "sm" | "md";
}) {
  const initials = authorInitials(author, name);
  const sizeClass = size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[10px]";
  const colorClass = author === "coach" ? "bg-sky-600" : "bg-violet-500";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass} ${colorClass}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function CommentCard({
  comment,
  activeThreadId,
  onOpenThread,
  editable,
}: {
  comment: WorkshopComment;
  activeThreadId: string | null;
  onOpenThread: (commentId: string) => void;
  editable: boolean;
}) {
  const authorLabel = displayAuthorName(comment.author, comment.authorName);
  const isThreadActive = activeThreadId === comment.id;
  const replyCount = comment.replies.length;
  const showReplies = isThreadActive && replyCount > 0;

  const replyAuthorKeys = useMemo(() => {
    const seen = new Set<string>();
    const authors: Array<{ author: WorkshopAuthorRole; authorName?: string }> = [];
    for (const reply of comment.replies) {
      const key = `${reply.author}:${reply.authorName ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      authors.push({ author: reply.author, authorName: reply.authorName });
    }
    return authors;
  }, [comment.replies]);

  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm ${
        isThreadActive ? "border-sky-300 ring-1 ring-sky-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <CommentAuthorAvatar author={comment.author} name={comment.authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">{authorLabel}</span>
            <time className="text-xs text-slate-400">{formatCommentWhen(comment.createdAt)}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {comment.text}
          </p>
        </div>
      </div>

      {showReplies ? (
        <ul className="ml-9 mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
          {comment.replies.map((reply) => (
            <li key={reply.id}>
              <ReplyLine reply={reply} />
            </li>
          ))}
        </ul>
      ) : null}

      {editable || replyCount > 0 ? (
        <div className="mt-2.5 flex items-center justify-end border-t border-slate-100 pt-2">
          {replyCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenThread(comment.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800"
              aria-label={`${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
            >
              <span>
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </span>
              <span className="flex -space-x-1">
                {replyAuthorKeys.slice(0, 3).map((author, index) => (
                  <CommentAuthorAvatar
                    key={`${author.author}-${author.authorName ?? index}`}
                    author={author.author}
                    name={author.authorName}
                    size="sm"
                  />
                ))}
              </span>
            </button>
          ) : editable ? (
            <button
              type="button"
              onClick={() => onOpenThread(comment.id)}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
            >
              Reply
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ReplyLine({ reply }: { reply: WorkshopCommentReply }) {
  const authorLabel = displayAuthorName(reply.author, reply.authorName);
  return (
    <div className="flex items-start gap-2 py-1">
      <CommentAuthorAvatar author={reply.author} name={reply.authorName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-800">{authorLabel}</span>
          <time className="text-[11px] text-slate-400">{formatCommentWhen(reply.createdAt)}</time>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{reply.text}</p>
      </div>
    </div>
  );
}

export type WorkshopActivityPanelProps = {
  activity: WorkshopActivityEvent[];
  comments: WorkshopComment[];
  editable: boolean;
  allowClientComments?: boolean;
  defaultAuthor?: WorkshopAuthorRole;
  defaultAuthorName?: string;
  onCommentsChange: (comments: WorkshopComment[]) => void;
  onActivityAppend: (event: Omit<WorkshopActivityEvent, "id" | "createdAt">) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function WorkshopActivityPanel({
  activity,
  comments,
  editable,
  allowClientComments = false,
  defaultAuthor = "coach",
  defaultAuthorName,
  onCommentsChange,
  onActivityAppend,
  collapsed,
  onCollapsedChange,
}: WorkshopActivityPanelProps) {
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  const maxTextareaHeight =
    panelHeight > 0
      ? Math.floor(panelHeight * COMMENT_MAX_HEIGHT_RATIO)
      : COMMENT_MAX_HEIGHT_FALLBACK_PX;
  const draftTextareaRef = useAutoGrowTextarea(draft, maxTextareaHeight);

  const threadTarget = useMemo(
    () => (replyingTo ? comments.find((c) => c.id === replyingTo) ?? null : null),
    [comments, replyingTo]
  );

  useEffect(() => {
    if (!replyingTo) return;
    composerTextareaRef.current?.focus();
  }, [replyingTo]);

  const openThread = (commentId: string) => {
    if (replyingTo === commentId) {
      closeThread();
      return;
    }
    setReplyingTo(commentId);
    requestAnimationFrame(() => composerTextareaRef.current?.focus());
  };

  const closeThread = () => {
    setReplyingTo(null);
    setDraft("");
  };

  const mergeTextareaRefs = (node: HTMLTextAreaElement | null) => {
    draftTextareaRef.current = node;
    composerTextareaRef.current = node;
  };

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const syncHeight = () => setPanelHeight(el.clientHeight);
    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);

  const feed = useMemo(() => {
    const entries: FeedEntry[] = [
      ...activity.map((event) => ({
        kind: "activity" as const,
        id: event.id,
        createdAt: event.createdAt,
        event,
      })),
      ...comments.map((comment) => ({
        kind: "comment" as const,
        id: comment.id,
        createdAt: comment.createdAt,
        comment,
      })),
    ];
    return entries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [activity, comments]);

  const feedSegments = useMemo(() => buildFeedSegments(feed), [feed]);

  const toggleActivityGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || !editable) return;
    if (replyingTo) {
      submitReply(replyingTo, text);
      setDraft("");
      return;
    }
    submitComment(text);
  };

  const submitComment = (text: string) => {
    const comment: WorkshopComment = {
      id: crypto.randomUUID(),
      author: defaultAuthor,
      authorName: defaultAuthorName,
      text,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    onCommentsChange([...comments, comment]);
    onActivityAppend({
      type: "comment_added",
      author: defaultAuthor,
      authorName: defaultAuthorName,
      meta: { commentId: comment.id },
    });
    setDraft("");
  };

  const submitReply = (commentId: string, text: string) => {
    if (!editable || !text.trim()) return;
    const reply: WorkshopCommentReply = {
      id: crypto.randomUUID(),
      author: defaultAuthor,
      authorName: defaultAuthorName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    onCommentsChange(
      comments.map((c) =>
        c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
      )
    );
    onActivityAppend({
      type: "comment_added",
      author: defaultAuthor,
      authorName: defaultAuthorName,
      meta: { commentId, replyId: reply.id },
    });
    setDraft("");
  };

  if (collapsed) {
    return (
      <aside className="flex h-full min-h-0 shrink-0 flex-col self-stretch border-l border-slate-200 bg-slate-100">
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-2 py-4 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Show activity"
        >
          <Activity className="h-5 w-5" aria-hidden />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ writingMode: "vertical-rl" }}
          >
            Activity
          </span>
        </button>
      </aside>
    );
  }

  const widthClass = "lg:w-[20.752rem] xl:w-[22.541rem]";

  return (
    <aside
      ref={panelRef}
      className={`flex h-full min-h-0 w-full shrink-0 flex-col self-stretch border-t border-slate-200 bg-slate-100/80 lg:border-l lg:border-t-0 ${widthClass}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</h3>
        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Collapse activity panel"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {feedSegments.length === 0 ? (
          <p className="text-sm text-slate-400">
            No activity yet. Score changes and comments will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {feedSegments.map((segment) =>
              segment.kind === "activity" ? (
                <li key={segment.entry.id}>
                  <ActivityLine entry={segment.entry} />
                </li>
              ) : segment.kind === "activity_group" ? (
                <ActivityGroupBlock
                  key={segment.id}
                  groupId={segment.id}
                  entries={segment.entries}
                  expanded={expandedGroups.has(segment.id)}
                  onToggle={() => toggleActivityGroup(segment.id)}
                />
              ) : (
                <li key={segment.entry.id}>
                  <CommentCard
                    comment={segment.entry.comment}
                    activeThreadId={replyingTo}
                    onOpenThread={openThread}
                    editable={editable}
                  />
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {editable ? (
        <div className="shrink-0 border-t border-slate-200 p-3">
          {threadTarget ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-sky-50 px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-sky-800">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  Replying to {displayAuthorName(threadTarget.author, threadTarget.authorName)}
                </span>
              </div>
              <button
                type="button"
                onClick={closeThread}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-sky-600 hover:bg-sky-100"
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <textarea
              ref={mergeTextareaRefs}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              className="min-h-[2rem] w-full resize-none rounded-t-lg border-0 px-2.5 py-1.5 text-sm outline-none"
              placeholder={
                threadTarget
                  ? "Write a reply…"
                  : allowClientComments
                    ? "Write a comment as coach or client…"
                    : "Write a comment…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitDraft();
                }
                if (e.key === "Escape" && threadTarget) {
                  e.preventDefault();
                  closeThread();
                }
              }}
            />
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-2.5 py-1">
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={submitDraft}
                className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Send className="h-3 w-3" aria-hidden />
                {threadTarget ? "Reply" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
