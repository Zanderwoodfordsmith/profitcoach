import {
  EXT_BY_MIME,
  maxBytesForCommunityPostMime,
  mediaKindForMime,
  resolveCommunityPostMediaMime,
  validateCommunityPostMediaFile,
} from "@/lib/communityPostMedia";
import { supabaseClient } from "@/lib/supabaseClient";

function academyLessonVideoPublicUrl(path: string): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/academy-lessons/${path}`;
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

  const validated = validateCommunityPostMediaFile(file);
  if ("error" in validated) {
    return validated;
  }
  if (validated.kind !== "video") {
    return { error: "File must be a video (MP4, WebM, or MOV)." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return { error: "Not signed in." };
  }

  const mime = resolveCommunityPostMediaMime(file);
  if (!mime || mediaKindForMime(mime) !== "video") {
    return { error: "File must be a video (MP4, WebM, or MOV)." };
  }
  if (file.size > maxBytesForCommunityPostMime(mime)) {
    const mb = Math.round(maxBytesForCommunityPostMime(mime) / (1024 * 1024));
    return { error: `Video must be ${mb}MB or smaller.` };
  }

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
