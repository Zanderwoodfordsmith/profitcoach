import type { AcademyRecommendedAction } from "@/lib/academy/lessonActions";

export type LessonEditSnapshot = {
  title: string;
  videoUrl: string;
  duration: string;
  bodyMarkdown: string;
  guideMarkdown: string;
  recommendedActions: AcademyRecommendedAction[];
};

function normalizeActions(actions: AcademyRecommendedAction[]) {
  return actions
    .filter((action) => action.text.trim())
    .map((action) => ({ id: action.id, text: action.text.trim() }));
}

/** True when the draft differs from the last saved lesson content. */
export function isLessonEditDirty(
  draft: LessonEditSnapshot,
  saved: LessonEditSnapshot
): boolean {
  if (draft.title.trim() !== saved.title.trim()) return true;
  if (draft.videoUrl.trim() !== saved.videoUrl.trim()) return true;
  if (draft.duration.trim() !== saved.duration.trim()) return true;
  if (draft.bodyMarkdown !== saved.bodyMarkdown) return true;
  if (draft.guideMarkdown !== saved.guideMarkdown) return true;
  return (
    JSON.stringify(normalizeActions(draft.recommendedActions)) !==
    JSON.stringify(normalizeActions(saved.recommendedActions))
  );
}
