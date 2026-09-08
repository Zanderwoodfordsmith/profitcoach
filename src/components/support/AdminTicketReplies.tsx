"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  Hourglass,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Minus,
  Send,
  Smile,
  Video,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommunityPostMediaGallery } from "@/components/community/CommunityPostMediaGallery";
import {
  CommentAttachButton,
  CommentImagePreviews,
  clearPendingCommentImages,
  type PendingCommentImage,
} from "@/components/community/CommentImageComposer";
import {
  SupportChatAvatar,
  SupportChatThread,
  supportAuthorShortName,
} from "@/components/support/SupportChatBubbles";
import { SeeMoreText } from "@/components/support/SeeMoreText";
import {
  SupportVoiceRecorder,
  pendingSupportVoiceToFile,
  revokePendingSupportVoice,
  type PendingSupportVoice,
} from "@/components/support/SupportVoiceRecorder";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";
import {
  COMMUNITY_COMMENT_MEDIA_MAX,
} from "@/lib/communityCommentMedia";
import {
  uploadSupportMediaFile,
  validateSupportMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import { parseSupportTicketMedia } from "@/lib/support/supportTicketMedia";
import {
  assigneeDisplayName,
  isSupportMessageSender,
  type SupportAssignee,
} from "@/lib/support/assignees";
import { supabaseClient } from "@/lib/supabaseClient";
import { isSupabaseAbortError } from "@/lib/supabaseErrorMessage";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_STATUS_ADMIN_LABELS,
  normalizeSupportAuthor,
  supportStatusAfterStaffReply,
  type SupportReply,
  type SupportTicketStatus,
} from "@/lib/support/tickets";

const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((m) => m.default),
  { ssr: false }
);

export type AdminTicketOpening = {
  authorLabel: string;
  authorAvatarUrl?: string | null;
  title: string;
  body: string;
  createdAt: string;
  typeLabel: string;
  media?: unknown;
};

type AdminTicketRepliesProps = {
  reportId: string;
  reportStatus: SupportTicketStatus;
  onStatusTouched?: () => void;
  /** Change ticket status from the inbox header control. */
  onStatusChange?: (status: SupportTicketStatus) => void;
  statusSaving?: boolean;
  /** Card = nested under table/card; inbox = full thread pane. */
  variant?: "card" | "inbox";
  openingMessage?: AdminTicketOpening;
  /** Show "Email about this reply" when we have a member or contact email. */
  canEmailNotify?: boolean;
  /** Default checkbox on (e.g. email_inbox / public_form). */
  emailNotifyDefault?: boolean;
  /** Short label for who gets the email, e.g. coach name. */
  emailNotifyLabel?: string | null;
  /** Staff profiles the admin can send as (Zander, Pam, …). */
  sendAsOptions?: SupportAssignee[];
};

export function AdminTicketReplies({
  reportId,
  reportStatus,
  onStatusTouched,
  onStatusChange,
  statusSaving = false,
  variant = "card",
  openingMessage,
  canEmailNotify = false,
  emailNotifyDefault = false,
  emailNotifyLabel = null,
  sendAsOptions = [],
}: AdminTicketRepliesProps) {
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [userId, setUserId] = useState<string | null>(null);
  const [sendAsId, setSendAsId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [sendAsMenuOpen, setSendAsMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emailNotify, setEmailNotify] = useState(emailNotifyDefault);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const sendAsMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const inbox = variant === "inbox";

  const sendAsPeople = useMemo(() => {
    const preferred = ["zander", "pam"];
    const ranked = [...sendAsOptions]
      .filter(isSupportMessageSender)
      .sort((a, b) => {
      const ai = preferred.indexOf((a.first_name ?? "").toLowerCase());
      const bi = preferred.indexOf((b.first_name ?? "").toLowerCase());
      const ar = ai === -1 ? 99 : ai;
      const br = bi === -1 ? 99 : bi;
      if (ar !== br) return ar - br;
      return assigneeDisplayName(a).localeCompare(assigneeDisplayName(b));
    });
    const byId = new Map<string, SupportAssignee>();
    for (const a of ranked) byId.set(a.id, a);
    return [...byId.values()];
  }, [sendAsOptions]);

  const activeSendAs =
    sendAsPeople.find((a) => a.id === sendAsId) ??
    sendAsPeople.find((a) => a.id === userId) ??
    sendAsPeople[0] ??
    null;

  useEffect(() => {
    setEmailNotify(emailNotifyDefault);
    setNotifyNote(null);
  }, [reportId, emailNotifyDefault]);

  const loadReplies = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
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
    if (generation !== loadGenerationRef.current) return;

    if (queryError) {
      if (isSupabaseAbortError(queryError)) return;
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
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadReplies]);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setUserId(user?.id ?? null);
      setSendAsId((current) => current ?? user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (sendAsId && sendAsPeople.some((a) => a.id === sendAsId)) return;
    const preferred =
      sendAsPeople.find((a) => a.id === userId)?.id ??
      sendAsPeople[0]?.id ??
      userId;
    setSendAsId(preferred);
  }, [userId, sendAsPeople, sendAsId]);

  useEffect(() => {
    setComposerOpen(false);
    setComposerExpanded(false);
    setSendAsMenuOpen(false);
    setEmojiOpen(false);
    setDraft("");
    clearPendingCommentImages(pendingImages);
    setPendingImages([]);
    revokePendingSupportVoice(pendingVoice);
    setPendingVoice(null);
    if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
    setPendingVideo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on ticket change
  }, [reportId]);

  useEffect(() => {
    return () => {
      revokePendingSupportVoice(pendingVoice);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sendAsMenuOpen && !emojiOpen && !statusMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        sendAsMenuOpen &&
        sendAsMenuRef.current &&
        !sendAsMenuRef.current.contains(t)
      ) {
        setSendAsMenuOpen(false);
      }
      if (
        statusMenuOpen &&
        statusMenuRef.current &&
        !statusMenuRef.current.contains(t)
      ) {
        setStatusMenuOpen(false);
      }
      if (emojiOpen && emojiWrapRef.current && !emojiWrapRef.current.contains(t)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sendAsMenuOpen, emojiOpen, statusMenuOpen]);

  useEffect(() => {
    if (!inbox) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [inbox, reportId, replies.length, loading]);

  function insertEmojiAtCursor(emoji: string) {
    const el = replyTextareaRef.current;
    if (!el) {
      setDraft((d) => d + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function minimizeComposer() {
    setComposerOpen(false);
    setComposerExpanded(false);
    setSendAsMenuOpen(false);
    setEmojiOpen(false);
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

  async function sendReply() {
    const body = draft.trim();
    const authorId = sendAsId ?? userId;
    const hasMedia =
      pendingImages.length > 0 || Boolean(pendingVoice) || Boolean(pendingVideo);
    if ((!body && !hasMedia) || busy || !authorId) return;
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

      const replyBody =
        body ||
        (pendingVoice
          ? "Sent a voice note"
          : pendingVideo
            ? "Sent a video"
            : "");

      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_replies")
        .insert({
          report_id: reportId,
          created_by: authorId,
          body: replyBody,
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
      revokePendingSupportVoice(pendingVoice);
      setPendingVoice(null);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
      setPendingVideo(null);
      setComposerOpen(false);
      setComposerExpanded(false);
      setNotifyNote(null);

      const nextStatus = supportStatusAfterStaffReply(reportStatus);
      if (nextStatus) {
        const { error: statusError } = await supabaseClient
          .from("community_feedback_reports")
          .update({ status: nextStatus })
          .eq("id", reportId);
        if (!statusError) onStatusTouched?.();
      }

      if (canEmailNotify && emailNotify && replyBody) {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (session?.access_token) {
          const notifyRes = await fetch(
            `/api/admin/support/tickets/${reportId}/notify-reply`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ replyBody }),
            }
          );
          const notifyBody = (await notifyRes.json().catch(() => ({}))) as {
            error?: string;
            emailed?: string;
          };
          if (!notifyRes.ok) {
            setNotifyNote(
              notifyBody.error ||
                "Reply saved, but the email notification failed."
            );
          } else {
            setNotifyNote(
              notifyBody.emailed
                ? `Email to ${notifyBody.emailed} queued (sends after a short pause if you keep typing).`
                : "Email notification queued."
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setBusy(false);
    }
  }

  const canSend = Boolean(
    draft.trim() ||
      pendingImages.length > 0 ||
      pendingVoice ||
      pendingVideo
  );

  const activeSendAsLabel = activeSendAs
    ? supportAuthorShortName({
        id: activeSendAs.id,
        full_name: activeSendAs.full_name,
        first_name: activeSendAs.first_name,
        last_name: activeSendAs.last_name,
        avatar_url: activeSendAs.avatar_url,
        role: activeSendAs.role ?? "admin",
      })
    : "Send as";

  const sendAsSelect =
    sendAsPeople.length > 0 ? (
      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
        <select
          value={activeSendAs?.id ?? ""}
          onChange={(e) => setSendAsId(e.target.value)}
          className="max-w-[10rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 [color-scheme:light] focus:border-sky-500 focus:outline-none"
          aria-label="Send as"
        >
          {sendAsPeople.map((person) => (
            <option key={person.id} value={person.id}>
              {supportAuthorShortName({
                id: person.id,
                full_name: person.full_name,
                first_name: person.first_name,
                last_name: person.last_name,
                avatar_url: person.avatar_url,
                role: person.role ?? "admin",
              })}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  const notifyToggle = canEmailNotify ? (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
      <input
        type="checkbox"
        checked={emailNotify}
        onChange={(e) => setEmailNotify(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 accent-sky-600"
      />
      <span>
        Email{" "}
        {emailNotifyLabel?.trim() ? emailNotifyLabel.trim() : "them"} about this
        reply
        <span className="text-slate-400"> (waits ~4 min)</span>
      </span>
    </label>
  ) : null;

  const sendAsPicker =
    sendAsPeople.length > 0 ? (
      <div className="relative" ref={sendAsMenuRef}>
        <button
          type="button"
          aria-label={`Send as ${activeSendAsLabel}`}
          aria-expanded={sendAsMenuOpen}
          onClick={() => setSendAsMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {activeSendAs ? (
            <SupportChatAvatar
              name={assigneeDisplayName(activeSendAs)}
              avatarUrl={activeSendAs.avatar_url}
              tone="sky"
              size="xs"
            />
          ) : null}
          <span>{activeSendAsLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
        </button>
        {sendAsMenuOpen ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
          >
            {sendAsPeople.map((person) => {
              const label = supportAuthorShortName({
                id: person.id,
                full_name: person.full_name,
                first_name: person.first_name,
                last_name: person.last_name,
                avatar_url: person.avatar_url,
                role: person.role ?? "admin",
              });
              const active = person.id === activeSendAs?.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSendAsId(person.id);
                    setSendAsMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                    active
                      ? "bg-sky-50 font-medium text-sky-800"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <SupportChatAvatar
                    name={assigneeDisplayName(person)}
                    avatarUrl={person.avatar_url}
                    tone="sky"
                    size="xs"
                  />
                  <span className="min-w-0 flex-1">{label}</span>
                  {active ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-sky-600"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    ) : null;

  const composer = inbox ? (
    <div
      className={`relative flex flex-col border-t border-slate-200 bg-white ${
        composerOpen && composerExpanded ? "min-h-0 flex-1" : "shrink-0"
      }`}
    >
      {reportStatus === "resolved" && composerOpen ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          This ticket is resolved — sending a message will reopen it.
        </p>
      ) : null}
      {!composerOpen ? (
        <div className="px-3 py-2.5">
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
            {sendAsPeople.length > 0 ? (
              <div className="relative shrink-0" ref={sendAsMenuRef}>
                <button
                  type="button"
                  aria-label={`Send as ${activeSendAsLabel}`}
                  aria-expanded={sendAsMenuOpen}
                  onClick={() => setSendAsMenuOpen((v) => !v)}
                  className="flex h-full items-center gap-1.5 border-r border-slate-200 px-2.5 py-2 hover:bg-slate-50"
                >
                  {activeSendAs ? (
                    <SupportChatAvatar
                      name={assigneeDisplayName(activeSendAs)}
                      avatarUrl={activeSendAs.avatar_url}
                      tone="sky"
                      size="xs"
                    />
                  ) : null}
                  <ChevronDown
                    className="h-3.5 w-3.5 text-slate-400"
                    strokeWidth={2}
                  />
                </button>
                {sendAsMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute bottom-full left-0 z-30 mb-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
                  >
                    {sendAsPeople.map((person) => {
                      const label = supportAuthorShortName({
                        id: person.id,
                        full_name: person.full_name,
                        first_name: person.first_name,
                        last_name: person.last_name,
                        avatar_url: person.avatar_url,
                        role: person.role ?? "admin",
                      });
                      const active = person.id === activeSendAs?.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setSendAsId(person.id);
                            setSendAsMenuOpen(false);
                            setComposerOpen(true);
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                            active
                              ? "bg-sky-50 font-medium text-sky-800"
                              : "text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          <SupportChatAvatar
                            name={assigneeDisplayName(person)}
                            avatarUrl={person.avatar_url}
                            tone="sky"
                            size="xs"
                          />
                          <span className="min-w-0 flex-1">{label}</span>
                          {active ? (
                            <Check
                              className="h-3.5 w-3.5 shrink-0 text-sky-600"
                              strokeWidth={2.5}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setComposerOpen(true);
                setSendAsMenuOpen(false);
              }}
              className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              Type a message
            </button>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(true);
                setSendAsMenuOpen(false);
              }}
              className="flex shrink-0 items-center justify-center border-l border-slate-200 px-3 py-2 text-sky-600 hover:bg-sky-50"
              aria-label="Compose"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`flex min-h-0 flex-col ${
            composerExpanded ? "h-full flex-1" : ""
          }`}
        >
          <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            {sendAsPicker}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Minimize"
                onClick={minimizeComposer}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                <Minus className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                title={
                  composerExpanded ? "Shrink composer" : "Expand composer"
                }
                onClick={() => setComposerExpanded((v) => !v)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                {composerExpanded ? (
                  <Minimize2 className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
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

            <div
              className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-sky-400 ${
                composerExpanded ? "flex-1" : ""
              }`}
            >
              <textarea
                ref={replyTextareaRef}
                rows={composerExpanded ? undefined : 4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
                autoFocus
                placeholder="Write a message..."
                className={`min-h-[5.5rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm leading-normal text-slate-900 outline-none placeholder:text-slate-400 ${
                  composerExpanded ? "min-h-0 flex-1" : ""
                }`}
              />
            </div>

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
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Support templates (coming soon)"
                      disabled
                      className="rounded-md p-1.5 text-slate-300"
                    >
                      <FileText className="h-4 w-4" strokeWidth={1.75} />
                    </button>
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
                      <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
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
                    <div className="relative" ref={emojiWrapRef}>
                      <button
                        type="button"
                        title="Emoji"
                        onClick={() => setEmojiOpen((v) => !v)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Smile className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      {emojiOpen ? (
                        <div className="absolute bottom-full left-0 z-40 mb-2">
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              insertEmojiAtCursor(emojiData.emoji);
                              setEmojiOpen(false);
                            }}
                            width={320}
                            height={360}
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-3">
                    {notifyToggle}
                    <button
                      type="button"
                      disabled={busy || !canSend}
                      onClick={() => void sendReply()}
                      className="shrink-0 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {busy ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              )}
            />

            {notifyNote ? (
              <p className="text-xs text-slate-600">{notifyNote}</p>
            ) : null}
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          </div>
        </div>
      )}
      {!composerOpen && (error || notifyNote) ? (
        <div className="space-y-1 px-3 pb-2">
          {notifyNote ? (
            <p className="text-xs text-slate-600">{notifyNote}</p>
          ) : null}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  ) : (
    <div className="mt-3 space-y-2">
      {reportStatus === "resolved" ? (
        <p className="text-[11px] text-slate-500">
          This ticket is resolved — sending a reply will reopen it.
        </p>
      ) : null}
      <CommentImagePreviews
        pending={pendingImages}
        onChange={setPendingImages}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-3">
        {sendAsSelect}
        {notifyToggle}
      </div>
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
          placeholder="Reply to the coach…"
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
          disabled={busy || !canSend}
          onClick={() => void sendReply()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-700 text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          aria-label="Send reply"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {notifyNote ? (
        <p className="text-[11px] text-slate-600">{notifyNote}</p>
      ) : null}
    </div>
  );

  if (inbox) {
    const statusStyles: Record<
      SupportTicketStatus,
      { trigger: string; option: string; icon: ReactNode }
    > = {
      open: {
        trigger: "bg-sky-50 text-sky-800 ring-sky-200/80",
        option: "bg-sky-50 text-sky-800 hover:bg-sky-100",
        icon: <Circle className="h-3.5 w-3.5" strokeWidth={2} />,
      },
      waiting_reply: {
        trigger: "bg-amber-50 text-amber-900 ring-amber-200/80",
        option: "bg-amber-50 text-amber-900 hover:bg-amber-100",
        icon: <Hourglass className="h-3.5 w-3.5" strokeWidth={1.75} />,
      },
      resolved: {
        trigger: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
        option: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
        icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
      },
    };

    const activeStatus = statusStyles[reportStatus];

    const statusSelect = onStatusChange ? (
      <div className="relative shrink-0" ref={statusMenuRef}>
        <button
          type="button"
          disabled={statusSaving}
          aria-label="Ticket status"
          aria-expanded={statusMenuOpen}
          onClick={() => setStatusMenuOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2 text-sm font-semibold ring-1 ring-inset disabled:opacity-60 ${activeStatus.trigger}`}
        >
          {activeStatus.icon}
          {SUPPORT_STATUS_ADMIN_LABELS[reportStatus]}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
        </button>
        {statusMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1.5 min-w-[10.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
          >
            {(
              Object.keys(SUPPORT_STATUS_ADMIN_LABELS) as SupportTicketStatus[]
            ).map((s) => {
              const style = statusStyles[s];
              const active = s === reportStatus;
              return (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setStatusMenuOpen(false);
                    if (s !== reportStatus) onStatusChange(s);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold ${style.option} ${
                    active ? "ring-1 ring-inset ring-black/10" : ""
                  }`}
                >
                  {style.icon}
                  <span className="min-w-0 flex-1">
                    {SUPPORT_STATUS_ADMIN_LABELS[s]}
                  </span>
                  {active ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 opacity-80"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    ) : (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${activeStatus.trigger}`}
      >
        {activeStatus.icon}
        {SUPPORT_STATUS_ADMIN_LABELS[reportStatus]}
      </span>
    );

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div
          className={`min-h-0 overflow-y-auto overscroll-contain bg-[#f7f8fa] ${
            composerOpen && composerExpanded ? "max-h-[45%] shrink-0" : "flex-1"
          }`}
        >
          {openingMessage ? (
            <div className="border-b border-slate-200/80 bg-white px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <SupportChatAvatar
                  name={openingMessage.authorLabel}
                  avatarUrl={openingMessage.authorAvatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-none text-slate-900">
                        {openingMessage.authorLabel}
                      </p>
                      <p className="mt-1 text-xs leading-none text-slate-500">
                        {formatCommunityPostTimestamp(openingMessage.createdAt)}
                        <span className="mx-0.5 select-none text-slate-400">
                          ·
                        </span>
                        <span className="font-semibold text-slate-600">
                          {openingMessage.typeLabel}
                        </span>
                      </p>
                    </div>
                    {statusSelect}
                  </div>
                </div>
              </div>
              <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
                {openingMessage.title}
              </h2>
              {openingMessage.body.trim() ? (
                <div className="mt-1.5">
                  <SeeMoreText
                    key={reportId}
                    text={openingMessage.body}
                    variant="feed"
                  />
                </div>
              ) : null}
              {(() => {
                const openingMedia = parseSupportTicketMedia(
                  openingMessage.media
                );
                return openingMedia.length > 0 ? (
                  <div className="mt-3">
                    <CommunityPostMediaGallery
                      items={openingMedia}
                      variant="compact"
                    />
                  </div>
                ) : null;
              })()}
            </div>
          ) : null}

          <div className="px-4 py-4 sm:px-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading conversation…</p>
            ) : (
              <SupportChatThread
                replies={replies}
                viewerId={userId}
                perspective="admin"
              />
            )}
            <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
          </div>
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-[#f7f8fa] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Conversation
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-slate-500">Loading replies…</p>
      ) : (
        <div className="mt-2">
          <SupportChatThread
            replies={replies}
            viewerId={userId}
            perspective="admin"
            emptyLabel="No replies yet."
          />
        </div>
      )}
      {composer}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
