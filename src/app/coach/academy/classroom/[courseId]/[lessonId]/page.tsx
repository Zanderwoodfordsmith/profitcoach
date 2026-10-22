import { notFound, redirect } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
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
import {
  slimLessonShell,
  stripInactiveLessonBodies,
  withClassroomMetadata,
} from "@/lib/academy/lessonContent";
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

  // Hidden or removed lessons: old links land on the course page.
  const visibleCourse = applyLegacyCourseVisibility(
    await withClassroomMetadata(baseCourse),
  );
  if (!findLessonInCourse(visibleCourse, lessonId)) {
    redirect(`${BASE}/${encodeURIComponent(baseCourse.id)}`);
  }

  // Titles only: video, text and transcript load through the lesson API,
  // which needs a member login (the server can't see the login here).
  const shellCourse = stripInactiveLessonBodies(visibleCourse, null);
  const contentUrl = `/api/academy/lesson?${new URLSearchParams({
    hub: "classroom",
    courseId,
    lessonId,
  })}`;

  return (
    <div>
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        <ClassroomLessonPlayer
          course={shellCourse}
          lesson={slimLessonShell(baseLesson)}
          contentUrl={contentUrl}
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
