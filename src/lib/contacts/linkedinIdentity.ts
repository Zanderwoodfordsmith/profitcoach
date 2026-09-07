/**
 * LinkedIn vanity URL ↔ provider member-id (ACo…/ACw…) identity bridge.
 *
 * Scrapers and Unipile may supply either form for the same person. Prefer
 * vanity for display/storage; always keep provider_id for matching.
 */

import {
  isLinkedInMemberIdSlug,
  linkedInProfileSlug,
} from "@/lib/salesNavigator/linkedinUrl";
import { resolveUnipileUser } from "@/lib/unipile/client";
import {
  linkedInPublicIdentifier,
  normalizeLinkedInProfileUrl,
} from "@/lib/unipile/linkedinUrl";

export type LinkedInIdentityPair = {
  providerId: string | null;
  /** Prefer vanity `/in/{slug}` when known; may be member-id URL as fallback. */
  linkedinUrl: string | null;
  publicIdentifier: string | null;
  hasVanity: boolean;
};

export function normalizeLinkedInProviderId(
  raw: string | null | undefined
): string | null {
  const v = raw?.trim();
  if (!v) return null;
  // Strip URN prefixes if present.
  const bare = v.includes(":") ? v.split(":").pop()!.trim() : v;
  if (!isLinkedInMemberIdSlug(bare)) return null;
  return bare;
}

/** Provider id embedded in an obfuscated `/in/ACo…` URL. */
export function linkedInProviderIdFromUrl(
  url: string | null | undefined
): string | null {
  const slug =
    linkedInProfileSlug(url) ||
    (url ? linkedInPublicIdentifier(url) : null);
  return normalizeLinkedInProviderId(slug);
}

export function isObfuscatedLinkedInProfileUrl(
  url: string | null | undefined
): boolean {
  return Boolean(linkedInProviderIdFromUrl(url));
}

function urlFromSlug(slug: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
}

/**
 * Build a pair from whatever pieces we already have (no network).
 * Prefers vanity URL over member-id URL.
 */
export function parseLinkedInIdentity(input: {
  linkedinUrl?: string | null;
  providerId?: string | null;
  publicIdentifier?: string | null;
}): LinkedInIdentityPair {
  const fromProvider = normalizeLinkedInProviderId(input.providerId);
  const fromUrlProvider = linkedInProviderIdFromUrl(input.linkedinUrl);
  const providerId = fromProvider || fromUrlProvider;

  const pubRaw = (input.publicIdentifier || "").trim() || null;
  const pubIsProvider = Boolean(normalizeLinkedInProviderId(pubRaw));
  const vanityFromPub =
    pubRaw && !pubIsProvider && !pubRaw.includes("@") && !pubRaw.includes(":")
      ? pubRaw
      : null;

  const urlNorm = input.linkedinUrl
    ? normalizeLinkedInProfileUrl(input.linkedinUrl)
    : null;
  const urlIsObfuscated = Boolean(linkedInProviderIdFromUrl(urlNorm));

  let publicIdentifier: string | null = vanityFromPub;
  let linkedinUrl: string | null = null;
  let hasVanity = false;

  if (vanityFromPub) {
    linkedinUrl = urlFromSlug(vanityFromPub);
    publicIdentifier = vanityFromPub;
    hasVanity = true;
  } else if (urlNorm && !urlIsObfuscated) {
    linkedinUrl = urlNorm;
    publicIdentifier = linkedInPublicIdentifier(urlNorm);
    hasVanity = true;
  } else if (urlNorm) {
    linkedinUrl = urlNorm;
    publicIdentifier =
      linkedInPublicIdentifier(urlNorm) || providerId || null;
  } else if (providerId) {
    linkedinUrl = urlFromSlug(providerId);
    publicIdentifier = providerId;
  }

  return { providerId, linkedinUrl, publicIdentifier, hasVanity };
}

/**
 * True when we are missing the other half of the vanity↔provider pair.
 */
export function linkedInIdentityIncomplete(pair: LinkedInIdentityPair): boolean {
  if (!pair.providerId && !pair.linkedinUrl) return true;
  if (!pair.providerId) return true;
  if (!pair.hasVanity) return true;
  return false;
}

/**
 * Resolve via Unipile so we always try to hold both provider_id and vanity URL.
 * Safe to call with a partial pair; no-ops when already complete or account missing.
 */
export async function resolveLinkedInIdentityPair(input: {
  linkedinUrl?: string | null;
  providerId?: string | null;
  publicIdentifier?: string | null;
  unipileAccountId?: string | null;
}): Promise<LinkedInIdentityPair> {
  const existing = parseLinkedInIdentity(input);
  if (!linkedInIdentityIncomplete(existing)) return existing;

  const accountId = input.unipileAccountId?.trim();
  if (!accountId) return existing;

  const identifier =
    (existing.hasVanity ? existing.publicIdentifier : null) ||
    existing.providerId ||
    existing.publicIdentifier;
  if (!identifier) return existing;

  const resolved = await resolveUnipileUser(identifier, accountId);
  if (!resolved.ok || !resolved.data) return existing;

  const data = resolved.data as Record<string, unknown>;
  const providerId =
    normalizeLinkedInProviderId(
      typeof data.provider_id === "string" ? data.provider_id : null
    ) ||
    normalizeLinkedInProviderId(
      typeof data.id === "string" ? data.id : null
    ) ||
    existing.providerId;

  const publicIdentifier =
    (typeof data.public_identifier === "string" &&
    data.public_identifier.trim()
      ? data.public_identifier.trim()
      : null) || existing.publicIdentifier;

  const profileUrl =
    typeof data.public_profile_url === "string"
      ? data.public_profile_url
      : null;

  return parseLinkedInIdentity({
    linkedinUrl: profileUrl || existing.linkedinUrl,
    providerId,
    publicIdentifier,
  });
}

/** Identity keys for union-find collapse / dedupe indexes. */
export function linkedInIdentityKeys(input: {
  linkedinUrl?: string | null;
  providerId?: string | null;
  publicIdentifier?: string | null;
}): string[] {
  const pair = parseLinkedInIdentity(input);
  const keys: string[] = [];
  if (pair.providerId) keys.push(`lip:${pair.providerId}`);
  if (pair.linkedinUrl) {
    const norm = normalizeLinkedInProfileUrl(pair.linkedinUrl);
    if (norm) keys.push(`li:${norm}`);
  }
  return keys;
}

/**
 * Prefer vanity when choosing which URL to persist.
 * Never overwrite a stored vanity with an obfuscated member-id URL.
 */
export function preferLinkedInUrl(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  const a = existing ? normalizeLinkedInProfileUrl(existing) : null;
  const b = incoming ? normalizeLinkedInProfileUrl(incoming) : null;
  if (!a) return b;
  if (!b) return a;
  const aOb = isObfuscatedLinkedInProfileUrl(a);
  const bOb = isObfuscatedLinkedInProfileUrl(b);
  if (aOb && !bOb) return b;
  if (!aOb && bOb) return a;
  return b || a;
}
