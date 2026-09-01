import { createHash } from "crypto";

import {
  isLinkedInMemberIdSlug,
  linkedInProfileSlug,
} from "@/lib/salesNavigator/linkedinUrl";

export {
  canonicalLinkedInProfileUrl,
  isLinkedInMemberIdSlug,
  linkedInProfileSlug,
} from "@/lib/salesNavigator/linkedinUrl";

/**
 * Lowercase /in/ URL for matching only. Do not store this — member IDs
 * (ACw…) are case-sensitive and 404 when folded. Use
 * `canonicalLinkedInProfileUrl` for anything we persist or open.
 */
export function normalizePublicLinkedInUrl(input: string | null | undefined): string | null {
  const slug = linkedInProfileSlug(input);
  if (!slug) return null;
  return `https://www.linkedin.com/in/${slug.toLowerCase()}`;
}

/**
 * Opaque LinkedIn member-id URLs like /in/ACwAAA... — stable but not
 * human-readable. Sales Navigator returns these; LeadRocks returns vanity URLs.
 * Vanity slugs never match this shape.
 */
export function isObfuscatedLinkedInUrl(
  input: string | null | undefined
): boolean {
  return isLinkedInMemberIdSlug(linkedInProfileSlug(input));
}

/** A human-readable vanity /in/ URL (a valid profile URL that isn't a member-id blob). */
export function isVanityLinkedInUrl(input: string | null | undefined): boolean {
  return Boolean(normalizePublicLinkedInUrl(input)) && !isObfuscatedLinkedInUrl(input);
}

/**
 * Recover a vanity URL from a LeadRocks `linkedin:<url>` dedupe key.
 * Returns null when the key is email/name based, or the URL is a member-id blob.
 */
export function vanityUrlFromDedupeKey(
  key: string | null | undefined
): string | null {
  if (!key?.startsWith("linkedin:")) return null;
  const url = key.slice("linkedin:".length);
  return isVanityLinkedInUrl(url) ? normalizePublicLinkedInUrl(url) : null;
}

function normPersonPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Fallback identity when LinkedIn URL is missing or changed. */
export function nameCompanyIdentityKey(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
}): string | null {
  const company = normPersonPart(input.company);
  if (!company) return null;

  const first = normPersonPart(input.firstName);
  const last = normPersonPart(input.lastName);
  if (first && last) {
    const hash = createHash("sha256")
      .update(`${first}|${last}|${company}`)
      .digest("hex")
      .slice(0, 24);
    return `nameflco:${hash}`;
  }

  const full = normPersonPart(input.fullName);
  if (!full) return null;
  const hash = createHash("sha256")
    .update(`${full}|${company}`)
    .digest("hex")
    .slice(0, 24);
  return `nameco:${hash}`;
}

export function salesNavDedupeKey(input: {
  linkedinUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
  email?: string | null;
}): string | null {
  const li = normalizePublicLinkedInUrl(input.linkedinUrl);
  if (li) return `linkedin:${li}`;

  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  return nameCompanyIdentityKey(input);
}

export function samePersonNameCompany(
  a: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    company?: string | null;
  },
  b: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    company?: string | null;
  }
): boolean {
  const companyA = normPersonPart(a.company);
  const companyB = normPersonPart(b.company);
  if (!companyA || !companyB || companyA !== companyB) return false;

  const firstA = normPersonPart(a.firstName);
  const lastA = normPersonPart(a.lastName);
  const firstB = normPersonPart(b.first_name);
  const lastB = normPersonPart(b.last_name);
  if (firstA && lastA && firstB && lastB) {
    return firstA === firstB && lastA === lastB;
  }

  const fullA = normPersonPart(a.fullName);
  const fullB = normPersonPart(b.full_name);
  return Boolean(fullA && fullB && fullA === fullB);
}
