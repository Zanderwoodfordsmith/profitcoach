import { notFound } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";
import { findCourse } from "@/lib/academy/catalog";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";

const BASE = "/coach/academy/classroom";

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
      <LessonProgressProvider courseId={courseId}>
        <ClassroomLessonPlayer
          category={found.category}
          course={found.course}
          lesson={lesson}
          basePath={BASE}
        />
      </LessonProgressProvider>
    </div>
  );
}
