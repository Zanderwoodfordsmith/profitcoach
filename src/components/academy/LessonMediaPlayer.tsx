"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { LessonAudioSurface } from "@/components/academy/LessonAudioSurface";
import { LessonChapterPlayer } from "@/components/academy/LessonChapterPlayer";
import {
  LessonMediaModeToggle,
  type LessonMediaMode,
} from "@/components/academy/LessonMediaModeToggle";
import { LessonVideoPlayer } from "@/components/academy/LessonVideoPlayer";
import { LessonYouTubePlayer } from "@/components/academy/LessonYouTubePlayer";
import { lessonPlaybackKey, storePlaybackPosition } from "@/lib/academy/lessonPlaybackPosition";
import type { LessonSeekRequest } from "@/lib/academy/lessonSeekRequest";
import { lessonHasVideoChapters, type LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { parseLessonVideoEmbed } from "@/lib/videoEmbed";

export type { LessonSeekRequest };

type Props = {
  courseId: string;
  lessonId: string;
  title: string;
  videoUrl?: string | null;
  videoChapters?: LessonVideoChapter[];
  audioUrl?: string | null;
  onWatchProgress?: (currentTimeSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  initialChapterId?: string | null;
  /** When true, show the end-of-video handoff overlay above the watch surface. */
  handoff?: ReactNode;
  /** Seek the active media to this time when key changes. */
  seekRequest?: LessonSeekRequest | null;
};

/**
 * One media frame that swaps Watch ↔ Listen when lesson audio is available.
 */
export function LessonMediaPlayer({
  courseId,
  lessonId,
  title,
  videoUrl = null,
  videoChapters = [],
  audioUrl = null,
  onWatchProgress,
  onEnded,
  initialChapterId = null,
  handoff,
  seekRequest = null,
}: Props) {
  const trimmedAudio = audioUrl?.trim() || null;
  const trimmedVideo = videoUrl?.trim() || null;
  const hasChapterPlayback = lessonHasVideoChapters(videoChapters);
  const hasAudio = Boolean(trimmedAudio);
  const hasVideo = hasChapterPlayback || Boolean(trimmedVideo);

  const positionKey = lessonPlaybackKey(courseId, lessonId);
  const videoEmbed = trimmedVideo ? parseLessonVideoEmbed(trimmedVideo) : null;
  const directVideoUrl =
    trimmedVideo && !videoEmbed && isDirectVideoFileUrl(trimmedVideo)
      ? trimmedVideo
      : null;

  const [mode, setMode] = useState<LessonMediaMode>(
    hasVideo ? "watch" : "listen"
  );
  const [carryTime, setCarryTime] = useState(0);
  const [flipNonce, setFlipNonce] = useState(0);
  const [autoplayAfterFlip, setAutoplayAfterFlip] = useState(false);
  const liveTimeRef = useRef(0);

  useEffect(() => {
    setMode(hasVideo ? "watch" : "listen");
    setCarryTime(0);
    setAutoplayAfterFlip(false);
    liveTimeRef.current = 0;
  }, [courseId, lessonId, hasVideo]);

  function handleModeChange(next: LessonMediaMode) {
    if (!hasAudio && next === "listen") return;
    if (!hasVideo && next === "watch") return;
    if (next === mode) return;
    const t = liveTimeRef.current;
    if (t > 0) storePlaybackPosition(positionKey, t);
    setCarryTime(t);
    setAutoplayAfterFlip(true);
    setFlipNonce((n) => n + 1);
    setMode(next);
  }

  function onTimeChange(seconds: number) {
    liveTimeRef.current = seconds;
  }

  const modeToggle = hasAudio && hasVideo ? handleModeChange : undefined;

  // Audio-only lesson
  if (!hasVideo && trimmedAudio) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-slate-950">
        <LessonAudioSurface
          key={`${lessonId}-audio-only`}
          src={trimmedAudio}
          title={title}
          positionKey={positionKey}
          onWatchProgress={onWatchProgress}
          onEnded={onEnded}
          onTimeChange={onTimeChange}
          forcedSeekTime={seekRequest?.seconds ?? null}
          forcedSeekKey={seekRequest?.key ?? 0}
        />
      </div>
    );
  }

  if (!hasVideo) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-slate-950">
        <div className="flex aspect-video items-center justify-center p-6 text-sm text-slate-300">
          No media for this lesson yet.
        </div>
      </div>
    );
  }

  if (mode === "listen" && trimmedAudio) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-slate-950">
        <LessonAudioSurface
          key={`${lessonId}-listen-${flipNonce}`}
          src={trimmedAudio}
          title={title}
          positionKey={positionKey}
          initialTime={carryTime}
          autoplay={autoplayAfterFlip}
          onWatchProgress={onWatchProgress}
          onEnded={onEnded}
          onTimeChange={onTimeChange}
          onModeChange={modeToggle}
          forcedSeekTime={seekRequest?.seconds ?? null}
          forcedSeekKey={seekRequest?.key ?? 0}
        />
      </div>
    );
  }

  // Watch mode — multi-chapter main path
  if (hasChapterPlayback) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-slate-950">
        <LessonChapterPlayer
          chapters={videoChapters}
          title={title}
          positionKey={positionKey}
          lessonId={lessonId}
          initialChapterId={initialChapterId}
          onWatchProgress={onWatchProgress}
          onAllChaptersEnded={onEnded}
          handoff={handoff}
          seekRequest={seekRequest}
        />
      </div>
    );
  }

  // Watch mode — single video
  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-950">
      {videoEmbed?.kind === "youtube" ? (
        <>
          <div className="relative aspect-video w-full">
            <LessonYouTubePlayer
              videoId={videoEmbed.videoId}
              title={title}
              onWatchProgress={onWatchProgress}
              onEnded={onEnded}
            />
            {handoff}
          </div>
          {hasAudio ? (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[var(--brand-chathams)]/80 px-3 py-2">
              <p className="text-[11px] font-medium text-white/70">
                Prefer audio? Switch anytime.
              </p>
              <LessonMediaModeToggle
                mode="watch"
                onModeChange={handleModeChange}
                compact
              />
            </div>
          ) : null}
        </>
      ) : videoEmbed ? (
        <>
          <div className="relative aspect-video w-full">
            <iframe
              title={title}
              src={videoEmbed.embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            {handoff}
          </div>
          {hasAudio ? (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[var(--brand-chathams)]/80 px-3 py-2">
              <p className="text-[11px] font-medium text-white/70">
                Prefer audio? Switch anytime.
              </p>
              <LessonMediaModeToggle
                mode="watch"
                onModeChange={handleModeChange}
                compact
              />
            </div>
          ) : null}
        </>
      ) : directVideoUrl ? (
        <>
          <LessonVideoPlayer
            key={`${lessonId}-watch-${flipNonce}`}
            src={directVideoUrl}
            title={title}
            className="aspect-video w-full bg-black"
            positionKey={positionKey}
            initialTime={carryTime}
            autoplay={autoplayAfterFlip}
            onWatchProgress={onWatchProgress}
            onEnded={onEnded}
            onTimeChange={onTimeChange}
            onModeChange={modeToggle}
            forcedSeekTime={seekRequest?.seconds ?? null}
            forcedSeekKey={seekRequest?.key ?? 0}
          />
          {handoff}
        </>
      ) : (
        <div className="p-6 text-sm text-slate-300">
          <p>Video URL is set but is not a recognized embed or video file.</p>
          {trimmedVideo ? (
            <a
              href={trimmedVideo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sky-400 underline"
            >
              Open video
            </a>
          ) : null}
          {hasAudio ? (
            <div className="mt-4">
              <LessonMediaModeToggle
                mode="watch"
                onModeChange={handleModeChange}
                compact
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
