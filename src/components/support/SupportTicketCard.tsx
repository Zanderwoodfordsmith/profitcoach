"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Circle, Hourglass, MessageCircle } from "lucide-react";
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import { SeeMoreText } from "@/components/support/SeeMoreText";
import { SupportTicketChat } from "@/components/support/SupportTicketChat";
import { parseSupportTicketMedia } from "@/lib/support/supportTicketMedia";
import {
  formatSupportTicketDate,
  SUPPORT_STATUS_USER_LABELS,
  supportTypeOptionLabel,
  unreadStaffReplyCount,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";

export type SupportTicketCardTicket = SupportTicket & {
  replies: SupportReply[];
};

type Props = {
  ticket: SupportTicketCardTicket;
  expanded: boolean;
  onToggle: () => void;
  viewer: SupportTicketAuthor | null;
  viewerId: string;
  onTicketChange: (next: SupportTicketCardTicket) => void;
};

export function SupportTicketCard({
  ticket,
  expanded,
  onToggle,
  viewer,
  viewerId,
  onTicketChange,
}: Props) {
  const resolved = ticket.status === "resolved";
  const details = ticket.details.trim();
  const title = ticket.title?.trim() || "(No subject)";
  const media = parseSupportTicketMedia(ticket.media);
  const replyCount = ticket.replies.length;
  const unreadCount =
    !resolved && !expanded
      ? unreadStaffReplyCount(ticket, ticket.replies, viewerId)
      : 0;

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white transition ${
        resolved && !expanded
          ? "opacity-[0.55] shadow-sm"
          : "opacity-100 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
      }`}
    >
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatSupportTicketDate(ticket.created_at)}
              <span className="mx-1.5 text-slate-300">·</span>
              {supportTypeOptionLabel(ticket.type)}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            {resolved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/80">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                {SUPPORT_STATUS_USER_LABELS.resolved}
              </span>
            ) : ticket.status === "waiting_reply" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/80">
                <Hourglass className="h-3.5 w-3.5" strokeWidth={1.75} />
                {SUPPORT_STATUS_USER_LABELS.waiting_reply}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-200/80">
                <Circle className="h-3.5 w-3.5" strokeWidth={2} />
                {SUPPORT_STATUS_USER_LABELS.open}
              </span>
            )}
          </div>
        </div>

        {details ? (
          <div className="mt-3">
            <SeeMoreText key={ticket.id} text={details} variant="feed" />
          </div>
        ) : null}

        {media.length > 0 ? (
          <div className="mt-3">
            <CommunityPostMediaGallery items={media} variant="compact" />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? "Close chat"
              : resolved
                ? "Chat to reopen"
                : unreadCount > 0
                  ? `Chat, ${unreadCount} new ${
                      unreadCount === 1 ? "reply" : "replies"
                    }`
                  : replyCount > 0
                    ? `Chat, ${replyCount} ${
                        replyCount === 1 ? "reply" : "replies"
                      }`
                    : "Chat"
          }
          className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          <span className="relative inline-flex">
            <MessageCircle
              className="h-4 w-4 text-slate-500"
              strokeWidth={1.75}
            />
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </span>
          {expanded ? "Close chat" : resolved ? "Chat to reopen" : "Chat"}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          )}
        </button>
      </div>

      {expanded ? (
        <SupportTicketChat
          ticket={ticket}
          viewer={viewer}
          viewerId={viewerId}
          onTicketChange={onTicketChange}
        />
      ) : null}
    </article>
  );
}
