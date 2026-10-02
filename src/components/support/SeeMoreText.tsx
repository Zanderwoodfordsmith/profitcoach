"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SupportMessageBody } from "@/components/support/SupportMessageBody";
import "./supportOpeningScroll.css";
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
  /** Controlled expand state. Omit to keep it inside this component. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Parent renders See less when the control should sit outside a scroll area. */
  showSeeLess?: boolean;
};

const BASE_TEXT =
  "min-w-0 text-[15px] leading-relaxed break-words [overflow-wrap:anywhere] text-slate-700";

/**
 * Opening message on a support ticket. Twice the old 12rem cap.
 * The box stays as short as the content; it scrolls only when the body
 * is taller than this, with a bar that stays visible.
 */
const supportOpeningScrollClassName =
  "max-h-[min(50vh,24rem)] overflow-y-auto overscroll-contain";

/** Classic bar (not the overlay that fades) so a long message looks scrollable. */
const supportOpeningScrollbarClassName = "support-opening-scroll";

const seeLessButtonClassName =
  "mt-1 font-medium text-sky-600 hover:text-sky-500 hover:underline";

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
  expanded: expandedProp,
  onExpandedChange,
  showSeeLess = true,
}: Props) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false);
  const expanded = expandedProp ?? uncontrolledExpanded;
  const setExpanded = (next: boolean) => {
    onExpandedChange?.(next);
    if (expandedProp === undefined) setUncontrolledExpanded(next);
  };
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
        <SupportMessageBody body={trimmed} className={expandedClassName} />
        {showSeeLess ? (
          <button
            type="button"
            className={seeLessButtonClassName}
            onClick={() => setExpanded(false)}
          >
            See less
          </button>
        ) : null}
      </div>
    );
  }

  if (!needsTruncation) {
    return (
      <SupportMessageBody
        body={variant === "feed" ? previewText : trimmed}
        className={collapsedClassName}
      />
    );
  }

  // Feed: text flows into an inline “… See more” (no orphaned link row / double ellipsis).
  if (variant === "feed") {
    return (
      <p className={collapsedClassName}>
        <SupportMessageBody
          as="span"
          body={truncateAtWord(previewText, 140)}
          className=""
        />{" "}
        {seeMoreButton}
      </p>
    );
  }

  return (
    <div>
      <div className="relative">
        <SupportMessageBody
          body={trimmed}
          className={`${collapsedClassName} line-clamp-9 overflow-hidden`}
        />
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

/**
 * Ticket opening body for the coach inbox and the admin inbox.
 * See more grows the message to about twice the old height. If it is still
 * longer, this region scrolls and the bar stays visible. See less sits
 * under the region so it stays clickable.
 */
export function SupportOpeningBody({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const trimmed = text.trim();

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const measure = () => {
      setOverflows(scroller.scrollHeight > scroller.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(content);
    return () => observer.disconnect();
  }, [expanded, trimmed]);

  if (!trimmed && !children) return null;

  return (
    <div className="mt-1.5">
      <div
        ref={scrollerRef}
        className={
          overflows
            ? `${supportOpeningScrollClassName} ${supportOpeningScrollbarClassName}`
            : supportOpeningScrollClassName
        }
      >
        <div ref={contentRef}>
          {trimmed ? (
            <SeeMoreText
              text={text}
              variant="feed"
              expanded={expanded}
              onExpandedChange={setExpanded}
              showSeeLess={false}
            />
          ) : null}
          {children}
        </div>
      </div>
      {expanded ? (
        <button
          type="button"
          className={seeLessButtonClassName}
          onClick={() => setExpanded(false)}
        >
          See less
        </button>
      ) : null}
    </div>
  );
}
