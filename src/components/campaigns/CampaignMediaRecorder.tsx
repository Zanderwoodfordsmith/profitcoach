"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Square, Video, X } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

/** Matches the upload hint: "up to about 5 minutes". */
const MAX_RECORDING_MS = 5 * 60 * 1000;

type Kind = "voice" | "video";

function pickMime(kind: Kind): { mime: string; ext: string } {
  const options =
    kind === "voice"
      ? [
          { mime: "audio/mp4", ext: "m4a" },
          { mime: "audio/webm;codecs=opus", ext: "webm" },
          { mime: "audio/webm", ext: "webm" },
        ]
      : [
          { mime: "video/mp4", ext: "mp4" },
          { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
          { mime: "video/webm", ext: "webm" },
        ];
  if (typeof MediaRecorder !== "undefined") {
    for (const o of options) {
      if (MediaRecorder.isTypeSupported(o.mime)) return o;
    }
  }
  return { mime: "", ext: options[options.length - 1]!.ext };
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function blockedReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) {
    return "Open this page over https or localhost to record.";
  }
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "Recording doesn’t work in this browser. Upload a file instead.";
  }
  return null;
}

/**
 * Record a voice or video note in the browser, play it back, then use it or
 * record again. `onUse` gets the finished file (the parent uploads it).
 */
export function CampaignMediaRecorder({
  kind,
  busy,
  onUse,
  onCancel,
}: {
  kind: Kind;
  busy: boolean;
  onUse: (file: File) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<"starting" | "recording" | "review">(
    "starting"
  );
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ file: File; url: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const liveRef = useRef<HTMLVideoElement>(null);
  const takeUrlRef = useRef<string | null>(null);

  // Start recording on open and on every "Record again".
  useEffect(() => {
    let cancelled = false;
    let clockTimer: ReturnType<typeof setInterval> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      const blocked = blockedReason();
      if (blocked) {
        setError(blocked);
        return;
      }
      setState("starting");
      setError(null);
      setSeconds(0);
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          kind === "voice"
            ? { audio: { echoCancellation: true, noiseSuppression: true } }
            : {
                audio: { echoCancellation: true, noiseSuppression: true },
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              }
        );
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (kind === "video" && liveRef.current) {
          liveRef.current.srcObject = stream;
          void liveRef.current.play().catch(() => {});
        }
        const { mime, ext } = pickMime(kind);
        const opts: MediaRecorderOptions = mime ? { mimeType: mime } : {};
        // Keep five minutes of video well under the 50 MB upload limit.
        if (kind === "video") opts.videoBitsPerSecond = 1_000_000;
        const recorder = new MediaRecorder(stream, opts);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          if (clockTimer) clearInterval(clockTimer);
          if (maxTimer) clearTimeout(maxTimer);
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          recorderRef.current = null;
          if (cancelled) return;
          const type = (recorder.mimeType || mime || `${kind === "voice" ? "audio" : "video"}/webm`)
            .split(";")[0]!
            .trim();
          const blob = new Blob(chunks, { type });
          if (blob.size < 500) {
            setError("That was too short. Try again.");
            setState("review");
            return;
          }
          const file = new File(
            [blob],
            `${kind === "voice" ? "voice-note" : "video-note"}.${ext}`,
            { type }
          );
          const url = URL.createObjectURL(blob);
          takeUrlRef.current = url;
          setTake({ file, url });
          setState("review");
        };
        recorderRef.current = recorder;
        recorder.start(1000);
        setState("recording");
        const startedAt = Date.now();
        clockTimer = setInterval(() => {
          setSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }, 250);
        maxTimer = setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, MAX_RECORDING_MS);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        const what = kind === "voice" ? "microphone" : "camera";
        setError(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? `The ${what} was blocked. Allow it for this site, or upload a file.`
            : name === "NotFoundError"
              ? `No ${what} found. Plug one in, or upload a file.`
              : `Couldn’t start the ${what}. Allow access, or upload a file.`
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (clockTimer) clearInterval(clockTimer);
      if (maxTimer) clearTimeout(maxTimer);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [kind, attempt]);

  useEffect(() => {
    return () => {
      if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    };
  }, []);

  function stop() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function again() {
    if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    takeUrlRef.current = null;
    setTake(null);
    setAttempt((n) => n + 1);
  }

  const Icon = kind === "voice" ? Mic : Video;

  return (
    <div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-3">
      {kind === "video" && state !== "review" ? (
        <video
          ref={liveRef}
          muted
          playsInline
          className="mb-2.5 aspect-video w-full max-w-sm rounded-md bg-slate-900 object-cover [transform:scaleX(-1)]"
        />
      ) : null}

      {state === "review" && take ? (
        kind === "voice" ? (
          <audio controls src={take.url} className="mb-2.5 h-9 w-full" />
        ) : (
          <video
            controls
            playsInline
            src={take.url}
            className="mb-2.5 aspect-video w-full max-w-sm rounded-md bg-slate-900"
          />
        )
      ) : null}

      {error ? <p className="mb-2 text-xs text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {state === "starting" && !error ? (
          <span className="text-xs text-slate-600">
            <Icon className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Waiting for the {kind === "voice" ? "microphone" : "camera"}…
          </span>
        ) : null}

        {state === "recording" ? (
          <>
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            <span className="text-sm font-medium tabular-nums text-slate-700">
              {clock(seconds)}
            </span>
            <span className="text-xs text-slate-500">of 5:00</span>
            <button
              type="button"
              onClick={stop}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden />
              Stop
            </button>
          </>
        ) : null}

        {state === "review" ? (
          <>
            {take ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onUse(take.file)}
                className={buttonClass("main", "normal")}
              >
                <Check className="h-4 w-4" aria-hidden />
                {busy ? "Saving…" : "Use this"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={again}
              className={buttonClass("quiet", "normal")}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Record again
            </button>
          </>
        ) : null}

        {state !== "recording" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={buttonClass("quiet", "normal", "ml-auto")}
          >
            <X className="h-4 w-4" aria-hidden />
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
