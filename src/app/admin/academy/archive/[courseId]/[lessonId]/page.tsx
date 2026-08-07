import { notFound } from "next/navigation";

import { AdminClassroomLessonEditor } from "@/components/academy/AdminClassroomLessonEditor";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";
import { loadClassroomCourseWithContent } from "@/lib/academy/lessonContent";
import { loadLessonResources } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";

const BASE = "/admin/academy/archive";
const CLASSROOM_HUB = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyArchiveLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const data = loadArchiveHub();
  const baseCourse = findHubCourse(data, courseId);
  if (!baseCourse) notFound();

  // Archive course mixes Kickstart / Client Acquisition / Client Delivery ids.
  const course = await loadClassroomCourseWithContent(baseCourse, {
    includeDrafts: true,
  });
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  const lessonResources = await loadLessonResources(
    contentSourceCourseId(lessonId),
    lessonId,
  );

  return (
    <div>
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        <AdminClassroomLessonEditor
          data={data}
          course={course}
          lesson={lesson}
          initialVideoUrl={lesson.videoUrl ?? null}
          initialAudioUrl={lesson.audioUrl ?? null}
          initialBodyMarkdown={lesson.bodyMarkdown ?? ""}
          initialGuideMarkdown={lesson.guideMarkdown ?? ""}
          basePath={BASE}
          classroomHref={CLASSROOM_HUB}
          lessonResources={lessonResources}
          contentsPosition="left"
          chrome="minimal"
          contentsBackLabel={null}
          hub="archive"
        />
      </LessonProgressProvider>
    </div>
  );
}
