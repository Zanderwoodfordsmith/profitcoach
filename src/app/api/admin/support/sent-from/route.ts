import { NextResponse } from "next/server";

import { resolveClassroomLessonId } from "@/lib/academy/classroomIdAliases";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import { lessonContext } from "@/lib/academy/hubCatalog";
import { requireAdmin } from "@/lib/requireAdmin";
import { chatPageFor } from "@/lib/support/chatPages";

const LESSON_PATH = /^\/coach\/academy\/classroom\/[^/]+\/([^/?#]+)/;

/**
 * The page a coach was on when they sent a Support message (25 Nov), in
 * words: a lesson gives its title and course, any other page its name.
 */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error !== null) return NextResponse.json({ error: check.error }, { status: 401 });
  const path = new URL(request.url).searchParams.get("path")?.trim() ?? "";
  if (!path) return NextResponse.json({ error: "Which page?" }, { status: 400 });

  const lessonId = LESSON_PATH.exec(path)?.[1];
  if (lessonId) {
    const hit = lessonContext(loadClassroomHub(), resolveClassroomLessonId(decodeURIComponent(lessonId)));
    if (hit) {
      const where = [hit.course.title, hit.section.title].filter(Boolean).join(" · ");
      return NextResponse.json({ title: hit.lesson.title, detail: `Lesson in ${where}` });
    }
  }
  const page = chatPageFor(path.split(/[?#]/)[0]);
  return NextResponse.json({ title: page?.name ?? path, detail: null });
}
