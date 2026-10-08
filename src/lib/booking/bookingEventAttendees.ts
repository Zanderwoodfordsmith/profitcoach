export type BookingEventAttendee = {
  email: string;
  name?: string;
};

/** Guest plus any extra invites, de-duplicated. Empty or invalid emails are dropped. */
export function bookingEventAttendees(input: {
  guestEmail: string;
  guestName: string;
  extra?: BookingEventAttendee[];
}): BookingEventAttendee[] {
  const seen = new Set<string>();
  const out: BookingEventAttendee[] = [];
  const add = (email: string, name?: string) => {
    const normalised = email.trim().toLowerCase();
    if (!normalised.includes("@") || seen.has(normalised)) return;
    seen.add(normalised);
    const label = name?.trim();
    out.push(label ? { email: normalised, name: label } : { email: normalised });
  };
  add(input.guestEmail, input.guestName);
  for (const attendee of input.extra ?? []) {
    add(attendee.email, attendee.name);
  }
  return out;
}
