/** Aggregate timeline math for multi-chapter lesson videos. */

export type ChapterTimelineMarker = {
  /** 0–1 position on the full timeline */
  ratio: number;
  title: string;
};

export type ChapterTimelineSegment = {
  startRatio: number;
  endRatio: number;
  title: string;
};

export function buildChapterTimelineSegments(
  chapterTitles: string[],
  chapterDurations: number[]
): ChapterTimelineSegment[] {
  const total = sumChapterDurations(chapterDurations);
  if (total <= 0) return [];

  const segments: ChapterTimelineSegment[] = [];
  let elapsed = 0;

  for (let index = 0; index < chapterTitles.length; index++) {
    const duration = chapterDurations[index] ?? 0;
    if (duration <= 0) continue;
    const startRatio = elapsed / total;
    elapsed += duration;
    segments.push({
      startRatio,
      endRatio: elapsed / total,
      title: chapterTitles[index] ?? `Chapter ${index + 1}`,
    });
  }

  return segments;
}

export function chapterSegmentAtRatio(
  ratio: number,
  segments: ChapterTimelineSegment[]
): ChapterTimelineSegment | null {
  if (segments.length === 0) return null;
  const clamped = Math.min(1, Math.max(0, ratio));

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    const isLast = index === segments.length - 1;
    if (
      clamped >= segment.startRatio &&
      (isLast ? clamped <= segment.endRatio : clamped < segment.endRatio)
    ) {
      return segment;
    }
  }

  return segments[segments.length - 1] ?? null;
}

export function chapterDurationSecondsFromLabel(duration: string | null | undefined): number {
  const trimmed = duration?.trim() ?? "";
  if (!trimmed) return 0;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*m/i);
  if (match) return Math.round(Number(match[1]) * 60);
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && asNumber > 0 ? Math.round(asNumber * 60) : 0;
}

export function sumChapterDurations(durations: number[]): number {
  return durations.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
}

export function aggregateTimeBeforeChapter(
  chapterIndex: number,
  chapterDurations: number[]
): number {
  return chapterDurations
    .slice(0, chapterIndex)
    .reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
}

export function aggregateCurrentTime(
  chapterIndex: number,
  chapterTime: number,
  chapterDurations: number[]
): number {
  return aggregateTimeBeforeChapter(chapterIndex, chapterDurations) + chapterTime;
}

export function aggregateTimeToChapter(
  aggregateSeconds: number,
  chapterDurations: number[]
): { chapterIndex: number; chapterTime: number } {
  const total = sumChapterDurations(chapterDurations);
  const clamped =
    total > 0
      ? Math.min(Math.max(0, aggregateSeconds), total)
      : Math.max(0, aggregateSeconds);

  let elapsed = 0;
  for (let index = 0; index < chapterDurations.length; index++) {
    const duration = chapterDurations[index] ?? 0;
    if (duration <= 0) {
      return { chapterIndex: index, chapterTime: 0 };
    }
    if (clamped < elapsed + duration || index === chapterDurations.length - 1) {
      return {
        chapterIndex: index,
        chapterTime: Math.min(Math.max(0, clamped - elapsed), duration),
      };
    }
    elapsed += duration;
  }

  return { chapterIndex: 0, chapterTime: 0 };
}

export function buildChapterTimelineMarkers(
  chapterTitles: string[],
  chapterDurations: number[]
): ChapterTimelineMarker[] {
  const total = sumChapterDurations(chapterDurations);
  if (total <= 0) return [];

  const markers: ChapterTimelineMarker[] = [];
  let elapsed = 0;

  for (let index = 1; index < chapterTitles.length; index++) {
    const priorDuration = chapterDurations[index - 1] ?? 0;
    if (priorDuration <= 0) continue;
    elapsed += priorDuration;
    markers.push({
      ratio: elapsed / total,
      title: chapterTitles[index] ?? `Chapter ${index + 1}`,
    });
  }

  return markers;
}

export function aggregateBufferedRatio(
  chapterIndex: number,
  chapterBufferedRatio: number,
  chapterDurations: number[],
  totalDuration: number
): number {
  if (totalDuration <= 0) return 0;
  const before = aggregateTimeBeforeChapter(chapterIndex, chapterDurations);
  const currentDuration = chapterDurations[chapterIndex] ?? 0;
  const currentBuffered =
    currentDuration > 0 ? currentDuration * Math.min(1, Math.max(0, chapterBufferedRatio)) : 0;
  return Math.min(1, (before + currentBuffered) / totalDuration);
}
