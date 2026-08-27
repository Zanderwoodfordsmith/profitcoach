"use client";

import { useMemo } from "react";

import type { LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import {
  buildTranscriptItemsFromChapters,
  parseTranscriptItems,
  type TranscriptItem,
} from "@/lib/academy/transcriptCues";

type Props = {
  transcriptText: string;
  /** When set, prefer per-chapter transcripts with bold chapter headings. */
  videoChapters?: LessonVideoChapter[];
  /** Seek the lesson media to this time (seconds). */
  onSeekToSeconds?: (seconds: number) => void;
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

/**
 * Lesson transcript with speaker labels removed and clickable timestamps.
 */
export function LessonTranscriptPanel({
  transcriptText,
  videoChapters,
  onSeekToSeconds,
  className = "max-h-[min(48rem,70vh)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-5 pb-4 pt-5",
}: Props) {
  const items = useMemo<TranscriptItem[]>(() => {
    const fromChapters = buildTranscriptItemsFromChapters(videoChapters);
    if (fromChapters.length > 0) return fromChapters;
    return parseTranscriptItems(transcriptText);
  }, [transcriptText, videoChapters]);

  if (items.length === 0) {
    const trimmed = transcriptText.trim();
    if (!trimmed) return null;
    return (
      <pre
        className={`${className} whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-700`}
      >
        {trimmed}
      </pre>
    );
  }

  return (
    <div className={className}>
      <ul className="space-y-4 font-sans text-[15px] text-slate-700">
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
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3"
            >
              <TimeLink
                seconds={item.seconds}
                label={item.label}
                onSeek={onSeekToSeconds}
              />
              <p className="min-w-0 whitespace-pre-wrap leading-relaxed">
                {item.text}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
