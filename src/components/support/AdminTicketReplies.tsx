"use client";

import { Send, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  CommentAttachButton,
  CommentImagePreviews,
  clearPendingCommentImages,
  type PendingCommentImage,
} from "@/components/community/CommentImageComposer";
import { CommentMediaDisplay } from "@/components/community/CommentMediaDisplay";
import { profileInitialsFromName } from "@/lib/communityProfile";
import { uploadCommunityCommentImageFile } from "@/lib/communityCommentMedia";
import { parseSupportReplyMedia } from "@/lib/support/supportTicketMedia";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  SUPPORT_AUTHOR_SELECT,
  authorDisplayName,
  formatSupportRelativeAgo,
  isSupportStaffAuthor,
  normalizeSupportAuthor,
  type SupportReply,
} from "@/lib/support/tickets";

type AdminTicketRepliesProps = {
  reportId: string;
  reportStatus: "new" | "in_review" | "resolved";
  onStatusTouched?: () => void;
};

export function AdminTicketReplies({
  reportId,
  reportStatus,
  onStatusTouched,
}: AdminTicketRepliesProps) {
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingCommentImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadReplies = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabaseClient
      .from("community_feedback_replies")
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
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });

    if (queryError) {
      setReplies([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setReplies(
      (data ?? []).map((raw) => ({
        id: raw.id,
        created_at: raw.created_at,
        report_id: raw.report_id,
        created_by: raw.created_by,
        body: raw.body,
        media: raw.media,
        community_comment_id: raw.community_comment_id ?? null,
        author: normalizeSupportAuthor(raw.author),
      }))
    );
    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    void loadReplies();
  }, [loadReplies]);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  async function sendReply() {
    const body = draft.trim();
    if ((!body && pendingImages.length === 0) || busy || !userId) return;
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
          report_id: reportId,
          created_by: userId,
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
        author: normalizeSupportAuthor(data.author),
      };
      setReplies((current) => [...current, reply]);
      setDraft("");
      clearPendingCommentImages(pendingImages);
      setPendingImages([]);

      if (reportStatus === "new") {
        const { error: statusError } = await supabaseClient
          .from("community_feedback_reports")
          .update({ status: "in_review" })
          .eq("id", reportId);
        if (!statusError) onStatusTouched?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Conversation
      </p>

      {loading ? (
        <p className="mt-2 text-xs text-slate-500">Loading replies...</p>
      ) : replies.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No replies yet.</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {replies.map((reply) => {
            const staff = isSupportStaffAuthor(reply.author);
            const name = staff
              ? "Support Team"
              : authorDisplayName(reply.author);
            const initials = profileInitialsFromName(name);

            return (
              <li key={reply.id} className="flex items-start gap-2">
                {staff ? (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white">
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-slate-700">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  {reply.body.trim() ? (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                      {reply.body}
                    </p>
                  ) : null}
                  <CommentMediaDisplay
                    media={parseSupportReplyMedia(reply.media)}
                    className="mt-2"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {name} · {formatSupportRelativeAgo(reply.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {reportStatus !== "resolved" ? (
        <div className="mt-3 space-y-2">
          <CommentImagePreviews
            pending={pendingImages}
            onChange={setPendingImages}
            disabled={busy}
          />
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              placeholder="Reply to the coach..."
              className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <CommentAttachButton
              pending={pendingImages}
              onChange={setPendingImages}
              disabled={busy}
              onError={setError}
              size="sm"
            />
            <button
              type="button"
              disabled={busy || (!draft.trim() && pendingImages.length === 0)}
              onClick={() => void sendReply()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-700 text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Send reply"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
