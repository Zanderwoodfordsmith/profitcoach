"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ChevronDown,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  LessonMediaModeToggle,
  type LessonMediaMode,
} from "@/components/academy/LessonMediaModeToggle";
import {
  clearPlaybackPosition,
  isResumable,
  readPlaybackPosition,
  storePlaybackPosition,
} from "@/lib/academy/lessonPlaybackPosition";
import { buildLessonWaveformBars } from "@/lib/academy/lessonWaveform";
import {
  PLAYBACK_SPEEDS,
  formatPlaybackSpeed,
  readStoredPlaybackSpeed,
  storePlaybackSpeed,
  type PlaybackSpeed,
} from "@/lib/academy/playbackSpeed";

type Props = {
  src: string;
  title?: string;
  /** localStorage key for resume (lesson-scoped when provided). */
  positionKey?: string;
  /** Seek here on mount (mode flip carry). */
  initialTime?: number;
  /** Auto-start when mounting into Listen mode mid-session. */
  autoplay?: boolean;
  className?: string;
  onWatchProgress?: (currentTimeSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  /** Current time for parent sync when flipping modes. */
  onTimeChange?: (seconds: number) => void;
  onModeChange?: (mode: LessonMediaMode) => void;
  /** Seek within the current file (e.g. transcript timestamp click). */
  forcedSeekTime?: number | null;
  forcedSeekKey?: number;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Custom Listen surface — waveform scrubber inside the lesson media frame. */
export function LessonAudioSurface({
  src,
  title,
  positionKey,
  initialTime = 0,
  autoplay = false,
  className = "aspect-video w-full",
  onWatchProgress,
  onEnded,
  onTimeChange,
  onModeChange,
  forcedSeekTime = null,
  forcedSeekKey = 0,
}: Props) {
  const storageKey = positionKey ?? src;
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef(0);
  const onWatchProgressRef = useRef(onWatchProgress);
  onWatchProgressRef.current = onWatchProgress;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;

  const bars = useMemo(() => buildLessonWaveformBars(storageKey, 72), [storageKey]);

  const [rate, setRate] = useState<PlaybackSpeed>(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    setRate(readStoredPlaybackSpeed());
  }, []);

  useEffect(() => {
    lastSavedRef.current = 0;
  }, [src, storageKey]);

  useEffect(() => {
    if (forcedSeekTime == null || forcedSeekKey <= 0) return;
    const el = audioRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : forcedSeekTime;
    const next = Math.min(max, Math.max(0, forcedSeekTime));
    el.currentTime = next;
    setCurrentTime(next);
    onTimeChangeRef.current?.(next);
    void el.play();
  }, [forcedSeekKey, forcedSeekTime]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    if (!speedMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSpeedMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [speedMenuOpen]);

  function selectRate(next: PlaybackSpeed) {
    setRate(next);
    storePlaybackSpeed(next);
    setSpeedMenuOpen(false);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function seekToRatio(ratio: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * el.duration;
    el.currentTime = next;
    setCurrentTime(next);
    onTimeChangeRef.current?.(next);
  }

  function skipBy(seconds: number) {
    const el = audioRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : el.currentTime;
    const next = Math.min(max, Math.max(0, el.currentTime + seconds));
    el.currentTime = next;
    setCurrentTime(next);
    onTimeChangeRef.current?.(next);
  }

  function toggleMute() {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function onVolumeInput(e: ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    if (!el) return;
    const next = Math.min(1, Math.max(0, Number(e.target.value)));
    el.volume = next;
    el.muted = next === 0;
    setVolume(next);
    setMuted(el.muted);
  }

  function ratioFromPointer(clientX: number): number {
    const node = waveRef.current;
    if (!node) return 0;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function onWavePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekToRatio(ratioFromPointer(e.clientX));
  }

  function onWavePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    seekToRatio(ratioFromPointer(e.clientX));
  }

  function onWavePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setScrubbing(false);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-slate-950 via-[#0a2744] to-slate-950 text-white ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          const el = audioRef.current;
          if (el && el.currentTime > 0) {
            storePlaybackPosition(storageKey, el.currentTime);
          }
        }}
        onTimeUpdate={() => {
          const el = audioRef.current;
          if (!el || scrubbing) return;
          setCurrentTime(el.currentTime);
          onTimeChangeRef.current?.(el.currentTime);
          if (Math.abs(el.currentTime - lastSavedRef.current) >= 5) {
            lastSavedRef.current = el.currentTime;
            storePlaybackPosition(storageKey, el.currentTime);
          }
          if (Number.isFinite(el.duration) && el.duration > 0) {
            onWatchProgressRef.current?.(el.currentTime, el.duration);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          clearPlaybackPosition(storageKey);
          const el = audioRef.current;
          if (el && Number.isFinite(el.duration) && el.duration > 0) {
            onWatchProgressRef.current?.(el.duration, el.duration);
          }
          onEndedRef.current?.();
        }}
        onLoadedMetadata={() => {
          const el = audioRef.current;
          if (!el) return;
          el.playbackRate = rate;
          setDuration(el.duration);
          setVolume(el.volume);
          setMuted(el.muted);

          let seek = initialTime > 0 ? initialTime : 0;
          if (seek <= 0) {
            const saved = readPlaybackPosition(storageKey);
            if (saved != null && isResumable(saved, el.duration)) seek = saved;
            else if (saved != null) clearPlaybackPosition(storageKey);
          }
          if (seek > 0 && Number.isFinite(el.duration)) {
            const clamped = Math.min(seek, Math.max(0, el.duration - 0.25));
            el.currentTime = clamped;
            setCurrentTime(clamped);
          }
          if (autoplay) void el.play();
        }}
        onDurationChange={() => {
          const el = audioRef.current;
          if (el) setDuration(el.duration);
        }}
        onVolumeChange={() => {
          const el = audioRef.current;
          if (!el) return;
          setVolume(el.volume);
          setMuted(el.muted);
        }}
      />

      <div className="flex items-start gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Headphones className="h-5 w-5 text-sky-200" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
              {title?.trim() || "Lesson audio"}
            </p>
            <p className="mt-0.5 text-xs text-white/55">Listen mode</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-6">
        <div
          ref={waveRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.floor(duration))}
          aria-valuenow={Math.floor(currentTime)}
          aria-valuetext={formatTime(currentTime)}
          onPointerDown={onWavePointerDown}
          onPointerMove={onWavePointerMove}
          onPointerUp={onWavePointerUp}
          onPointerCancel={onWavePointerUp}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              skipBy(15);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              skipBy(-15);
            }
          }}
          className="flex h-16 cursor-pointer items-end gap-[2px] touch-none sm:h-20 sm:gap-0.5"
        >
          {bars.map((height, i) => {
            const barProgress = (i + 0.5) / bars.length;
            const played = barProgress <= progress;
            return (
              <span
                key={i}
                className={`min-w-0 flex-1 rounded-full transition-colors ${
                  played ? "bg-sky-300" : "bg-white/25"
                }`}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium tabular-nums text-white/60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-4 sm:px-6 sm:pb-5">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          {muted || volume === 0 ? (
            <VolumeX className="h-5 w-5" aria-hidden />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden />
          )}
        </button>
        <div className="relative hidden h-4 w-16 items-center sm:flex">
          <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="absolute inset-y-0 left-0 bg-white"
              style={{ width: `${(muted ? 0 : volume) * 100}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volume"
            onChange={onVolumeInput}
            className="absolute inset-x-0 h-4 w-full cursor-pointer appearance-none bg-transparent accent-white"
          />
        </div>

        <div className="flex flex-1 items-center justify-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => skipBy(-15)}
            aria-label="Back 15 seconds"
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white sm:h-14 sm:w-14"
          >
            <RotateCcw className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center pt-0.5 text-[10px] font-bold sm:text-[11px]">
              15
            </span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-400 text-black shadow-[0_0_0_8px_rgba(56,189,248,0.18)] transition hover:bg-sky-300 sm:h-16 sm:w-16"
          >
            {playing ? (
              <Pause className="h-6 w-6" fill="currentColor" aria-hidden />
            ) : (
              <Play className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden />
            )}
          </button>

          <button
            type="button"
            onClick={() => skipBy(15)}
            aria-label="Forward 15 seconds"
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white sm:h-14 sm:w-14"
          >
            <RotateCw className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center pt-0.5 text-[10px] font-bold sm:text-[11px]">
              15
            </span>
          </button>
        </div>

        <div ref={speedMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setSpeedMenuOpen((open) => !open)}
            aria-expanded={speedMenuOpen}
            aria-haspopup="listbox"
            aria-label={`Playback speed ${formatPlaybackSpeed(rate)}`}
            className="inline-flex h-10 items-center gap-0.5 rounded-full px-2.5 text-xs font-semibold tabular-nums text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            {formatPlaybackSpeed(rate)}
            <ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
          </button>
          {speedMenuOpen ? (
            <ul
              role="listbox"
              aria-label="Playback speed"
              className="absolute bottom-full right-0 mb-2 max-h-56 min-w-[7rem] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/95 py-1 shadow-xl backdrop-blur-md"
            >
              {PLAYBACK_SPEEDS.map((speed) => {
                const selected = speed === rate;
                return (
                  <li key={speed} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => selectRate(speed)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition ${
                        selected
                          ? "bg-white/10 font-semibold text-white"
                          : "text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span>{formatPlaybackSpeed(speed)}</span>
                      {selected ? (
                        <Check
                          className="h-3.5 w-3.5 text-sky-300"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      ) : (
                        <span className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {onModeChange ? (
          <LessonMediaModeToggle
            mode="listen"
            onModeChange={onModeChange}
            compact
          />
        ) : null}
      </div>
    </div>
  );
}
