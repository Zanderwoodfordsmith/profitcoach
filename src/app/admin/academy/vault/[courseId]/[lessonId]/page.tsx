import { notFound, redirect } from "next/navigation";

import { AdminClassroomLessonEditor } from "@/components/academy/AdminClassroomLessonEditor";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { classroomLessonQueryString } from "@/lib/academy/classroomIdAliases";
import { findHubCourse, findLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadClassroomCourseWithContent } from "@/lib/academy/lessonContent";
import { legacyConsolidatedChapterRedirect } from "@/lib/academy/lessonVideoChapters";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { loadLessonResources } from "@/lib/academy/resources";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";

const BASE = "/admin/academy/vault";

type Props = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ chapter?: string; t?: string }>;
};

export default async function AdminAcademyVaultLessonPage({ params, searchParams }: Props) {
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

  const [course, lessonResources] = await Promise.all([
    loadClassroomCourseWithContent(baseCourse, {
      includeDrafts: true,
      activeLessonId: lessonId,
    }),
    loadLessonResources(contentSourceCourseId(lessonId), lessonId),
  ]);
  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  return (
    <div>
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        <AdminClassroomLessonEditor
          course={course}
          lesson={lesson}
          initialVideoUrl={lesson.videoUrl ?? null}
          initialAudioUrl={lesson.audioUrl ?? null}
          initialBodyMarkdown={lesson.bodyMarkdown ?? ""}
          initialGuideMarkdown={lesson.guideMarkdown ?? ""}
          basePath={BASE}
          classroomHref={BASE}
          lessonResources={lessonResources}
          contentsPosition="left"
          chrome="minimal"
          hub="vault"
          initialChapterId={initialChapterId ?? null}
        />
      </LessonProgressProvider>
    </div>
  );
}
