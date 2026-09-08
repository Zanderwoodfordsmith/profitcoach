"use client";

import { ImagePlus, Minus, Send, Video, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CommentImagePreviews,
  clearPendingCommentImages,
  type PendingCommentImage,
} from "@/components/community/CommentImageComposer";
import { SupportChatThread } from "@/components/support/SupportChatBubbles";
import {
  SupportVoiceRecorder,
  pendingSupportVoiceToFile,
  revokePendingSupportVoice,
  type PendingSupportVoice,
} from "@/components/support/SupportVoiceRecorder";
import { COMMUNITY_COMMENT_MEDIA_MAX } from "@/lib/communityCommentMedia";
import {
  uploadSupportMediaFile,
  validateSupportMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import {
  SUPPORT_AUTHOR_SELECT,
  normalizeSupportAuthor,
  supportStatusAfterMemberReply,
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
  onTicketChange: (next: TicketWithReplies) => void;
};

export function SupportTicketChat({
  ticket,
  viewer,
  viewerId,
  onTicketChange,
}: Props) {
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingCommentImage[]>([]);
  const [pendingVoice, setPendingVoice] = useState<PendingSupportVoice | null>(
    null
  );
  const [pendingVideo, setPendingVideo] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = useState(
    ticket.member_notify_email !== false
  );
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const resolved = ticket.status === "resolved";
  const canSend = Boolean(
    draft.trim() || pendingImages.length > 0 || pendingVoice || pendingVideo
  );

  useEffect(() => {
    setNotifyEmail(ticket.member_notify_email !== false);
  }, [ticket.id, ticket.member_notify_email]);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setAccountEmail(user?.email?.trim() || null);
    })();
  }, []);

  useEffect(() => {
    return () => {
      clearPendingCommentImages(pendingImages);
      revokePendingSupportVoice(pendingVoice);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [ticket.replies.length]);

  useEffect(() => {
    if (!composerOpen) return;
    const t = window.setTimeout(() => replyTextareaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [composerOpen]);

  function minimizeComposer() {
    setComposerOpen(false);
  }

  async function toggleNotifyEmail(next: boolean) {
    setNotifyBusy(true);
    setNotifyEmail(next);
    const { error: rpcError } = await supabaseClient.rpc(
      "set_support_ticket_notify_email",
      { p_report_id: ticket.id, p_notify: next }
    );
    if (rpcError) {
      setNotifyEmail(!next);
      setError(rpcError.message);
    } else {
      onTicketChange({ ...ticket, member_notify_email: next });
    }
    setNotifyBusy(false);
  }

  function addPendingImages(files: FileList | null) {
    if (!files?.length) return;
    const room = COMMUNITY_COMMENT_MEDIA_MAX - pendingImages.length;
    if (room <= 0) return;
    const next = [...pendingImages];
    for (const file of Array.from(files).slice(0, room)) {
      const validated = validateSupportMediaFile(file);
      if ("error" in validated) {
        setError(validated.error);
        continue;
      }
      if (validated.kind !== "image") {
        setError("Use the video or voice button for that file type.");
        continue;
      }
      next.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingImages(next);
  }

  function addPendingVideo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const validated = validateSupportMediaFile(file);
    if ("error" in validated) {
      setError(validated.error);
      return;
    }
    if (validated.kind !== "video") {
      setError("Please choose a video file (MP4, WebM, or MOV).");
      return;
    }
    if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
    setPendingVideo({ file, url: URL.createObjectURL(file) });
  }

  async function sendReply(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !canSend) return;
    setBusy(true);
    setError(null);

    try {
      const uploaded: CommunityPostMediaItem[] = [];
      for (const item of pendingImages) {
        const up = await uploadSupportMediaFile(item.file);
        if ("error" in up) throw new Error(up.error);
        uploaded.push(up.media);
      }
      if (pendingVoice) {
        const up = await uploadSupportMediaFile(
          pendingSupportVoiceToFile(pendingVoice)
        );
        if ("error" in up) throw new Error(up.error);
        uploaded.push(up.media);
      }
      if (pendingVideo) {
        const up = await uploadSupportMediaFile(pendingVideo.file);
        if ("error" in up) throw new Error(up.error);
        uploaded.push(up.media);
      }

      const body =
        draft.trim() ||
        (pendingVoice
          ? "Sent a voice note"
          : pendingVideo
            ? "Sent a video"
            : "");

      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_replies")
        .insert({
          report_id: ticket.id,
          created_by: viewerId,
          body,
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
        author: normalizeSupportAuthor(data.author) ?? viewer,
      };

      let nextStatus = ticket.status;
      const statusAfterReply = supportStatusAfterMemberReply(ticket.status);
      if (statusAfterReply) {
        const { error: statusError } = await supabaseClient
          .from("community_feedback_reports")
          .update({ status: statusAfterReply })
          .eq("id", ticket.id);
        if (!statusError) nextStatus = statusAfterReply;
      }

      onTicketChange({
        ...ticket,
        status: nextStatus,
        replies: [...ticket.replies, reply],
      });
      setDraft("");
      clearPendingCommentImages(pendingImages);
      setPendingImages([]);
      revokePendingSupportVoice(pendingVoice);
      setPendingVoice(null);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
      setPendingVideo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-slate-100 bg-[#f7f8fa]">
      <div className="max-h-[min(28rem,50vh)] space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
        <SupportChatThread
          replies={ticket.replies}
          viewerId={viewerId}
          perspective="member"
          emptyLabel="We'll reply here."
        />
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-slate-200 bg-white"
        onSubmit={(e) => void sendReply(e)}
      >
        {resolved && composerOpen ? (
          <p className="border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 sm:px-5">
            Resolved — sending a message will reopen it.
          </p>
        ) : ticket.status === "waiting_reply" && composerOpen ? (
          <p className="border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 sm:px-5">
            Support is waiting on your reply.
          </p>
        ) : null}

        {!composerOpen ? (
          <div className="px-4 py-2.5 sm:px-5">
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
              >
                {resolved
                  ? "Message to reopen…"
                  : ticket.status === "waiting_reply"
                    ? "Write your reply…"
                    : "Type a message…"}
              </button>
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="flex shrink-0 items-center justify-center border-l border-slate-200 px-3 py-2 text-sky-600 hover:bg-sky-50"
                aria-label="Compose"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {error ? (
              <p className="mt-2 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 px-4 py-2.5 sm:px-5">
            {pendingImages.length > 0 ? (
              <CommentImagePreviews
                pending={pendingImages}
                onChange={setPendingImages}
                disabled={busy}
              />
            ) : null}
            {pendingVideo ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <video
                  src={pendingVideo.url}
                  className="h-14 w-20 rounded object-cover"
                  muted
                />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                  {pendingVideo.file.name}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    URL.revokeObjectURL(pendingVideo.url);
                    setPendingVideo(null);
                  }}
                  className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
                  aria-label="Remove video"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-sky-400">
              <button
                type="button"
                title="Minimize"
                onClick={minimizeComposer}
                className="absolute right-1.5 top-1.5 z-10 rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                <Minus className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <textarea
                ref={replyTextareaRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
                placeholder={
                  resolved
                    ? "Message to reopen…"
                    : ticket.status === "waiting_reply"
                      ? "Write your reply…"
                      : "Write a message…"
                }
                className="min-h-[3.25rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 pr-9 text-sm leading-normal text-slate-900 outline-none placeholder:text-slate-400"
              />
              <SupportVoiceRecorder
                pending={pendingVoice}
                onChange={(note) => {
                  setPendingVoice((prev) => {
                    if (prev?.url && prev.url !== note?.url) {
                      URL.revokeObjectURL(prev.url);
                    }
                    return note;
                  });
                }}
                disabled={busy}
                onError={setError}
                onInteract={() => setComposerOpen(true)}
                toolbar={(micButton) => (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5">
                    <div className="flex items-center gap-0.5">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        disabled={
                          busy ||
                          pendingImages.length >= COMMUNITY_COMMENT_MEDIA_MAX
                        }
                        onChange={(e) => {
                          addPendingImages(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        title="Add image"
                        disabled={
                          busy ||
                          pendingImages.length >= COMMUNITY_COMMENT_MEDIA_MAX
                        }
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                      >
                        <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,.mp4,.mov"
                        className="hidden"
                        disabled={busy || Boolean(pendingVideo)}
                        onChange={(e) => {
                          addPendingVideo(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        title="Attach video"
                        disabled={busy || Boolean(pendingVideo)}
                        onClick={() => videoInputRef.current?.click()}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                      >
                        <Video className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      {micButton}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <label
                        className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500"
                        title={
                          accountEmail
                            ? `Email ${accountEmail} when support replies`
                            : "Email me when support replies"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={notifyEmail}
                          disabled={notifyBusy}
                          onChange={(e) =>
                            void toggleNotifyEmail(e.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
                        />
                        <span className="whitespace-nowrap">Email me</span>
                      </label>
                      <button
                        type="submit"
                        disabled={busy || !canSend}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        aria-label="Send message"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden />
                        Send
                      </button>
                    </div>
                  </div>
                )}
              />
            </div>
            {error ? (
              <p className="text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
}
