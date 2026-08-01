import { notFound } from "next/navigation";

import { AdminClassroomLessonEditor } from "@/components/academy/AdminClassroomLessonEditor";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadClassroomCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

const BASE = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyClassroomLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const data = loadClassroomHub();
  const baseCourse = findHubCourse(data, courseId);
  if (!baseCourse) notFound();

  const [course, lessonResources] = await Promise.all([
    loadClassroomCourseWithContent(baseCourse, { includeDrafts: true }),
    loadLessonResources(contentSourceCourseId(lessonId), lessonId),
  ]);
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  return (
    <div>
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        <AdminClassroomLessonEditor
          data={data}
          course={course}
          lesson={lesson}
          initialVideoUrl={lesson.videoUrl ?? null}
          initialBodyMarkdown={lesson.bodyMarkdown ?? ""}
          initialGuideMarkdown={lesson.guideMarkdown ?? ""}
          basePath={BASE}
          classroomHref={BASE}
          lessonResources={lessonResources}
          contentsPosition="left"
          chrome="minimal"
          hub="classroom"
        />
      </LessonProgressProvider>
    </div>
  );
}
