const KEY_PREFIX = "academy-lesson-position:";

/** Don't offer a resume for a video barely started or all but finished. */
const MIN_RESUME_SECONDS = 15;
const MIN_REMAINING_SECONDS = 20;

function storageKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

/** Shared Watch/Listen cursor for a lesson (preferred when both media exist). */
export function lessonPlaybackKey(courseId: string, lessonId: string): string {
  return `lesson:${courseId}:${lessonId}`;
}

export function readPlaybackPosition(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function storePlaybackPosition(key: string, seconds: number): void {
  try {
    window.localStorage.setItem(storageKey(key), String(Math.floor(seconds)));
  } catch {
    // ignore
  }
}

export function clearPlaybackPosition(key: string): void {
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

export function isResumable(seconds: number, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return seconds >= MIN_RESUME_SECONDS && duration - seconds >= MIN_REMAINING_SECONDS;
}
