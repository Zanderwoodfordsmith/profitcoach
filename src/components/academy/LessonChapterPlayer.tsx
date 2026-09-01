"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  LessonVideoPlayer,
  type LessonVideoChapterMenu,
  type LessonVideoTimeline,
} from "@/components/academy/LessonVideoPlayer";
import type { LessonSeekRequest } from "@/lib/academy/lessonSeekRequest";
import {
  aggregateBufferedRatio,
  aggregateCurrentTime,
  aggregateTimeToChapter,
  buildChapterTimelineMarkers,
  buildChapterTimelineSegments,
  chapterDurationSecondsFromLabel,
  sumChapterDurations,
} from "@/lib/academy/chapterTimeline";
import { parseDurationMinutes } from "@/lib/academy/hubCatalog";
import type { LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import { useReportChapterWatchProgress } from "@/components/academy/LessonProgressControls";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";

const PRELOAD_BEFORE_END_SECONDS = 10;

type Props = {
  chapters: LessonVideoChapter[];
  title: string;
  positionKey: string;
  lessonId?: string;
  onWatchProgress?: (currentTimeSeconds: number, durationSeconds: number) => void;
  onAllChaptersEnded?: () => void;
  handoff?: ReactNode;
  initialChapterId?: string | null;
  seekRequest?: LessonSeekRequest | null;
};

function chapterDurationSeconds(chapter: LessonVideoChapter): number {
  const fromLabel = chapterDurationSecondsFromLabel(chapter.duration);
  if (fromLabel > 0) return fromLabel;
  const minutes = parseDurationMinutes(chapter.duration ?? "");
  return minutes > 0 ? minutes * 60 : 0;
}

export function LessonChapterPlayer({
  chapters,
  title,
  positionKey,
  lessonId,
  onWatchProgress,
  onAllChaptersEnded,
  handoff,
  initialChapterId = null,
  seekRequest = null,
}: Props) {
  const playableChapters = useMemo(() => {
    const rows: Array<LessonVideoChapter & { videoUrl: string }> = [];
    for (const chapter of chapters) {
      const videoUrl = chapter.videoUrl?.trim();
      if (videoUrl && isDirectVideoFileUrl(videoUrl)) {
        rows.push({ ...chapter, videoUrl });
      }
    }
    return rows;
  }, [chapters]);

  const initialIndex = useMemo(() => {
    if (!initialChapterId) return 0;
    const idx = playableChapters.findIndex((chapter) => chapter.id === initialChapterId);
    return idx >= 0 ? idx : 0;
  }, [initialChapterId, playableChapters]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [autoplay, setAutoplay] = useState(false);
  const [chapterDurations, setChapterDurations] = useState<number[]>(() =>
    playableChapters.map(chapterDurationSeconds)
  );
  const [aggregateCurrent, setAggregateCurrent] = useState(0);
  const [chapterBufferedRatio, setChapterBufferedRatio] = useState(0);
  const [forcedSeekTime, setForcedSeekTime] = useState<number | null>(null);
  const [forcedSeekKey, setForcedSeekKey] = useState(0);
  const [chapterInitialTime, setChapterInitialTime] = useState(0);
  const preloadRef = useRef<HTMLVideoElement>(null);
  const preloadedSrcRef = useRef<string | null>(null);
  const onWatchProgressRef = useRef(onWatchProgress);
  onWatchProgressRef.current = onWatchProgress;
  const onAllChaptersEndedRef = useRef(onAllChaptersEnded);
  onAllChaptersEndedRef.current = onAllChaptersEnded;

  useEffect(() => {
    setActiveIndex(initialIndex);
    setAutoplay(false);
    setAggregateCurrent(0);
    setChapterBufferedRatio(0);
    setForcedSeekTime(null);
    setChapterInitialTime(0);
    preloadedSrcRef.current = null;
    setChapterDurations(playableChapters.map(chapterDurationSeconds));
  }, [positionKey, initialIndex, playableChapters]);

  const activeChapter = playableChapters[activeIndex] ?? null;
  const nextChapter = playableChapters[activeIndex + 1] ?? null;
  const reportChapterWatchProgress = useReportChapterWatchProgress(
    lessonId,
    activeChapter?.id,
  );

  const totalDurationSeconds = useMemo(() => {
    const known = sumChapterDurations(chapterDurations);
    if (known > 0) return known;
    return playableChapters.reduce(
      (sum, chapter) => sum + chapterDurationSeconds(chapter),
      0
    );
  }, [chapterDurations, playableChapters]);

  const chapterMarkers = useMemo(
    () =>
      buildChapterTimelineMarkers(
        playableChapters.map((chapter) => chapter.title),
        chapterDurations
      ),
    [chapterDurations, playableChapters]
  );

  const chapterSegments = useMemo(
    () =>
      buildChapterTimelineSegments(
        playableChapters.map((chapter) => chapter.title),
        chapterDurations
      ),
    [chapterDurations, playableChapters]
  );

  const preloadNextChapter = useCallback((nextUrl: string) => {
    if (preloadedSrcRef.current === nextUrl) return;
    const el = preloadRef.current;
    if (!el) return;
    preloadedSrcRef.current = nextUrl;
    el.src = nextUrl;
    el.load();
  }, []);

  const reportAggregateProgress = useCallback(
    (currentChapterTime: number, currentChapterDuration: number) => {
      const durations = [...chapterDurations];
      if (currentChapterDuration > 0) {
        durations[activeIndex] = currentChapterDuration;
      }
      const aggregate = aggregateCurrentTime(activeIndex, currentChapterTime, durations);
      const aggregateDuration =
        totalDurationSeconds > 0
          ? totalDurationSeconds
          : currentChapterDuration > 0
            ? aggregate + Math.max(0, currentChapterDuration - currentChapterTime)
            : currentChapterDuration;
      setAggregateCurrent(aggregate);
      if (aggregateDuration > 0) {
        onWatchProgressRef.current?.(aggregate, aggregateDuration);
      }
    },
    [activeIndex, chapterDurations, totalDurationSeconds]
  );

  const seekAggregate = useCallback(
    (ratio: number) => {
      if (totalDurationSeconds <= 0) return;
      const target = Math.min(totalDurationSeconds, Math.max(0, ratio * totalDurationSeconds));
      const { chapterIndex, chapterTime } = aggregateTimeToChapter(
        target,
        chapterDurations
      );

      setAutoplay(true);
      setAggregateCurrent(target);

      if (chapterIndex === activeIndex) {
        setForcedSeekTime(chapterTime);
        setForcedSeekKey((key) => key + 1);
        return;
      }

      setChapterInitialTime(chapterTime);
      setActiveIndex(chapterIndex);
      preloadedSrcRef.current = null;
    },
    [activeIndex, chapterDurations, totalDurationSeconds]
  );

  const seekAggregateRef = useRef(seekAggregate);
  seekAggregateRef.current = seekAggregate;

  useEffect(() => {
    if (!seekRequest || seekRequest.key <= 0) return;
    if (initialChapterId) {
      setAutoplay(true);
      setForcedSeekTime(Math.max(0, seekRequest.seconds));
      setForcedSeekKey((key) => key + 1);
      return;
    }
    if (totalDurationSeconds <= 0) return;
    const ratio = Math.min(1, Math.max(0, seekRequest.seconds / totalDurationSeconds));
    seekAggregateRef.current(ratio);
  }, [initialChapterId, seekRequest, totalDurationSeconds]);

  const timeline = useMemo<LessonVideoTimeline | undefined>(() => {
    if (totalDurationSeconds <= 0) return undefined;
    return {
      currentTime: aggregateCurrent,
      duration: totalDurationSeconds,
      chapterMarkers,
      chapterSegments,
      bufferedRatio: aggregateBufferedRatio(
        activeIndex,
        chapterBufferedRatio,
        chapterDurations,
        totalDurationSeconds
      ),
      onSeekRatio: seekAggregate,
    };
  }, [
    activeIndex,
    aggregateCurrent,
    chapterBufferedRatio,
    chapterDurations,
    chapterMarkers,
    chapterSegments,
    seekAggregate,
    totalDurationSeconds,
  ]);

  const chapterMenu = useMemo<LessonVideoChapterMenu>(
    () => ({
      chapters: playableChapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        duration: chapter.duration,
      })),
      activeIndex,
      lessonId,
      onSelectChapter: (index: number) => {
        if (index < 0 || index >= playableChapters.length) return;
        const target = aggregateCurrentTime(index, 0, chapterDurations);
        setAutoplay(true);
        setAggregateCurrent(target);
        if (index === activeIndex) {
          setForcedSeekTime(0);
          setForcedSeekKey((key) => key + 1);
          return;
        }
        setChapterInitialTime(0);
        setActiveIndex(index);
        preloadedSrcRef.current = null;
      },
    }),
    [activeIndex, chapterDurations, lessonId, playableChapters]
  );

  function markActiveChapterComplete(durationSeconds: number) {
    if (durationSeconds > 0) {
      reportChapterWatchProgress(durationSeconds, durationSeconds);
    }
  }

  function handleChapterEnded(finishedDuration: number) {
    const effectiveDuration =
      finishedDuration > 0 ? finishedDuration : chapterDurations[activeIndex] ?? 0;
    markActiveChapterComplete(effectiveDuration);

    const nextIndex = activeIndex + 1;

    if (nextIndex >= playableChapters.length) {
      if (totalDurationSeconds > 0) {
        setAggregateCurrent(totalDurationSeconds);
        onWatchProgressRef.current?.(totalDurationSeconds, totalDurationSeconds);
      }
      onAllChaptersEndedRef.current?.();
      return;
    }

    const completedDuration =
      finishedDuration > 0 ? finishedDuration : chapterDurations[activeIndex] ?? 0;
    setAggregateCurrent(
      aggregateCurrentTime(activeIndex, completedDuration, chapterDurations)
    );
    setChapterInitialTime(0);
    setActiveIndex(nextIndex);
    setAutoplay(true);
    preloadedSrcRef.current = null;
  }

  if (playableChapters.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center bg-black p-6 text-sm text-slate-300">
        Chapter videos are not available as hosted files yet.
      </div>
    );
  }

  return (
    <div className="relative">
      {activeChapter ? (
        <LessonVideoPlayer
          key={`${positionKey}-${activeChapter.id}-${activeIndex}`}
          src={activeChapter.videoUrl}
          title={`${title} — ${activeChapter.title}`}
          className="aspect-video w-full bg-black"
          positionKey={`${positionKey}:chapter:${activeChapter.id}`}
          initialTime={chapterInitialTime}
          autoplay={autoplay}
          timeline={timeline}
          chapterMenu={chapterMenu}
          forcedSeekTime={forcedSeekTime}
          forcedSeekKey={forcedSeekKey}
          onWatchProgress={(current, duration) => {
            setChapterDurations((prev) => {
              const next = [...prev];
              if (duration > 0) next[activeIndex] = duration;
              return next;
            });
            if (duration > 0) {
              setChapterBufferedRatio(Math.min(1, current / duration));
            }
            reportAggregateProgress(current, duration);
            reportChapterWatchProgress(current, duration);
            if (
              nextChapter &&
              duration > 0 &&
              duration - current <= PRELOAD_BEFORE_END_SECONDS
            ) {
              preloadNextChapter(nextChapter.videoUrl);
            }
          }}
          onEnded={() => {
            const duration = chapterDurations[activeIndex] ?? 0;
            handleChapterEnded(duration);
          }}
        />
      ) : null}
      {handoff}
      <video
        ref={preloadRef}
        preload="auto"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-hidden
        muted
        playsInline
      />
    </div>
  );
}
