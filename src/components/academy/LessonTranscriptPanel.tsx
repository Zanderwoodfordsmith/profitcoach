"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";

import type { LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import {
  buildTranscriptItemsFromChapters,
  parseTranscriptItems,
  type TranscriptItem,
} from "@/lib/academy/transcriptCues";
import { significantQueryTokens } from "@/lib/search/types";
import { cardClass } from "@/components/ui/Card";

type Props = {
  transcriptText: string;
  /** When set, prefer per-chapter transcripts with bold chapter headings. */
  videoChapters?: LessonVideoChapter[];
  /** Seek the lesson media to this time (seconds). */
  onSeekToSeconds?: (seconds: number) => void;
  /** Searched words to mark in the text (from a global search hit). */
  highlightQuery?: string | null;
  /** Scroll to the first marked words said at or after this time (seconds). */
  anchorSeconds?: number | null;
  className?: string;
};

function TimeLink({
  seconds,
  label,
  onSeek,
}: {
  seconds: number;
  label: string;
  onSeek?: (seconds: number) => void;
}) {
  if (onSeek) {
    return (
      <button
        type="button"
        onClick={() => onSeek(seconds)}
        className="text-left font-medium tabular-nums leading-relaxed text-sky-700 hover:text-sky-900 hover:underline"
        aria-label={`Jump to ${label}`}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="font-medium tabular-nums leading-relaxed text-sky-700">
      {label}
    </span>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The whole phrase first, then each meaningful word, so "elephant" marks "elephant's" too. */
function highlightPattern(query: string | null | undefined): RegExp | null {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return null;
  const words = q.split(/\s+/).filter(Boolean);
  const tokens = significantQueryTokens(q);
  const parts = [
    ...(words.length > 1 ? [q] : []),
    ...(tokens.length > 0 ? tokens : words.filter((w) => w.length >= 2)),
  ];
  if (parts.length === 0) return null;
  const unique = [...new Set(parts)].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(?:${unique.map(escapeRegExp).join("|")})`, "gi");
}

function markMatches(text: string, pattern: RegExp | null): ReactNode {
  if (!pattern) return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <mark
        key={start}
        data-hit=""
        className="rounded-sm bg-amber-200 px-0.5 text-amber-950"
      >
        {m[0]}
      </mark>
    );
    last = start + m[0].length;
  }
  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Lesson transcript with speaker labels removed and clickable timestamps.
 */
export function LessonTranscriptPanel({
  transcriptText,
  videoChapters,
  onSeekToSeconds,
  highlightQuery = null,
  anchorSeconds = null,
  className = cardClass("soft", "max-h-[min(48rem,70vh)] overflow-y-auto px-5 pb-4 pt-5"),
}: Props) {
  const items = useMemo<TranscriptItem[]>(() => {
    const fromChapters = buildTranscriptItemsFromChapters(videoChapters);
    if (fromChapters.length > 0) return fromChapters;
    return parseTranscriptItems(transcriptText);
  }, [transcriptText, videoChapters]);

  const pattern = useMemo(() => highlightPattern(highlightQuery), [highlightQuery]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrolledForRef = useRef<string | null>(null);

  // Bring the first marked words into view inside the panel (the page stays
  // on the video). Once per search, so the reader can scroll freely after.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !pattern || !highlightQuery) return;
    const key = `${highlightQuery}@${anchorSeconds ?? ""}`;
    if (scrolledForRef.current === key) return;
    const marks = [...root.querySelectorAll<HTMLElement>("mark[data-hit]")];
    if (marks.length === 0) return;
    const target =
      anchorSeconds == null
        ? marks[0]
        : (marks.find((m) => {
            const row = m.closest<HTMLElement>("[data-seconds]");
            return row ? Number(row.dataset.seconds) >= anchorSeconds : false;
          }) ?? marks[0]);
    scrolledForRef.current = key;
    const rootRect = root.getBoundingClientRect();
    const markRect = target.getBoundingClientRect();
    root.scrollTop += markRect.top - rootRect.top - rootRect.height / 2;
  }, [anchorSeconds, highlightQuery, items, pattern]);

  if (items.length === 0) {
    const trimmed = transcriptText.trim();
    if (!trimmed) return null;
    return (
      <pre
        className={`${className} whitespace-pre-wrap font-sans text-read leading-relaxed text-slate-700`}
      >
        {trimmed}
      </pre>
    );
  }

  return (
    <div ref={rootRef} className={className}>
      <ul className="space-y-4 font-sans text-read text-slate-700">
        {items.map((item, index) => {
          if (item.type === "chapter") {
            return (
              <li
                key={`chapter-${item.title}-${index}`}
                className={index === 0 ? "" : "pt-2"}
              >
                <p className="font-semibold leading-snug text-slate-900">
                  {item.title}
                </p>
              </li>
            );
          }

          return (
            <li
              key={`cue-${item.seconds}-${index}`}
              data-seconds={item.seconds}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3"
            >
              <TimeLink
                seconds={item.seconds}
                label={item.label}
                onSeek={onSeekToSeconds}
              />
              <p className="min-w-0 whitespace-pre-wrap leading-relaxed">
                {markMatches(item.text, pattern)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
