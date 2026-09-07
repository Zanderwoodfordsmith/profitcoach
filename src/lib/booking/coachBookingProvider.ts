/**
 * Client-safe booking calendar provider helpers.
 * Server-only resolvers live in coachBookingProviderServer.ts.
 */

export const BOOKING_CALENDAR_PROVIDERS = ["native", "ghl"] as const;
export type BookingCalendarProvider = (typeof BOOKING_CALENDAR_PROVIDERS)[number];

/** Default calendar used on assessment thank-you / report pages. */
export const ASSESSMENT_BOOKING_CALENDAR_SLUG = "discovery";

export type PublicBookingSurface =
  | {
      provider: "ghl";
      calendar_embed_code: string | null;
      coach_slug: string;
      calendar_slug: null;
    }
  | {
      provider: "native";
      calendar_embed_code: null;
      coach_slug: string;
      calendar_slug: string;
    };

export function parseBookingCalendarProvider(
  raw: string | null | undefined
): BookingCalendarProvider {
  return raw === "ghl" ? "ghl" : "native";
}

export function isBookingCalendarProvider(
  value: unknown
): value is BookingCalendarProvider {
  return value === "native" || value === "ghl";
}

export function getCoachBookingProvider(input: {
  booking_calendar_provider?: string | null;
}): BookingCalendarProvider {
  return parseBookingCalendarProvider(input.booking_calendar_provider);
}
