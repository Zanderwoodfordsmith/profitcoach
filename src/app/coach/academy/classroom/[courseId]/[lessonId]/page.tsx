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
import { loadClassroomCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
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

  const [course, lessonResources] = await Promise.all([
    loadClassroomCourseWithContent(baseCourse),
    loadLessonResources(contentSourceCourseId(lessonId), lessonId),
  ]);
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  const videoUrl = "videoUrl" in lesson ? lesson.videoUrl : null;
  const videoChapters =
    "videoChapters" in lesson && Array.isArray(lesson.videoChapters)
      ? lesson.videoChapters
      : [];
  const audioUrl = "audioUrl" in lesson ? lesson.audioUrl : null;
  const bodyMarkdown = "bodyMarkdown" in lesson ? lesson.bodyMarkdown : "";
  const guideMarkdown = "guideMarkdown" in lesson ? lesson.guideMarkdown : "";
  const transcriptText = "transcriptText" in lesson ? lesson.transcriptText : null;

  return (
    <div>
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        <ClassroomLessonPlayer
          data={data}
          course={course}
          lesson={lesson}
          basePath={BASE}
          classroomHref={BASE}
          videoUrl={videoUrl}
          videoChapters={videoChapters}
          audioUrl={audioUrl}
          initialChapterId={initialChapterId ?? null}
          bodyMarkdown={bodyMarkdown}
          guideMarkdown={guideMarkdown}
          transcriptText={transcriptText}
          lessonResources={lessonResources}
          contentsPosition="left"
          chrome="minimal"
        />
      </LessonProgressProvider>
    </div>
  );
}
