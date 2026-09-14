import { notFound, redirect } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { loadClassroomLessonPayload } from "@/lib/academy/classroomLessonPayload";
import {
  classroomIdsNeedRedirect,
  classroomLessonQueryString,
  resolveClassroomCourseId,
  resolveClassroomLessonId,
} from "@/lib/academy/classroomIdAliases";
import { isRetiredClassroomCourseId } from "@/lib/academy/classroomIds";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import {
  classroomCourseIdForLesson,
  loadClassroomHub,
} from "@/lib/academy/classroomHubLoad";
import { stripInactiveLessonBodies } from "@/lib/academy/lessonContent";
import { applyLegacyCourseVisibility } from "@/lib/academy/lessonVisibility";
import {
  legacyConsolidatedChapterRedirect,
} from "@/lib/academy/lessonVideoChapters";

const BASE = "/coach/academy/classroom";

type Props = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ chapter?: string; t?: string }>;
};

export default async function CoachAcademyClassroomLessonPage({
  params,
  searchParams,
}: Props) {
  const { courseId: rawCourseId, lessonId: rawLessonId } = await params;
  const { chapter: initialChapterId, t: seekSeconds } = await searchParams;
  const lessonId = resolveClassroomLessonId(rawLessonId);
  const data = loadClassroomHub();
  const remappedCourseId = classroomCourseIdForLesson(data, lessonId);
  const courseId = remappedCourseId ?? resolveClassroomCourseId(rawCourseId);
  const keepQuery = (chapter?: string | null) =>
    classroomLessonQueryString({
      chapter: chapter ?? initialChapterId,
      t: seekSeconds,
    });

  // Retired Profit Coach OS path: send remapped lessons to their new cards,
  // otherwise drop bookmarks on the classroom catalog.
  if (
    isRetiredClassroomCourseId(rawCourseId) ||
    isRetiredClassroomCourseId(courseId)
  ) {
    if (remappedCourseId) {
      redirect(
        `${BASE}/${encodeURIComponent(remappedCourseId)}/${encodeURIComponent(lessonId)}${keepQuery()}`
      );
    }
    redirect(BASE);
  }

  if (
    classroomIdsNeedRedirect(rawCourseId, rawLessonId) ||
    courseId !== rawCourseId ||
    lessonId !== rawLessonId
  ) {
    redirect(
      `${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}${keepQuery()}`
    );
  }

  const legacyRedirect = legacyConsolidatedChapterRedirect(lessonId);
  if (legacyRedirect) {
    redirect(
      `${BASE}/${encodeURIComponent(legacyRedirect.courseId)}/${encodeURIComponent(legacyRedirect.lessonId)}${keepQuery(
        legacyRedirect.chapter
      )}`
    );
  }

  const baseCourse = findHubCourse(data, courseId);
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
        />
      </LessonProgressProvider>
    </div>
  );
}
