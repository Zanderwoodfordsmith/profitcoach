"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Clock,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Video,
  X,
} from "lucide-react";

const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((m) => m.default),
  { ssr: false }
);

/** Live level meter while recording (same pattern as Profit Coach AI). */
const LEVEL_BARS = 40;
const LEVEL_SAMPLE_MS = 120;

function formatRecordingClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type PendingComposerFile = {
  id: string;
  file: File;
  previewUrl: string | null;
};

export type PendingVoiceNote = {
  blob: Blob;
  filename: string;
  mime: string;
  url: string;
};

export type PendingVideoNote = {
  file: File;
  url: string;
};

export function revokePendingFiles(files: PendingComposerFile[]) {
  for (const f of files) {
    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
  }
}

export function ScheduleMessageModal({
  open,
  onClose,
  onSchedule,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSchedule: (iso: string) => void;
  busy?: boolean;
}) {
  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const defaults = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional on open
  }, [open]);

  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  useEffect(() => {
    if (open) {
      setDate(defaults.date);
      setTime(defaults.time);
    }
  }, [open, defaults.date, defaults.time]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-message-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3
            id="schedule-message-title"
            className="text-sm font-semibold text-slate-900"
          >
            Schedule your message
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="block text-xs font-medium text-slate-600">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm"
            />
          </label>
          <p className="text-[11px] text-slate-500">Timezone: {tz}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setDate(defaults.date);
              setTime(defaults.time);
            }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={busy || !date || !time}
            onClick={() => {
              const local = new Date(`${date}T${time}:00`);
              if (Number.isNaN(local.getTime())) return;
              onSchedule(local.toISOString());
            }}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MessageAttachments({
  attachments,
  tone = "neutral",
  uploading = false,
}: {
  attachments: Array<{
    filename: string;
    mime: string;
    kind?: string;
    signedUrl?: string | null;
  }>;
  tone?: "neutral" | "sky";
  /** Local preview while the file is still uploading to the provider. */
  uploading?: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map((a, i) => {
        const isImage = (a.mime || "").startsWith("image/") && a.signedUrl;
        const isAudio =
          a.kind === "voice" || (a.mime || "").startsWith("audio/");
        const isVideo =
          a.kind === "video" || (a.mime || "").startsWith("video/");
        if (isImage) {
          return (
            <div
              key={`${a.filename}-${i}`}
              className="relative block overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.signedUrl!}
                alt={a.filename}
                className={`max-h-48 max-w-full object-contain ${
                  uploading ? "opacity-70" : ""
                }`}
              />
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/25">
                  <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
                    Uploading…
                  </span>
                </div>
              ) : (
                <a
                  href={a.signedUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0"
                  aria-label={a.filename}
                />
              )}
            </div>
          );
        }
        if (isAudio && a.signedUrl) {
          return (
            <div key={`${a.filename}-${i}`} className="relative">
              <audio
                controls={!uploading}
                src={a.signedUrl}
                className={`max-w-full ${uploading ? "opacity-60" : ""}`}
              />
              {uploading ? (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Uploading voice note…
                </p>
              ) : null}
            </div>
          );
        }
        if (isVideo && a.signedUrl) {
          return (
            <div
              key={`${a.filename}-${i}`}
              className="relative overflow-hidden rounded-lg"
            >
              <video
                controls={!uploading}
                src={a.signedUrl}
                className={`max-h-48 max-w-full rounded-lg ${
                  uploading ? "opacity-70" : ""
                }`}
              />
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
                  <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
                    Uploading…
                  </span>
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <div
            key={`${a.filename}-${i}`}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
              tone === "sky"
                ? "border-sky-200 bg-sky-50/80 text-sky-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
            } ${uploading ? "opacity-80" : ""}`}
          >
            <Paperclip className="h-3 w-3 shrink-0" />
            {a.signedUrl && !uploading ? (
              <a
                href={a.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate underline-offset-2 hover:underline"
              >
                {a.filename}
              </a>
            ) : (
              <span className="truncate">{a.filename}</span>
            )}
            {uploading ? (
              <span className="shrink-0 text-[10px] font-medium text-slate-500">
                Uploading…
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function pickRecorderMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") {
    return { mime: "audio/webm", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mime: "audio/mp4", ext: "m4a" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mime: "audio/webm;codecs=opus", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return { mime: "audio/webm", ext: "webm" };
  }
  return { mime: "", ext: "webm" };
}

export function ChatComposerTools({
  enabled,
  pendingFiles,
  pendingVoice,
  pendingVideo,
  onAddFiles,
  onRemoveFile,
  onVoiceChange,
  onVideoChange,
  onInsertEmoji,
  onDiscard,
  onSend,
  onOpenSchedule,
  sending,
  canSend,
  showSchedule,
}: {
  enabled: boolean;
  pendingFiles: PendingComposerFile[];
  pendingVoice: PendingVoiceNote | null;
  pendingVideo: PendingVideoNote | null;
  onAddFiles: (files: FileList | null, kind: "image" | "file") => void;
  onRemoveFile: (id: string) => void;
  onVoiceChange: (note: PendingVoiceNote | null) => void;
  onVideoChange: (note: PendingVideoNote | null) => void;
  onInsertEmoji: (emoji: string) => void;
  onDiscard: () => void;
  onSend: () => void;
  onOpenSchedule: () => void;
  sending: boolean;
  canSend: boolean;
  showSchedule: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [micMenuOpen, setMicMenuOpen] = useState(false);
  const [micState, setMicState] = useState<"idle" | "requesting" | "recording">(
    "idle"
  );
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMeters = useCallback(() => {
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    if (clockTimerRef.current) {
      clearInterval(clockTimerRef.current);
      clockTimerRef.current = null;
    }
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevels([]);
    setRecordSeconds(0);
  }, []);

  useEffect(() => {
    if (!emojiOpen && !sendMenuOpen && !micMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (emojiOpen && emojiWrapRef.current && !emojiWrapRef.current.contains(t)) {
        setEmojiOpen(false);
      }
      if (sendMenuOpen && sendMenuRef.current && !sendMenuRef.current.contains(t)) {
        setSendMenuOpen(false);
      }
      if (micMenuOpen && micMenuRef.current && !micMenuRef.current.contains(t)) {
        setMicMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [emojiOpen, sendMenuOpen, micMenuOpen]);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopMeters();
    };
  }, [stopMeters]);

  function clearHintTimer() {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }

  function micBlockedReason(): string | null {
    if (typeof window === "undefined") return null;
    if (!window.isSecureContext) {
      return "Open this page over https or localhost so the browser can use the microphone.";
    }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return "Voice recording isn’t supported here. Upload an audio file instead.";
    }
    try {
      if (window.self !== window.top) {
        return "Microphone is blocked in embedded previews. Open the app in a normal tab, or upload an audio file.";
      }
    } catch {
      return "Microphone is blocked in embedded previews. Open the app in a normal tab, or upload an audio file.";
    }
    return null;
  }

  async function startRecording() {
    setRecordError(null);
    setMicMenuOpen(false);
    const blocked = micBlockedReason();
    if (blocked) {
      setRecordError(blocked);
      return;
    }
    if (micState !== "idle" || mediaRecorderRef.current) return;

    setMicState("requesting");
    // Arc often opens its permission UI in the browser chrome / sidebar and
    // never resolves getUserMedia — show a way out + upload fallback.
    clearHintTimer();
    hintTimerRef.current = setTimeout(() => {
      setRecordError(
        "Still waiting for microphone permission. In Arc, paste arc://settings/content/microphone in the address bar, allow this site, then try again — or upload an audio file."
      );
    }, 6000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      clearHintTimer();
      setRecordError(null);
      streamRef.current = stream;
      const { mime, ext } = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopMeters();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        // Chrome often reports `audio/webm;codecs=opus` — keep codecs on the
        // Blob for playback, but store a clean base mime for the API.
        const rawMime = recorder.mimeType || mime || "audio/webm";
        const baseMime = rawMime.split(";")[0]!.trim() || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: rawMime });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (blob.size < 500) {
          setRecordError("Recording was too short.");
          setMicState("idle");
          return;
        }
        const url = URL.createObjectURL(blob);
        onVoiceChange({
          blob,
          filename: `voice-note.${ext}`,
          mime: baseMime,
          url,
        });
        setMicState("idle");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setMicState("recording");

      // Live feedback: elapsed clock + level meter (cosmetic — recording
      // still works if AudioContext fails).
      setRecordSeconds(0);
      setLevels([]);
      const startedAt = Date.now();
      clockTimerRef.current = setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        void ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        meterTimerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = ((data[i] ?? 128) - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevels((prev) => [...prev.slice(-(LEVEL_BARS - 1)), rms]);
        }, LEVEL_SAMPLE_MS);
      } catch {
        /* no meter — recording continues */
      }
    } catch (err) {
      clearHintTimer();
      stopMeters();
      setMicState("idle");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setRecordError(
          "Microphone was blocked. In Arc: arc://settings/content/microphone → allow this site. Or upload an audio file below."
        );
      } else if (name === "NotFoundError") {
        setRecordError("No microphone found. Plug one in, or upload an audio file.");
      } else {
        setRecordError(
          "Couldn’t start the mic. Allow microphone access for this site, or upload an audio file."
        );
      }
    }
  }

  function stopRecording() {
    clearHintTimer();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      stopMeters();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setMicState("idle");
    }
  }

  function onPickAudioFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const mime = file.type || "audio/mpeg";
    if (!mime.startsWith("audio/") && !/\.(m4a|mp3|wav|ogg|webm)$/i.test(file.name)) {
      setRecordError("Please choose an audio file (m4a, mp3, wav, webm).");
      return;
    }
    setRecordError(null);
    setMicMenuOpen(false);
    const url = URL.createObjectURL(file);
    onVoiceChange({
      blob: file,
      filename: file.name || "voice-note.m4a",
      mime,
      url,
    });
  }

  const recording = micState === "recording";
  const requesting = micState === "requesting";

  return (
    <div className="space-y-2">
      {pendingFiles.length ? (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((p) => (
            <div
              key={p.id}
              className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
            >
              {p.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.previewUrl}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <Paperclip className="h-4 w-4 text-slate-500" />
              )}
              <span className="max-w-[9rem] truncate text-xs text-slate-700">
                {p.file.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(p.id)}
                className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label={`Remove ${p.file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {pendingVoice ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <Mic className="h-4 w-4 shrink-0 text-rose-500" />
          <audio controls src={pendingVoice.url} className="h-8 min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(pendingVoice.url);
              onVoiceChange(null);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label="Remove voice note"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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
            onClick={() => {
              URL.revokeObjectURL(pendingVideo.url);
              onVideoChange(null);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label="Remove video"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {requesting ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Waiting for microphone permission…
          <button
            type="button"
            onClick={() => {
              clearHintTimer();
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              setMicState("idle");
              setRecordError(
                "Cancelled. Allow the mic in Arc settings, or upload an audio file."
              );
            }}
            className="ml-auto rounded-md px-2 py-1 font-medium text-amber-800 hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {recording ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-white px-3 py-2 shadow-sm">
          <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500" />
          <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
            {formatRecordingClock(recordSeconds)}
          </span>
          <div
            aria-hidden
            className="flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden px-1"
          >
            {Array.from({ length: LEVEL_BARS }).map((_, i) => {
              const offset = Math.max(0, levels.length - LEVEL_BARS);
              const level =
                i < levels.length - offset ? levels[offset + i]! : null;
              const h = level === null ? 3 : Math.min(24, 3 + level * 110);
              return (
                <span
                  key={i}
                  className={`w-[2px] shrink-0 rounded-full ${
                    level === null ? "bg-slate-200" : "bg-rose-500"
                  }`}
                  style={{ height: `${h}px` }}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </div>
      ) : null}

      {recordError ? (
        <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <p>{recordError}</p>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="font-medium text-red-800 underline hover:no-underline"
          >
            Upload an audio file instead
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          {enabled ? (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  onAddFiles(e.target.files, "image");
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf,text/plain"
                multiple
                className="hidden"
                onChange={(e) => {
                  onAddFiles(e.target.files, "file");
                  e.target.value = "";
                }}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (pendingVideo?.url) URL.revokeObjectURL(pendingVideo.url);
                  onVideoChange({
                    file,
                    url: URL.createObjectURL(file),
                  });
                }}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
                className="hidden"
                onChange={(e) => {
                  onPickAudioFile(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                title="Add image"
                onClick={() => imageInputRef.current?.click()}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <div className="relative" ref={micMenuRef}>
                <button
                  type="button"
                  title={
                    recording
                      ? "Stop recording"
                      : requesting
                        ? "Waiting for microphone…"
                        : "Voice note"
                  }
                  disabled={requesting}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (recording) {
                      stopRecording();
                      return;
                    }
                    if (requesting) return;
                    setMicMenuOpen((v) => !v);
                  }}
                  className={`rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-50 ${
                    recording || requesting
                      ? "text-rose-600"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Mic className="h-4 w-4" strokeWidth={1.75} />
                </button>
                {micMenuOpen && !recording && !requesting ? (
                  <div className="absolute bottom-full left-0 z-40 mb-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void startRecording();
                      }}
                    >
                      <Mic className="h-3.5 w-3.5 text-slate-400" />
                      Record with mic
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMicMenuOpen(false);
                        audioInputRef.current?.click();
                      }}
                    >
                      <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                      Upload audio file
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                title="Send video message"
                onClick={() => videoInputRef.current?.click()}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Video className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </>
          ) : null}
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
                    onInsertEmoji(emojiData.emoji);
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
          >
            Discard
          </button>
          {showSchedule ? (
            <div className="relative flex" ref={sendMenuRef}>
              <button
                type="button"
                disabled={sending || !canSend}
                onClick={onSend}
                className="rounded-l-md bg-sky-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                disabled={sending || !canSend}
                onClick={() => setSendMenuOpen((v) => !v)}
                aria-label="Send options"
                className="rounded-r-md border-l border-sky-500 bg-sky-600 px-2 py-1.5 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>
              {sendMenuOpen ? (
                <div className="absolute bottom-full right-0 z-40 mb-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setSendMenuOpen(false);
                      onSend();
                    }}
                  >
                    <Send className="h-3.5 w-3.5 text-slate-400" />
                    Send now
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setSendMenuOpen(false);
                      onOpenSchedule();
                    }}
                  >
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Send later
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={sending || !canSend}
              onClick={onSend}
              className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
