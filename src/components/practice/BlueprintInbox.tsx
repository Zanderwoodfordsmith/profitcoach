"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquare, Pencil } from "lucide-react";

import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import type { ProjectThread } from "@/components/jobs/useCoachThreads";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import type { CommunityPostMediaItem } from "@/lib/communityPostMedia";
import type { SectionComment } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { CHAT_TITLE_MAX, topicFrom } from "@/lib/support/chatTitle";
import { parseSupportTicketMedia } from "@/lib/support/supportTicketMedia";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_REPLY_LIST_SELECT,
  authorDisplayName,
  formatSupportRelativeCompact,
  isSupportStaffAuthor,
  mapSupportReplyRow,
  mapSupportTicketRow,
  supportChatOpenedByBca,
  supportStatusAfterMemberReply,
  type SupportReply,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";

import { ChatComposer } from "./comments/ChatComposer";
import { FileDropZone } from "@/components/messaging/FileDropZone";
import { SeenTick } from "@/components/support/SeenTick";
import { commentsCall } from "./comments/SectionCommentsContext";
import { CommentAvatar, commentWhen, firstName } from "./comments/SectionCommentsUI";
import { useHalfHeight } from "./composer";
import { usePractice } from "./PracticeProvider";

/**
 * A chat with BCA, drawn like a page chat: the same message rows and the same
 * box. With no thread yet it's a new chat: the first message starts it, and its
 * opening words name it in the list.
 */
export function BcaChat({
  thread,
  coach,
  coachId,
  onClose,
  onChange,
}: {
  thread: ProjectThread | null;
  coach: SupportTicketAuthor | null;
  coachId: string;
  onClose: () => void;
  onChange: (thread: ProjectThread) => void;
}) {
  const { ref: panelRef, half } = useHalfHeight<HTMLDivElement>();
  const feedRef = useRef<HTMLDivElement>(null);
  const messages = thread ? [openingMessage(thread), ...thread.replies] : [];
  const [tickError, setTickError] = useState<string | null>(null);

  /** Tick (or untick) one of BCA's messages "Seen" as the coach, so it leaves Needs you without a reply. */
  async function tick(message: SupportReply, seen: boolean) {
    if (!thread) return;
    setTickError(null);
    const opening = message.id === `opening-${thread.id}`;
    const { error } = await supabaseClient.rpc("set_support_message_seen", {
      p_report_id: thread.id,
      p_reply_id: opening ? null : message.id,
      p_seen: seen,
      // BCA viewing as the coach ticks for the coach, as it sends for them.
      p_seen_by: coachId,
    });
    if (error) {
      setTickError("Couldn't tick it. Try again.");
      return;
    }
    const at = seen ? new Date().toISOString() : null;
    const name = seen ? coach?.first_name?.trim() || null : null;
    onChange(
      opening
        ? { ...thread, opening_seen_at: at, opening_seen_name: name }
        : { ...thread, replies: thread.replies.map((r) => (r.id === message.id ? { ...r, seen_at: at, seen_name: name } : r)) }
    );
    notifyCoachSupportReadChanged();
  }

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function post(body: string, media: CommunityPostMediaItem[]): Promise<string | null> {
    if (!thread) {
      const { data, error } = await supabaseClient
        .from("community_feedback_reports")
        .insert({
          created_by: coachId,
          source: "direct",
          type: "question",
          title: topicFrom(body),
          details: body,
          media: media.length ? media : null,
          status: "open",
          page_path: window.location.pathname,
        })
        .select(
          `id, created_at, created_by, ticket_number, type, title, details, page_path, status, media, coach_last_read_at, member_notify_email, topic, author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})`
        )
        .single();
      if (error || !data) return error?.message ?? "Could not send. Try again.";
      onChange({ ...mapSupportTicketRow(data as unknown as Parameters<typeof mapSupportTicketRow>[0]), replies: [], topic: null, context_path: null });
      return null;
    }
    const { data, error } = await supabaseClient
      .from("community_feedback_replies")
      .insert({ report_id: thread.id, created_by: coachId, body, media: media.length ? media : null })
      .select(SUPPORT_REPLY_LIST_SELECT)
      .single();
    if (error || !data) return error?.message ?? "Could not send. Try again.";
    // As in Support: a reply reopens a closed chat, and touching the row tells BCA it moved.
    const after = supportStatusAfterMemberReply(thread.status);
    const { error: statusError } = await supabaseClient
      .from("community_feedback_reports")
      .update({ status: after ?? thread.status })
      .eq("id", thread.id);
    onChange({
      ...thread,
      status: !statusError && after ? after : thread.status,
      replies: [...thread.replies, mapSupportReplyRow(data, { fallbackAuthor: coach })],
    });
    return null;
  }

  return (
    <FileDropZone ref={panelRef} className="bp-chat-panel flex h-full min-h-0 flex-col bg-white">
      <div ref={feedRef} className="bp-scroll bp-chat-feed min-h-0 flex-1 overflow-y-auto bg-[#f5f8fb] px-4 py-4">
        {messages.length ? (
          <ol className="bp-chat-list space-y-3">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                latest={index === messages.length - 1}
                onTick={(seen) => void tick(message, seen)}
              />
            ))}
          </ol>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1a8fd4] shadow-[0_1px_2px_rgba(5,30,54,0.08)]">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--bp-ink)]">New chat with BCA</p>
            <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">Ask us anything. We reply here.</p>
          </div>
        )}
        {tickError ? <p className="mt-2 text-xs text-rose-600">{tickError}</p> : null}
      </div>
      <ChatComposer
        chatKey={thread ? `bca:${thread.id}` : "bca:new"}
        other="BCA"
        replying={Boolean(thread?.replies.some((r) => isSupportStaffAuthor(r.author)))}
        maxHeight={half}
        onEscape={onClose}
        onPost={post}
      />
    </FileDropZone>
  );
}

/** One message, as a page chat draws it: avatar, name, BCA or AI tag, time, text, and its "Seen" tick. */
function ChatMessage({ message, latest, onTick }: { message: SupportReply; latest: boolean; onTick: (seen: boolean) => void }) {
  const side = message.as_ava ? "ava" : isSupportStaffAuthor(message.author) ? "bca" : "coach";
  // First names only, and no BCA tag (5 Nov): coaches know Zander and Pam.
  const name = message.as_ava
    ? "Ava"
    : message.author?.first_name?.trim() || firstName(authorDisplayName(message.author)) || (side === "bca" ? "BCA" : "You");
  const media = parseSupportTicketMedia(message.media);
  const avatar: Pick<SectionComment, "author_side" | "author_name" | "author_avatar_url"> = {
    author_side: side,
    author_name: name,
    author_avatar_url: message.as_ava ? null : (message.author?.avatar_url ?? null),
  };
  const mine = side === "coach";
  return (
    <li className="group/msg">
      <article
        className={`bp-chat-msg rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(5,30,54,0.05)] ${mine ? "border-[#cfe3f5]" : "border-[#e3e8ef]"}`}
      >
        <div className="flex items-start gap-2.5">
          <CommentAvatar comment={avatar as SectionComment} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="bp-chat-name text-sm font-medium text-[#0b1b2e]">{name}</span>
              {side === "ava" ? (
                <span className="rounded bg-[#e3eef8] px-1 text-caption font-semibold tracking-[0.04em] text-[#0c5290]">AI</span>
              ) : null}
              <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString("en-GB")} className="text-xs text-[#8595a8]">
                {commentWhen(message.created_at)}
              </time>
              {/* In the name line, right-aligned like a chat's ticks (5 Nov), so it takes no row of its own. */}
              <span className="ml-auto flex shrink-0 self-center">
                <SeenTick
                  inline
                  seenAt={message.seen_at ?? null}
                  seenName={mine ? message.seen_name ?? null : "you"}
                  canTick={!mine}
                  latest={latest}
                  onTick={onTick}
                />
              </span>
            </div>
            {media.length && /^Sent (a voice note|a video|an image|images|a document|documents)$/.test(message.body) ? null : (
              <p className="bp-chat-body mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1e2f44]">{message.body}</p>
            )}
            {media.length ? (
              <div className="mt-1.5 max-w-[20rem]">
                <CommunityPostMediaGallery items={media} variant="compact" />
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

/** The chat's name in the list: its title, or its opening words. */
export function chatTitle(thread: ProjectThread) {
  return thread.title?.trim() || topicFrom(thread.details);
}

/** The chat's name in its header. Click to rename it; Enter or clicking away saves, Escape cancels. */
export function ChatName({ thread, onRenamed }: { thread: ProjectThread; onRenamed: (id: string, title: string) => void }) {
  const { coachId } = usePractice();
  const name = chatTitle(thread);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [failed, setFailed] = useState(false);

  async function save() {
    const next = draft.trim().slice(0, CHAT_TITLE_MAX);
    setEditing(false);
    if (!next || next === name) return setDraft(name);
    onRenamed(thread.id, next);
    try {
      await commentsCall(coachId, "/api/coach/support/chat-title", { method: "PATCH", body: { report_id: thread.id, title: next } });
    } catch {
      onRenamed(thread.id, name);
      setDraft(name);
      setFailed(true);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={CHAT_TITLE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="Chat name"
        className="w-full rounded-md border border-[var(--bp-sky)] bg-white px-1.5 py-0.5 text-[0.8125rem] font-semibold text-[var(--ava-ink)] outline-none ring-2 ring-[#cfe6f8]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name);
        setFailed(false);
        setEditing(true);
      }}
      title={failed ? "Couldn't rename it. Try again." : "Rename this chat"}
      className="group/name -mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-white/60"
    >
      <span className="truncate">{name}</span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--ava-muted)] opacity-0 transition-opacity group-hover/name:opacity-100" aria-hidden />
    </button>
  );
}

/** The chat's first message, shown as one, so the opener reads like the rest of the chat. */
function openingMessage(thread: ProjectThread): SupportReply {
  // A chat BCA started opens with BCA's words, not the coach's.
  const byBca = supportChatOpenedByBca(thread);
  return {
    id: `opening-${thread.id}`,
    created_at: thread.created_at,
    report_id: thread.id,
    created_by: byBca ? (thread.created_by_admin ?? "") : (thread.created_by ?? ""),
    body: thread.details,
    community_comment_id: null,
    author: byBca ? (thread.opener ?? { id: "", full_name: null, first_name: "BCA", last_name: null, role: "admin" }) : (thread.author ?? null),
    media: thread.media,
    seen_at: thread.opening_seen_at ?? null,
    seen_name: thread.opening_seen_name ?? null,
  };
}

/** A chat's newest message for the list: "Zander: …", or "You: …" for the coach's own (first names only, 5 Nov). */
export function lastReplyLine(
  replies: { body: string; created_by: string; author: { full_name: string | null; first_name: string | null } | null }[],
  coachId?: string | null
) {
  const last = replies[replies.length - 1];
  if (!last) return null;
  const name =
    coachId && last.created_by === coachId
      ? "You"
      : last.author?.first_name?.trim() || firstName(last.author?.full_name ?? "") || "BCA";
  return `${name}: ${last.body}`;
}

/** A page chat's newest message for the list, the same way. */
export function pageChatLine(last: Pick<SectionComment, "author_side" | "author_name" | "body"> | null) {
  if (!last) return "New messages on this page";
  const name = last.author_side === "coach" ? "You" : last.author_side === "ava" ? "Ava" : firstName(last.author_name) || "BCA";
  return `${name}: ${last.body}`;
}

export function SectionHeading({ id, label, count }: { id: string; label: string; count: number | null }) {
  return (
    <h2 id={id} className="flex items-baseline gap-2 border-b border-slate-200 pb-2 text-[1.0625rem] font-semibold tracking-[-0.01em] text-slate-900">
      {label}
      {count ? <span className="text-sm font-normal tabular-nums text-slate-400">{count}</span> : null}
    </h2>
  );
}

export function Row({
  onOpen,
  selected = false,
  icon,
  title,
  line,
  unread,
  count,
  at,
  strong = false,
  muted = false,
  href,
  state,
}: {
  onOpen?: () => void;
  selected?: boolean;
  icon: ReactNode;
  title: string;
  line: string | null;
  unread: number;
  count?: number;
  at: string;
  strong?: boolean;
  muted?: boolean;
  /** Support's chats look: a row that goes to another page (a Blueprint page's chat) is a link. */
  href?: string;
  /** Support's chats look: where the chat stands, in place of its message count. */
  state?: { label: string; tone: "you" | "bca" | "done" };
}) {
  const className = `group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-3 text-left transition-colors ${
    selected ? "bg-sky-50" : "hover:bg-slate-50"
  }`;
  const inner = (
    <>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[0.9375rem] ${
              muted ? "text-slate-500" : strong || unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"
            }`}
          >
            {title}
          </span>
          {line ? <span className="mt-0.5 block truncate text-sm text-slate-500">{line}</span> : null}
        </span>
        <span className={`flex shrink-0 justify-center ${state ? "w-20" : "w-14"}`}>
          {unread > 0 ? (
            <span className="inline-flex items-center rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
              {unread} new
            </span>
          ) : state ? (
            <span
              className={`text-xs font-medium ${
                state.tone === "you" ? "text-sky-700" : state.tone === "bca" ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {state.label}
            </span>
          ) : count ? (
            <span className="inline-flex items-center gap-1 text-sm tabular-nums text-slate-500">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {count}
            </span>
          ) : null}
        </span>
        <span className="w-14 shrink-0 text-right text-caption tabular-nums text-slate-400">
          {at ? formatSupportRelativeCompact(at) : ""}
        </span>
    </>
  );
  return (
    <li className="border-b border-slate-200">
      {href ? (
        <Link href={href} className={className}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} aria-current={selected ? "true" : undefined} className={className}>
          {inner}
        </button>
      )}
    </li>
  );
}
