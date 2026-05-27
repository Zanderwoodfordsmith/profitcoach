import { notFound } from "next/navigation";

import { AdminClassroomLessonEditor } from "@/components/academy/AdminClassroomLessonEditor";
import { findCourse } from "@/lib/academy/catalog";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyClassroomLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const catalog = await loadAcademyCatalogWithDb();
  const found = findCourse(catalog, courseId);
  if (!found) notFound();

  const lesson = found.course.lessons?.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  return (
    <div className="pt-6">
      <AdminClassroomLessonEditor
        category={found.category}
        course={found.course}
        lesson={lesson}
      />
    </div>
  );
}
