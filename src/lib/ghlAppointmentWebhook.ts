export type GhlAppointmentStatusNormalized =
  | "booked"
  | "confirmed"
  | "cancelled"
  | "showed"
  | "noshow"
  | "invalid"
  | "other";

export type GhlAppointmentMatchStatus =
  | "matched"
  | "unmatched_contact"
  | "unmatched_coach";

export type GhlWebhookLocation = {
  id?: string | null;
  name?: string | null;
};

export type GhlWebhookCalendar = {
  id?: string | null;
  calendarName?: string | null;
  title?: string | null;
  selectedTimezone?: string | null;
  appointmentId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
  appoinmentStatus?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type GhlAppointmentWebhookPayload = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: GhlWebhookLocation | null;
  calendar?: GhlWebhookCalendar | null;
  [key: string]: unknown;
};

export type ParsedGhlAppointment = {
  ghlAppointmentId: string;
  ghlLocationId: string | null;
  ghlCalendarId: string | null;
  prospectEmail: string | null;
  prospectPhone: string | null;
  prospectName: string | null;
  calendarName: string | null;
  title: string | null;
  statusRaw: string | null;
  statusNormalized: GhlAppointmentStatusNormalized;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  notes: string | null;
  address: string | null;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeEmail(value: unknown): string | null {
  const trimmed = asTrimmedString(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

export function normalizeGhlAppointmentStatus(
  ...values: Array<string | null | undefined>
): { raw: string | null; normalized: GhlAppointmentStatusNormalized } {
  const raw =
    values.map((v) => asTrimmedString(v)).find((v) => v != null) ?? null;
  if (!raw) return { raw: null, normalized: "other" };

  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");

  if (key === "booked" || key === "new") {
    return { raw, normalized: "booked" };
  }
  if (key === "confirmed") {
    return { raw, normalized: "confirmed" };
  }
  if (key === "cancelled" || key === "canceled") {
    return { raw, normalized: "cancelled" };
  }
  if (key === "showed" || key === "completed") {
    return { raw, normalized: "showed" };
  }
  if (key === "noshow" || key === "no_show") {
    return { raw, normalized: "noshow" };
  }
  if (key === "invalid") {
    return { raw, normalized: "invalid" };
  }

  return { raw, normalized: "other" };
}

function parseGhlLocalDateTime(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // GHL format: 'YYYY-MM-DDTHH:mm:ss' in selectedTimezone (no offset).
  const naiveMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/
  );
  if (naiveMatch) {
    return `${naiveMatch[1]}T${naiveMatch[2]}Z`;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseGhlAppointmentWebhookPayload(
  body: GhlAppointmentWebhookPayload
): ParsedGhlAppointment | { error: string } {
  const calendar = body.calendar;
  if (!calendar || typeof calendar !== "object") {
    return { error: "Missing calendar object." };
  }

  const ghlAppointmentId = asTrimmedString(calendar.appointmentId);
  if (!ghlAppointmentId) {
    return { error: "Missing calendar.appointmentId." };
  }

  const location =
    body.location && typeof body.location === "object" ? body.location : null;

  const joinedName = [asTrimmedString(body.first_name), asTrimmedString(body.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const fullName = asTrimmedString(body.full_name) ?? (joinedName || null);

  const { raw: statusRaw, normalized: statusNormalized } =
    normalizeGhlAppointmentStatus(calendar.status, calendar.appoinmentStatus);

  return {
    ghlAppointmentId,
    ghlLocationId: asTrimmedString(location?.id),
    ghlCalendarId: asTrimmedString(calendar.id),
    prospectEmail: normalizeEmail(body.email),
    prospectPhone: asTrimmedString(body.phone),
    prospectName: fullName,
    calendarName: asTrimmedString(calendar.calendarName),
    title: asTrimmedString(calendar.title),
    statusRaw,
    statusNormalized,
    startTime: parseGhlLocalDateTime(asTrimmedString(calendar.startTime)),
    endTime: parseGhlLocalDateTime(asTrimmedString(calendar.endTime)),
    timezone: asTrimmedString(calendar.selectedTimezone),
    notes: asTrimmedString(calendar.notes),
    address: asTrimmedString(calendar.address),
  };
}

export function verifyGhlWebhookAuthorization(
  request: Request,
  expectedSecret: string
): boolean {
  if (!expectedSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const headerToken = bearerMatch?.[1]?.trim();
  if (headerToken && headerToken === expectedSecret) return true;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("secret")?.trim();
  if (queryToken && queryToken === expectedSecret) return true;

  return false;
}
