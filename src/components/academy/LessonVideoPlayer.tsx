"use client";

import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  Check,
  ChevronDown,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatHubDurationLabel } from "@/lib/academy/hubCatalog";

import { LessonProgressChapterMenuTick } from "@/components/academy/LessonProgressControls";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
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
import {
  chapterSegmentAtRatio,
  type ChapterTimelineMarker,
  type ChapterTimelineSegment,
} from "@/lib/academy/chapterTimeline";
import {
  PLAYBACK_SPEEDS,
  formatPlaybackSpeed,
  readStoredPlaybackSpeed,
  storePlaybackSpeed,
  type PlaybackSpeed,
} from "@/lib/academy/playbackSpeed";

export type LessonVideoTimeline = {
  currentTime: number;
  duration: number;
  chapterMarkers?: ChapterTimelineMarker[];
  chapterSegments?: ChapterTimelineSegment[];
  bufferedRatio?: number;
  onSeekRatio: (ratio: number) => void;
};

export type LessonVideoChapterMenuItem = {
  id: string;
  title: string;
  duration: string | null;
};

export type LessonVideoChapterMenu = {
  chapters: LessonVideoChapterMenuItem[];
  activeIndex: number;
  onSelectChapter: (index: number) => void;
  /** When set, chapter rows show progress ticks (coach classroom). */
  lessonId?: string;
};

type Props = {
  src: string;
  title?: string;
  className?: string;
  /** localStorage key for resume (lesson-scoped when both media exist). */
  positionKey?: string;
  /** Seek here on mount (mode flip carry). */
  initialTime?: number;
  /** Auto-start when returning from Listen mid-session. */
  autoplay?: boolean;
  /** Fired as playback advances; used to auto-complete lessons near the end. */
  onWatchProgress?: (currentTimeSeconds: number, durationSeconds: number) => void;
  /** Fired when the video reaches the end (for the post-video handoff). */
  onEnded?: () => void;
  onTimeChange?: (seconds: number) => void;
  /** When set, show Watch|Listen in the control bar. */
  onModeChange?: (mode: LessonMediaMode) => void;
  /** Unified multi-chapter timeline (aggregate scrubber + markers). */
  timeline?: LessonVideoTimeline;
  /** Seek within the current file when timeline scrubber jumps inside the active chapter. */
  forcedSeekTime?: number | null;
  forcedSeekKey?: number;
  /** Popover chapter picker in the control bar. */
  chapterMenu?: LessonVideoChapterMenu;
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

const CHAPTER_MENU_HEIGHT_RATIO = 0.75;

type ChapterScrubberTrackProps = {
  progress: number;
  bufferedRatio: number;
  markers: ChapterTimelineMarker[];
  segments: ChapterTimelineSegment[];
  displayCurrentTime: number;
  onSeek: (e: ChangeEvent<HTMLInputElement>) => void;
};

function ChapterScrubberTrack({
  progress,
  bufferedRatio,
  markers,
  segments,
  displayCurrentTime,
  onSeek,
}: ChapterScrubberTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<ChapterTimelineSegment | null>(null);
  const [hoverRatio, setHoverRatio] = useState(0);

  function updateHoveredChapter(clientX: number) {
    const el = trackRef.current;
    if (!el || segments.length === 0) {
      setHoveredSegment(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHoverRatio(ratio);
    setHoveredSegment(chapterSegmentAtRatio(ratio, segments));
  }

  function onTrackMouseMove(event: MouseEvent<HTMLDivElement>) {
    updateHoveredChapter(event.clientX);
  }

  return (
    <div
      ref={trackRef}
      className="relative mx-1 flex h-5 min-w-0 flex-1 items-center"
      onMouseMove={onTrackMouseMove}
      onMouseLeave={() => setHoveredSegment(null)}
    >
      <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/30">
        <div
          className="absolute inset-y-0 left-0 bg-white/40"
          style={{ width: `${bufferedRatio * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {markers.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 flex h-1 items-center">
          {markers.map((marker) => {
            const highlighted =
              hoveredSegment != null &&
              hoveredSegment.startRatio > 0 &&
              Math.abs(marker.ratio - hoveredSegment.startRatio) < 0.0001;
            return (
              <div
                key={`${marker.ratio}-${marker.title}`}
                className={`absolute -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)] transition-all ${
                  highlighted ? "h-3 w-[3px] opacity-100" : "h-2.5 w-[2px] opacity-90"
                }`}
                style={{ left: `${marker.ratio * 100}%` }}
                aria-hidden
              />
            );
          })}
        </div>
      ) : null}

      {hoveredSegment ? (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-2 max-w-[min(18rem,calc(100%-0.5rem))] -translate-x-1/2 rounded-md bg-slate-950/95 px-2.5 py-1 text-[10px] font-medium leading-snug text-white shadow-lg ring-1 ring-white/10"
          style={{ left: `${hoverRatio * 100}%` }}
          role="tooltip"
        >
          {hoveredSegment.title}
        </div>
      ) : null}

      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(progress * 1000)}
        aria-label="Seek"
        aria-valuetext={formatTime(displayCurrentTime)}
        onChange={onSeek}
        className="absolute inset-x-0 h-5 w-full cursor-pointer appearance-none bg-transparent accent-white"
      />
    </div>
  );
}

export function LessonVideoPlayer({
  src,
  title,
  className = "aspect-video w-full bg-black",
  positionKey,
  initialTime = 0,
  autoplay = false,
  onWatchProgress,
  onEnded,
  onTimeChange,
  onModeChange,
  timeline,
  forcedSeekTime = null,
  forcedSeekKey = 0,
  chapterMenu,
}: Props) {
  const storageKey = positionKey ?? src;
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const chapterMenuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef(0);
  const onWatchProgressRef = useRef(onWatchProgress);
  onWatchProgressRef.current = onWatchProgress;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;

  const { profile } = useDashboardProfile();
  const firstName =
    profile?.first_name?.trim() || profile?.full_name?.trim().split(/\s+/)[0] || "";

  const [rate, setRate] = useState<PlaybackSpeed>(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [chapterMenuMaxHeight, setChapterMenuMaxHeight] = useState<number | undefined>();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      setChapterMenuMaxHeight(Math.floor(root.clientHeight * CHAPTER_MENU_HEIGHT_RATIO));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setRate(readStoredPlaybackSpeed());
  }, []);

  useEffect(() => {
    setStarted(false);
    setResumeAt(null);
    lastSavedRef.current = 0;
  }, [src, storageKey]);

  useEffect(() => {
    if (forcedSeekTime == null || forcedSeekKey <= 0) return;
    const el = videoRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : forcedSeekTime;
    const next = Math.min(max, Math.max(0, forcedSeekTime));
    el.currentTime = next;
    setCurrentTime(next);
    setStarted(true);
    void el.play();
  }, [forcedSeekKey, forcedSeekTime]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    if (!speedMenuOpen && !chapterMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (speedMenuRef.current && !speedMenuRef.current.contains(target)) {
        setSpeedMenuOpen(false);
      }
      if (chapterMenuRef.current && !chapterMenuRef.current.contains(target)) {
        setChapterMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSpeedMenuOpen(false);
        setChapterMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [speedMenuOpen, chapterMenuOpen]);

  useEffect(() => {
    function onFullscreenChange() {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const active =
        document.fullscreenElement === rootRef.current ||
        doc.webkitFullscreenElement === rootRef.current;
      setFullscreen(Boolean(active));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  function clearHideTimer() {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function scheduleHideControls(isPlaying = playing) {
    clearHideTimer();
    if (!isPlaying || speedMenuOpen || chapterMenuOpen) return;
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
  }

  function revealControls() {
    setControlsVisible(true);
    scheduleHideControls();
  }

  function selectRate(next: PlaybackSpeed) {
    setRate(next);
    storePlaybackSpeed(next);
    setSpeedMenuOpen(false);
  }

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function startPlayback(fromSeconds: number) {
    const el = videoRef.current;
    if (!el) return;
    if (fromSeconds > 0) {
      el.currentTime = fromSeconds;
      setCurrentTime(fromSeconds);
    }
    setStarted(true);
    void el.play();
  }

  function seekToRatio(ratio: number) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * el.duration;
    el.currentTime = next;
    setCurrentTime(next);
  }

  function skipBy(seconds: number) {
    const el = videoRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : el.currentTime;
    const next = Math.min(max, Math.max(0, el.currentTime + seconds));
    el.currentTime = next;
    setCurrentTime(next);
  }

  function onSeekInput(e: ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value);
    if (!Number.isFinite(value)) return;
    const ratio = value / 1000;
    if (timeline) {
      timeline.onSeekRatio(ratio);
      return;
    }
    seekToRatio(ratio);
  }

  function toggleMute() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function onVolumeInput(e: ChangeEvent<HTMLInputElement>) {
    const el = videoRef.current;
    if (!el) return;
    const next = Math.min(1, Math.max(0, Number(e.target.value)));
    el.volume = next;
    el.muted = next === 0;
    setVolume(next);
    setMuted(el.muted);
  }

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const el = root as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const isFs =
      document.fullscreenElement === root || doc.webkitFullscreenElement === root;
    if (isFs) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      return;
    }
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }

  function updateBuffered() {
    const el = videoRef.current;
    if (!el || el.buffered.length === 0 || !Number.isFinite(el.duration) || el.duration <= 0) {
      setBufferedEnd(0);
      return;
    }
    setBufferedEnd(el.buffered.end(el.buffered.length - 1) / el.duration);
  }

  const displayCurrentTime = timeline?.currentTime ?? currentTime;
  const displayDuration = timeline?.duration ?? duration;
  const progress =
    displayDuration > 0 ? Math.min(1, displayCurrentTime / displayDuration) : 0;
  const displayBuffered = timeline?.bufferedRatio ?? bufferedEnd;
  const showChrome = controlsVisible || !playing || speedMenuOpen || chapterMenuOpen;

  return (
    <div
      ref={rootRef}
      className="group/player relative bg-black"
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing && !speedMenuOpen && !chapterMenuOpen) setControlsVisible(false);
      }}
      onFocusCapture={revealControls}
    >
      <video
        ref={videoRef}
        src={src}
        title={title}
        playsInline
        preload="metadata"
        className={className}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          scheduleHideControls(true);
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          clearHideTimer();
          const el = videoRef.current;
          if (el && el.currentTime > 0) storePlaybackPosition(storageKey, el.currentTime);
        }}
        onTimeUpdate={() => {
          const el = videoRef.current;
          if (!el) return;
          setCurrentTime(el.currentTime);
          onTimeChangeRef.current?.(el.currentTime);
          updateBuffered();
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
          const el = videoRef.current;
          if (el && Number.isFinite(el.duration) && el.duration > 0) {
            onWatchProgressRef.current?.(el.duration, el.duration);
          }
          onEndedRef.current?.();
        }}
        onLoadedMetadata={() => {
          const el = videoRef.current;
          if (!el) return;
          el.playbackRate = rate;
          setDuration(el.duration);
          setVolume(el.volume);
          setMuted(el.muted);
          updateBuffered();

          let seek = initialTime > 0 ? initialTime : 0;
          if (seek <= 0) {
            const saved = readPlaybackPosition(storageKey);
            if (saved != null && isResumable(saved, el.duration)) {
              setResumeAt(saved);
            } else {
              if (saved != null) clearPlaybackPosition(storageKey);
              setResumeAt(null);
            }
          } else {
            const clamped = Math.min(seek, Math.max(0, el.duration - 0.25));
            el.currentTime = clamped;
            setCurrentTime(clamped);
            setResumeAt(null);
          }
          if (autoplay) {
            setStarted(true);
            void el.play();
          }
        }}
        onDurationChange={() => {
          const el = videoRef.current;
          if (el) setDuration(el.duration);
        }}
        onProgress={updateBuffered}
        onVolumeChange={() => {
          const el = videoRef.current;
          if (!el) return;
          setVolume(el.volume);
          setMuted(el.muted);
        }}
      />

      {!started ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/25 px-4">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[var(--brand-chathams)]/70 p-5 text-center backdrop-blur-[2px] sm:max-w-sm sm:p-6">
            <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {firstName ? `Hey ${firstName}` : "Ready when you are"}
            </p>
            <p className="mt-1.5 text-sm text-white/85 sm:text-base">
              {resumeAt != null
                ? `Pick up where you left off at ${formatTime(resumeAt)}.`
                : "Ready to start this lesson?"}
            </p>
            <button
              type="button"
              onClick={() => startPlayback(resumeAt ?? 0)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--brand-chathams)] shadow-sm transition duration-200 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
              {resumeAt != null ? "Resume lesson" : "Start lesson"}
            </button>
            {resumeAt != null ? (
              <button
                type="button"
                onClick={() => startPlayback(0)}
                className="mt-3 block w-full text-xs font-medium text-white/75 underline-offset-2 transition hover:text-white hover:underline"
              >
                Start from the beginning
              </button>
            ) : null}
          </div>
        </div>
      ) : !playing ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-[1] flex items-center justify-center bg-black/15 transition hover:bg-black/25"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-chathams)] text-white shadow-lg ring-1 ring-white/20 transition hover:bg-[#0a457a] sm:h-16 sm:w-16">
            <Play className="ml-0.5 h-7 w-7" fill="currentColor" aria-hidden />
          </span>
        </button>
      ) : null}

      <div
        className={`absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1 bg-[var(--brand-chathams)]/60 px-2 py-1.5 transition-opacity duration-200 sm:gap-1.5 sm:px-2.5 ${
          showChrome ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-white transition hover:bg-white/20"
        >
          {playing ? (
            <Pause className="h-4 w-4" fill="currentColor" aria-hidden />
          ) : (
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={() => skipBy(-15)}
          aria-label="Back 15 seconds"
          className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-white transition hover:bg-white/20"
        >
          <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center pt-px text-[8px] font-bold leading-none"
            aria-hidden
          >
            15
          </span>
        </button>

        {chapterMenu && chapterMenu.chapters.length > 1 ? (
          <div ref={chapterMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setChapterMenuOpen((open) => !open);
                setSpeedMenuOpen(false);
              }}
              aria-expanded={chapterMenuOpen}
              aria-haspopup="listbox"
              aria-label={`Chapters, ${chapterMenu.activeIndex + 1} of ${chapterMenu.chapters.length}`}
              className="inline-flex h-7 items-center gap-0.5 rounded px-1 text-white transition hover:bg-white/20 sm:px-1.5"
            >
              <ListVideo className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-[10px] font-semibold tabular-nums">
                {chapterMenu.activeIndex + 1}/{chapterMenu.chapters.length}
              </span>
              <ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
            </button>
            {chapterMenuOpen ? (
              <ul
                role="listbox"
                aria-label="Chapters"
                style={chapterMenuMaxHeight ? { maxHeight: chapterMenuMaxHeight } : undefined}
                className="absolute bottom-full left-0 mb-2 max-h-[min(28rem,75dvh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/95 py-1.5 shadow-xl backdrop-blur-md"
              >
                {chapterMenu.chapters.map((chapter, index) => {
                  const selected = index === chapterMenu.activeIndex;
                  const durationLabel = chapter.duration
                    ? formatHubDurationLabel(chapter.duration)
                    : null;
                  return (
                    <li key={chapter.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => {
                          chapterMenu.onSelectChapter(index);
                          setChapterMenuOpen(false);
                        }}
                        className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition ${
                          selected
                            ? "bg-white/10 text-white"
                            : "text-slate-200 hover:bg-white/5"
                        }`}
                      >
                        {chapterMenu.lessonId ? (
                          <span className="mt-0.5 shrink-0">
                            <LessonProgressChapterMenuTick
                              lessonId={chapterMenu.lessonId}
                              chapterId={chapter.id}
                              selected={selected}
                            />
                          </span>
                        ) : (
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              selected ? "bg-sky-500 text-white" : "bg-white/10 text-white/70"
                            }`}
                            aria-hidden
                          >
                            <Play className="h-2.5 w-2.5 fill-current" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-xs leading-snug ${
                              selected ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {chapter.title}
                          </span>
                        </span>
                        {durationLabel ? (
                          <span className="shrink-0 pt-px text-[10px] tabular-nums text-white/50">
                            {durationLabel}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        <ChapterScrubberTrack
          progress={progress}
          bufferedRatio={displayBuffered}
          markers={timeline?.chapterMarkers ?? []}
          segments={timeline?.chapterSegments ?? []}
          displayCurrentTime={displayCurrentTime}
          onSeek={onSeekInput}
        />

        <p className="shrink-0 text-[11px] font-medium tabular-nums text-white/95">
          {formatTime(displayCurrentTime)}
          <span className="text-white/60"> / {formatTime(displayDuration)}</span>
        </p>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-white transition hover:bg-white/20"
        >
          {muted || volume === 0 ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
        </button>
        <div className="relative flex h-4 w-16 shrink-0 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/30">
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

        <div ref={speedMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setSpeedMenuOpen((open) => !open);
              setChapterMenuOpen(false);
            }}
            aria-expanded={speedMenuOpen}
            aria-haspopup="listbox"
            aria-label={`Playback speed ${formatPlaybackSpeed(rate)}`}
            className="inline-flex h-7 items-center gap-0.5 rounded px-1.5 text-xs font-semibold tabular-nums text-white transition hover:bg-white/20"
          >
            {formatPlaybackSpeed(rate)}
            <ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
          </button>
          {speedMenuOpen ? (
            <ul
              role="listbox"
              aria-label="Playback speed"
              className="absolute bottom-full right-0 mb-2 min-w-[7rem] overflow-hidden rounded-lg border border-white/10 bg-slate-950/95 py-1 shadow-xl backdrop-blur-md"
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
                          className="h-3.5 w-3.5 text-[var(--brand-light-blue)]"
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
            mode="watch"
            onModeChange={onModeChange}
            compact
          />
        ) : null}

        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-white transition hover:bg-white/20"
        >
          {fullscreen ? (
            <Minimize className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
