"use client";

import { useMemo, useState } from "react";
import {
  feedBodyNeedsTruncation,
  postBodyNeedsTruncation,
} from "@/lib/communityPostBodyTruncation";

type Props = {
  text: string;
  className?: string;
  /**
   * `feed` — short preview like community PostCard (~2 lines, blank lines collapsed).
   * `modal` — longer clamp like the community post detail modal (~9 lines).
   */
  variant?: "feed" | "modal";
};

const BASE_TEXT =
  "text-[15px] leading-relaxed break-words text-slate-700";

/** Soft word-boundary cut so “… See more” can sit inline after the preview. */
function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut =
    lastSpace > maxChars * 0.55 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd();
}

/**
 * Truncate long plain text like community post bodies: line-clamp + fade + See more.
 */
export function SeeMoreText({
  text,
  className,
  variant = "modal",
}: Props) {
  const trimmed = text.trim();
  /** Feed cards collapse runs of whitespace the same way as community PostCard. */
  const previewText =
    variant === "feed" ? trimmed.replace(/\s+/g, " ").trim() : trimmed;
  const needsTruncation = useMemo(
    () =>
      variant === "feed"
        ? feedBodyNeedsTruncation(previewText)
        : postBodyNeedsTruncation(trimmed),
    [previewText, trimmed, variant]
  );
  const [expanded, setExpanded] = useState(false);

  if (!trimmed) return null;

  const collapsedClassName =
    className ??
    `${BASE_TEXT} ${
      variant === "feed" ? "whitespace-normal" : "whitespace-pre-wrap"
    }`;
  const expandedClassName =
    className ?? `${BASE_TEXT} whitespace-pre-wrap`;

  const seeMoreButton = (
    <button
      type="button"
      className="inline font-medium text-sky-600 hover:text-sky-500 hover:underline"
      onClick={() => setExpanded(true)}
    >
      <span className="text-slate-400" aria-hidden>
        …
      </span>{" "}
      See more
    </button>
  );

  if (expanded) {
    return (
      <div>
        <p className={expandedClassName}>{trimmed}</p>
        <button
          type="button"
          className="mt-1 font-medium text-sky-600 hover:text-sky-500 hover:underline"
          onClick={() => setExpanded(false)}
        >
          See less
        </button>
      </div>
    );
  }

  if (!needsTruncation) {
    return (
      <p className={collapsedClassName}>
        {variant === "feed" ? previewText : trimmed}
      </p>
    );
  }

  // Feed: text flows into an inline “… See more” (no orphaned link row / double ellipsis).
  if (variant === "feed") {
    return (
      <p className={collapsedClassName}>
        {truncateAtWord(previewText, 140)} {seeMoreButton}
      </p>
    );
  }

  return (
    <div>
      <div className="relative">
        <p
          className={`${collapsedClassName} line-clamp-9 overflow-hidden`}
        >
          {trimmed}
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/90 to-transparent"
        />
      </div>
      <button
        type="button"
        className="mt-1 inline-flex items-baseline gap-0.5 font-medium text-sky-600 hover:text-sky-500 hover:underline"
        onClick={() => setExpanded(true)}
      >
        <span className="text-slate-400" aria-hidden>
          …
        </span>
        See more
      </button>
    </div>
  );
}
