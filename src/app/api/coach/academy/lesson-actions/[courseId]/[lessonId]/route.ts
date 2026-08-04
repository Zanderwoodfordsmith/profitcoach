import { NextResponse } from "next/server";

import {
  addAcademyLessonAction,
  setAcademyLessonActionDone,
} from "@/lib/actionPlans/academyLessonActions";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import { progressCourseId } from "@/lib/academy/programmeContentSource";
import {
  isAcademyRecommendedActionTracked,
  syncAcademyLessonTrackedActions,
} from "@/lib/academy/syncAcademyTrackedActions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  const canonicalCourseId = progressCourseId(courseId, lessonId);
  try {
    const items = await syncAcademyLessonTrackedActions(
      authCheck.userId,
      canonicalCourseId,
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
  const canonicalCourseId = progressCourseId(courseId, lessonId);
  try {
    const body = (await request.json()) as PostBody;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Action text is required." }, { status: 400 });
    }

    if (body.recommendedActionId && body.done) {
      const tracked = await isAcademyRecommendedActionTracked(
        canonicalCourseId,
        lessonId,
        body.recommendedActionId
      );
      if (tracked) {
        return NextResponse.json(
          {
            error:
              "This action completes automatically when you do it — it cannot be ticked off manually.",
          },
          { status: 400 }
        );
      }
    }

    const item = await addAcademyLessonAction(authCheck.userId, {
      courseId: canonicalCourseId,
      lessonId,
      text,
      recommendedActionId: body.recommendedActionId ?? null,
      done: body.done,
      doneSource: body.done ? "manual" : null,
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

  const { courseId, lessonId } = await context.params;
  const canonicalCourseId = progressCourseId(courseId, lessonId);

  try {
    const body = (await request.json()) as PatchBody;
    if (!body.actionId || typeof body.done !== "boolean") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("coach_action_items")
      .select("id, academy_recommended_action_id, academy_course_id, academy_lesson_id")
      .eq("id", body.actionId)
      .eq("coach_id", authCheck.userId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!existing) {
      return NextResponse.json({ error: "Action not found." }, { status: 404 });
    }

    const recommendedId = existing.academy_recommended_action_id as string | null;
    if (recommendedId) {
      const tracked = await isAcademyRecommendedActionTracked(
        (existing.academy_course_id as string | null) ?? canonicalCourseId,
        (existing.academy_lesson_id as string | null) ?? lessonId,
        recommendedId
      );
      if (tracked) {
        return NextResponse.json(
          {
            error:
              "This action completes automatically when you do it — it cannot be ticked off manually.",
          },
          { status: 400 }
        );
      }
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
