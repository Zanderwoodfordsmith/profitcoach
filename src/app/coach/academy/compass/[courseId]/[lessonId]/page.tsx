import { notFound } from "next/navigation";

import { CompassLessonPlayer } from "@/components/academy/CompassLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { findCourse } from "@/lib/academy/compassCatalog";
import { slimCompassCategory, slimCompassCourse, slimCompassLesson } from "@/lib/academy/compassLessonContent";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";

const BASE = "/coach/academy/compass";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function CoachAcademyClassroomLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const catalog = await loadAcademyCatalogWithDb();
  const found = findCourse(catalog, courseId);
  if (!found) notFound();

  const lesson = found.course.lessons?.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  return (
    <div className="pt-6">
      <LessonProgressProvider courseId={courseId} activeLessonId={lessonId}>
        {/* Titles only: video, text and transcript load through the lesson API, which needs a member login. */}
        <CompassLessonPlayer
          category={slimCompassCategory(found.category)}
          course={slimCompassCourse(found.course)}
          lesson={slimCompassLesson(lesson)}
          contentUrl={`/api/academy/lesson?${new URLSearchParams({ hub: "compass", courseId, lessonId })}`}
          basePath={BASE}
        />
      </LessonProgressProvider>
    </div>
  );
}
