"use client";

import { CheckCircle2, Clock, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  CommentAttachButton,
  CommentImagePreviews,
  clearPendingCommentImages,
  type PendingCommentImage,
} from "@/components/community/CommentImageComposer";
import { CommentMediaDisplay } from "@/components/community/CommentMediaDisplay";
import { CommunityAuthorAvatar } from "@/components/community/CommunityAuthorAvatar";
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";
import { uploadCommunityCommentImageFile } from "@/lib/communityCommentMedia";
import {
  parseSupportReplyMedia,
  parseSupportTicketMedia,
} from "@/lib/support/supportTicketMedia";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_STATUS_USER_LABELS,
  SUPPORT_TYPE_LABELS,
  authorDisplayName,
  formatSupportTicketId,
  normalizeSupportAuthor,
  supportAuthorAsProfile,
  type SupportReply,
  type SupportTicket,
  type SupportTicketAuthor,
} from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";

type TicketWithReplies = SupportTicket & { replies: SupportReply[] };

type Props = {
  ticket: TicketWithReplies;
  viewer: SupportTicketAuthor | null;
  viewerId: string;
  onClose: () => void;
  onTicketChange: (next: TicketWithReplies) => void;
};

export function SupportTicketDetailModal({
  ticket,
  viewer,
  viewerId,
  onClose,
  onTicketChange,
}: Props) {
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingCommentImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const media = parseSupportTicketMedia(ticket.media);
  const resolved = ticket.status === "resolved";
  const viewerName = viewer ? authorDisplayName(viewer) : "You";
  const canSend = Boolean(draft.trim() || pendingImages.length > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    return () => clearPendingCommentImages(pendingImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendReply(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !canSend || resolved) return;
    setBusy(true);
    setError(null);

    try {
      const uploaded = [];
      for (const item of pendingImages) {
        const up = await uploadCommunityCommentImageFile(item.file);
        if ("error" in up) throw new Error(up.error);
        uploaded.push(up.media);
      }

      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_replies")
        .insert({
          report_id: ticket.id,
          created_by: viewerId,
          body: draft.trim(),
          media: uploaded.length > 0 ? uploaded : null,
        })
        .select(
          `
          id,
          created_at,
          report_id,
          created_by,
          body,
          media,
          community_comment_id,
          author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})
        `
        )
        .single();

      if (insertError) throw insertError;

      const reply: SupportReply = {
        id: data.id,
        created_at: data.created_at,
        report_id: data.report_id,
        created_by: data.created_by,
        body: data.body,
        media: data.media,
        community_comment_id: data.community_comment_id ?? null,
        author: normalizeSupportAuthor(data.author),
      };

      onTicketChange({ ...ticket, replies: [...ticket.replies, reply] });
      setDraft("");
      clearPendingCommentImages(pendingImages);
      setPendingImages([]);
      setComposerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden overscroll-none bg-black/45 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[calc(42rem*1.15)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-ticket-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1.5 -top-1.5 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:bg-slate-50 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <div className="relative flex max-h-[90dvh] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-5 sm:px-8">
            <div className="flex items-start gap-3">
              <CommunityAuthorAvatar
                profile={supportAuthorAsProfile(ticket.author ?? viewer)}
                size="md"
              />
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold leading-tight text-slate-900">
                    {authorDisplayName(ticket.author ?? viewer)}
                  </p>
                  {ticket.status === "resolved" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-emerald-600"
                        strokeWidth={1.75}
                      />
                      {SUPPORT_STATUS_USER_LABELS.resolved}
                    </span>
                  ) : ticket.status === "in_review" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                      <Clock className="h-3.5 w-3.5 text-sky-600" strokeWidth={1.75} />
                      {SUPPORT_STATUS_USER_LABELS.in_review}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">
                      {SUPPORT_STATUS_USER_LABELS.new}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatCommunityPostTimestamp(ticket.created_at)}
                  <span className="mx-0.5 select-none text-slate-400">·</span>
                  <span className="font-semibold">
                    {SUPPORT_TYPE_LABELS[ticket.type]}
                  </span>
                  <span className="mx-0.5 select-none text-slate-400">·</span>
                  {formatSupportTicketId(ticket.ticket_number)}
                </p>
              </div>
            </div>

            <h2
              id="support-ticket-detail-title"
              className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-slate-900"
            >
              {ticket.title?.trim() || "(No subject)"}
            </h2>
            {ticket.details.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                {ticket.details}
              </p>
            ) : null}
            {ticket.page_path ? (
              <p className="mt-3 break-all text-sm text-slate-500">
                Page:{" "}
                <span className="font-mono text-[13px]">{ticket.page_path}</span>
              </p>
            ) : null}
            {media.length > 0 ? (
              <div className="mt-4">
                <CommunityPostMediaGallery items={media} />
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-800">
                Comments ({ticket.replies.length})
              </p>
              {ticket.replies.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No comments yet. Add one below, or wait for the support team.
                </p>
              ) : (
                <ul className="mt-3 space-y-4">
                  {ticket.replies.map((reply) => {
                    const name = authorDisplayName(reply.author);
                    const replyMedia = parseSupportReplyMedia(reply.media);
                    return (
                      <li key={reply.id} className="flex items-start gap-2.5">
                        <CommunityAuthorAvatar
                          profile={supportAuthorAsProfile(reply.author)}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-semibold text-slate-900">
                              {name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatCommunityPostTimestamp(reply.created_at)}
                            </span>
                          </div>
                          {reply.body.trim() ? (
                            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                              {reply.body}
                            </p>
                          ) : null}
                          {replyMedia.length > 0 ? (
                            <CommentMediaDisplay
                              media={replyMedia}
                              className="mt-2"
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {resolved ? (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-8">
              <p className="text-sm text-slate-500">
                This ticket is resolved. Raise a new ticket if you still need help.
              </p>
            </div>
          ) : (
            <form
              className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-8"
              onSubmit={(e) => void sendReply(e)}
            >
              <div className="flex items-end gap-3">
                {viewer?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewer.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="mb-0.5 h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-100"
                  />
                ) : (
                  <span className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
                    {profileInitialsFromName(viewerName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-50">
                    {pendingImages.length > 0 ? (
                      <div className="border-b border-slate-200 px-3 py-2">
                        <CommentImagePreviews
                          pending={pendingImages}
                          onChange={setPendingImages}
                          disabled={busy}
                        />
                      </div>
                    ) : null}
                    <textarea
                      rows={composerOpen || draft ? 3 : 1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onFocus={() => setComposerOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendReply();
                        }
                      }}
                      placeholder="Your comment"
                      className="min-h-[2.75rem] w-full resize-none border-0 bg-transparent px-3.5 py-2 text-[17px] leading-normal text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
                    />
                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-2 py-1.5">
                      {composerOpen ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setDraft("");
                              clearPendingCommentImages(pendingImages);
                              setPendingImages([]);
                              setComposerOpen(false);
                            }}
                            className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={busy || !canSend}
                            className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-50"
                          >
                            {busy ? "Sending…" : "Comment"}
                          </button>
                        </>
                      ) : null}
                      <CommentAttachButton
                        pending={pendingImages}
                        onChange={setPendingImages}
                        disabled={busy}
                        onError={setError}
                        onAttachInteract={() => setComposerOpen(true)}
                        size="md"
                      />
                    </div>
                  </div>
                  {error ? (
                    <p className="mt-2 text-sm text-rose-700" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
