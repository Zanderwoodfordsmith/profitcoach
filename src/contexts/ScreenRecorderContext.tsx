"use client";

import { Circle, Loader2, Pause, Play, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Screen recording for support replies (Loom-style).
 *
 * Lives at the root so a recording keeps going while you move around the app,
 * and lands back in the reply box it was started from. Controls float in an
 * always-on-top window where the browser supports it (Chrome, Edge), else in
 * a bar on the page. Chunks are saved to IndexedDB as they arrive, so a
 * finished recording survives a reload until it's in a reply box. (Chrome's
 * MP4 recorder only hands over data at Stop, so a reload mid-recording loses
 * it there; the browser asks before leaving.)
 */

export type ScreenRecordingTarget = {
  /** Which reply box gets the video, e.g. `admin:<ticket id>`. */
  key: string;
  /** Short name for the "back to" button, e.g. "ticket #123". */
  label: string;
};

type Phase = "idle" | "countdown" | "recording" | "paused";

type StoredMeta = {
  target: ScreenRecordingTarget;
  href: string;
  mime: string;
  tabId: string;
  updatedAt: number;
  done: boolean;
};

type ReadyRecording = {
  target: ScreenRecordingTarget;
  href: string;
  file: File;
};

type ScreenRecorderValue = {
  supported: boolean;
  phase: Phase;
  activeKey: string | null;
  ready: ReadyRecording | null;
  start: (target: ScreenRecordingTarget) => Promise<void>;
  /** Hand the finished recording to its reply box (clears it). */
  take: (key: string) => File | null;
};

const ScreenRecorderContext = createContext<ScreenRecorderValue | null>(null);

const COUNTDOWN_SECONDS = 3;
/** About 6.5 minutes fits in the 100MB support limit at this bitrate. */
const VIDEO_BITS_PER_SECOND = 2_000_000;
const MAX_RECORDING_MS = 6 * 60_000;
const MAX_RECORDING_BYTES = 95 * 1024 * 1024;
/** A recording from another tab counts as abandoned after this long. */
const STALE_MS = 15_000;

const DB_NAME = "support-screen-recorder";
const STORE = "recording";
const TAB_ID_KEY = "support-screen-recorder-tab";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
    };
  }
}

function pickVideoMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function recordingFile(chunks: Blob[], mime: string, startedAt = new Date()): File {
  const base = (mime || "video/webm").split(";")[0]!;
  const ext = base === "video/mp4" ? "mp4" : "webm";
  const stamp = startedAt
    .toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "")
    .replace(":", ".");
  return new File(chunks, `Screen recording ${stamp}.${ext}`, { type: base });
}

const noopSubscribe = () => () => {};

function canRecordScreen(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia)
  );
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function tabId(): string {
  try {
    let id = sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    return "no-session-storage";
  }
}

// --- IndexedDB (best effort: every call swallows errors) ---

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function dbRun(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | void
): Promise<unknown> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req ? req.result : null);
      };
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

const chunkKey = (i: number) => `chunk-${i.toString().padStart(6, "0")}`;
const CHUNK_RANGE = () => IDBKeyRange.bound("chunk-", "chunk-￿");

function dbClear() {
  return dbRun("readwrite", (s) => s.clear());
}

function dbPutMeta(meta: StoredMeta) {
  return dbRun("readwrite", (s) => s.put(meta, "meta"));
}

function dbPutChunk(i: number, blob: Blob, meta: StoredMeta) {
  return dbRun("readwrite", (s) => {
    s.put(blob, chunkKey(i));
    s.put(meta, "meta");
  });
}

async function dbLoad(): Promise<{ meta: StoredMeta; chunks: Blob[] } | null> {
  const meta = (await dbRun("readonly", (s) => s.get("meta"))) as StoredMeta | null;
  if (!meta?.target?.key) return null;
  const chunks = (await dbRun("readonly", (s) => s.getAll(CHUNK_RANGE()))) as
    | Blob[]
    | null;
  if (!chunks?.length) return null;
  return { meta, chunks };
}

// --- Controls (rendered on the page and, when possible, in the floating window) ---

function RecorderControls({
  phase,
  countdown,
  elapsedMs,
  micMissing,
  onPause,
  onResume,
  onStop,
  onCancel,
}: {
  phase: Phase;
  countdown: number;
  elapsedMs: number;
  micMissing: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  if (phase === "countdown") {
    return (
      <div className="flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-white shadow-lg">
        <span className="text-sm">Recording starts in</span>
        <span className="w-5 text-center text-lg font-semibold tabular-nums">
          {countdown}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
      </div>
    );
  }
  const paused = phase === "paused";
  return (
    <div className="flex items-center gap-2 rounded-full bg-slate-900 py-1.5 pl-3 pr-1.5 text-white shadow-lg">
      <Circle
        className={`h-2.5 w-2.5 ${paused ? "fill-amber-400 text-amber-400" : "animate-pulse fill-rose-500 text-rose-500"}`}
        aria-hidden
      />
      <span className="w-11 text-sm font-medium tabular-nums">
        {formatClock(elapsedMs)}
      </span>
      {micMissing ? (
        <span className="text-xs text-slate-400">No mic</span>
      ) : null}
      <button
        type="button"
        onClick={paused ? onResume : onPause}
        title={paused ? "Carry on recording" : "Pause"}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm hover:bg-white/10"
      >
        {paused ? (
          <Play className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Pause className="h-3.5 w-3.5" aria-hidden />
        )}
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        type="button"
        onClick={onStop}
        title="Stop and add to the reply"
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-semibold hover:bg-rose-700"
      >
        <Square className="h-3 w-3 fill-current" aria-hidden />
        Stop
      </button>
      <button
        type="button"
        onClick={onCancel}
        title="Throw this recording away"
        className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Discard</span>
      </button>
    </div>
  );
}

export function ScreenRecorderProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Server render: false. Phones have no getDisplayMedia, so the button stays hidden.
  const supported = useSyncExternalStore(noopSubscribe, canRecordScreen, () => false);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [micMissing, setMicMissing] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [ready, setReady] = useState<ReadyRecording | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const metaRef = useRef<StoredMeta | null>(null);
  const startedAtRef = useRef(new Date());
  const discardRef = useRef(false);
  const countdownTimerRef = useRef<number | null>(null);
  /** Active time before the current run (pauses excluded). */
  const accumulatedRef = useRef(0);
  const runStartedRef = useRef<number | null>(null);

  useEffect(() => {
    // Pick up a recording that a reload (or closed tab) cut short.
    void (async () => {
      const saved = await dbLoad();
      if (!saved) return;
      const { meta, chunks } = saved;
      const ours = meta.tabId === tabId();
      const abandoned = Date.now() - meta.updatedAt > STALE_MS;
      if (!meta.done && !ours && !abandoned) return; // still recording elsewhere
      setReady({
        target: meta.target,
        href: meta.href,
        file: recordingFile(chunks, meta.mime, new Date(meta.updatedAt)),
      });
    })();
  }, []);

  const closePip = useCallback(() => {
    setPipWindow((win) => {
      win?.close();
      return null;
    });
  }, []);

  const releaseStreams = useCallback(() => {
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamsRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // onstop does the rest
      return;
    }
    // Stopped during the countdown: nothing was recorded.
    releaseStreams();
    closePip();
    recorderRef.current = null;
    setPhase("idle");
    setActiveKey(null);
  }, [closePip, releaseStreams]);

  const cancel = useCallback(() => {
    discardRef.current = true;
    finish();
  }, [finish]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") return;
    recorder.pause();
    if (runStartedRef.current) {
      accumulatedRef.current += Date.now() - runStartedRef.current;
    }
    runStartedRef.current = null;
    setPhase("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "paused") return;
    recorder.resume();
    runStartedRef.current = Date.now();
    setPhase("recording");
  }, []);

  // A reload or closed tab ends the screen share, so ask first.
  useEffect(() => {
    if (phase === "idle") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  // Clock and the length limit.
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const timer = window.setInterval(() => {
      const running = runStartedRef.current ? Date.now() - runStartedRef.current : 0;
      const total = accumulatedRef.current + running;
      setElapsedMs(total);
      if (total >= MAX_RECORDING_MS) finish();
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, finish]);

  const start = useCallback(
    async (target: ScreenRecordingTarget) => {
      if (phase !== "idle") return;

      // The floating window needs the click, so open it before the share picker.
      let pip: Window | null = null;
      if (window.documentPictureInPicture) {
        try {
          pip = await window.documentPictureInPicture.requestWindow({
            width: 360,
            height: 64,
          });
          for (const node of document.head.querySelectorAll(
            'link[rel="stylesheet"], style'
          )) {
            pip.document.head.appendChild(node.cloneNode(true));
          }
          pip.document.body.style.margin = "0";
          pip.document.body.style.background = "#0f172a";
          pip.addEventListener("pagehide", () => setPipWindow(null));
        } catch {
          pip = null;
        }
      }

      let display: MediaStream;
      try {
        display = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { max: 1920 },
            height: { max: 1080 },
            frameRate: { max: 24 },
          },
          audio: false,
          // Chrome: let you switch to sharing another tab mid-recording.
          selfBrowserSurface: "include",
          surfaceSwitching: "include",
        } as DisplayMediaStreamOptions);
      } catch {
        pip?.close();
        return; // picker closed
      }

      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        mic = null;
      }

      streamsRef.current = mic ? [display, mic] : [display];
      const tracks = [
        ...display.getVideoTracks(),
        ...(mic ? mic.getAudioTracks() : []),
      ];
      const mime = pickVideoMime();
      const recorder = new MediaRecorder(new MediaStream(tracks), {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: 96_000,
      });

      chunksRef.current = [];
      bytesRef.current = 0;
      accumulatedRef.current = 0;
      runStartedRef.current = null;
      discardRef.current = false;
      startedAtRef.current = new Date();
      const meta: StoredMeta = {
        target,
        href: `${window.location.pathname}${window.location.search}`,
        mime: recorder.mimeType || mime,
        tabId: tabId(),
        updatedAt: Date.now(),
        done: false,
      };
      metaRef.current = meta;
      await dbClear();
      await dbPutMeta(meta);

      recorder.ondataavailable = (e) => {
        if (!e.data.size) return;
        const index = chunksRef.current.length;
        chunksRef.current.push(e.data);
        bytesRef.current += e.data.size;
        if (metaRef.current) {
          metaRef.current = { ...metaRef.current, updatedAt: Date.now() };
          void dbPutChunk(index, e.data, metaRef.current);
        }
        if (bytesRef.current >= MAX_RECORDING_BYTES) finish();
      };
      recorder.onstop = () => {
        releaseStreams();
        closePip();
        recorderRef.current = null;
        setPhase("idle");
        setActiveKey(null);
        setElapsedMs(0);
        const current = metaRef.current;
        metaRef.current = null;
        if (discardRef.current || !current || chunksRef.current.length === 0) {
          void dbClear();
          return;
        }
        void dbPutMeta({ ...current, done: true, updatedAt: Date.now() });
        setReady({
          target: current.target,
          href: current.href,
          file: recordingFile(chunksRef.current, current.mime, startedAtRef.current),
        });
      };

      // "Stop sharing" in the browser's own bar ends the recording too.
      display.getVideoTracks()[0]?.addEventListener("ended", () => finish());

      recorderRef.current = recorder;
      setMicMissing(!mic);
      setActiveKey(target.key);
      setElapsedMs(0);
      setPipWindow(pip);
      setReady(null);

      let left = COUNTDOWN_SECONDS;
      setCountdown(left);
      setPhase("countdown");
      countdownTimerRef.current = window.setInterval(() => {
        left -= 1;
        if (left > 0) {
          setCountdown(left);
          return;
        }
        if (countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        if (recorderRef.current !== recorder) return;
        recorder.start(1000);
        runStartedRef.current = Date.now();
        setPhase("recording");
      }, 1000);
    },
    [phase, finish, releaseStreams, closePip]
  );

  const take = useCallback(
    (key: string) => {
      if (!ready || ready.target.key !== key) return null;
      setReady(null);
      void dbClear();
      return ready.file;
    },
    [ready]
  );

  const discardReady = useCallback(() => {
    setReady(null);
    void dbClear();
  }, []);

  const controls =
    phase === "idle" ? null : (
      <RecorderControls
        phase={phase}
        countdown={countdown}
        elapsedMs={elapsedMs}
        micMissing={micMissing}
        onPause={pause}
        onResume={resume}
        onStop={finish}
        onCancel={cancel}
      />
    );

  return (
    <ScreenRecorderContext.Provider
      value={{ supported, phase, activeKey, ready, start, take }}
    >
      {children}
      {mounted && controls && pipWindow
        ? createPortal(
            <div className="flex h-screen items-center justify-center">{controls}</div>,
            pipWindow.document.body
          )
        : null}
      {mounted && controls && !pipWindow
        ? createPortal(
            <div className="fixed bottom-5 left-1/2 z-[95] -translate-x-1/2">
              {controls}
            </div>,
            document.body
          )
        : null}
      {mounted && phase === "idle" && ready
        ? createPortal(
            <div className="fixed bottom-5 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-900 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-lg">
              <span>Screen recording ready</span>
              <button
                type="button"
                onClick={() => router.push(ready.href)}
                className="rounded-full bg-sky-600 px-3 py-1.5 font-semibold hover:bg-sky-700"
              >
                Back to {ready.target.label}
              </button>
              <button
                type="button"
                onClick={discardReady}
                title="Throw this recording away"
                className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Discard</span>
              </button>
            </div>,
            document.body
          )
        : null}
    </ScreenRecorderContext.Provider>
  );
}

export function useScreenRecorder(): ScreenRecorderValue | null {
  return useContext(ScreenRecorderContext);
}

/**
 * Drops a finished recording into this reply box whenever one is waiting for
 * `key` (straight after Stop, or after coming back to the page).
 */
export function useScreenRecordingFor(key: string, onFile: (file: File) => void) {
  const recorder = useScreenRecorder();
  const onFileRef = useRef(onFile);
  useEffect(() => {
    onFileRef.current = onFile;
  });
  const readyKey = recorder?.ready?.target.key;
  useEffect(() => {
    if (!recorder || readyKey !== key) return;
    const file = recorder.take(key);
    if (file) onFileRef.current(file);
  }, [recorder, readyKey, key]);
}

/** Toolbar button that starts a recording for this reply box. Hidden on phones. */
export function ScreenRecordButton({
  target,
  disabled,
}: {
  target: ScreenRecordingTarget;
  disabled?: boolean;
}) {
  const recorder = useScreenRecorder();
  const [starting, setStarting] = useState(false);
  if (!recorder?.supported) return null;
  const busyHere = recorder.activeKey === target.key;
  const busyElsewhere = recorder.phase !== "idle" && !busyHere;
  return (
    <button
      type="button"
      title={
        busyHere
          ? "Recording… use the controls to stop"
          : busyElsewhere
            ? "Another recording is running"
            : "Record your screen"
      }
      disabled={disabled || starting || recorder.phase !== "idle"}
      onClick={async () => {
        setStarting(true);
        try {
          await recorder.start(target);
        } finally {
          setStarting(false);
        }
      }}
      className={`rounded-md p-1.5 disabled:opacity-40 ${
        busyHere
          ? "bg-rose-50 text-rose-600"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {starting ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <ScreenRecordIcon />
      )}
      <span className="sr-only">Record screen</span>
    </button>
  );
}

/** Monitor with a record dot: reads as "record screen" next to the video and mic icons. */
function ScreenRecordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
