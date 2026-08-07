import { NextResponse } from "next/server";

import { setAcademyLessonVisibility } from "@/lib/academy/lessonContent";
import { requireAdmin } from "@/lib/requireAdmin";

type Body = {
  draft?: boolean;
};

/**
 * Admin lesson visibility: draft (admins only) and soft-delete.
 * `courseId` must be the content storage course id (programs / classroom id,
 * or simplified `contentSourceCourseId(lessonId)`).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { courseId, lessonId } = await context.params;
  const body = (await request.json()) as Body;

  if (typeof body.draft !== "boolean") {
    return NextResponse.json(
      { error: "Expected { draft: boolean }." },
      { status: 400 }
    );
  }

  try {
    const row = await setAcademyLessonVisibility({
      courseId,
      lessonId,
      isDraft: body.draft,
    });
    return NextResponse.json({
      courseId,
      lessonId,
      draft: row?.is_draft === true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update draft." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const check = await requireAdmin(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  const { courseId, lessonId } = await context.params;

  try {
    await setAcademyLessonVisibility({
      courseId,
      lessonId,
      isDeleted: true,
    });
    return NextResponse.json({ ok: true, courseId, lessonId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete lesson." },
      { status: 500 }
    );
  }
}
