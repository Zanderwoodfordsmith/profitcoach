/**
 * Post-payment orientation call — uses our native booking UI
 * (same day/time picker as Let’s Talk after Continue), not the GHL iframe.
 *
 * Defaults to Zander’s onboarding calendar; override via env if needed.
 */
export const PROGRAMME_ORIENTATION_BOOK_SLUG =
  process.env.NEXT_PUBLIC_PROGRAMME_ORIENTATION_BOOK_SLUG?.trim().toLowerCase() ||
  "zander";

export const PROGRAMME_ORIENTATION_CALENDAR_SLUG =
  process.env.NEXT_PUBLIC_PROGRAMME_ORIENTATION_CALENDAR_SLUG?.trim().toLowerCase() ||
  "onboarding";
