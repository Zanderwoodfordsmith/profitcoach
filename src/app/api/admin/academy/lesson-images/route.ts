import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import {
  ACADEMY_LESSON_IMAGE_BUCKET,
  ACADEMY_LESSON_MAX_IMAGE_BYTES,
  validateAcademyLessonImageFile,
} from "@/lib/academyLessonImage";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function publicUrlFor(path: string): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/${ACADEMY_LESSON_IMAGE_BUCKET}/${path}`;
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabaseAdmin.storage.getBucket(ACADEMY_LESSON_IMAGE_BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(ACADEMY_LESSON_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: ACADEMY_LESSON_MAX_IMAGE_BYTES,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status =
      check.error === "Server error." ? 500 : check.error === "Not authorized." ? 403 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  if (!courseId || !lessonId) {
    return NextResponse.json({ error: "courseId and lessonId are required." }, { status: 400 });
  }

  const validated = validateAcademyLessonImageFile(file);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    await ensureBucket();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not prepare image storage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const ext = EXT_BY_MIME[validated.mime] ?? "png";
  const safeCourse = courseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeLesson = lessonId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `editor/${safeCourse}/${safeLesson}/${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(ACADEMY_LESSON_IMAGE_BUCKET)
    .upload(path, buffer, {
      contentType: validated.mime,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message ?? "Upload failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: publicUrlFor(path) });
}
