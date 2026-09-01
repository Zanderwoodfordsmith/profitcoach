"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Element } from "hast";
import { X, ZoomIn } from "lucide-react";

type ImgProps = ComponentPropsWithoutRef<"img"> & { node?: Element };

/**
 * Lesson markdown images: click (or Enter/Space) opens a full-viewport lightbox
 * so dense diagrams stay readable beyond the guide column width.
 */
export function ExpandableAcademyImage({
  src,
  alt = "",
  className,
  node: _node,
  ...rest
}: ImgProps) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <span className="group relative my-5 block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...rest}
          src={src}
          alt={alt}
          className={[
            "my-0 max-w-full cursor-zoom-in rounded-xl outline-offset-2 transition-[outline-color] group-hover:outline group-hover:outline-2 group-hover:outline-slate-400/55 group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-slate-400/55",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          role="button"
          tabIndex={0}
          aria-label={alt ? `Expand image: ${alt}` : "Expand image"}
          onClick={() => setOpen(true)}
          onKeyDown={(event: KeyboardEvent<HTMLImageElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
        <span
          className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden
        >
          <ZoomIn className="h-3 w-3" strokeWidth={2} />
          Expand
        </span>
      </span>
      {open ? (
        <AcademyImageLightbox
          src={String(src)}
          alt={alt}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function AcademyImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const onKey = useCallback(
    (event: globalThis.KeyboardEvent) => {
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
      role="presentation"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-[201] rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 transition hover:bg-white/20"
        aria-label="Close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>
      <div
        className="flex max-h-[min(94dvh,94vh)] max-w-[min(96dvw,96vw)] items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className="h-auto max-h-[min(94dvh,94vh)] w-auto max-w-[min(96dvw,96vw)] object-contain shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}
