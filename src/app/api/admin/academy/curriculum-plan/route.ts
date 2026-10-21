import { NextResponse } from "next/server";

import {
  curriculumPatchToDb,
  curriculumPlanItemFromDb,
  type CurriculumPlanItemDbRow,
} from "@/lib/academy/curriculumPlan";
import { curriculumPlanCourses } from "@/lib/academy/curriculumPlanLoad";
import { findLessonInCourse } from "@/lib/academy/hubCatalog";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Create a plan row. With `lessonId` it is the plan for a current lesson in
 * any board course (one per lesson, so it upserts); without, it is a new lesson.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const courseId = typeof body.courseId === "string" ? body.courseId : "";
  const lessonId =
    typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;

  const course = curriculumPlanCourses().find((pc) => pc.course.id === courseId)?.course;
  if (!course) {
    return NextResponse.json({ error: "Unknown course." }, { status: 400 });
  }
  if (lessonId && !findLessonInCourse(course, lessonId)) {
    return NextResponse.json({ error: "That lesson is not in this course." }, { status: 400 });
  }

  let fields: Record<string, unknown>;
  try {
    fields = curriculumPatchToDb(body.patch ?? {});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid fields.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const row = {
    decision: lessonId ? "undecided" : "new",
    ...fields,
    course_id: courseId,
    lesson_id: lessonId,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };

  const query = lessonId
    ? supabaseAdmin
        .from("curriculum_plan_items")
        .upsert(row, { onConflict: "lesson_id" })
    : supabaseAdmin.from("curriculum_plan_items").insert(row);

  const { data, error } = await query.select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    item: curriculumPlanItemFromDb(data as CurriculumPlanItemDbRow),
  });
}
