import { notFound, redirect } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { classroomLessonQueryString } from "@/lib/academy/classroomIdAliases";
import { loadClassroomLessonPayload } from "@/lib/academy/classroomLessonPayload";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import { stripInactiveLessonBodies } from "@/lib/academy/lessonContent";
import { legacyConsolidatedChapterRedirect } from "@/lib/academy/lessonVideoChapters";
import { applyLegacyCourseVisibility } from "@/lib/academy/lessonVisibility";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";

const BASE = "/coach/academy/vault";

type Props = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ chapter?: string; t?: string }>;
};

export default async function CoachAcademyVaultLessonPage({ params, searchParams }: Props) {
  const { courseId, lessonId } = await params;
  const { chapter: initialChapterId, t: seekSeconds } = await searchParams;

  // Single videos that became chapters of a merged lesson.
  const merged = legacyConsolidatedChapterRedirect(lessonId);
  if (merged && merged.courseId === courseId) {
    redirect(
      `${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(merged.lessonId)}${classroomLessonQueryString(
        { chapter: merged.chapter, t: seekSeconds }
      )}`
    );
  }

  const baseCourse = findHubCourse(loadVaultHub(), courseId);
  if (!baseCourse) notFound();
  const baseLesson = findLessonInCourse(baseCourse, lessonId);
  if (!baseLesson) notFound();

  const shellCourse = stripInactiveLessonBodies(
    applyLegacyCourseVisibility(baseCourse),
    lessonId,
  );

  // Do not await — the rail and title paint from hub JSON while this loads.
  const contentPromise = loadClassroomLessonPayload(baseCourse, lessonId);

  return (
    <div>
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        <ClassroomLessonPlayer
          course={shellCourse}
          lesson={baseLesson}
          contentPromise={contentPromise}
          basePath={BASE}
          classroomHref={BASE}
          initialChapterId={initialChapterId ?? null}
          contentsPosition="left"
          chrome="minimal"
          contentsBackLabel="Vault"
          chapterStepsGuide={false}
        />
      </LessonProgressProvider>
    </div>
  );
}
