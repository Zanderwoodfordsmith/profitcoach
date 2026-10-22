import { NextResponse } from "next/server";

import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import { loadClassroomLessonPayload } from "@/lib/academy/classroomLessonPayload";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";
import { academyCourseLocked } from "@/lib/coachAccess/gatedRoutes";
import {
  coachHasFeature,
  resolveCoachAccessForUserId,
} from "@/lib/coachAccess/resolveCoachAccess";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

/**
 * Lesson video, text and transcript for the coach Classroom and Vault.
 * The lesson pages render only titles on the server, so paid content goes
 * out only to a signed-in member whose plan includes the programme.
 */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const url = new URL(request.url);
  const hub = url.searchParams.get("hub");
  const courseId = url.searchParams.get("courseId") ?? "";
  const lessonId = url.searchParams.get("lessonId") ?? "";
  if ((hub !== "classroom" && hub !== "vault") || !courseId || !lessonId) {
    return NextResponse.json({ error: "Missing lesson." }, { status: 400 });
  }

  // Admins browsing as themselves see everything; view-as follows the coach's plan.
  const adminSelf = auth.callerIsAdmin && auth.userId === auth.callerId;
  if (!adminSelf) {
    const access = await resolveCoachAccessForUserId(auth.userId);
    if (academyCourseLocked(courseId, (f) => coachHasFeature(access, f))) {
      return NextResponse.json({ error: "Not in your plan." }, { status: 403 });
    }
  }

  const course = findHubCourse(
    hub === "vault" ? loadVaultHub() : loadClassroomHub(),
    courseId,
  );
  if (!course || !findLessonInCourse(course, lessonId)) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  // Throws when the lesson is hidden or removed.
  const payload = await loadClassroomLessonPayload(course, lessonId).catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
