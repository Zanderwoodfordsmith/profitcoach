import { resolveSupabaseBrowserSession } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";
import { videoPosterFile } from "@/lib/videoPoster";

export type CommunityPostMediaKind = "image" | "video" | "audio" | "file";

export type CommunityPostMediaItem = {
  url: string;
  kind: CommunityPostMediaKind;
  /** Original filename for documents. Omitted for images, video, and audio. */
  name?: string;
  /** Still frame with a play button, for videos. Shown in support emails. */
  poster?: string;
};

export const COMMUNITY_POST_MEDIA_MAX = 6;

export const COMMUNITY_POST_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const COMMUNITY_POST_MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
export const COMMUNITY_POST_MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25MB
export const SUPPORT_MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB
/** Support allows longer videos than the feed (screen recordings). */
export const SUPPORT_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

export const SUPPORT_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/rtf";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
  "audio/mp3",
] as const;

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mp3": "mp3",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/csv": "csv",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
};

export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  aac: "audio/aac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
};

export function mediaKindForMime(mime: string): CommunityPostMediaKind | null {
  const base = mime.split(";")[0]!.trim().toLowerCase();
  if ((IMAGE_TYPES as readonly string[]).includes(base)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(base)) return "video";
  if ((AUDIO_TYPES as readonly string[]).includes(base)) return "audio";
  if (base.startsWith("audio/")) return "audio";
  if (base in EXT_BY_MIME && !base.startsWith("image/") && !base.startsWith("video/") && !base.startsWith("audio/")) {
    return "file";
  }
  return null;
}

export function maxBytesForCommunityPostMime(mime: string): number {
  const kind = mediaKindForMime(mime);
  if (kind === "video") return COMMUNITY_POST_MAX_VIDEO_BYTES;
  if (kind === "audio") return COMMUNITY_POST_MAX_AUDIO_BYTES;
  if (kind === "file") return SUPPORT_MAX_DOCUMENT_BYTES;
  return COMMUNITY_POST_MAX_IMAGE_BYTES;
}

/** Resolve MIME from File.type or filename when the browser omits type (common for .mov). */
export function resolveMediaMimeFromName(
  filename: string,
  declaredMime?: string | null
): string | null {
  const declared = (declaredMime || "").split(";")[0]!.trim().toLowerCase();
  if (declared && mediaKindForMime(declared)) return declared;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const fromExt = MIME_BY_EXT[ext];
  if (fromExt && mediaKindForMime(fromExt)) return fromExt;
  return null;
}

export function resolveCommunityPostMediaMime(file: File): string | null {
  return resolveMediaMimeFromName(file.name, file.type);
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
  // Community feed posts stay image/video only; support uses validateSupportMediaFile.
  if (kind !== "image" && kind !== "video") {
    return {
      error:
        "File must be an image (JPEG, PNG, WebP) or video (MP4, WebM, MOV).",
    };
  }
  const maxBytes = maxBytesForCommunityPostMime(mime);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { error: `File must be ${mb}MB or smaller.` };
  }
  return { mime, kind };
}

/** Safe display name for a support document. */
export function supportDocumentName(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() || "Document";
  return base.replace(/[\r\n\t]/g, " ").slice(0, 180);
}

/** Images, video, audio, and documents — used by support tickets/replies. */
export function validateSupportMediaFile(
  file: File
): { mime: string; kind: CommunityPostMediaKind } | { error: string } {
  const mime = resolveCommunityPostMediaMime(file);
  if (!mime) {
    return {
      error:
        "File must be an image, video (MP4, WebM, MOV), audio, or a document (PDF, Word, Excel, PowerPoint, text).",
    };
  }
  const kind = mediaKindForMime(mime)!;
  const maxBytes =
    kind === "video" ? SUPPORT_MAX_VIDEO_BYTES : maxBytesForCommunityPostMime(mime);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { error: `File must be ${mb}MB or smaller.` };
  }
  return { mime, kind };
}

export function inferCommunityPostMediaKindFromUrl(url: string): CommunityPostMediaKind {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv|rtf)(\s|$)/i.test(path)) return "file";
  if (/\.(m4a|mp3|wav|ogg|aac)(\s|$)/i.test(path)) return "audio";
  // Prefer video for ambiguous .webm when no kind is stored.
  if (/\.(mp4|webm|mov|m4v|ogv)(\s|$)/i.test(path)) return "video";
  return "image";
}

function isMediaKind(k: unknown): k is CommunityPostMediaKind {
  return k === "image" || k === "video" || k === "audio" || k === "file";
}

function storedMediaName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = supportDocumentName(raw);
  return name && name !== "Document" ? name : undefined;
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
    const name = storedMediaName((el as { name?: unknown }).name);
    const posterRaw = (el as { poster?: unknown }).poster;
    const poster =
      typeof posterRaw === "string" && posterRaw.trim() ? posterRaw.trim() : undefined;
    out.push({
      url: url.trim(),
      kind,
      ...(name ? { name } : {}),
      ...(poster ? { poster } : {}),
    });
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
async function uploadValidatedMediaFile(
  file: File,
  validated: { mime: string; kind: CommunityPostMediaKind }
): Promise<{ media: CommunityPostMediaItem } | { error: string }> {
  const session = await resolveSupabaseBrowserSession();
  const user = session?.user;
  if (!user) {
    return { error: "Not signed in." };
  }

  const ext =
    EXT_BY_MIME[validated.mime] ??
    (validated.kind === "video"
      ? "mp4"
      : validated.kind === "audio"
        ? "webm"
        : validated.kind === "file"
          ? "bin"
          : "jpg");
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

  const name =
    validated.kind === "file" ? supportDocumentName(file.name) : undefined;
  return {
    media: {
      url: communityPostMediaPublicUrl(path),
      kind: validated.kind,
      ...(name ? { name } : {}),
    },
  };
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
  return uploadValidatedMediaFile(file, validated);
}

/** Upload image, video, or audio for support tickets / replies. */
export async function uploadSupportMediaFile(
  file: File
): Promise<{ media: CommunityPostMediaItem } | { error: string }> {
  const validated = validateSupportMediaFile(file);
  if ("error" in validated) {
    return validated;
  }
  const up = await uploadValidatedMediaFile(file, validated);
  if ("error" in up || validated.kind !== "video") return up;

  // Emails link a still of the video instead of attaching it. Best effort.
  const posterFile = await videoPosterFile(file);
  if (!posterFile) return up;
  const posterUp = await uploadValidatedMediaFile(posterFile, {
    mime: "image/jpeg",
    kind: "image",
  });
  if ("error" in posterUp) return up;
  return { media: { ...up.media, poster: posterUp.media.url } };
}
