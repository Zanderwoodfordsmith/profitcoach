import { sanitizeProspectUrlParam } from "@/lib/landingCopy";
import { splitFullName } from "@/lib/splitFullName";
import { formatPersonName } from "@/lib/formatPersonName";
import {
  ASSESSMENT_INVITE_PARAM,
  normalizeAssessmentInviteToken,
} from "@/lib/assessmentInviteToken";

export type AssessmentContactFromUrl = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  inviteToken: string | null;
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
    inviteToken: normalizeAssessmentInviteToken(
      searchParams.get(ASSESSMENT_INVITE_PARAM)
    ),
  };
}

export const LANDING_CONTACT_SESSION_KEY = "boss_landing_contact";

export type LandingContactSession = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  inviteToken?: string;
};

/** Opt-in details stored when a prospect completes the landing funnel form. */
export function readLandingContactSession(): LandingContactSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LANDING_CONTACT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LandingContactSession;
  } catch {
    return null;
  }
}

export function landingContactSessionToAssessmentContact(
  session: LandingContactSession
): AssessmentContactFromUrl {
  const firstName = session.firstName?.trim() || null;
  const lastName = session.lastName?.trim() || null;
  const fromParts = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName = session.fullName?.trim() || fromParts || null;

  return {
    firstName,
    lastName,
    fullName,
    email: session.email?.trim().toLowerCase() || null,
    phone: session.phone?.trim() || null,
    businessName: session.businessName?.trim() || null,
    inviteToken: normalizeAssessmentInviteToken(session.inviteToken),
  };
}

/** URL contact wins; session fills gaps after landing opt-in. */
export function mergeAssessmentContactWithSession(
  urlContact: AssessmentContactFromUrl,
  session: LandingContactSession | null
): AssessmentContactFromUrl {
  if (!session) return urlContact;
  const fromSession = landingContactSessionToAssessmentContact(session);
  return {
    firstName: urlContact.firstName ?? fromSession.firstName,
    lastName: urlContact.lastName ?? fromSession.lastName,
    fullName: urlContact.fullName ?? fromSession.fullName,
    email: urlContact.email ?? fromSession.email,
    phone: urlContact.phone ?? fromSession.phone,
    businessName: urlContact.businessName ?? fromSession.businessName,
    inviteToken: urlContact.inviteToken ?? fromSession.inviteToken,
  };
}

/** First name for personalised assessment greetings (URL param, then full name). */
export function getAssessmentProspectFirstName(
  contact: AssessmentContactFromUrl
): string | null {
  const fromParam = contact.firstName?.trim();
  if (fromParam) return formatPersonName(fromParam) || null;
  const fromFull = contact.fullName?.trim();
  if (fromFull) return formatPersonName(splitFullName(fromFull).first_name) || null;
  return null;
}

/** First name for greetings: URL params, landing opt-in session, then typed full name. */
export function resolveAssessmentProspectFirstName(
  urlContact: AssessmentContactFromUrl,
  options?: {
    sessionContact?: LandingContactSession | null;
    fullName?: string | null;
  }
): string | null {
  const fromUrl = getAssessmentProspectFirstName(urlContact);
  if (fromUrl) return fromUrl;

  const session = options?.sessionContact ?? readLandingContactSession();
  if (session) {
    const fromSession = getAssessmentProspectFirstName(
      landingContactSessionToAssessmentContact(session)
    );
    if (fromSession) return fromSession;
  }

  const typedFull = options?.fullName?.trim();
  if (typedFull) return formatPersonName(splitFullName(typedFull).first_name) || null;

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
    inviteToken: contact.inviteToken ?? undefined,
  };
}

export type PersonalisedAssessmentLinkInput = {
  coachSlug: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  /** Opaque contact invite token (`?c=`). */
  inviteToken?: string;
  /** Full origin, e.g. https://theprofitcoach.com — omit for a path-only link. */
  origin?: string;
};

function appendPersonalisedContactParams(
  q: URLSearchParams,
  input: Pick<
    PersonalisedAssessmentLinkInput,
    "firstName" | "lastName" | "email" | "phone" | "businessName" | "inviteToken"
  >
) {
  const first = input.firstName?.trim();
  const last = input.lastName?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  const business = input.businessName?.trim();
  const invite = normalizeAssessmentInviteToken(input.inviteToken);

  if (first) q.set("first_name", first);
  if (last) q.set("last_name", last);
  if (email) q.set("email", email);
  if (phone) q.set("phone", phone);
  if (business) q.set("business", business);
  if (invite) q.set(ASSESSMENT_INVITE_PARAM, invite);
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

const RESULTS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Personalised /assessment links carry at least one known-person query param. */
export function isPersonalisedAssessmentEntry(
  contact: AssessmentContactFromUrl
): boolean {
  return Boolean(
    contact.firstName ||
      contact.lastName ||
      contact.fullName ||
      contact.email ||
      contact.phone ||
      contact.businessName ||
      contact.inviteToken
  );
}

export type ResultsContactPrompt = {
  show: boolean;
  askEmail: boolean;
  askPhone: boolean;
};

function hasContactValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * Ask for email (required) and phone (optional) just before results — only on
 * personalised assessment links, and only for fields we do not already have.
 * Landing opt-in already collected contact, so that path never shows this.
 * If email is already known, skip entirely (do not interrupt for optional phone).
 */
export function getResultsContactPrompt(input: {
  fromLanding: boolean;
  urlContact: AssessmentContactFromUrl;
  email?: string | null;
  phone?: string | null;
  /** True when the invite token already maps to a contact with email. */
  inviteHasEmail?: boolean;
  /** True when the invite token already maps to a contact with phone. */
  inviteHasPhone?: boolean;
}): ResultsContactPrompt {
  const hidden = { show: false, askEmail: false, askPhone: false };
  if (input.fromLanding) return hidden;
  if (!isPersonalisedAssessmentEntry(input.urlContact)) return hidden;

  const hasEmail =
    input.inviteHasEmail === true ||
    hasContactValue(input.email) ||
    hasContactValue(input.urlContact.email);
  if (hasEmail) return hidden;

  const hasPhone =
    input.inviteHasPhone === true ||
    hasContactValue(input.phone) ||
    hasContactValue(input.urlContact.phone);

  return {
    show: true,
    askEmail: true,
    askPhone: !hasPhone,
  };
}

/** Lowercased email if valid; otherwise null. */
export function normalizeAssessmentResultsEmail(
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value.length > 254 || !RESULTS_EMAIL_RE.test(value)) {
    return null;
  }
  return value;
}
