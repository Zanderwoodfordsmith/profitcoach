/**
 * Probe audio/video duration for academy import scripts (Node).
 * Uses music-metadata — works for MP3/M4A and most MP4/MOV containers.
 */

import { parseFile } from "music-metadata";

import { formatLessonDurationFromSeconds } from "../../src/lib/academy/hubCatalog";

export async function probeMediaDurationSeconds(
  filePath: string
): Promise<number | null> {
  try {
    const meta = await parseFile(filePath, { duration: true });
    const seconds = meta.format.duration;
    if (!Number.isFinite(seconds) || seconds == null || seconds <= 0) {
      return null;
    }
    return seconds;
  } catch {
    return null;
  }
}

/** Prefer video length when both files exist (what the lesson player leads with). */
export async function probeLessonDurationLabel(input: {
  videoPath?: string | null;
  audioPath?: string | null;
}): Promise<string | null> {
  const paths = [input.videoPath, input.audioPath].filter(
    (p): p is string => Boolean(p)
  );
  for (const filePath of paths) {
    const seconds = await probeMediaDurationSeconds(filePath);
    if (seconds != null) {
      return formatLessonDurationFromSeconds(seconds);
    }
  }
  return null;
}
