export type CommunityPostMediaKind = "image" | "video";

export type CommunityPostMediaItem = {
  url: string;
  kind: CommunityPostMediaKind;
};

export const COMMUNITY_POST_MEDIA_MAX = 6;

export function inferCommunityPostMediaKindFromUrl(url: string): CommunityPostMediaKind {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(mp4|webm|mov|m4v|ogv)(\s|$)/i.test(path)) return "video";
  return "image";
}

function isMediaKind(k: unknown): k is CommunityPostMediaKind {
  return k === "image" || k === "video";
}

/**
 * Parse `community_posts.media` JSONB. Returns null if missing/invalid/empty.
 */
export function parseStoredCommunityPostMedia(raw: unknown): CommunityPostMediaItem[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: CommunityPostMediaItem[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const url = (el as { url?: unknown }).url;
    const kindRaw = (el as { kind?: unknown }).kind;
    if (typeof url !== "string" || !url.trim()) continue;
    const kind = isMediaKind(kindRaw)
      ? kindRaw
      : inferCommunityPostMediaKindFromUrl(url);
    out.push({ url: url.trim(), kind });
    if (out.length >= COMMUNITY_POST_MEDIA_MAX) break;
  }
  return out.length > 0 ? out : null;
}

/**
 * Normalized list for UI: DB `media` column, else legacy `image_url`.
 */
export function normalizeCommunityPostMedia(
  mediaColumn: unknown,
  fallbackImageUrl: string | null
): CommunityPostMediaItem[] {
  const parsed = parseStoredCommunityPostMedia(mediaColumn);
  if (parsed && parsed.length > 0) return parsed;
  if (fallbackImageUrl?.trim()) {
    return [
      {
        url: fallbackImageUrl.trim(),
        kind: inferCommunityPostMediaKindFromUrl(fallbackImageUrl),
      },
    ];
  }
  return [];
}

/** First image URL in the list; for `image_url` column and feed thumbnails. */
export function firstCommunityPostImageUrl(media: CommunityPostMediaItem[]): string | null {
  const img = media.find((m) => m.kind === "image");
  return img?.url ?? null;
}

export function communityPostMediaFingerprint(media: CommunityPostMediaItem[]): string {
  return media.map((m) => `${m.kind}:${m.url}`).join("|");
}

/**
 * Upload one image or video for a community post via the authenticated API route.
 */
export async function uploadCommunityPostMediaFile(
  file: File,
  accessToken: string | null | undefined
): Promise<{ media: CommunityPostMediaItem } | { error: string }> {
  if (!accessToken) {
    return { error: "Not signed in." };
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/community/post-image", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const body = (await res.json()) as {
    media?: CommunityPostMediaItem;
    error?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? "Upload failed." };
  }
  if (!body.media?.url || !isMediaKind(body.media.kind)) {
    return { error: "No media URL returned." };
  }
  return { media: body.media };
}
