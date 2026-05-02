/**
 * Upload a JPEG/PNG/WebP for a community post via the authenticated API route.
 */
export async function uploadCommunityPostImage(
  file: File,
  accessToken: string | null | undefined
): Promise<{ image_url: string } | { error: string }> {
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
  const body = (await res.json()) as { image_url?: string; error?: string };
  if (!res.ok) {
    return { error: body.error ?? "Upload failed." };
  }
  if (!body.image_url) {
    return { error: "No image URL returned." };
  }
  return { image_url: body.image_url };
}
