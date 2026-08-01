import { patchHubLessonContent } from "@/lib/academy/adminHubLessonContent";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  return patchHubLessonContent(request, await context.params, loadArchiveHub());
}
