import {
  parseStoredCommunityPostMedia,
  uploadSupportMediaFile,
  validateCommunityPostMediaFile,
  validateSupportMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";

export const COMMUNITY_COMMENT_MEDIA_MAX = 6;

/** Images, videos, voice notes and documents on a community comment. */
export type CommunityCommentMediaItem = CommunityPostMediaItem;

export function parseStoredCommunityCommentMedia(
  raw: unknown
): CommunityCommentMediaItem[] {
  const parsed = parseStoredCommunityPostMedia(raw);
  if (!parsed) return [];
  return parsed.slice(0, COMMUNITY_COMMENT_MEDIA_MAX);
}

/** Images only. Support's image button still uses this. */
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

/** Any file a comment can carry: image, video, audio or document. */
export function validateCommunityCommentFile(
  file: File
): { mime: string } | { error: string } {
  const validated = validateSupportMediaFile(file);
  if ("error" in validated) return validated;
  return { mime: validated.mime };
}

export async function uploadCommunityCommentFile(
  file: File
): Promise<{ media: CommunityCommentMediaItem } | { error: string }> {
  return uploadSupportMediaFile(file);
}
