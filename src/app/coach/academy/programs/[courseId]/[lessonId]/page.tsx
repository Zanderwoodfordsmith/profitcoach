import { notFound } from "next/navigation";

import { LegacyAcademyLessonPlayer } from "@/components/academy/LegacyAcademyLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { findLegacyCourse, findLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";
import { loadLegacyCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";

const BASE = "/coach/academy/programs";
const CLASSROOM = "/coach/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function CoachAcademyProgramsLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const data = loadLegacyHub();
  const baseCourse = findLegacyCourse(data, courseId);
  if (!baseCourse) notFound();

  const course = await loadLegacyCourseWithContent(baseCourse);
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  const lessonResources = await loadLessonResources(courseId, lessonId);
  const videoUrl = "videoUrl" in lesson ? lesson.videoUrl : null;
  const bodyMarkdown = "bodyMarkdown" in lesson ? lesson.bodyMarkdown : "";
  const transcriptText = "transcriptText" in lesson ? lesson.transcriptText : null;

  return (
    <div className="pt-6">
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
        />
      </LessonProgressProvider>
    </div>
  );
}
