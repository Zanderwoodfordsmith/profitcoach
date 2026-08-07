/** Fraction of the video that may remain unwatched (10%). */
export const LESSON_WATCH_COMPLETE_REMAINING_RATIO = 0.1;

/**
 * Cap on that remaining tail. For long videos, 10% would be too generous
 * (e.g. 18 min on a 3-hour lesson), so we require watching until at most
 * this many seconds are left.
 */
export const LESSON_WATCH_COMPLETE_MAX_REMAINING_SECONDS = 120;

/**
 * Auto-complete once remaining time is at most min(10% of duration, 2 minutes).
 * Short videos complete around 90%; long ones near the end.
 */
export function remainingSecondsAllowedForWatchComplete(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(
    durationSeconds * LESSON_WATCH_COMPLETE_REMAINING_RATIO,
    LESSON_WATCH_COMPLETE_MAX_REMAINING_SECONDS,
  );
}

export function hasReachedWatchCompleteThreshold(
  currentTimeSeconds: number,
  durationSeconds: number,
): boolean {
  if (!Number.isFinite(currentTimeSeconds) || !Number.isFinite(durationSeconds)) {
    return false;
  }
  if (durationSeconds <= 0 || currentTimeSeconds < 0) return false;
  const allowedRemaining = remainingSecondsAllowedForWatchComplete(durationSeconds);
  return durationSeconds - currentTimeSeconds <= allowedRemaining;
}
