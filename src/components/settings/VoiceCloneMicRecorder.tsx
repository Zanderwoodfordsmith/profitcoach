"use client";

import { useEffect, useRef, useState } from "react";
import { recordingBlobToWavFile } from "@/lib/audio/wav";

const MIC_STORAGE_KEY = "profit-coach:voice-clone:mic-id";
const MAX_RECORD_MS = 90_000;
const MIC_ASK_TIMEOUT_MS = 45_000;

type MicDevice = {
  deviceId: string;
  label: string;
};

type Props = {
  disabled?: boolean;
  onRecorded: (file: File) => void;
  onClear: () => void;
};

function preferredMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function microphoneBlockReason() {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) {
    return "Open this page over https or localhost so the browser can use the microphone.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser cannot use the microphone. Try Chrome or Safari.";
  }
  try {
    if (window.self !== window.top) {
      return "The microphone is blocked inside an embedded preview. Open the app in a normal browser tab.";
    }
  } catch {
    return "The microphone is blocked inside an embedded preview. Open the app in a normal browser tab.";
  }
  return null;
}

function messageFromMicError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "AbortError") {
    return "Microphone request cancelled. Click Enable microphone and allow access when asked.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone was blocked. Allow the mic when your browser asks, then try again.";
  }
  if (name === "NotFoundError") {
    return "No microphone was found. Plug one in or pick a different input.";
  }
  if (name === "NotReadableError") {
    return "That microphone is already in use by another app. Close Zoom or similar, then try again.";
  }
  return "Could not turn the microphone on. Allow the mic in your browser, then try again.";
}

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new DOMException("Microphone permission timed out.", "TimeoutError"));
    }, ms);

    const onAbort = () => {
      reject(new DOMException("Microphone request cancelled.", "AbortError"));
    };

    if (signal?.aborted) {
      window.clearTimeout(timer);
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    promise
      .then((value) => {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
  });
}

export function VoiceCloneMicRecorder({ disabled, onRecorded, onClear }: Props) {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const micAskAbortRef = useRef<AbortController | null>(null);

  function stopMeter() {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setLevel(0);
  }

  function startMeter() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 4));
      meterRafRef.current = requestAnimationFrame(tick);
    };

    stopMeter();
    meterRafRef.current = requestAnimationFrame(tick);
  }

  async function closeStream() {
    stopMeter();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }

  async function refreshDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    const mics = all
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
    setDevices(mics);
    return mics;
  }

  async function attachStream(stream: MediaStream) {
    streamRef.current = stream;

    const context = new AudioContext();
    audioContextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyserRef.current = analyser;
    startMeter();

    const mics = await refreshDevices();
    const usedId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? "";
    const chosen = mics.some((mic) => mic.deviceId === usedId)
      ? usedId
      : (mics[0]?.deviceId ?? "");
    setDeviceId(chosen);
    if (chosen) {
      window.localStorage.setItem(MIC_STORAGE_KEY, chosen);
    }
    setReady(true);
    setPermissionError(null);
  }

  async function openStream(nextDeviceId: string) {
    await closeStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: nextDeviceId },
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    await attachStream(stream);
  }

  function cancelMicAsk() {
    micAskAbortRef.current?.abort();
    micAskAbortRef.current = null;
    setAsking(false);
  }

  function enableMic() {
    const blocked = microphoneBlockReason();
    if (blocked) {
      setPermissionError(blocked);
      setReady(false);
      return;
    }

    micAskAbortRef.current?.abort();
    const controller = new AbortController();
    micAskAbortRef.current = controller;

    setAsking(true);
    setPermissionError(null);

    const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });

    void (async () => {
      try {
        const stream = await withTimeout(
          streamPromise,
          MIC_ASK_TIMEOUT_MS,
          controller.signal
        );
        if (controller.signal.aborted) {
          stream.getTracks().forEach((track) => track.stop());
          throw new DOMException("Microphone request cancelled.", "AbortError");
        }
        await attachStream(stream);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "TimeoutError") {
          setPermissionError(
            "Still waiting for microphone permission. Allow it if your browser asked, then try again."
          );
        } else if (name !== "AbortError") {
          setPermissionError(messageFromMicError(error));
        }
        setReady(false);
      } finally {
        micAskAbortRef.current = null;
        setAsking(false);
      }
    })();
  }

  async function changeMic(nextId: string) {
    setDeviceId(nextId);
    window.localStorage.setItem(MIC_STORAGE_KEY, nextId);
    try {
      await openStream(nextId);
    } catch {
      setPermissionError("Could not switch to that microphone.");
    }
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onClear();
  }

  function startTimer() {
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => {
      const next = Date.now() - startedAtRef.current;
      setElapsedMs(next);
      if (next >= MAX_RECORD_MS) {
        void stopRecording();
      }
    }, 200);
  }

  function stopTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || disabled) return;
    if (typeof MediaRecorder === "undefined") {
      setPermissionError(
        "This browser cannot record audio. Use Chrome or Safari on this computer."
      );
      return;
    }
    clearPreview();
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: preferredMimeType() || undefined,
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      void finishRecording(recorder.mimeType);
    };
    recorder.start(250);
    setRecording(true);
    startTimer();
  }

  async function finishRecording(mimeType: string) {
    stopTimer();
    setRecording(false);
    const blob = new Blob(chunksRef.current, {
      type: mimeType || "audio/webm",
    });
    chunksRef.current = [];
    if (blob.size < 1000) {
      setPermissionError("That recording was too short. Try again.");
      return;
    }

    setSaving(true);
    try {
      const file = await recordingBlobToWavFile(
        blob,
        `voice-sample-${Date.now()}.wav`
      );
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onRecorded(file);
    } catch {
      setPermissionError("Could not save that recording. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  useEffect(() => {
    const onDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      stopTimer();
      stopMeter();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      void closeStream();
    };
    // Unmount-only cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {!ready ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={enableMic}
            disabled={disabled || asking}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {asking ? "Waiting for microphone…" : "Enable microphone"}
          </button>
          {asking ? (
            <button
              type="button"
              onClick={cancelMicAsk}
              className="rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div>
            <label
              htmlFor="voice-clone-mic"
              className="mb-1 block text-[11px] font-medium text-slate-500"
            >
              Microphone
            </label>
            <select
              id="voice-clone-mic"
              value={deviceId}
              onChange={(event) => void changeMic(event.target.value)}
              disabled={disabled || recording}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 disabled:bg-slate-50"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Speak a few words — the bar should move if this is the right mic.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {recording ? (
              <button
                type="button"
                onClick={() => void stopRecording()}
                disabled={disabled}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled || saving}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewUrl ? "Re-record" : "Record"}
              </button>
            )}
            <span className="text-xs tabular-nums text-slate-500">
              {recording || elapsedMs ? formatClock(elapsedMs) : "0:00"}
              {recording ? " recording" : saving ? " saving" : ""}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Aim for about 30 seconds reading the script. Max 90 seconds.
          </p>
        </>
      )}

      {previewUrl ? (
        <audio
          className="w-full"
          src={previewUrl}
          controls
          preload="metadata"
        />
      ) : null}

      {permissionError ? (
        <p className="text-sm text-rose-600">{permissionError}</p>
      ) : null}
    </div>
  );
}
