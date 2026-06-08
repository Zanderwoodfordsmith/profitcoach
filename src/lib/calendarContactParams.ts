import {
  mergeAssessmentContactWithSession,
  parseAssessmentContactParams,
  type AssessmentContactFromUrl,
  type LandingContactSession,
} from "@/lib/assessmentContactParams";
import { splitFullName } from "@/lib/splitFullName";

export type CalendarContactParams = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type SearchParamsLike = {
  get: (key: string) => string | null;
};

export function toCalendarContactParams(
  contact: AssessmentContactFromUrl
): CalendarContactParams {
  let firstName = contact.firstName?.trim() || null;
  let lastName = contact.lastName?.trim() || null;
  if (!firstName && !lastName && contact.fullName?.trim()) {
    const split = splitFullName(contact.fullName);
    firstName = split.first_name;
    lastName = split.last_name;
  }

  return {
    firstName,
    lastName,
    email: contact.email?.trim().toLowerCase() || null,
    phone: contact.phone?.trim() || null,
  };
}

export function calendarContactFromFields(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}): CalendarContactParams {
  const firstName =
    input.firstName?.trim() ||
    splitFullName(input.fullName ?? "").first_name ||
    null;
  const lastName =
    input.lastName?.trim() ||
    splitFullName(input.fullName ?? "").last_name ||
    null;

  return {
    firstName,
    lastName,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
  };
}

export function hasCalendarContactParams(
  contact: CalendarContactParams | null | undefined
): contact is CalendarContactParams {
  if (!contact) return false;
  return Boolean(
    contact.firstName?.trim() ||
      contact.lastName?.trim() ||
      contact.email?.trim() ||
      contact.phone?.trim()
  );
}

/** URL params win; session fills gaps (landing opt-in or stored assessment contact). */
export function resolveReportCalendarContact(options: {
  searchParams?: SearchParamsLike | null;
  sessionContact?: LandingContactSession | null;
}): CalendarContactParams {
  const urlContact = options.searchParams
    ? parseAssessmentContactParams(options.searchParams)
    : {
        firstName: null,
        lastName: null,
        fullName: null,
        email: null,
        phone: null,
        businessName: null,
      };
  const merged = mergeAssessmentContactWithSession(
    urlContact,
    options.sessionContact ?? null
  );
  return toCalendarContactParams(merged);
}

function buildCalendarQuery(contact: CalendarContactParams): URLSearchParams {
  const q = new URLSearchParams();
  const first = contact.firstName?.trim();
  const last = contact.lastName?.trim();
  const email = contact.email?.trim();
  const phone = contact.phone?.trim();
  if (first) q.set("first_name", first);
  if (last) q.set("last_name", last);
  if (email) q.set("email", email);
  if (phone) q.set("phone", phone);
  return q;
}

/** Appends GHL booking prefill params to iframe src URLs inside calendar embed HTML. */
export function appendCalendarContactParams(
  embedCode: string,
  contact: CalendarContactParams
): string {
  const trimmed = embedCode.trim();
  if (!trimmed || !hasCalendarContactParams(contact)) return embedCode;

  const extra = buildCalendarQuery(contact);
  if (!extra.toString()) return embedCode;

  return trimmed.replace(
    /(<iframe\b[^>]*\ssrc=["'])([^"']+)(["'])/i,
    (_match, prefix: string, src: string, suffix: string) => {
      try {
        const url = new URL(src);
        for (const [key, value] of extra.entries()) {
          url.searchParams.set(key, value);
        }
        return `${prefix}${url.toString()}${suffix}`;
      } catch {
        return `${prefix}${src}${suffix}`;
      }
    }
  );
}
