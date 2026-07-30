import { notFound } from "next/navigation";

import { LegacyAcademyLessonPlayer } from "@/components/academy/LegacyAcademyLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { findLegacyCourse, findLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadSimplifiedCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";
import {
  contentSourceCourseId,
  loadSimplifiedHub,
} from "@/lib/academy/simplifiedHubLoad";

const BASE = "/admin/academy/simplified";
const CLASSROOM = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademySimplifiedLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const data = loadSimplifiedHub();
  const baseCourse = findLegacyCourse(data, courseId);
  if (!baseCourse) notFound();

  const course = await loadSimplifiedCourseWithContent(baseCourse);
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  const lessonResources = await loadLessonResources(
    contentSourceCourseId(lessonId),
    lessonId
  );
  const videoUrl = "videoUrl" in lesson ? lesson.videoUrl : null;
  const bodyMarkdown = "bodyMarkdown" in lesson ? lesson.bodyMarkdown : "";
  const transcriptText = "transcriptText" in lesson ? lesson.transcriptText : null;

  return (
    <div>
      <LessonProgressProvider courseId={courseId}>
        <LegacyAcademyLessonPlayer
          data={data}
          course={course}
          lesson={lesson}
          basePath={BASE}
          classroomHref={CLASSROOM}
          videoUrl={videoUrl}
          bodyMarkdown={bodyMarkdown}
          transcriptText={transcriptText}
          lessonResources={lessonResources}
          contentsPosition="left"
          chrome="minimal"
        />
      </LessonProgressProvider>
    </div>
  );
}
