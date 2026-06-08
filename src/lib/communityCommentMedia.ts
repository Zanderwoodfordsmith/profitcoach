import {
  parseStoredCommunityPostMedia,
  uploadCommunityPostMediaFile,
  validateCommunityPostMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";

export const COMMUNITY_COMMENT_MEDIA_MAX = 3;

export type CommunityCommentMediaItem = CommunityPostMediaItem & { kind: "image" };

export function parseStoredCommunityCommentMedia(
  raw: unknown
): CommunityCommentMediaItem[] {
  const parsed = parseStoredCommunityPostMedia(raw);
  if (!parsed) return [];
  const out: CommunityCommentMediaItem[] = [];
  for (const item of parsed) {
    if (item.kind !== "image") continue;
    out.push({ url: item.url, kind: "image" });
    if (out.length >= COMMUNITY_COMMENT_MEDIA_MAX) break;
  }
  return out;
}

export function validateCommunityCommentImageFile(
  file: File
): { mime: string } | { error: string } {
  const validated = validateCommunityPostMediaFile(file);
  if ("error" in validated) return validated;
  if (validated.kind !== "image") {
    return { error: "File must be an image (JPEG, PNG, or WebP)." };
  }
  return { mime: validated.mime };
}

export async function uploadCommunityCommentImageFile(
  file: File
): Promise<{ media: CommunityCommentMediaItem } | { error: string }> {
  const validated = validateCommunityCommentImageFile(file);
  if ("error" in validated) return validated;

  const up = await uploadCommunityPostMediaFile(file);
  if ("error" in up) return up;
  if (up.media.kind !== "image") {
    return { error: "File must be an image (JPEG, PNG, or WebP)." };
  }
  return { media: up.media as CommunityCommentMediaItem };
}
