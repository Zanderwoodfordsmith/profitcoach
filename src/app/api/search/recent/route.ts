import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { hubLessonMeta } from "@/lib/search/classroomDisplay";
import type { SearchRecentLesson } from "@/lib/search/types";

export const dynamic = "force-dynamic";

const LIMIT = 8;

/** Lessons the caller opened most recently, newest first, for the search start screen. */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    const status =
      auth.error === "Missing access token." ||
      auth.error === "Invalid access token."
        ? 401
        : 403;
    return NextResponse.json({ error: auth.error ?? "Not authorized." }, { status });
  }

  const { data, error } = await supabaseAdmin
    .from("academy_lesson_views")
    .select("lesson_id, viewed_at")
    .eq("user_id", auth.userId)
    .order("viewed_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[search/recent]", error.message);
    return NextResponse.json({ error: "Could not load recent lessons." }, { status: 500 });
  }

  // One row per hub lesson: the same lesson can be stored under several course ids.
  const seen = new Set<string>();
  const lessons: SearchRecentLesson[] = [];
  for (const row of data ?? []) {
    const meta = hubLessonMeta(row.lesson_id as string);
    if (!meta || seen.has(meta.lessonId)) continue;
    seen.add(meta.lessonId);
    lessons.push({
      lesson_id: meta.lessonId,
      course_id: meta.courseId,
      title: meta.title,
      course_title: meta.courseTitle,
      viewed_at: row.viewed_at as string,
    });
    if (lessons.length >= LIMIT) break;
  }

  return NextResponse.json({ lessons });
}
