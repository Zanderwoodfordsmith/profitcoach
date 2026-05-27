import { notFound } from "next/navigation";

import { AdminLegacyAcademyLessonEditor } from "@/components/academy/AdminLegacyAcademyLessonEditor";
import { findLegacyCourse, findLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";
import { loadLegacyCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";

const BASE = "/admin/academy/programs";
const CLASSROOM = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyProgramsLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const data = loadLegacyHub();
  const baseCourse = findLegacyCourse(data, courseId);
  if (!baseCourse) notFound();

  const course = await loadLegacyCourseWithContent(baseCourse);
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  const lessonResources = await loadLessonResources(courseId, lessonId);

  return (
    <div className="pt-6">
      <AdminLegacyAcademyLessonEditor
        data={data}
        course={course}
        lesson={lesson}
        initialVideoUrl={lesson.videoUrl ?? null}
        initialBodyMarkdown={lesson.bodyMarkdown ?? ""}
        basePath={BASE}
        classroomHref={CLASSROOM}
        lessonResources={lessonResources}
      />
    </div>
  );
}
