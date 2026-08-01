import type { ReactNode } from "react";

import type { AcademyRecommendedAction } from "@/lib/academy/lessonActions";
import type { AcademyResourceRow } from "@/lib/academy/resources";

import { AcademyMarkdown } from "./AcademyMarkdown";
import { LessonActionsPanel } from "./LessonActionsPanel";
import { LessonGuideCta } from "./LessonGuideCta";
import { LessonResourcesPanel } from "./LessonResourcesPanel";

type Props = {
  courseId: string;
  lessonId: string;
  bodyMarkdown: string;
  /** Shows the link through to the Guide tab. */
  hasGuide?: boolean;
  recommendedActions?: AcademyRecommendedAction[];
  resources?: AcademyResourceRow[];
  /** When overview is empty and there's no markdown fallback. */
  emptyOverview?: ReactNode;
  readOnlyActions?: boolean;
};

export function LessonOverviewPanel({
  courseId,
  lessonId,
  bodyMarkdown,
  hasGuide = false,
  recommendedActions = [],
  resources = [],
  emptyOverview,
  readOnlyActions = false,
}: Props) {
  const overview = bodyMarkdown.trim() ? (
    <AcademyMarkdown markdown={bodyMarkdown} />
  ) : (
    (emptyOverview ?? (
      <p className="text-sm text-slate-500">No overview for this lesson yet.</p>
    ))
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.85fr)] lg:items-start">
      <div className="min-w-0">
        {overview}
        {hasGuide ? <LessonGuideCta /> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <LessonActionsPanel
          courseId={courseId}
          lessonId={lessonId}
          recommendedActions={recommendedActions}
          readOnly={readOnlyActions}
        />
        {resources.length > 0 ? (
          <LessonResourcesPanel resources={resources} compact />
        ) : null}
      </div>
    </div>
  );
}
