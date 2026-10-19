import { patchHubLessonContent } from "@/lib/academy/adminHubLessonContent";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  return patchHubLessonContent(request, await context.params, loadVaultHub());
}
