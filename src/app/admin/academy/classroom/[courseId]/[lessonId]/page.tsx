import { notFound, redirect } from "next/navigation";

import { AdminClassroomLessonEditor } from "@/components/academy/AdminClassroomLessonEditor";
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

const BASE = "/admin/academy/classroom";

type Props = {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ chapter?: string; t?: string }>;
};

export default async function AdminAcademyClassroomLessonPage({
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
          initialAudioUrl={lesson.audioUrl ?? null}
          initialBodyMarkdown={lesson.bodyMarkdown ?? ""}
          initialGuideMarkdown={lesson.guideMarkdown ?? ""}
          basePath={BASE}
          classroomHref={BASE}
          lessonResources={lessonResources}
          contentsPosition="left"
          chrome="minimal"
          hub="classroom"
          initialChapterId={initialChapterId ?? null}
        />
      </LessonProgressProvider>
    </div>
  );
}
