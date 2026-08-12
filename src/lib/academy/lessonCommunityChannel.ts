import {
  FEEDBACK_REQUEST_CATEGORY_SLUG,
  QA_CATEGORY_LABEL,
} from "@/lib/coachAccess/tiers";

/** Start Here onboarding lessons that post into a dedicated community channel. */
export const MEMBER_WINS_LESSON_ID = "start-here-welcome-member-wins";
export const INTRODUCE_YOURSELF_LESSON_ID =
  "start-here-welcome-introduce-yourself";

const WINS_CATEGORY_SLUG = "wins";
const INTROS_CATEGORY_SLUG = "intros";

/**
 * Community category slug for a lesson Ask & Share tab.
 * Member Wins → Wins channel; Introduce Yourself → Intros; everything else → Ask & Share.
 * New posts stay `post_scope=lesson_qa`; dedicated lesson panels also include
 * the full matching community channel history.
 */
export function lessonCommunityCategorySlug(lessonId: string): string {
  if (lessonId === MEMBER_WINS_LESSON_ID) return WINS_CATEGORY_SLUG;
  if (lessonId === INTRODUCE_YOURSELF_LESSON_ID) return INTROS_CATEGORY_SLUG;
  return FEEDBACK_REQUEST_CATEGORY_SLUG;
}

/** Whether the lesson panel represents a complete community channel. */
export function lessonUsesCommunityChannelHistory(lessonId: string): boolean {
  return (
    lessonId === MEMBER_WINS_LESSON_ID ||
    lessonId === INTRODUCE_YOURSELF_LESSON_ID
  );
}

/** Tab / empty-state label for the lesson community panel. */
export function lessonCommunityTabLabel(lessonId: string): string {
  if (lessonId === MEMBER_WINS_LESSON_ID) return "Wins";
  if (lessonId === INTRODUCE_YOURSELF_LESSON_ID) return "Intros";
  return QA_CATEGORY_LABEL;
}

export function lessonCommunityComposerPlaceholder(lessonId: string): string {
  if (lessonId === MEMBER_WINS_LESSON_ID) return "Share a win…";
  if (lessonId === INTRODUCE_YOURSELF_LESSON_ID) {
    return "Introduce yourself to the community…";
  }
  return "Ask a question or share something…";
}

export function lessonCommunityPublicVisibilityTitle(lessonId: string): string {
  const channel = lessonCommunityTabLabel(lessonId);
  return `Everyone can see this in ${channel}`;
}
