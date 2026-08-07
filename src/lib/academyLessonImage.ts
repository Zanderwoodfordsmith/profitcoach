/** Must match `academy-lesson-images` bucket `file_size_limit` (see 20260801150000 migration). */
export const ACADEMY_LESSON_MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACADEMY_LESSON_IMAGE_BUCKET = "academy-lesson-images";

const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function resolveLessonImageMime(file: File): string | null {
  const trimmed = file.type?.trim().toLowerCase();
  if (trimmed && (IMAGE_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed === "image/jpg" ? "image/jpeg" : trimmed;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

export function validateAcademyLessonImageFile(
  file: File
): { mime: string } | { error: string } {
  const mime = resolveLessonImageMime(file);
  if (!mime) {
    return { error: "File must be an image (PNG, JPEG, GIF, WebP, or SVG)." };
  }
  if (file.size > ACADEMY_LESSON_MAX_IMAGE_BYTES) {
    const maxMb = Math.round(ACADEMY_LESSON_MAX_IMAGE_BYTES / (1024 * 1024));
    const sizeMb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return { error: `Image is ${sizeMb}MB (max ${maxMb}MB).` };
  }
  return { mime };
}

/**
 * Upload a lesson body image (admin). Goes through the admin API (service role)
 * so storage RLS cannot block editors who can already save lessons.
 */
export async function uploadAcademyLessonImageFile(
  file: File,
  courseId: string,
  lessonId: string
): Promise<{ url: string } | { error: string }> {
  const validated = validateAcademyLessonImageFile(file);
  if ("error" in validated) {
    return validated;
  }

  const { getValidSupabaseAccessToken } = await import("@/lib/supabaseAccessToken");
  const accessToken = await getValidSupabaseAccessToken();
  if (!accessToken) {
    return { error: "Not signed in." };
  }

  const body = new FormData();
  body.set("file", file);
  body.set("courseId", courseId);
  body.set("lessonId", lessonId);

  let res: Response;
  try {
    res = await fetch("/api/admin/academy/lesson-images", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
  } catch {
    return { error: "Upload failed (network error)." };
  }

  const payload = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!res.ok) {
    return { error: payload?.error ?? `Upload failed (${res.status}).` };
  }
  if (!payload?.url) {
    return { error: "Upload failed (no URL returned)." };
  }
  return { url: payload.url };
}
