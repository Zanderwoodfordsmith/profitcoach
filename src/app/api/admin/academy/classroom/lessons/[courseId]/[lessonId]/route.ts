import { patchHubLessonContent } from "@/lib/academy/adminHubLessonContent";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  return patchHubLessonContent(request, await context.params, loadClassroomHub());
}
