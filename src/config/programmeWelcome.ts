/**
 * Post-checkout welcome (/welcome) — celebration video.
 * Set NEXT_PUBLIC_PROGRAMME_WELCOME_VIDEO_URL to a YouTube or Vimeo URL.
 */
export const PROGRAMME_WELCOME_VIDEO_URL =
  process.env.NEXT_PUBLIC_PROGRAMME_WELCOME_VIDEO_URL?.trim() || "";
