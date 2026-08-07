/** Presets for academy lesson direct-file players. */
export const PLAYBACK_SPEEDS = [
  0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 2.75, 3, 3.5,
] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

const STORAGE_KEY = "academy-lesson-playback-speed";

export function formatPlaybackSpeed(rate: number): string {
  const rounded = Math.round(rate * 100) / 100;
  return `${rounded}×`;
}

export function isPlaybackSpeed(value: number): value is PlaybackSpeed {
  return (PLAYBACK_SPEEDS as readonly number[]).includes(value);
}

export function readStoredPlaybackSpeed(): PlaybackSpeed {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const parsed = Number.parseFloat(raw);
    if (isPlaybackSpeed(parsed)) return parsed;
  } catch {
    // ignore
  }
  return 1;
}

export function storePlaybackSpeed(rate: PlaybackSpeed): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // ignore
  }
}
