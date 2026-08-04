import { supabaseClient } from "@/lib/supabaseClient";

/** Comfortable ceiling for lesson MP3s (audiobook-length sessions). */
export const ACADEMY_LESSON_MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200 MB

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

function academyLessonAudioPublicUrl(path: string): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/academy-lessons/${path}`;
}

function resolveAudioMime(file: File): string | null {
  const trimmed = file.type?.trim().toLowerCase();
  if (trimmed?.startsWith("audio/")) return trimmed;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_MIME_BY_EXT[ext] ?? null;
}

function validateAcademyLessonAudioFile(file: File): { mime: string; ext: string } | { error: string } {
  const mime = resolveAudioMime(file);
  if (!mime) {
    return { error: "File must be audio (MP3, M4A, AAC, WAV, or OGG)." };
  }
  if (file.size > ACADEMY_LESSON_MAX_AUDIO_BYTES) {
    const maxMb = Math.round(ACADEMY_LESSON_MAX_AUDIO_BYTES / (1024 * 1024));
    const sizeMb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return { error: `Audio is ${sizeMb}MB (max ${maxMb}MB).` };
  }
  const extFromName = file.name.split(".").pop()?.toLowerCase();
  const ext =
    extFromName && AUDIO_MIME_BY_EXT[extFromName]
      ? extFromName
      : mime === "audio/mpeg"
        ? "mp3"
        : mime === "audio/mp4"
          ? "m4a"
          : "mp3";
  return { mime, ext };
}

/**
 * Upload a lesson audio file (admin). Returns a public URL for `audioUrl` on the lesson.
 */
export async function uploadAcademyLessonAudioFile(
  file: File,
  courseId: string,
  lessonId: string,
  accessToken: string | null | undefined
): Promise<{ url: string } | { error: string }> {
  if (!accessToken) {
    return { error: "Not signed in." };
  }

  const validated = validateAcademyLessonAudioFile(file);
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

  const safeCourse = courseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeLesson = lessonId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${safeCourse}/${safeLesson}/audio-${crypto.randomUUID()}.${validated.ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("academy-lessons")
    .upload(path, file, {
      contentType: validated.mime,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message ?? "Upload failed." };
  }

  return { url: academyLessonAudioPublicUrl(path) };
}
