import {
  EXT_BY_MIME,
  mediaKindForMime,
  resolveCommunityPostMediaMime,
} from "@/lib/communityPostMedia";
import { supabaseClient } from "@/lib/supabaseClient";

/** Must match `academy-lessons` bucket `file_size_limit` (see 20260731150000 migration). */
export const ACADEMY_LESSON_MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function academyLessonVideoPublicUrl(path: string): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/academy-lessons/${path}`;
}

function validateAcademyLessonVideoFile(file: File): { mime: string } | { error: string } {
  const mime = resolveCommunityPostMediaMime(file);
  if (!mime || mediaKindForMime(mime) !== "video") {
    return { error: "File must be a video (MP4, WebM, or MOV)." };
  }
  if (file.size > ACADEMY_LESSON_MAX_VIDEO_BYTES) {
    const maxMb = Math.round(ACADEMY_LESSON_MAX_VIDEO_BYTES / (1024 * 1024));
    const sizeMb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return { error: `Video is ${sizeMb}MB (max ${maxMb}MB).` };
  }
  return { mime };
}

/**
 * Upload a lesson video file (admin). Returns a public URL for `videoUrl` on the lesson.
 */
export async function uploadAcademyLessonVideoFile(
  file: File,
  courseId: string,
  lessonId: string,
  accessToken: string | null | undefined
): Promise<{ url: string } | { error: string }> {
  if (!accessToken) {
    return { error: "Not signed in." };
  }

  const validated = validateAcademyLessonVideoFile(file);
  if ("error" in validated) {
    return validated;
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return { error: "Not signed in." };
  }

  const mime = validated.mime;
  const ext = EXT_BY_MIME[mime] ?? "mp4";
  const safeCourse = courseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeLesson = lessonId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${safeCourse}/${safeLesson}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("academy-lessons")
    .upload(path, file, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message ?? "Upload failed." };
  }

  return { url: academyLessonVideoPublicUrl(path) };
}
