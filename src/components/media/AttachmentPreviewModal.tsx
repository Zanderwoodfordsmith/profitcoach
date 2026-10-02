"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type PreviewKind = "image" | "video";

export function AttachmentPreviewModal({
  url,
  kind,
  onClose,
}: {
  url: string;
  kind: PreviewKind;
  onClose: () => void;
}) {
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
      role="dialog"
      aria-modal="true"
      aria-label={kind === "video" ? "Video preview" : "Image preview"}
      onClick={onClose}
    >
      <button
        type="button"
        autoFocus
        className="absolute right-4 top-4 z-[201] rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 transition hover:bg-white/20"
        aria-label="Close preview"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>
      <div
        className="flex max-h-[min(90dvh,90vh)] max-w-[min(90dvw,90vw)] items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={url}
            className="max-h-[min(90dvh,90vh)] max-w-[min(90dvw,90vw)] rounded-lg shadow-2xl"
            controls
            autoPlay
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-auto max-h-[min(90dvh,90vh)] w-auto max-w-[min(90dvw,90vw)] object-contain shadow-2xl"
          />
        )}
      </div>
    </div>,
    document.body
  );
}

/** Thumbnail that opens a full preview. Closing it leaves the attachment in place. */
export function PreviewableMedia({
  url,
  kind,
  className = "",
  mediaClassName = "",
}: {
  url: string;
  kind: PreviewKind;
  className?: string;
  mediaClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cursor-zoom-in ${className}`}
        aria-label={kind === "video" ? "Preview video" : "Preview image"}
      >
        {kind === "video" ? (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className={mediaClassName}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={mediaClassName} />
        )}
      </button>
      {open ? (
        <AttachmentPreviewModal
          url={url}
          kind={kind}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
