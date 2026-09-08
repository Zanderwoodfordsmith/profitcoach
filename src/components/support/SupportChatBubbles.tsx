"use client";

import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { formatDayLabel, formatShortTime } from "@/lib/formatShortDate";
import { parseSupportReplyMedia } from "@/lib/support/supportTicketMedia";
import {
  authorDisplayName,
  isSupportStaffAuthor,
  type SupportReply,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";

function calendarDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function groupRepliesByDay(replies: SupportReply[]) {
  const groups: { key: string; label: string; replies: SupportReply[] }[] = [];
  for (const reply of replies) {
    const key = calendarDayKey(reply.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.replies.push(reply);
    } else {
      groups.push({
        key,
        label: formatDayLabel(reply.created_at),
        replies: [reply],
      });
    }
  }
  return groups;
}

export function SupportChatAvatar({
  name,
  avatarUrl,
  tone = "slate",
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  tone?: "slate" | "sky";
  size?: "xs" | "md";
}) {
  const initials = profileInitialsFromName(name);
  const box = size === "xs" ? "h-5 w-5 text-[9px]" : "h-9 w-9 text-[11px]";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-slate-200/80`}
      />
    );
  }
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full font-semibold ring-1 ${
        tone === "sky"
          ? "bg-sky-100 text-sky-800 ring-sky-200/80"
          : "bg-slate-200 text-slate-700 ring-slate-200/80"
      }`}
    >
      {initials}
    </span>
  );
}

type BubbleProps = {
  reply: SupportReply;
  /** True when this bubble is on the right (outgoing for this viewer). */
  outbound: boolean;
  /** Prefer this label when author is missing. */
  fallbackName?: string;
};

export function SupportChatBubble({
  reply,
  outbound,
  fallbackName = "Support",
}: BubbleProps) {
  const name = authorDisplayName(reply.author) || fallbackName;
  const avatarUrl = reply.author?.avatar_url ?? null;
  const media = parseSupportReplyMedia(reply.media);

  return (
    <div
      className={`flex items-end gap-2 ${
        outbound ? "justify-end" : "justify-start"
      }`}
    >
      {!outbound ? (
        <SupportChatAvatar name={name} avatarUrl={avatarUrl} />
      ) : null}
      <div
        className={`max-w-[min(85%,26rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1 ${
          outbound
            ? "rounded-br-md bg-sky-100/90 text-sky-950 ring-sky-200/70"
            : "rounded-bl-md bg-white text-slate-900 ring-slate-200/80"
        }`}
      >
        {reply.body.trim() ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {reply.body}
          </p>
        ) : null}
        {media.length > 0 ? (
          <div className="mt-2">
            <CommunityPostMediaGallery items={media} variant="compact" />
          </div>
        ) : null}
        <p
          className={`mt-1.5 text-[10px] tabular-nums ${
            outbound ? "text-right text-sky-800/55" : "text-slate-400"
          }`}
        >
          {formatShortTime(reply.created_at)}
        </p>
      </div>
      {outbound ? (
        <SupportChatAvatar name={name} avatarUrl={avatarUrl} tone="sky" />
      ) : null}
    </div>
  );
}

type ThreadProps = {
  replies: SupportReply[];
  /** Viewer user id — used with perspective to decide left/right. */
  viewerId: string | null;
  /**
   * admin = staff messages on the right, member on the left.
   * member = own messages on the right, staff on the left.
   */
  perspective: "admin" | "member";
  emptyLabel?: string;
};

export function SupportChatThread({
  replies,
  viewerId,
  perspective,
  emptyLabel,
}: ThreadProps) {
  if (replies.length === 0) {
    return emptyLabel ? (
      <p className="py-6 text-center text-sm text-slate-500">{emptyLabel}</p>
    ) : null;
  }

  const byDay = groupRepliesByDay(replies);

  return (
    <div className="space-y-3">
      {byDay.map((group) => (
        <div key={group.key} className="space-y-3">
          <div className="flex justify-center py-1">
            <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
              {group.label}
            </span>
          </div>
          {group.replies.map((reply) => {
            const staff = isSupportStaffAuthor(reply.author);
            const mine = viewerId != null && reply.created_by === viewerId;
            const outbound =
              perspective === "admin" ? staff || mine : mine && !staff;

            return (
              <SupportChatBubble
                key={reply.id}
                reply={reply}
                outbound={outbound}
                fallbackName={
                  staff
                    ? "Support"
                    : perspective === "member"
                      ? "You"
                      : "Member"
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function supportAuthorShortName(
  author: SupportTicketAuthor | null | undefined
): string {
  if (!author) return "Support";
  const first = author.first_name?.trim();
  if (first) return first;
  return authorDisplayName(author);
}
