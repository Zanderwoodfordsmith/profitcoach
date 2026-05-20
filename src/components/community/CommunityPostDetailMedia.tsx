"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import type { CommunityPostMediaKind } from "@/lib/communityPostMedia";
import { inferCommunityPostMediaKindFromUrl } from "@/lib/communityPostMedia";

type Props = {
  url: string;
  /** When set, overrides URL-based detection (e.g. from stored `media` JSON). */
  kind?: CommunityPostMediaKind;
};

function PlayOverlay({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <button
        type="button"
        className="pointer-events-auto flex h-12 w-[4.5rem] items-center justify-center rounded-lg bg-black/50 pl-1 text-white shadow-md transition hover:bg-black/60"
        aria-label="Play video"
        onClick={onClick}
      >
        <Play className="h-6 w-6 fill-white" strokeWidth={0} />
      </button>
    </div>
  );
}

/**
 * Full-width media under the post body in the detail modal: capped preview height,
 * opens a dark lightbox on click (large media fills up to the viewport; small stays small).
 */
export function CommunityPostDetailMedia({ url, kind: kindProp }: Props) {
  const [lightbox, setLightbox] = useState(false);
  /** Center play affordance — hidden while playing or scrubbing the timeline. */
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekingRef = useRef(false);
  const video =
    kindProp === "video" ||
    (kindProp !== "image" && inferCommunityPostMediaKindFromUrl(url) === "video");

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setLightbox(false);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, onKey]);

  const handlePlayClick = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    void el.play();
  }, []);

  const lightboxNode =
    lightbox && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 p-4 backdrop-blur-[2px]"
            role="presentation"
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-[201] rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 transition hover:bg-white/20"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(false);
              }}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            <div
              className="flex max-h-[min(90dvh,90vh)] max-w-[min(90dvw,90vw)] items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {video ? (
                <video
                  src={url}
                  className="max-h-[min(90dvh,90vh)] max-w-[min(90dvw,90vw)] rounded-lg shadow-2xl"
                  controls
                  playsInline
                  autoPlay
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="max-h-[min(90dvh,90vh)] max-w-[min(90dvw,90vw)] h-auto w-auto object-contain shadow-2xl"
                />
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  if (video) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
        <div className="flex max-h-[min(360px,52vh)] min-h-[120px] w-full items-center justify-center">
          <video
            ref={videoRef}
            src={url}
            className="max-h-[min(360px,52vh)] w-full object-contain"
            playsInline
            preload="metadata"
            controls
            onPlay={() => setShowPlayOverlay(false)}
            onPause={() => {
              if (!seekingRef.current) setShowPlayOverlay(true);
            }}
            onSeeking={() => {
              seekingRef.current = true;
              setShowPlayOverlay(false);
            }}
            onSeeked={() => {
              seekingRef.current = false;
              setShowPlayOverlay(Boolean(videoRef.current?.paused));
            }}
            onEnded={() => setShowPlayOverlay(true)}
          />
        </div>
        {showPlayOverlay ? <PlayOverlay onClick={handlePlayClick} /> : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="group relative w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80"
        aria-label="Open image larger"
        onClick={() => setLightbox(true)}
      >
        <div className="flex max-h-[min(360px,52vh)] min-h-[120px] w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-[min(360px,52vh)] w-full object-contain transition group-hover:opacity-95"
          />
        </div>
        <span className="pointer-events-none absolute inset-0 ring-inset ring-transparent transition group-hover:bg-black/[0.03]" />
      </button>
      {lightboxNode}
    </>
  );
}
