import { uploadCommunityPostMediaFile } from "@/lib/communityPostMedia";

/**
 * Upload a JPEG/PNG/WebP for a community post (e.g. event cover). Rejects video uploads.
 */
export async function uploadCommunityPostImage(
  file: File,
  accessToken: string | null | undefined
): Promise<{ image_url: string } | { error: string }> {
  const up = await uploadCommunityPostMediaFile(file, accessToken);
  if ("error" in up) return up;
  if (up.media.kind !== "image") {
    return { error: "File must be an image (JPEG, PNG, or WebP)." };
  }
  return { image_url: up.media.url };
}
