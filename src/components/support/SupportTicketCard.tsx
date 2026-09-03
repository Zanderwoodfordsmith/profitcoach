"use client";

import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { CommunityPostMediaThumb } from "@/components/community/CommunityPostMediaGallery";
import {
  formatCommunityPostTimestamp,
  formatCommunityRelativeActivityAgo,
} from "@/lib/communityRelativeTime";
import { profileInitialsFromProfile } from "@/lib/communityProfile";
import { parseSupportTicketMedia } from "@/lib/support/supportTicketMedia";
import {
  SUPPORT_STATUS_USER_LABELS,
  SUPPORT_TYPE_LABELS,
  authorDisplayName,
  supportAuthorAsProfile,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";

export type SupportTicketCardTicket = SupportTicket & {
  replies: SupportReply[];
};

type Props = {
  ticket: SupportTicketCardTicket;
  author: SupportTicketAuthor | null;
  hasUnread: boolean;
  onOpen: () => void;
};

function uniquePreviewAuthors(replies: SupportReply[]): SupportTicketAuthor[] {
  const seen = new Set<string>();
  const out: SupportTicketAuthor[] = [];
  for (const reply of [...replies].reverse()) {
    const author = reply.author;
    if (!author || seen.has(author.id)) continue;
    seen.add(author.id);
    out.push(author);
    if (out.length >= 3) break;
  }
  return out.reverse();
}

export function SupportTicketCard({ ticket, author, hasUnread, onOpen }: Props) {
  const authorName = author ? authorDisplayName(author) : "You";
  const media = parseSupportTicketMedia(ticket.media);
  const commentCount = ticket.replies.length;
  const previewAuthors = uniquePreviewAuthors(ticket.replies);
  const lastReply = ticket.replies[ticket.replies.length - 1] ?? null;
  const commentAgo = lastReply
    ? formatCommunityRelativeActivityAgo(lastReply.created_at)
    : null;
  const resolved = ticket.status === "resolved";
  const preview = ticket.details.replace(/\s+/g, " ").trim();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex w-full min-h-[132px] cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white py-4 px-[1.125rem] text-left transition hover:border-slate-300 hover:shadow ${
        resolved
          ? "opacity-[0.55] shadow-sm"
          : "opacity-100 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_3px_8px_-3px_rgb(15_23_42/0.08)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <CommunityAuthorAvatar profile={supportAuthorAsProfile(author)} size="md" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-semibold leading-tight text-slate-900">
              {authorName}
            </span>
            {ticket.status === "resolved" ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-900">
                <CheckCircle2
                  className="h-3.5 w-3.5 text-emerald-600"
                  strokeWidth={1.75}
                />
                {SUPPORT_STATUS_USER_LABELS.resolved}
              </span>
            ) : ticket.status === "in_review" ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-900">
                <Clock className="h-3.5 w-3.5 text-sky-600" strokeWidth={1.75} />
                {SUPPORT_STATUS_USER_LABELS.in_review}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            {formatCommunityPostTimestamp(ticket.created_at)}
            <span className="mx-0.5 select-none text-slate-400">·</span>
            <span className="font-semibold text-slate-500">
              {SUPPORT_TYPE_LABELS[ticket.type]}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex w-full min-w-0 gap-3">
        <div className={`min-w-0 flex-1 ${media.length > 0 ? "pr-2" : ""}`}>
          <h2 className="line-clamp-2 text-xl font-semibold leading-snug tracking-tight text-slate-900">
            {ticket.title?.trim() || "(No subject)"}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-base leading-relaxed text-slate-600">
            {preview || "\u00a0"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-[15px] text-slate-500">
              <MessageCircle
                className={`h-[18px] w-[18px] shrink-0 ${
                  commentCount > 0 ? "fill-sky-700 text-sky-700" : ""
                }`}
                strokeWidth={1.75}
              />
              <span className="tabular-nums">{commentCount}</span>
            </span>
            {previewAuthors.length > 0 || commentAgo ? (
              <div className="flex min-w-0 items-center gap-2 pl-1">
                {previewAuthors.length > 0 ? (
                  <div className="flex shrink-0 -space-x-2">
                    {previewAuthors.map((a, i) => (
                      <span
                        key={`${a.id}-${i}`}
                        className="relative inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white"
                        style={{ zIndex: previewAuthors.length - i }}
                      >
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-slate-200 text-[10px] font-medium text-slate-600">
                            {profileInitialsFromProfile(supportAuthorAsProfile(a))}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
                {commentAgo ? (
                  <span
                    className={`min-w-0 truncate text-xs font-medium ${
                      hasUnread ? "text-sky-600" : "text-slate-400"
                    }`}
                  >
                    {hasUnread ? `New comment ${commentAgo}` : `Last comment ${commentAgo}`}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {media.length > 0 ? (
          <div className="h-[80px] w-[92px] shrink-0 self-start">
            <CommunityPostMediaThumb
              item={media[0]}
              playIconSize="sm"
              className="h-full"
              extraCount={media.length > 1 ? media.length - 1 : 0}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

