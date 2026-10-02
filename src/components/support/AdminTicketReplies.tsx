"use client";

import {
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Eye,
  FileText,
  Hourglass,
  Image as ImageIcon,
  Link as LinkIcon,
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
import { PreviewableMedia } from "@/components/media/AttachmentPreviewModal";
import {
  CommentAttachButton,
  CommentImagePreviews,
  clearPendingCommentImages,
  type PendingCommentImage,
} from "@/components/community/CommentImageComposer";
import {
  ScheduledSupportBubble,
  SupportChatAvatar,
  SupportChatThread,
  SupportViaEmailMark,
  supportAuthorShortName,
} from "@/components/support/SupportChatBubbles";
import { SupportOpeningBody } from "@/components/support/SeeMoreText";
import { MentionTextarea } from "@/components/community/MentionTextarea";
import { notifySupportCountsChanged } from "@/components/layout/useNewFeedbackCount";
import {
  SupportVoiceRecorder,
  pendingSupportVoiceToFile,
  revokePendingSupportVoice,
  type PendingSupportVoice,
} from "@/components/support/SupportVoiceRecorder";
import { formatCommunityPostTimestamp } from "@/lib/communityRelativeTime";
import { ScheduleMessageModal } from "@/components/messaging/ComposerMediaTools";
import { assertFutureSchedule } from "@/lib/support/scheduledReplies";
import {
  COMMUNITY_COMMENT_MEDIA_MAX,
} from "@/lib/communityCommentMedia";
import {
  uploadSupportMediaFile,
  validateSupportMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import {
  parseSupportReplyMedia,
  parseSupportTicketMedia,
  supportComposerFallbackBody,
} from "@/lib/support/supportTicketMedia";
import {
  clearAdminReplyDraft,
  loadAdminReplyDraft,
  saveAdminReplyDraft,
} from "@/lib/support/adminReplyDrafts";
import {
  deleteSupportInternalNote,
  insertSupportInternalNote,
  loadSupportInternalNotes,
  updateSupportInternalNote,
  type SupportInternalNote,
} from "@/lib/support/internalNotes";
import {
  applyMarkdownLink,
  applyTextareaWrap,
} from "@/lib/support/textareaFormat";
import {
  assigneeDisplayName,
  isSupportMessageSender,
  type SupportAssignee,
} from "@/lib/support/assignees";
import {
  SUPPORT_CALL_HOSTS,
  SUPPORT_CALL_PUBLIC_ORIGIN,
  type SupportCallHostSlug,
} from "@/lib/support/supportCallHosts";
import {
  buildSupportCallPrefillQuery,
  type SupportCallContactPrefill,
} from "@/lib/support/supportCallPrefill";
import { supabaseClient } from "@/lib/supabaseClient";
import { isSupabaseAbortError } from "@/lib/supabaseErrorMessage";
import {
  SUPPORT_AUTHOR_SELECT,
  SUPPORT_REPLY_LIST_SELECT,
  SUPPORT_STATUS_ADMIN_LABELS,
  mapSupportReplyRow,
  normalizeSupportAuthor,
  supportStatusAfterStaffReply,
  type SupportReply,
  type SupportTicketAuthor,
  type SupportTicketStatus,
} from "@/lib/support/tickets";

type ComposerMode = "reply" | "note";

type ScheduledSupportReply = {
  id: string;
  created_by: string;
  body: string;
  media: unknown;
  email_notify: boolean;
  scheduled_for: string;
  status: string;
  last_error: string | null;
  author: SupportTicketAuthor | null;
};

const SCHEDULED_REPLY_SELECT = `
  id,
  created_by,
  body,
  media,
  email_notify,
  scheduled_for,
  status,
  last_error,
  author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})
`;

function mapScheduledReply(raw: {
  id: string;
  created_by: string;
  body: string;
  media?: unknown;
  email_notify?: boolean | null;
  scheduled_for: string;
  status: string;
  last_error?: string | null;
  author?: SupportTicketAuthor | SupportTicketAuthor[] | null;
}): ScheduledSupportReply {
  return {
    id: raw.id,
    created_by: raw.created_by,
    body: raw.body,
    media: raw.media,
    email_notify: Boolean(raw.email_notify),
    scheduled_for: raw.scheduled_for,
    status: raw.status,
    last_error: raw.last_error ?? null,
    author: normalizeSupportAuthor(raw.author),
  };
}

const ADMIN_REPLY_DRAFT_DEBOUNCE_MS = 500;

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
  /** Original ticket arrived through the support mailbox. */
  viaEmail?: boolean;
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
  /** Prefill name/email/phone on support-call booking links from templates. */
  supportCallContact?: SupportCallContactPrefill | null;
  /** Fired after an internal note is saved (for inbox attention refresh). */
  onInternalNoteSaved?: () => void;
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
  supportCallContact = null,
  onInternalNoteSaved,
}: AdminTicketRepliesProps) {
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [internalNotes, setInternalNotes] = useState<SupportInternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply");
  const [pendingImages, setPendingImages] = useState<PendingCommentImage[]>([]);
  const [pendingVoice, setPendingVoice] = useState<PendingSupportVoice | null>(
    null
  );
  const [pendingVideo, setPendingVideo] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const [busyKind, setBusyKind] = useState<
    null | "send" | "schedule" | "note"
  >(null);
  const busy = busyKind !== null;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [scheduledReplies, setScheduledReplies] = useState<
    ScheduledSupportReply[]
  >([]);
  const [cancellingScheduleId, setCancellingScheduleId] = useState<
    string | null
  >(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sendAsId, setSendAsId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [sendAsMenuOpen, setSendAsMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [emailNotify, setEmailNotify] = useState(emailNotifyDefault);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const sendAsMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const templatesWrapRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const reportIdRef = useRef(reportId);
  const prevReportIdRef = useRef<string | null>(null);
  const draftLoadGenerationRef = useRef(0);
  const draftAutosaveReadyRef = useRef(false);
  draftRef.current = draft;
  reportIdRef.current = reportId;
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

  const loadReplies = useCallback(async (opts?: { silent?: boolean }) => {
    const generation = ++loadGenerationRef.current;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    const [repliesResult, notesResult, scheduledResult] = await Promise.all([
      supabaseClient
        .from("community_feedback_replies")
        .select(SUPPORT_REPLY_LIST_SELECT)
        .eq("report_id", reportId)
        .order("created_at", { ascending: true }),
      loadSupportInternalNotes(reportId),
      supabaseClient
        .from("support_scheduled_replies")
        .select(SCHEDULED_REPLY_SELECT)
        .eq("report_id", reportId)
        .in("status", ["scheduled", "failed"])
        .order("scheduled_for", { ascending: true }),
    ]);
    if (generation !== loadGenerationRef.current) return;

    if (repliesResult.error) {
      if (isSupabaseAbortError(repliesResult.error)) return;
      if (!opts?.silent) {
        setReplies([]);
        setInternalNotes([]);
        setScheduledReplies([]);
        setError(repliesResult.error.message);
        setLoading(false);
      }
      return;
    }

    setReplies((repliesResult.data ?? []).map((raw) => mapSupportReplyRow(raw)));
    setInternalNotes(notesResult.notes);
    if (!scheduledResult.error) {
      setScheduledReplies((scheduledResult.data ?? []).map(mapScheduledReply));
    }
    if (notesResult.error && !opts?.silent) {
      setError(notesResult.error);
    }
    if (!opts?.silent) setLoading(false);
  }, [reportId]);

  useEffect(() => {
    void loadReplies();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadReplies]);

  useEffect(() => {
    const pending = scheduledReplies.filter((row) => row.status === "scheduled");
    if (!pending.length) return;

    let cancelled = false;

    async function tick() {
      const due = pending.some(
        (row) => new Date(row.scheduled_for).getTime() <= Date.now() + 1_000
      );
      if (due) {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (cancelled || !session?.access_token) return;
        await fetch("/api/admin/support/scheduled-replies/flush", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
      if (!cancelled) void loadReplies({ silent: true });
    }

    const earliest = Math.min(
      ...pending.map((row) => new Date(row.scheduled_for).getTime())
    );
    const dueTimer = window.setTimeout(
      () => {
        void tick();
      },
      Math.max(0, earliest - Date.now())
    );
    const interval = window.setInterval(() => {
      void tick();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearTimeout(dueTimer);
      window.clearInterval(interval);
    };
  }, [loadReplies, scheduledReplies]);

  const updateReplyBody = useCallback(
    async (replyId: string, body: string) => {
      const hasMedia = Boolean(
        parseSupportReplyMedia(
          replies.find((r) => r.id === replyId)?.media
        ).length
      );
      if (!body.trim() && !hasMedia) {
        throw new Error("Message cannot be empty.");
      }
      const { data, error: updateError } = await supabaseClient
        .from("community_feedback_replies")
        .update({ body })
        .eq("id", replyId)
        .eq("report_id", reportId)
        .select(SUPPORT_REPLY_LIST_SELECT)
        .single();
      if (updateError) throw updateError;
      const next = mapSupportReplyRow(data);
      setReplies((current) =>
        current.map((r) => (r.id === replyId ? next : r))
      );
    },
    [replies, reportId]
  );

  const deleteReply = useCallback(
    async (replyId: string) => {
      const { error: deleteError } = await supabaseClient
        .from("community_feedback_replies")
        .delete()
        .eq("id", replyId)
        .eq("report_id", reportId);
      if (deleteError) throw deleteError;
      setReplies((current) => current.filter((r) => r.id !== replyId));
    },
    [reportId]
  );

  const updateNoteBody = useCallback(
    async (noteId: string, body: string) => {
      const { note, error: updateError } = await updateSupportInternalNote({
        noteId,
        reportId,
        body,
      });
      if (updateError || !note) {
        throw new Error(updateError || "Could not update note.");
      }
      setInternalNotes((current) =>
        current.map((n) => (n.id === noteId ? note : n))
      );
      notifySupportCountsChanged();
      onInternalNoteSaved?.();
    },
    [onInternalNoteSaved, reportId]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const { error: deleteError } = await deleteSupportInternalNote({
        noteId,
        reportId,
      });
      if (deleteError) throw new Error(deleteError);
      setInternalNotes((current) => current.filter((n) => n.id !== noteId));
      notifySupportCountsChanged();
      onInternalNoteSaved?.();
    },
    [onInternalNoteSaved, reportId]
  );

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
    const prevId = prevReportIdRef.current;
    if (prevId && prevId !== reportId) {
      void saveAdminReplyDraft(prevId, draftRef.current);
    }
    prevReportIdRef.current = reportId;

    const generation = ++draftLoadGenerationRef.current;
    draftAutosaveReadyRef.current = false;
    setComposerOpen(false);
    setComposerExpanded(false);
    setComposerMode("reply");
    setSendAsMenuOpen(false);
    setScheduleOpen(false);
    setRescheduleId(null);
    setEmojiOpen(false);
    setTemplatesOpen(false);
    setDraft("");
    setNoteDraft("");
    clearPendingCommentImages(pendingImages);
    setPendingImages([]);
    revokePendingSupportVoice(pendingVoice);
    setPendingVoice(null);
    if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
    setPendingVideo(null);

    void loadAdminReplyDraft(reportId).then((restored) => {
      if (generation !== draftLoadGenerationRef.current) return;
      setDraft((current) => {
        // Keep anything the admin typed while the draft was loading.
        if (current.trim()) return current;
        return restored;
      });
      if (restored.trim()) {
        setComposerOpen(true);
      }
      draftAutosaveReadyRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on ticket change
  }, [reportId]);

  useEffect(() => {
    if (!draftAutosaveReadyRef.current) return;
    const timer = window.setTimeout(() => {
      void saveAdminReplyDraft(reportId, draft);
    }, ADMIN_REPLY_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, reportId]);

  useEffect(() => {
    return () => {
      void saveAdminReplyDraft(reportIdRef.current, draftRef.current);
      revokePendingSupportVoice(pendingVoice);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sendAsMenuOpen && !emojiOpen && !statusMenuOpen && !templatesOpen) {
      return;
    }
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
      if (
        templatesOpen &&
        templatesWrapRef.current &&
        !templatesWrapRef.current.contains(t)
      ) {
        setTemplatesOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sendAsMenuOpen, emojiOpen, statusMenuOpen, templatesOpen]);

  useEffect(() => {
    if (!inbox) return;
    const scroller = threadScrollRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [inbox, reportId, replies.length, internalNotes.length, loading]);

  function switchComposerMode(mode: ComposerMode) {
    setComposerMode(mode);
    setSendAsMenuOpen(false);
    setEmojiOpen(false);
    setTemplatesOpen(false);
    setNotifyNote(null);
    if (mode === "note") {
      clearPendingCommentImages(pendingImages);
      setPendingImages([]);
      revokePendingSupportVoice(pendingVoice);
      setPendingVoice(null);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
      setPendingVideo(null);
    }
  }

  function insertEmojiAtCursor(emoji: string) {
    const el = replyTextareaRef.current;
    const current = composerMode === "note" ? noteDraft : draft;
    const setCurrent = composerMode === "note" ? setNoteDraft : setDraft;
    if (!el) {
      setCurrent((d) => d + emoji);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    setCurrent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function applyFormatResult(
    result: { next: string; selectStart: number; selectEnd: number } | null
  ) {
    if (!result) return;
    if (composerMode === "note") setNoteDraft(result.next);
    else setDraft(result.next);
    const el = replyTextareaRef.current;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.selectStart, result.selectEnd);
    });
  }

  function insertBoldMarkdown() {
    const el = replyTextareaRef.current;
    const current = composerMode === "note" ? noteDraft : draft;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    applyFormatResult(
      applyTextareaWrap(current, start, end, "**", "**", "bold")
    );
  }

  function insertLinkMarkdown() {
    const el = replyTextareaRef.current;
    const current = composerMode === "note" ? noteDraft : draft;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    applyFormatResult(applyMarkdownLink(current, start, end));
  }

  function insertSupportCallTemplate(hostSlug: SupportCallHostSlug) {
    const host = SUPPORT_CALL_HOSTS.find((h) => h.slug === hostSlug);
    if (!host) return;
    const url = `${SUPPORT_CALL_PUBLIC_ORIGIN}${host.path}${buildSupportCallPrefillQuery(
      supportCallContact ?? {}
    )}`;
    const snippet = `[Book a support call](${url})`;
    const el = replyTextareaRef.current;
    const current = composerMode === "note" ? noteDraft : draft;
    const setCurrent = composerMode === "note" ? setNoteDraft : setDraft;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const needsLeadingNewline =
      start > 0 && current.slice(Math.max(0, start - 1), start) !== "\n";
    const insert = `${needsLeadingNewline ? "\n" : ""}${snippet}`;
    const next = current.slice(0, start) + insert + current.slice(end);
    setCurrent(next);
    setTemplatesOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + insert.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function minimizeComposer() {
    setComposerOpen(false);
    setComposerExpanded(false);
    setSendAsMenuOpen(false);
    setEmojiOpen(false);
    setTemplatesOpen(false);
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
    setBusyKind("send");
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

      const replyBody = supportComposerFallbackBody({
        text: body,
        voice: Boolean(pendingVoice),
        video: Boolean(pendingVideo),
        imageCount: pendingImages.length,
      });

      const emailed = Boolean(canEmailNotify && emailNotify && replyBody);
      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_replies")
        .insert({
          report_id: reportId,
          created_by: authorId,
          body: replyBody,
          media: uploaded.length > 0 ? uploaded : null,
          via_email: emailed,
        })
        .select(SUPPORT_REPLY_LIST_SELECT)
        .single();

      if (insertError) throw insertError;

      const reply = mapSupportReplyRow(data);
      setReplies((current) => [...current, reply]);
      setDraft("");
      void clearAdminReplyDraft(reportId);
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
        if (statusError) {
          setError(statusError.message);
        }
      }
      // Refresh inbox sections (age bands / waiting-on-reply) after any reply.
      onStatusTouched?.();

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
            sent?: boolean;
          };
          if (!notifyRes.ok) {
            setNotifyNote(
              notifyBody.error ||
                "Reply saved, but the email notification failed."
            );
          } else if (notifyBody.sent) {
            setNotifyNote(
              notifyBody.emailed
                ? `Email sent to ${notifyBody.emailed}.`
                : "Email sent."
            );
          } else {
            setNotifyNote(
              notifyBody.error
                ? `Reply saved, but the email could not be sent: ${notifyBody.error}`
                : notifyBody.emailed
                  ? `Email to ${notifyBody.emailed} will retry shortly.`
                  : "Email notification queued."
            );
          }
          const emailFailed =
            !notifyRes.ok || Boolean(notifyBody.error && !notifyBody.sent);
          if (emailFailed) {
            await supabaseClient
              .from("community_feedback_replies")
              .update({ via_email: false })
              .eq("id", reply.id)
              .eq("report_id", reportId);
            setReplies((current) =>
              current.map((row) =>
                row.id === reply.id ? { ...row, via_email: false } : row
              )
            );
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setBusyKind(null);
    }
  }

  async function scheduleReply(iso: string) {
    const body = draft.trim();
    const authorId = sendAsId ?? userId;
    const hasMedia =
      pendingImages.length > 0 || Boolean(pendingVoice) || Boolean(pendingVideo);
    if ((!body && !hasMedia) || busy || !authorId) return;

    let when: Date;
    try {
      when = assertFutureSchedule(iso);
    } catch (err) {
      setScheduleError(
        err instanceof Error ? err.message : "Invalid schedule time."
      );
      return;
    }
    setScheduleError(null);

    setBusyKind("schedule");
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

      const replyBody = supportComposerFallbackBody({
        text: body,
        voice: Boolean(pendingVoice),
        video: Boolean(pendingVideo),
        imageCount: pendingImages.length,
      });
      const willEmail = Boolean(canEmailNotify && emailNotify && replyBody);

      const { data, error: insertError } = await supabaseClient
        .from("support_scheduled_replies")
        .insert({
          report_id: reportId,
          created_by: authorId,
          body: replyBody,
          media: uploaded.length > 0 ? uploaded : null,
          email_notify: willEmail,
          scheduled_for: when.toISOString(),
          status: "scheduled",
        })
        .select(SCHEDULED_REPLY_SELECT)
        .single();

      if (insertError) throw insertError;

      setScheduledReplies((current) =>
        [...current, mapScheduledReply(data)].sort((a, b) =>
          a.scheduled_for.localeCompare(b.scheduled_for)
        )
      );
      setDraft("");
      void clearAdminReplyDraft(reportId);
      clearPendingCommentImages(pendingImages);
      setPendingImages([]);
      revokePendingSupportVoice(pendingVoice);
      setPendingVoice(null);
      if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
      setPendingVideo(null);
      setRescheduleId(null);
      setScheduleOpen(false);
      setComposerOpen(false);
      setComposerExpanded(false);
      setNotifyNote(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not schedule the reply.";
      setScheduleError(message);
      setError(message);
    } finally {
      setBusyKind(null);
    }
  }

  async function updateScheduledBody(id: string, body: string) {
    const { data, error: updateError } = await supabaseClient
      .from("support_scheduled_replies")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("report_id", reportId)
      .in("status", ["scheduled", "failed"])
      .select(SCHEDULED_REPLY_SELECT)
      .single();
    if (updateError) throw updateError;
    const next = mapScheduledReply(data);
    setScheduledReplies((current) =>
      current.map((row) => (row.id === id ? next : row))
    );
  }

  async function rescheduleReply(id: string, iso: string) {
    let when: Date;
    try {
      when = assertFutureSchedule(iso);
    } catch (err) {
      setScheduleError(
        err instanceof Error ? err.message : "Invalid schedule time."
      );
      return;
    }
    setScheduleError(null);
    setBusyKind("schedule");
    const { data, error: updateError } = await supabaseClient
      .from("support_scheduled_replies")
      .update({
        scheduled_for: when.toISOString(),
        status: "scheduled",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("report_id", reportId)
      .in("status", ["scheduled", "failed"])
      .select(SCHEDULED_REPLY_SELECT)
      .single();
    setBusyKind(null);
    if (updateError) {
      setScheduleError(updateError.message);
      return;
    }
    const next = mapScheduledReply(data);
    setScheduledReplies((current) =>
      current
        .map((row) => (row.id === id ? next : row))
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
    );
    setRescheduleId(null);
    setScheduleOpen(false);
  }

  async function cancelScheduledReply(id: string) {
    setCancellingScheduleId(id);
    setError(null);
    const { error: updateError } = await supabaseClient
      .from("support_scheduled_replies")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("report_id", reportId)
      .in("status", ["scheduled", "failed"]);
    setCancellingScheduleId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setScheduledReplies((current) => current.filter((row) => row.id !== id));
  }

  async function sendInternalNote() {
    const body = noteDraft.trim();
    if (!body || busy || !userId) return;
    setBusyKind("note");
    setError(null);
    try {
      const { note, error: insertError } = await insertSupportInternalNote({
        reportId,
        createdBy: userId,
        body,
      });
      if (insertError || !note) throw new Error(insertError || "Could not save note.");
      setInternalNotes((current) => [...current, note]);
      setNoteDraft("");
      setComposerOpen(false);
      setComposerExpanded(false);
      setNotifyNote(null);
      notifySupportCountsChanged();
      onInternalNoteSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note.");
    } finally {
      setBusyKind(null);
    }
  }

  function submitComposer() {
    if (composerMode === "note") {
      void sendInternalNote();
      return;
    }
    void sendReply();
  }

  const canSend =
    composerMode === "note"
      ? Boolean(noteDraft.trim())
      : Boolean(
          draft.trim() ||
            pendingImages.length > 0 ||
            pendingVoice ||
            pendingVideo
        );

  const modeToggle = (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => switchComposerMode("reply")}
        className={`rounded-md px-2.5 py-1 ${
          composerMode === "reply"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        Reply
      </button>
      <button
        type="button"
        onClick={() => switchComposerMode("note")}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${
          composerMode === "note"
            ? "bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-200/80"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <Eye className="h-3 w-3" strokeWidth={2} aria-hidden />
        Internal note
      </button>
    </div>
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
      {reportStatus === "resolved" && composerOpen && composerMode === "reply" ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          This ticket is resolved — sending a message will reopen it.
        </p>
      ) : null}
      {composerOpen && composerMode === "note" ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          Internal only — coaches cannot see this note.
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
                            switchComposerMode("reply");
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
                switchComposerMode("reply");
                setComposerOpen(true);
                setSendAsMenuOpen(false);
              }}
              className="min-w-0 flex-1 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              Type a message
            </button>
            <button
              type="button"
              title="Add internal note"
              onClick={() => {
                switchComposerMode("note");
                setComposerOpen(true);
                setSendAsMenuOpen(false);
              }}
              className="flex shrink-0 items-center justify-center border-l border-slate-200 px-3 py-2 text-amber-700 hover:bg-amber-50"
              aria-label="Add internal note"
            >
              <Eye className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => {
                switchComposerMode("reply");
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
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {modeToggle}
              {composerMode === "reply" ? sendAsPicker : null}
            </div>
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
            {composerMode === "reply" && pendingImages.length > 0 ? (
              <CommentImagePreviews
                pending={pendingImages}
                onChange={setPendingImages}
                disabled={busy}
              />
            ) : null}

            {composerMode === "reply" && pendingVideo ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <PreviewableMedia
                  url={pendingVideo.url}
                  kind="video"
                  mediaClassName="h-14 w-20 rounded object-cover"
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
              className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white focus-within:border-sky-400 ${
                composerMode === "note"
                  ? "border-amber-300 focus-within:border-amber-500"
                  : "border-slate-200"
              } ${composerExpanded ? "flex-1" : ""}`}
            >
              {composerMode === "note" ? (
                <MentionTextarea
                  value={noteDraft}
                  onChange={setNoteDraft}
                  disabled={busy}
                  rows={composerExpanded ? 12 : 4}
                  placeholder="Add an internal note… Type @ to mention Pam or Zander"
                  allowBroadcastMentions={false}
                  className="min-h-[5.5rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm leading-normal text-slate-900 outline-none placeholder:text-slate-400"
                />
              ) : (
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
              )}
            </div>

            {composerMode === "note" ? (
              <div className="flex shrink-0 items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busy || !canSend}
                  onClick={() => void sendInternalNote()}
                  className="shrink-0 rounded-md bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save note"}
                </button>
              </div>
            ) : (
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
                    <div className="relative" ref={templatesWrapRef}>
                      <button
                        type="button"
                        title="Support templates"
                        disabled={busy}
                        aria-expanded={templatesOpen}
                        onClick={() => {
                          setTemplatesOpen((v) => !v);
                          setEmojiOpen(false);
                        }}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                      >
                        <FileText className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      {templatesOpen ? (
                        <div
                          role="menu"
                          className="absolute bottom-full left-0 z-40 mb-2 min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
                        >
                          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Templates
                          </p>
                          {SUPPORT_CALL_HOSTS.map((host) => (
                            <button
                              key={host.slug}
                              type="button"
                              role="menuitem"
                              disabled={busy}
                              onClick={() =>
                                insertSupportCallTemplate(host.slug)
                              }
                              className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                            >
                              <span className="text-sm font-medium text-slate-900">
                                Book a support call
                              </span>
                              <span className="text-xs text-slate-500">
                                Link to {host.displayName}&apos;s calendar
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      title="Bold"
                      disabled={busy}
                      onClick={insertBoldMarkdown}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                    >
                      <Bold className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      title="Add link"
                      disabled={busy}
                      onClick={insertLinkMarkdown}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                    >
                      <LinkIcon className="h-4 w-4" strokeWidth={1.75} />
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
                        onClick={() => {
                          setEmojiOpen((v) => !v);
                          setTemplatesOpen(false);
                        }}
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
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        disabled={busy || !canSend}
                        onClick={() => void sendReply()}
                        className="rounded-l-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {busyKind === "schedule"
                          ? "Scheduling…"
                          : busyKind === "send"
                            ? "Sending…"
                            : "Send"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canSend}
                        onClick={() => {
                          setScheduleError(null);
                          setScheduleOpen(true);
                        }}
                        aria-label="Schedule send"
                        title="Schedule send"
                        className="rounded-r-md border-l border-sky-500 bg-sky-600 px-2 py-1.5 text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            />
            )}

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
      {modeToggle}
      {composerMode === "note" ? (
        <>
          <p className="text-[11px] text-amber-800">
            Internal only — coaches cannot see this note.
          </p>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <MentionTextarea
                value={noteDraft}
                onChange={setNoteDraft}
                disabled={busy}
                rows={2}
                placeholder="Add an internal note… Type @ to mention Pam or Zander"
                allowBroadcastMentions={false}
                className="min-h-[2.5rem] w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <button
              type="button"
              disabled={busy || !canSend}
              onClick={() => void sendInternalNote()}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-700 px-3 text-xs font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Save internal note"
            >
              Save note
            </button>
          </div>
        </>
      ) : (
        <>
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
            <div className="flex shrink-0">
              <button
                type="button"
                disabled={busy || !canSend}
                onClick={() => void sendReply()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-l-lg bg-sky-700 text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send reply"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                disabled={busy || !canSend}
                onClick={() => {
                  setScheduleError(null);
                  setScheduleOpen(true);
                }}
                aria-label="Schedule send"
                title="Schedule send"
                className="inline-flex h-9 w-8 items-center justify-center rounded-r-lg border-l border-sky-600 bg-sky-700 text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
          {notifyNote ? (
            <p className="text-[11px] text-slate-600">{notifyNote}</p>
          ) : null}
        </>
      )}
    </div>
  );

  const scheduledBubbles =
    scheduledReplies.length > 0 ? (
      <div className="mt-3 space-y-3">
        {scheduledReplies.map((row) => (
          <ScheduledSupportBubble
            key={row.id}
            id={row.id}
            body={row.body}
            media={row.media}
            scheduledFor={row.scheduled_for}
            status={row.status}
            lastError={row.last_error}
            emailNotify={row.email_notify}
            author={row.author}
            busy={cancellingScheduleId === row.id || busyKind === "schedule"}
            onSaveBody={updateScheduledBody}
            onReschedule={(id) => {
              setScheduleError(null);
              setRescheduleId(id);
              setScheduleOpen(true);
            }}
            onDelete={cancelScheduledReply}
          />
        ))}
      </div>
    ) : null;

  const scheduleModal = (
    <ScheduleMessageModal
      open={scheduleOpen}
      onClose={() => {
        if (busyKind === "schedule") return;
        setScheduleOpen(false);
        setRescheduleId(null);
      }}
      onSchedule={(iso) =>
        void (rescheduleId
          ? rescheduleReply(rescheduleId, iso)
          : scheduleReply(iso))
      }
      busy={busyKind === "schedule"}
      initialIso={
        rescheduleId
          ? scheduledReplies.find((row) => row.id === rescheduleId)
              ?.scheduled_for
          : null
      }
      title={rescheduleId ? "Change send time" : "Schedule this reply"}
      confirmLabel={rescheduleId ? "Save time" : "Schedule send"}
      error={scheduleError}
    />
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
            className="absolute right-0 top-full z-30 mt-1.5 w-max min-w-[10.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
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
                  <span className="whitespace-nowrap">
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

    const openingMedia = openingMessage
      ? parseSupportTicketMedia(openingMessage.media)
      : [];
    const openingBody = openingMessage?.body.trim() ?? "";

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
        {openingMessage ? (
          <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-4 sm:px-6">
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
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs leading-none text-slate-500">
                      {formatCommunityPostTimestamp(openingMessage.createdAt)}
                      {openingMessage.viaEmail ? (
                        <SupportViaEmailMark
                          className="text-slate-400"
                          label="Received by email"
                        />
                      ) : null}
                      <span className="select-none text-slate-400">·</span>
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
            <SupportOpeningBody key={reportId} text={openingMessage.body}>
              {openingMedia.length > 0 ? (
                <div className={openingBody ? "mt-3" : undefined}>
                  <CommunityPostMediaGallery
                    items={openingMedia}
                    variant="compact"
                  />
                </div>
              ) : null}
            </SupportOpeningBody>
          </div>
        ) : null}

        <div
          ref={threadScrollRef}
          className={`min-h-0 overflow-y-auto overscroll-contain bg-[#f7f8fa] ${
            composerOpen && composerExpanded ? "max-h-[45%] shrink-0" : "flex-1"
          }`}
        >
          <div className="px-4 py-4 sm:px-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading conversation…</p>
            ) : (
              <SupportChatThread
                replies={replies}
                notes={internalNotes}
                viewerId={userId}
                perspective="admin"
                onUpdateReplyBody={updateReplyBody}
                onDeleteReply={deleteReply}
                onUpdateNoteBody={updateNoteBody}
                onDeleteNote={deleteNote}
              />
            )}
            {scheduledBubbles}
            <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
          </div>
        </div>
        {composer}
        {scheduleModal}
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
            notes={internalNotes}
            viewerId={userId}
            perspective="admin"
            emptyLabel="No replies yet."
            onUpdateReplyBody={updateReplyBody}
            onDeleteReply={deleteReply}
            onUpdateNoteBody={updateNoteBody}
            onDeleteNote={deleteNote}
          />
        </div>
      )}
      {scheduledBubbles}
      {composer}
      {scheduleModal}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
