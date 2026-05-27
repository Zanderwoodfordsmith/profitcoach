"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import type { CommunityPostMediaItem } from "@/lib/communityPostMedia";
import { inferCommunityPostMediaKindFromUrl } from "@/lib/communityPostMedia";

function isVideoItem(item: CommunityPostMediaItem): boolean {
  return (
    item.kind === "video" ||
    inferCommunityPostMediaKindFromUrl(item.url) === "video"
  );
}

export function communityPostMediaSlotClass(index: number, total: number): string {
  if (total <= 1) return "min-w-0 flex-1";
  if (total === 2) return index === 0 ? "min-w-0 flex-[1.65]" : "min-w-0 flex-1";
  return "min-w-0 flex-1";
}

type ThumbProps = {
  item: CommunityPostMediaItem;
  className?: string;
  playIconSize?: "sm" | "md";
  /** Feed preview: show "+N" when more items exist beyond this thumb. */
  extraCount?: number;
};

export function CommunityPostMediaThumb({
  item,
  className = "",
  playIconSize = "md",
  extraCount = 0,
}: ThumbProps) {
  const video = isVideoItem(item);
  const playClass =
    playIconSize === "sm"
      ? "h-7 w-7 rounded-md"
      : "h-9 w-9 rounded-lg";
  const playIconClass = playIconSize === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 ${className}`}
    >
      {video ? (
        <video
          src={item.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      )}
      {video && extraCount <= 0 ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span
            className={`flex items-center justify-center bg-black/50 text-white shadow-sm ${playClass}`}
          >
            <Play className={`fill-white ${playIconClass}`} strokeWidth={0} />
          </span>
        </span>
      ) : null}
      {extraCount > 0 ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/45"
          aria-hidden
        >
          <span className="text-base font-semibold tabular-nums text-white">
            +{extraCount}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function CommunityPostMediaLightbox({
  item,
  onClose,
}: {
  item: CommunityPostMediaItem;
  onClose: () => void;
}) {
  const video = isVideoItem(item);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onKey]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-[201] rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 transition hover:bg-white/20"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
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
            src={item.url}
            className="max-h-[min(90dvh,90vh)] max-w-[min(90dvw,90vw)] rounded-lg shadow-2xl"
            controls
            playsInline
            autoPlay
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-auto max-h-[min(90dvh,90vh)] w-auto max-w-[min(90dvw,90vw)] object-contain shadow-2xl"
          />
        )}
      </div>
    </div>,
    document.body
  );
}

type GalleryProps = {
  items: CommunityPostMediaItem[];
};

/** Horizontal media row for post detail (Skool-style: smaller, side-by-side). */
export function CommunityPostMediaGallery({ items }: GalleryProps) {
  const [lightboxItem, setLightboxItem] = useState<CommunityPostMediaItem | null>(
    null
  );

  if (items.length === 0) return null;

  const rowHeight =
    items.length === 1 ? "h-[min(200px,36vh)]" : "h-[128px]";

  return (
    <>
      <div className={`flex gap-2 ${rowHeight}`}>
        {items.map((item, index) => (
          <button
            key={`${item.url}-${index}`}
            type="button"
            className={`relative h-full overflow-hidden rounded-xl text-left transition hover:opacity-95 ${communityPostMediaSlotClass(index, items.length)}`}
            aria-label={isVideoItem(item) ? "Play video" : "Open image larger"}
            onClick={() => setLightboxItem(item)}
          >
            <CommunityPostMediaThumb item={item} className="h-full" />
          </button>
        ))}
      </div>
      {lightboxItem ? (
        <CommunityPostMediaLightbox
          item={lightboxItem}
          onClose={() => setLightboxItem(null)}
        />
      ) : null}
    </>
  );
}
