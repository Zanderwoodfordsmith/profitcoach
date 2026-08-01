import { NextResponse } from "next/server";

import {
  addAcademyLessonAction,
  loadAcademyLessonActionItems,
  setAcademyLessonActionDone,
} from "@/lib/actionPlans/academyLessonActions";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import { progressCourseId } from "@/lib/academy/programmeContentSource";

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { courseId, lessonId } = await context.params;
  try {
    const items = await loadAcademyLessonActionItems(
      authCheck.userId,
      progressCourseId(courseId, lessonId),
      lessonId
    );
    return NextResponse.json({ items });
  } catch (err) {
    console.error("academy lesson-actions GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 500 }
    );
  }
}

type PostBody = {
  text?: string;
  recommendedActionId?: string | null;
  done?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { courseId, lessonId } = await context.params;
  try {
    const body = (await request.json()) as PostBody;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Action text is required." }, { status: 400 });
    }

    const item = await addAcademyLessonAction(authCheck.userId, {
      courseId: progressCourseId(courseId, lessonId),
      lessonId,
      text,
      recommendedActionId: body.recommendedActionId ?? null,
      done: body.done,
    });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("academy lesson-actions POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 500 }
    );
  }
}

type PatchBody = {
  actionId?: string;
  done?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  // courseId/lessonId reserved for future scoping checks
  await context.params;

  try {
    const body = (await request.json()) as PatchBody;
    if (!body.actionId || typeof body.done !== "boolean") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const item = await setAcademyLessonActionDone(
      authCheck.userId,
      body.actionId,
      body.done
    );
    return NextResponse.json({ item });
  } catch (err) {
    console.error("academy lesson-actions PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 500 }
    );
  }
}
