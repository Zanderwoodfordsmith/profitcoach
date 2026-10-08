import { supportCallMeetingLocationUrl } from "@/lib/support/supportCallHosts";

/**
 * Post-payment orientation call — uses our native booking UI
 * (same day/time picker as Let’s Talk after Continue), not the GHL iframe.
 *
 * Slots come from Zander’s onboarding calendar (the Google account that can
 * create events). Pam is added as an attendee so the invite lands on her
 * calendar as well as the member’s. The place on the invite is Pam’s standing
 * Zoom room (theprofitcoach.com/zoom-pam), the same room as her support calls.
 */

/** Pam's standing Zoom room. Shown on the calendar invite and in the emails. */
export const PROGRAMME_ORIENTATION_JOIN_URL =
  supportCallMeetingLocationUrl("pam") ?? "https://theprofitcoach.com/zoom-pam";
export const PROGRAMME_ORIENTATION_BOOK_SLUG =
  process.env.NEXT_PUBLIC_PROGRAMME_ORIENTATION_BOOK_SLUG?.trim().toLowerCase() ||
  "zander";

export const PROGRAMME_ORIENTATION_CALENDAR_SLUG =
  process.env.NEXT_PUBLIC_PROGRAMME_ORIENTATION_CALENDAR_SLUG?.trim().toLowerCase() ||
  "onboarding";

/** Invited on every orientation event so it shows on Pam’s calendar. */
export const PROGRAMME_ORIENTATION_CALENDAR_ATTENDEE = {
  email: "pam@businesscoachacademy.com",
  name: "Pam",
} as const;

export function isProgrammeOrientationBooking(input: {
  coachSlug: string | null | undefined;
  calendarSlug: string | null | undefined;
}): boolean {
  const coach = (input.coachSlug ?? "").trim().toLowerCase();
  const calendar = (input.calendarSlug ?? "").trim().toLowerCase();
  return (
    coach === PROGRAMME_ORIENTATION_BOOK_SLUG &&
    calendar === PROGRAMME_ORIENTATION_CALENDAR_SLUG
  );
}

/** Calendar invite title: "Orientation call: Jane Smith & Pam". */
export function orientationEventTitle(guestName: string): string {
  const member = guestName.trim() || "Member";
  return `Orientation call: ${member} & Pam`;
}
