import type { AudienceItemSource } from "@/lib/leadLists/audienceLists";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePoolEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || !EMAIL_RE.test(value) || value.length > 254) return null;
  return value;
}

export function normalizePoolPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export function normalizePoolWebsite(
  raw: string | null | undefined
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed.replace(/^\/+/, "")}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || host.length > 253) return null;
    return host;
  } catch {
    return null;
  }
}

export function normalizeGooglePlaceId(
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim();
  if (!/^(ChIJ|GhIJ)[A-Za-z0-9_-]{20,}$/.test(value)) return null;
  return value;
}

export function isPersonalLinkedInUrl(raw: string | null | undefined): boolean {
  return Boolean(normalizeLinkedInProfileUrl(raw ?? ""));
}

export type PoolIdentityInput = {
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  place_id?: string | null;
};

export type PoolRecordInput = PoolIdentityInput & {
  source: AudienceItemSource;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  match_reason?: string | null;
  raw?: Record<string, unknown>;
};

/**
 * Dedupe key for a pool row.
 * People with a /in/ URL win. Business-only Maps rows key on Place ID so
 * chains do not collapse onto one website.
 */
export function poolIdentityKey(input: PoolIdentityInput): string | null {
  const linkedin = normalizeLinkedInProfileUrl(input.linkedin_url ?? "");
  if (linkedin) return `li:${linkedin}`;
  const placeId = normalizeGooglePlaceId(input.place_id);
  if (placeId) return `g:${placeId}`;
  const email = normalizePoolEmail(input.email);
  if (email) return `em:${email}`;
  const phone = normalizePoolPhone(input.phone);
  if (phone) return `ph:${phone}`;
  const website = normalizePoolWebsite(input.website);
  if (website) return `ws:${website}`;
  return null;
}
