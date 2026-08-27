/** External seek request from transcript timestamps (or similar). */
export type LessonSeekRequest = {
  seconds: number;
  /** Bump to re-seek to the same second. */
  key: number;
};
