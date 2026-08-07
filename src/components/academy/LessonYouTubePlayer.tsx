"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  videoId: string;
  title?: string;
  className?: string;
  onWatchProgress?: (currentTimeSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
};

type YtPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
};

type YtNamespace = {
  Player: new (
    elementId: string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YtPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
    if (window.YT?.Player) resolve();
  });

  return youtubeApiPromise;
}

/**
 * YouTube embed with JS API progress callbacks for lesson auto-complete.
 * Vimeo stays on a plain iframe (no progress API wired yet).
 */
export function LessonYouTubePlayer({
  videoId,
  title,
  className = "absolute inset-0 h-full w-full",
  onWatchProgress,
  onEnded,
}: Props) {
  const reactId = useId();
  const elementId = `yt-lesson-${reactId.replace(/:/g, "")}`;
  const playerRef = useRef<YtPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const onWatchProgressRef = useRef(onWatchProgress);
  onWatchProgressRef.current = onWatchProgress;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;

    function clearPoll() {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    function reportFromPlayer(player: YtPlayer) {
      const duration = player.getDuration();
      const current = player.getCurrentTime();
      if (Number.isFinite(duration) && duration > 0 && Number.isFinite(current)) {
        onWatchProgressRef.current?.(current, duration);
      }
    }

    function startPoll(player: YtPlayer) {
      clearPoll();
      pollRef.current = window.setInterval(() => {
        reportFromPlayer(player);
      }, 1000);
    }

    async function mount() {
      await loadYouTubeIframeApi();
      if (cancelled || !window.YT?.Player) return;

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            const player = playerRef.current;
            if (!player || cancelled) return;
            reportFromPlayer(player);
          },
          onStateChange: (event) => {
            const player = playerRef.current;
            if (!player || cancelled || !window.YT) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              startPoll(player);
            } else {
              clearPoll();
              reportFromPlayer(player);
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              const duration = player.getDuration();
              if (Number.isFinite(duration) && duration > 0) {
                onWatchProgressRef.current?.(duration, duration);
              }
              onEndedRef.current?.();
            }
          },
        },
      });
    }

    void mount();

    return () => {
      cancelled = true;
      clearPoll();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [elementId, videoId]);

  return (
    <div className="relative aspect-video w-full bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full">
      <div id={elementId} title={title} className={className} />
    </div>
  );
}
