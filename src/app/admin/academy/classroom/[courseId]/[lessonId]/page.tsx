import { notFound } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { findCourse, loadAcademyCatalog } from "@/lib/academy/catalog";

const BASE = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyClassroomLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const catalog = await loadAcademyCatalog();
  const found = findCourse(catalog, courseId);
  if (!found) notFound();

  const lesson = found.course.lessons?.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  return (
    <div className="pt-6">
      <ClassroomLessonPlayer
        category={found.category}
        course={found.course}
        lesson={lesson}
        basePath={BASE}
      />
    </div>
  );
}
