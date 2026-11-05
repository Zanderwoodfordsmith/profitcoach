"use client";

import { AudioLines, ArrowUp, Clock, Loader2, Mail, Square, X } from "lucide-react";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

import {
  ChatComposerTools,
  ScheduleMessageModal,
  revokePendingFiles,
  type PendingComposerFile,
  type PendingVideoNote,
  type PendingVoiceNote,
} from "@/components/messaging/ComposerMediaTools";
import { COMMUNITY_POST_MEDIA_MAX, uploadSupportMediaFile, type CommunityPostMediaItem } from "@/lib/communityPostMedia";
import { COMMENT_MAX_LENGTH, type ScheduledComment } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { supportComposerFallbackBody } from "@/lib/support/supportTicketMedia";

import { useAutoGrow, useVoiceInput } from "../composer";
import { usePractice } from "../PracticeProvider";
import { commentsCall, useSectionComments } from "./SectionCommentsContext";

/** "Thu 6 Nov, 09:00" */
function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * The Blueprint chat's message box (5 Nov): Messages' shared toolbar
 * (images, files, voice notes, video, emoji) for everyone; for BCA also
 * "email them about this" and Send later, as in Support.
 */
export function ChatComposer({
  chatKey,
  other,
  replying,
  maxHeight,
  onEscape,
  onPost,
}: {
  chatKey: string;
  /** Who is on the other end: the coach's name, or BCA. */
  other: string;
  replying: boolean;
  maxHeight: number;
  onEscape: () => void;
  /** Send somewhere other than a page chat (the Inbox's chats with BCA). Returns an error, or null. */
  onPost?: (body: string, media: CommunityPostMediaItem[]) => Promise<string | null>;
}) {
  const comments = useSectionComments();
  const { coachId, transcribe } = usePractice();
  // Email and Send later belong to page chats.
  const bca = !onPost && comments?.side === "bca";
  const ready = Boolean(onPost || comments?.side);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingComposerFile[]>([]);
  const [voiceNote, setVoiceNote] = useState<PendingVoiceNote | null>(null);
  const [video, setVideo] = useState<PendingVideoNote | null>(null);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState<null | "send" | "schedule">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledComment[]>([]);

  // The box grows with the message, up to half the panel, then scrolls.
  const boxRef = useAutoGrow(draft, maxHeight);
  const dictation = useVoiceInput(transcribe, (said) => {
    setDraft((prev) => (prev ? `${prev} ${said}` : said).slice(0, COMMENT_MAX_LENGTH));
    boxRef.current?.focus();
  });

  useEffect(() => {
    boxRef.current?.focus();
  }, [boxRef]);

  // BCA's waiting messages for this chat. Loading them also posts any now due.
  const loadScheduled = useCallback(async () => {
    if (!bca) return;
    const data = await commentsCall<{ scheduled: ScheduledComment[] }>(coachId, "/api/coach/practice/comments/scheduled");
    if (data) setScheduled(data.scheduled);
  }, [bca, coachId]);

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled]);

  const mine = scheduled.filter((row) => row.section_key === chatKey);
  useEffect(() => {
    const waiting = mine.filter((row) => row.status === "scheduled");
    if (!waiting.length) return;
    const soonest = Math.min(...waiting.map((row) => Date.parse(row.scheduled_for)));
    const timer = window.setTimeout(() => void loadScheduled(), Math.max(5_000, soonest - Date.now() + 2_000));
    return () => window.clearTimeout(timer);
  }, [mine, loadScheduled]);

  const attachments = files.length + (voiceNote ? 1 : 0) + (video ? 1 : 0);
  const canSend = Boolean(draft.trim() || attachments) && !busy && ready;

  function addFiles(list: FileList | File[] | null) {
    const room = COMMUNITY_POST_MEDIA_MAX - attachments;
    const picked = Array.from(list ?? []).slice(0, Math.max(0, room));
    if ((list?.length ?? 0) > picked.length) setError(`Up to ${COMMUNITY_POST_MEDIA_MAX} attachments on one message.`);
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    ]);
  }

  function clearAttachments() {
    revokePendingFiles(files);
    setFiles([]);
    if (voiceNote) URL.revokeObjectURL(voiceNote.url);
    setVoiceNote(null);
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
  }

  /** Uploads go straight to storage first, as in Support; the message carries their links. */
  async function upload(): Promise<{ body: string; media: CommunityPostMediaItem[] }> {
    const media: CommunityPostMediaItem[] = [];
    const all = [
      ...files.map((f) => f.file),
      ...(voiceNote ? [new File([voiceNote.blob], voiceNote.filename, { type: voiceNote.mime })] : []),
      ...(video ? [video.file] : []),
    ];
    for (const file of all) {
      const up = await uploadSupportMediaFile(file);
      if ("error" in up) throw new Error(up.error);
      media.push(up.media);
    }
    const body = supportComposerFallbackBody({
      text: draft,
      voice: Boolean(voiceNote),
      video: Boolean(video),
      imageCount: files.filter((f) => f.file.type.startsWith("image/")).length,
      fileCount: files.filter((f) => !f.file.type.startsWith("image/")).length,
    });
    return { body, media };
  }

  async function send() {
    if (!canSend || (!comments && !onPost)) return;
    setBusy("send");
    setError(null);
    setNote(null);
    try {
      const { body, media } = await upload();
      if (onPost) {
        const failed = await onPost(body, media);
        if (failed) throw new Error(failed);
      } else if (comments) {
        const result = await comments.post(chatKey, body, { media, email: bca && email });
        if (result.error) throw new Error(result.error);
        setNote(result.note);
      }
      setDraft("");
      clearAttachments();
      boxRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(null);
    }
  }

  async function schedule(iso: string) {
    if (!canSend) return;
    setBusy("schedule");
    setScheduleError(null);
    try {
      const { body, media } = await upload();
      const data = await commentsCall<{ scheduled: ScheduledComment }>(coachId, "/api/coach/practice/comments/scheduled", {
        method: "POST",
        body: { section_key: chatKey, body, media: media.length ? media : undefined, email, scheduled_for: iso },
      });
      if (!data) throw new Error("Not signed in.");
      setScheduled((prev) => [...prev, data.scheduled].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      setScheduleOpen(false);
      setDraft("");
      clearAttachments();
      setNote(null);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Could not schedule it.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    try {
      await commentsCall(coachId, "/api/coach/practice/comments/scheduled", { method: "DELETE", body: { id } });
      setScheduled((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel it.");
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
    if (e.key === "Escape" && !draft.trim() && !attachments) onEscape();
  }

  const iconButton = "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40";

  return (
    <footer className="bp-chat-foot border-t border-[var(--bp-rule)] px-4 py-3.5">
      {mine.length ? (
        <ul className="mb-2 space-y-1.5" aria-label="Scheduled messages">
          {mine.map((row) => (
            <li key={row.id} className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-[var(--bp-muted)]">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--bp-sky)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={row.status === "failed" ? "font-medium text-[#9b2c2c]" : "font-medium text-[var(--bp-ink)]"}>
                  {row.status === "failed" ? "Didn't send" : `Sends ${whenLabel(row.scheduled_for)}`}
                  {row.email_notify ? " · emails them too" : ""}
                </p>
                <p className="truncate">{row.status === "failed" && row.last_error ? row.last_error : row.body}</p>
              </div>
              <button type="button" onClick={() => void cancel(row.id)} aria-label="Cancel this message" title="Cancel" className="rounded p-0.5 hover:bg-white hover:text-[var(--bp-ink)]">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error || dictation.failed ? <p className="mb-2 text-sm text-[#9b2c2c]">{error || dictation.failed}</p> : null}
      {note ? <p className="mb-2 text-xs text-[var(--bp-muted)]">{note}</p> : null}
      <div className="bp-chat-composer rounded-2xl border border-[var(--bp-rule)] bg-white">
        <textarea
          ref={boxRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
          onKeyDown={onKey}
          rows={1}
          disabled={!ready}
          placeholder={dictation.transcribing ? "Turning your voice into text…" : replying ? `Reply to ${other}` : `Write to ${other}`}
          className="bp-input block w-full resize-none bg-transparent px-4 pb-1 pt-3 text-ui leading-6 text-[var(--bp-ink)] outline-none placeholder:text-[var(--bp-faint)]"
        />
        <div className="px-2 pb-2 pt-1">
          <ChatComposerTools
            enabled
            pendingFiles={files}
            pendingVoice={voiceNote}
            pendingVideo={video}
            onAddFiles={(list) => addFiles(list)}
            onRemoveFile={(id) =>
              setFiles((prev) => {
                const gone = prev.find((f) => f.id === id);
                if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
                return prev.filter((f) => f.id !== id);
              })
            }
            onVoiceChange={setVoiceNote}
            onVideoChange={setVideo}
            onInsertEmoji={(emoji) => setDraft((prev) => `${prev}${emoji}`.slice(0, COMMENT_MAX_LENGTH))}
            onDiscard={clearAttachments}
            onSend={() => void send()}
            onOpenSchedule={() => setScheduleOpen(true)}
            sending={busy !== null}
            canSend={canSend}
            showSchedule={false}
            leadingTools={
              <button
                type="button"
                onClick={() => void dictation.toggle()}
                aria-pressed={dictation.recording}
                disabled={dictation.transcribing}
                title={dictation.recording ? "Stop and turn into text" : "Speak, and it types for you"}
                className={dictation.recording ? "rounded-md bg-[#fdeeee] p-1.5 text-[#9b1c1c]" : iconButton}
              >
                {dictation.transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : dictation.recording ? (
                  <Square className="h-4 w-4" aria-hidden />
                ) : (
                  <AudioLines className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            }
            trailing={
              <div className="flex items-center gap-0.5">
                {bca ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEmail((on) => !on)}
                      aria-pressed={email}
                      title={email ? `Will also email ${other}` : `Also email ${other} about this`}
                      className={`inline-flex items-center gap-1.5 rounded-md py-1.5 pl-1.5 pr-2 text-xs font-medium ${
                        email ? "bg-[#e3eef8] text-[var(--bp-blue)]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                    >
                      <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      {/* The icon alone wasn't clear (Zander, 5 Nov): say who it emails. */}
                      {email ? "Will email" : "Email"} {other.startsWith("the ") ? other : other.split(" ")[0]}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleError(null);
                        setScheduleOpen(true);
                      }}
                      disabled={!canSend}
                      title="Send later"
                      aria-label="Send later"
                      className={iconButton}
                    >
                      <Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canSend}
                  aria-label="Send"
                  title="Send (⌘ Enter)"
                  className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bp-blue)] text-white transition-colors hover:bg-[var(--bp-sky)] disabled:bg-[#c3cdd9] disabled:hover:bg-[#c3cdd9]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            }
          />
        </div>
      </div>
      {bca ? (
        <ScheduleMessageModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          onSchedule={(iso) => void schedule(iso)}
          busy={busy === "schedule"}
          title="Send later"
          confirmLabel="Schedule"
          error={scheduleError}
        />
      ) : null}
    </footer>
  );
}
