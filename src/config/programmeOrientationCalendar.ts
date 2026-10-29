import { supportCallMeetingLocationUrl } from "@/lib/support/supportCallHosts";

/**
 * Post-payment orientation call — uses our native booking UI
 * (same day/time picker as Let’s Talk after Continue), not the GHL iframe.
 *
 * Slots come from Zander’s onboarding calendar (the Google account that can
 * create events). Zander takes the call in his standing Zoom room
 * (theprofitcoach.com/zoom-zander), the same room as his support calls.
 */

/** Zander's standing Zoom room. Shown on the calendar invite and in the emails. */
export const PROGRAMME_ORIENTATION_JOIN_URL =
  supportCallMeetingLocationUrl("zander") ?? "https://theprofitcoach.com/zoom-zander";

/**
 * Who the member meets, read from the booking's join link. Older bookings sit
 * in Pam's room and stay with Pam.
 */
export function orientationHostName(joinUrl: string | null | undefined): string {
  return joinUrl?.trim() === supportCallMeetingLocationUrl("pam") ? "Pam" : "Zander";
}
export const PROGRAMME_ORIENTATION_BOOK_SLUG =
  process.env.NEXT_PUBLIC_PROGRAMME_ORIENTATION_BOOK_SLUG?.trim().toLowerCase() ||
  "zander";

export const PROGRAMME_ORIENTATION_CALENDAR_SLUG =
  process.env.NEXT_PUBLIC_PROGRAMME_ORIENTATION_CALENDAR_SLUG?.trim().toLowerCase() ||
  "onboarding";

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

/** Calendar invite title: "Orientation call: Jane Smith & Zander". */
export function orientationEventTitle(guestName: string): string {
  const member = guestName.trim() || "Member";
  return `Orientation call: ${member} & Zander`;
}
