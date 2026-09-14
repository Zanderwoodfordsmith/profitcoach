export type SocialUrlFields = {
  instagram_url: string | null;
  facebook_url: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstString(values: unknown): string | null {
  if (typeof values === "string") return asString(values);
  if (!Array.isArray(values)) return null;
  for (const item of values) {
    const one = asString(item);
    if (one) return one;
  }
  return null;
}

export function socialUrlsFromUnknown(raw: unknown): SocialUrlFields {
  const rec = asRecord(raw) ?? {};
  const maps = asRecord(rec.google_maps);
  const instagram =
    asString(rec.instagram_url) ||
    firstString(rec.instagrams) ||
    (maps ? firstString(maps.instagrams) : null);
  const facebook =
    asString(rec.facebook_url) ||
    firstString(rec.facebooks) ||
    (maps ? firstString(maps.facebooks) : null);
  return { instagram_url: instagram, facebook_url: facebook };
}

export function mergeSocialUrls(
  ...parts: Array<SocialUrlFields | null | undefined>
): SocialUrlFields {
  let instagram_url: string | null = null;
  let facebook_url: string | null = null;
  for (const part of parts) {
    if (!part) continue;
    if (!instagram_url && part.instagram_url) instagram_url = part.instagram_url;
    if (!facebook_url && part.facebook_url) facebook_url = part.facebook_url;
  }
  return { instagram_url, facebook_url };
}
