import { notFound, redirect } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import {
  classroomIdsNeedRedirect,
  resolveClassroomCourseId,
  resolveClassroomLessonId,
} from "@/lib/academy/classroomIdAliases";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import {
  classroomCourseIdForLesson,
  loadClassroomHub,
} from "@/lib/academy/classroomHubLoad";
import { loadClassroomCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";

const BASE = "/coach/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function CoachAcademyClassroomLessonPage({ params }: Props) {
  const { courseId: rawCourseId, lessonId: rawLessonId } = await params;
  const lessonId = resolveClassroomLessonId(rawLessonId);
  const data = loadClassroomHub();
  const courseId =
    classroomCourseIdForLesson(data, lessonId) ??
    resolveClassroomCourseId(rawCourseId);

  if (
    classroomIdsNeedRedirect(rawCourseId, rawLessonId) ||
    courseId !== rawCourseId ||
    lessonId !== rawLessonId
  ) {
    redirect(
      `${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`
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
          audioUrl={audioUrl}
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
