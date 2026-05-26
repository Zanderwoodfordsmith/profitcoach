import { sanitizeProspectUrlParam } from "@/lib/landingCopy";
import { splitFullName } from "@/lib/splitFullName";

export type AssessmentContactFromUrl = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
};

type SearchParamsLike = {
  get: (key: string) => string | null;
};

/** Prospect contact fields coaches may pass on direct /assessment links. */
export function parseAssessmentContactParams(
  searchParams: SearchParamsLike
): AssessmentContactFromUrl {
  const firstName = sanitizeProspectUrlParam(searchParams.get("first_name"));
  const lastName = sanitizeProspectUrlParam(searchParams.get("last_name"));
  const name = sanitizeProspectUrlParam(searchParams.get("name"));
  const emailRaw = sanitizeProspectUrlParam(searchParams.get("email"));
  const phone = sanitizeProspectUrlParam(searchParams.get("phone"));
  const businessName = sanitizeProspectUrlParam(
    searchParams.get("business") ?? searchParams.get("company")
  );

  const fromParts = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName = name ?? (fromParts || null);

  return {
    firstName,
    lastName,
    fullName,
    email: emailRaw ? emailRaw.toLowerCase() : null,
    phone,
    businessName,
  };
}

/** First name for personalised assessment greetings (URL param, then full name). */
export function getAssessmentProspectFirstName(
  contact: AssessmentContactFromUrl
): string | null {
  const fromParam = contact.firstName?.trim();
  if (fromParam) return fromParam;
  const fromFull = contact.fullName?.trim();
  if (fromFull) return splitFullName(fromFull).first_name;
  return null;
}

export function assessmentContactToSessionPayload(
  contact: AssessmentContactFromUrl
): Record<string, string | undefined> {
  return {
    firstName: contact.firstName ?? undefined,
    lastName: contact.lastName ?? undefined,
    fullName: contact.fullName ?? undefined,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    businessName: contact.businessName ?? undefined,
  };
}

export type PersonalisedAssessmentLinkInput = {
  coachSlug: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  /** Full origin, e.g. https://theprofitcoach.com — omit for a path-only link. */
  origin?: string;
};

function appendPersonalisedContactParams(
  q: URLSearchParams,
  input: Pick<
    PersonalisedAssessmentLinkInput,
    "firstName" | "lastName" | "email" | "phone" | "businessName"
  >
) {
  const first = input.firstName?.trim();
  const last = input.lastName?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  const business = input.businessName?.trim();

  if (first) q.set("first_name", first);
  if (last) q.set("last_name", last);
  if (email) q.set("email", email);
  if (phone) q.set("phone", phone);
  if (business) q.set("business", business);
}

/** Builds /assessment/{slug}?… with correctly encoded contact query params. */
export function buildPersonalisedAssessmentLink(
  input: PersonalisedAssessmentLinkInput
): string {
  const slug = input.coachSlug.trim();
  const path = `/assessment/${encodeURIComponent(slug)}`;
  const q = new URLSearchParams();
  appendPersonalisedContactParams(q, input);

  const query = q.toString();
  const suffix = query ? `?${query}` : "";
  const origin = input.origin?.replace(/\/$/, "");
  return origin ? `${origin}${path}${suffix}` : `${path}${suffix}`;
}

/** Builds /assessment-pro/{slug}?… with correctly encoded contact query params. */
export function buildPersonalisedAssessmentProLink(
  input: PersonalisedAssessmentLinkInput
): string {
  const slug = input.coachSlug.trim();
  const path = `/assessment-pro/${encodeURIComponent(slug)}`;
  const q = new URLSearchParams();
  appendPersonalisedContactParams(q, input);

  const query = q.toString();
  const suffix = query ? `?${query}` : "";
  const origin = input.origin?.replace(/\/$/, "");
  return origin ? `${origin}${path}${suffix}` : `${path}${suffix}`;
}
