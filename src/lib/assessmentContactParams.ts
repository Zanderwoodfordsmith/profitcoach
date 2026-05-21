import { sanitizeProspectUrlParam } from "@/lib/landingCopy";

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
  /** Full origin, e.g. https://theprofitcoach.com — omit for a path-only link. */
  origin?: string;
};

/** Builds /assessment/{slug}?… with correctly encoded contact query params. */
export function buildPersonalisedAssessmentLink(
  input: PersonalisedAssessmentLinkInput
): string {
  const slug = input.coachSlug.trim();
  const path = `/assessment/${encodeURIComponent(slug)}`;
  const q = new URLSearchParams();

  const first = input.firstName?.trim();
  const last = input.lastName?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();

  if (first) q.set("first_name", first);
  if (last) q.set("last_name", last);
  if (email) q.set("email", email);
  if (phone) q.set("phone", phone);

  const query = q.toString();
  const suffix = query ? `?${query}` : "";
  const origin = input.origin?.replace(/\/$/, "");
  return origin ? `${origin}${path}${suffix}` : `${path}${suffix}`;
}
