/**
 * Parse academy lesson transcripts into timed cues for display + seek.
 */

import type { LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import { stripTranscriptSpeakerLabels } from "@/lib/academy/stripTranscriptSpeakerLabels";

export type TranscriptCue = {
  /** Absolute seconds from the start of the lesson recording. */
  seconds: number;
  /** Display label, e.g. "1:23" or "1:02:03". */
  label: string;
  text: string;
};

export type TranscriptItem =
  | { type: "chapter"; title: string; seconds: number }
  | ({ type: "cue" } & TranscriptCue);

/** Match [mm:ss], [hh:mm:ss], or bare mm:ss / hh:mm:ss on its own line. */
const TIMESTAMP_LINE_RE =
  /^\s*\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*:?\s*$/;

/** Leading bracket timestamp on a dialogue line: [00:01:23] text… */
const TIMESTAMP_PREFIX_RE =
  /^\s*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*:?\s*/;

/** Chapter title lines emitted by buildLessonTranscriptFromChapters. */
const CHAPTER_HEADING_RE = /^\s*##\s+(.+?)\s*$/;

export function formatTranscriptClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function parseTimestampParts(a: string, b: string, c: string | undefined): number {
  if (c != null) return Number(a) * 3600 + Number(b) * 60 + Number(c);
  return Number(a) * 60 + Number(b);
}

function parseDurationLabelSeconds(label: string | null | undefined): number {
  if (!label) return 0;
  const t = label.trim().toLowerCase();
  let total = 0;
  const h = t.match(/(\d+)\s*h/);
  const m = t.match(/(\d+)\s*m/);
  if (h) total += Number(h[1]) * 3600;
  if (m) total += Number(m[1]) * 60;
  if (!h && !m) {
    const plain = t.match(/^(\d+)$/);
    if (plain) total += Number(plain[1]) * 60;
  }
  return total;
}

function maxCueSeconds(cues: TranscriptCue[]): number {
  let max = 0;
  for (const cue of cues) {
    if (cue.seconds > max) max = cue.seconds;
  }
  return max;
}

/**
 * Split transcript text into cues. Speaker labels are stripped first.
 * Timestamps may be on their own line or leading a dialogue line.
 * Optional `## Chapter title` lines become chapter headings.
 */
export function parseTranscriptItems(raw: string): TranscriptItem[] {
  const cleaned = stripTranscriptSpeakerLabels(raw);
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/);
  const items: TranscriptItem[] = [];
  let pendingSeconds: number | null = null;
  let pendingParts: string[] = [];

  function flush() {
    if (pendingSeconds == null) return;
    const text = pendingParts.join("\n").trim();
    if (text) {
      items.push({
        type: "cue",
        seconds: pendingSeconds,
        label: formatTranscriptClock(pendingSeconds),
        text,
      });
    }
    pendingSeconds = null;
    pendingParts = [];
  }

  for (const line of lines) {
    const heading = line.match(CHAPTER_HEADING_RE);
    if (heading) {
      flush();
      const title = heading[1].trim();
      if (title) {
        let seconds = 0;
        for (const item of items) {
          if (item.type === "cue" && item.seconds > seconds) seconds = item.seconds;
          if (item.type === "chapter" && item.seconds > seconds) seconds = item.seconds;
        }
        items.push({ type: "chapter", title, seconds });
      }
      continue;
    }

    const tsOnly = line.match(TIMESTAMP_LINE_RE);
    if (tsOnly) {
      flush();
      pendingSeconds = parseTimestampParts(tsOnly[1], tsOnly[2], tsOnly[3]);
      continue;
    }

    const tsPrefix = line.match(TIMESTAMP_PREFIX_RE);
    if (tsPrefix) {
      const rest = line.slice(tsPrefix[0].length);
      flush();
      pendingSeconds = parseTimestampParts(tsPrefix[1], tsPrefix[2], tsPrefix[3]);
      if (rest.trim()) pendingParts.push(rest.trimEnd());
      continue;
    }

    if (pendingSeconds == null) {
      if (!line.trim()) continue;
      pendingSeconds = 0;
      pendingParts.push(line);
      continue;
    }

    pendingParts.push(line);
  }

  flush();
  return items;
}

/** @deprecated Prefer parseTranscriptItems — kept for simple cue-only callers. */
export function parseTranscriptCues(raw: string): TranscriptCue[] {
  return parseTranscriptItems(raw)
    .filter((item): item is Extract<TranscriptItem, { type: "cue" }> => item.type === "cue")
    .map(({ seconds, label, text }) => ({ seconds, label, text }));
}

/**
 * Build timed transcript items from chaptered lessons, with bold-ready
 * chapter headings and timestamps stacked across the full lesson.
 */
export function buildTranscriptItemsFromChapters(
  chapters: LessonVideoChapter[] | undefined
): TranscriptItem[] {
  if (!chapters?.length) return [];

  const items: TranscriptItem[] = [];
  let offsetSeconds = 0;
  let chapterCount = 0;

  for (const chapter of chapters) {
    const transcript = chapter.transcriptText?.trim();
    if (!transcript) {
      offsetSeconds += parseDurationLabelSeconds(chapter.duration);
      continue;
    }

    chapterCount += 1;
    const title = chapter.title.trim();
    if (title) {
      items.push({ type: "chapter", title, seconds: offsetSeconds });
    }

    const cues = parseTranscriptCues(transcript);
    for (const cue of cues) {
      const seconds = cue.seconds + offsetSeconds;
      items.push({
        type: "cue",
        seconds,
        label: formatTranscriptClock(seconds),
        text: cue.text,
      });
    }

    const spanned = maxCueSeconds(cues);
    offsetSeconds += Math.max(spanned, parseDurationLabelSeconds(chapter.duration));
  }

  // Single-chapter lessons don't need a heading.
  if (chapterCount <= 1) {
    return items.filter((item) => item.type === "cue");
  }

  return items;
}
