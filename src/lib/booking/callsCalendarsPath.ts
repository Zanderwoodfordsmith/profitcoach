/** Booking calendar + reminder editor lives on Calls → Settings. */
export function callsCalendarsHref(admin: boolean): string {
  return admin ? "/admin/calls?tab=settings" : "/coach/calls?tab=settings";
}

export function callsCalendarSettingsHref(
  admin: boolean,
  calendarSlug?: string | null
): string {
  const base = callsCalendarsHref(admin);
  const slug = calendarSlug?.trim();
  if (!slug) return base;
  return `${base}&calendar=${encodeURIComponent(slug)}`;
}
