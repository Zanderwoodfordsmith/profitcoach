"use client";

import { Loader2, Mic, Square, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export type PendingSupportVoice = {
  blob: Blob;
  filename: string;
  mime: string;
  url: string;
};

const LEVEL_BARS = 40;
const LEVEL_SAMPLE_MS = 120;
/** Match Coach AI panel — forgotten open mic shouldn't run forever. */
const MAX_RECORDING_MS = 180_000;

/** Chunked to avoid blowing the call stack on multi-MB recordings. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function formatRecordingClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

function micBlockedReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) {
    return "Open this page over https or localhost so the browser can use the microphone.";
  }
  if (
    typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
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

type Props = {
  pending: PendingSupportVoice | null;
  onChange: (note: PendingSupportVoice | null) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
  onInteract?: () => void;
  /**
   * After a mic take finishes, run Whisper and pass the transcript so the
   * parent can append it to a text field. The recording is still kept as an
   * attachment (tone). Uploaded files never auto-transcribe unless
   * `transcribeUploads` is true.
   */
  onTranscribed?: (text: string) => void;
  /** Also run Whisper on uploaded audio files. Default false. */
  transcribeUploads?: boolean;
  /**
   * Skip the mic menu — click starts/stops recording. Use for a mic inside
   * the description field.
   */
  directRecord?: boolean;
  /**
   * When set, chrome (pending / recording / errors) renders above and
   * `toolbar(micButton)` builds the icon row that includes the mic.
   */
  toolbar?: (micButton: ReactNode) => ReactNode;
  /**
   * Full layout control (e.g. mic in the description corner + chrome below).
   * Takes precedence over `toolbar`.
   */
  layout?: (parts: {
    micButton: ReactNode;
    chrome: ReactNode;
  }) => ReactNode;
};

/**
 * Mic button + live recording meter + pending voice preview.
 * Same interaction pattern as conversations; parent uploads via support media helpers.
 * With `onTranscribed`, mic recording fills text and keeps the audio for tone.
 */
export function SupportVoiceRecorder({
  pending,
  onChange,
  disabled = false,
  onError,
  onInteract,
  onTranscribed,
  transcribeUploads = false,
  directRecord = false,
  toolbar,
  layout,
}: Props) {
  const [micMenuOpen, setMicMenuOpen] = useState(false);
  const [micState, setMicState] = useState<
    "idle" | "requesting" | "recording" | "transcribing"
  >("idle");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;
  const transcribeUploadsRef = useRef(transcribeUploads);
  transcribeUploadsRef.current = transcribeUploads;

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
    if (!micMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (micMenuRef.current && !micMenuRef.current.contains(e.target as Node)) {
        setMicMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [micMenuOpen]);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (maxRecordTimerRef.current) clearTimeout(maxRecordTimerRef.current);
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

  function clearMaxRecordTimer() {
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
  }

  async function transcribeBlob(blob: Blob) {
    const callback = onTranscribedRef.current;
    if (!callback) return;

    setMicState("transcribing");
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        const message = "Please sign in again to use voice dictation.";
        setRecordError(message);
        onError?.(message);
        return;
      }
      const audio_base64 = arrayBufferToBase64(await blob.arrayBuffer());
      const res = await fetch("/api/coach/profit-coach-ai/transcribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio_base64 }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      if (!res.ok || typeof data.text !== "string") {
        const message = data.error || "Transcription failed. Try again.";
        setRecordError(message);
        onError?.(message);
        return;
      }
      const spoken = data.text.trim();
      if (spoken) callback(spoken);
    } catch {
      const message = "Transcription failed. Try again.";
      setRecordError(message);
      onError?.(message);
    } finally {
      setMicState("idle");
    }
  }

  function commitVoiceNote(blob: Blob, filename: string, mime: string) {
    if (blob.size < 500) {
      setRecordError("Recording was too short.");
      setMicState("idle");
      return;
    }
    const url = URL.createObjectURL(blob);
    onChange({
      blob,
      filename,
      mime,
      url,
    });
    if (onTranscribedRef.current) {
      void transcribeBlob(blob);
    } else {
      setMicState("idle");
    }
  }

  async function startRecording() {
    onInteract?.();
    setRecordError(null);
    setMicMenuOpen(false);
    const blocked = micBlockedReason();
    if (blocked) {
      setRecordError(blocked);
      onError?.(blocked);
      return;
    }
    if (micState !== "idle" || mediaRecorderRef.current) return;

    setMicState("requesting");
    clearHintTimer();
    hintTimerRef.current = setTimeout(() => {
      setRecordError(
        "Still waiting for microphone permission. Allow this site, then try again — or upload an audio file."
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
        clearMaxRecordTimer();
        stopMeters();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const rawMime = recorder.mimeType || mime || "audio/webm";
        const baseMime = rawMime.split(";")[0]!.trim() || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: rawMime });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        commitVoiceNote(blob, `voice-note.${ext}`, baseMime);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setMicState("recording");
      clearMaxRecordTimer();
      maxRecordTimerRef.current = setTimeout(() => {
        mediaRecorderRef.current?.stop();
      }, MAX_RECORDING_MS);

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
        /* meter optional */
      }
    } catch (err) {
      clearHintTimer();
      stopMeters();
      setMicState("idle");
      const name = err instanceof DOMException ? err.name : "";
      const message =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Microphone was blocked. Allow this site, or upload an audio file."
          : name === "NotFoundError"
            ? "No microphone found. Plug one in, or upload an audio file."
            : "Couldn’t start the mic. Allow microphone access, or upload an audio file.";
      setRecordError(message);
      onError?.(message);
    }
  }

  function stopRecording() {
    clearHintTimer();
    clearMaxRecordTimer();
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
    onInteract?.();
    const mime = file.type || "audio/mpeg";
    if (
      !mime.startsWith("audio/") &&
      !/\.(m4a|mp3|wav|ogg|webm)$/i.test(file.name)
    ) {
      const message = "Please choose an audio file (m4a, mp3, wav, webm).";
      setRecordError(message);
      onError?.(message);
      return;
    }
    setRecordError(null);
    setMicMenuOpen(false);
    if (pending?.url) URL.revokeObjectURL(pending.url);
    const note: PendingSupportVoice = {
      blob: file,
      filename: file.name || "voice-note.m4a",
      mime,
      url: URL.createObjectURL(file),
    };
    onChange(note);
    if (onTranscribedRef.current && transcribeUploadsRef.current) {
      void transcribeBlob(file);
    }
  }

  const recording = micState === "recording";
  const requesting = micState === "requesting";
  const transcribing = micState === "transcribing";
  const dictateEnabled = Boolean(onTranscribed);

  const chrome = (
    <>
      {pending ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <Mic className="h-4 w-4 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            {dictateEnabled ? (
              <p className="mb-1 text-[11px] font-medium text-slate-500">
                Voice note attached (for tone)
              </p>
            ) : null}
            <audio controls src={pending.url} className="h-8 w-full" />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              URL.revokeObjectURL(pending.url);
              onChange(null);
            }}
            className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40"
            aria-label="Remove voice note"
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
                "Cancelled. Allow the mic in browser settings, or upload an audio file."
              );
            }}
            className="ml-auto rounded-md px-2 py-1 font-medium text-amber-800 hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {transcribing ? (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600" />
          Turning your voice into text…
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
            {dictateEnabled ? "Done" : "Stop"}
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
    </>
  );

  const micButton = (
    <div className="relative inline-flex" ref={micMenuRef}>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
        className="hidden"
        disabled={
          disabled || Boolean(pending) || recording || requesting || transcribing
        }
        onChange={(e) => {
          onPickAudioFile(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title={
          recording
            ? dictateEnabled
              ? "Stop — fill text and keep the recording"
              : "Stop recording"
            : requesting
              ? "Waiting for microphone…"
              : transcribing
                ? "Transcribing…"
                : dictateEnabled
                  ? "Speak your description — fills text and keeps audio for tone"
                  : "Voice note"
        }
        disabled={disabled || Boolean(pending) || transcribing}
        onClick={() => {
          if (recording) {
            stopRecording();
            return;
          }
          if (requesting || transcribing) return;
          if (directRecord) {
            void startRecording();
            return;
          }
          setMicMenuOpen((v) => !v);
        }}
        className={`rounded-md p-1.5 disabled:opacity-40 ${
          recording
            ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        }`}
      >
        {transcribing || requesting ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Mic className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
      {!directRecord &&
      micMenuOpen &&
      !recording &&
      !requesting &&
      !transcribing ? (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => void startRecording()}
          >
            <Mic className="h-3.5 w-3.5 text-slate-400" />
            Record with mic
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setMicMenuOpen(false);
              audioInputRef.current?.click();
            }}
          >
            Upload audio file
          </button>
        </div>
      ) : null}
    </div>
  );

  if (layout) {
    return <>{layout({ micButton, chrome })}</>;
  }

  if (toolbar) {
    return (
      <div className="space-y-2">
        {chrome}
        {toolbar(micButton)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chrome}
      {micButton}
    </div>
  );
}

export function revokePendingSupportVoice(
  note: PendingSupportVoice | null | undefined
) {
  if (note?.url) URL.revokeObjectURL(note.url);
}

export function pendingSupportVoiceToFile(note: PendingSupportVoice): File {
  return new File([note.blob], note.filename, {
    type: note.mime || "audio/webm",
  });
}
