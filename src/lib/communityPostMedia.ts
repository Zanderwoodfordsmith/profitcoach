import { resolveSupabaseBrowserSession } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";

export type CommunityPostMediaKind = "image" | "video";

export type CommunityPostMediaItem = {
  url: string;
  kind: CommunityPostMediaKind;
};

export const COMMUNITY_POST_MEDIA_MAX = 6;

export const COMMUNITY_POST_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const COMMUNITY_POST_MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
};

export function mediaKindForMime(mime: string): CommunityPostMediaKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

export function maxBytesForCommunityPostMime(mime: string): number {
  return mediaKindForMime(mime) === "video"
    ? COMMUNITY_POST_MAX_VIDEO_BYTES
    : COMMUNITY_POST_MAX_IMAGE_BYTES;
}

/** Resolve MIME from File.type or filename when the browser omits type (common for .mov). */
export function resolveCommunityPostMediaMime(file: File): string | null {
  const trimmed = file.type?.trim();
  if (trimmed && mediaKindForMime(trimmed)) return trimmed;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fromExt = MIME_BY_EXT[ext];
  if (fromExt && mediaKindForMime(fromExt)) return fromExt;
  return null;
}

export function validateCommunityPostMediaFile(
  file: File
): { mime: string; kind: CommunityPostMediaKind } | { error: string } {
  const mime = resolveCommunityPostMediaMime(file);
  if (!mime) {
    return {
      error:
        "File must be an image (JPEG, PNG, WebP) or video (MP4, WebM, MOV).",
    };
  }
  const kind = mediaKindForMime(mime)!;
  const maxBytes = maxBytesForCommunityPostMime(mime);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { error: `File must be ${mb}MB or smaller.` };
  }
  return { mime, kind };
}

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

function communityPostMediaPublicUrl(path: string): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/community-posts/${path}`;
}

/**
 * Upload one image or video for a community post directly to Supabase Storage
 * (avoids proxying large files through the Next.js API, which can hang or hit body limits).
 */
export async function uploadCommunityPostMediaFile(
  file: File,
  _accessToken?: string | null | undefined
): Promise<{ media: CommunityPostMediaItem } | { error: string }> {
  const validated = validateCommunityPostMediaFile(file);
  if ("error" in validated) {
    return validated;
  }

  const session = await resolveSupabaseBrowserSession();
  const user = session?.user;
  if (!user) {
    return { error: "Not signed in." };
  }

  const ext = EXT_BY_MIME[validated.mime] ?? (validated.kind === "video" ? "mp4" : "jpg");
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("community-posts")
    .upload(path, file, {
      contentType: validated.mime,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message ?? "Upload failed." };
  }

  return {
    media: {
      url: communityPostMediaPublicUrl(path),
      kind: validated.kind,
    },
  };
}
