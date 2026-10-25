import { ExternalLink } from "lucide-react";

import { resolveClassroomLessonId } from "@/lib/academy/classroomIdAliases";
import { SALES_NAV_BASE_SEARCH_URL } from "@/lib/salesNavigator/salesNavLinks";

import {
  SALES_NAV_BASE_SEARCH_LESSON_ID,
  SALES_NAV_CONSOLIDATED_LESSON_ID,
} from "@/lib/academy/lessonVideoChapters";
import { buttonClass } from "@/components/ui/Button";

const BASE_SEARCH_LESSON_ID = SALES_NAV_BASE_SEARCH_LESSON_ID;

/** Shown on Build Your Base Search (legacy or consolidated Sales Nav lesson). */
export function LessonBaseSearchCta({ lessonId }: { lessonId: string }) {
  const resolved = resolveClassroomLessonId(lessonId);
  if (
    resolved !== BASE_SEARCH_LESSON_ID &&
    resolved !== SALES_NAV_CONSOLIDATED_LESSON_ID
  ) {
    return null;
  }

  return (
    <a
      href={SALES_NAV_BASE_SEARCH_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass("main", "normal", "mb-6 h-auto! min-h-10 max-w-full py-2.5 whitespace-normal!")}
    >
      Look, we&apos;ve done this for you. Now just click here
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
  );
}
