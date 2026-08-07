import { notFound } from "next/navigation";

import { AdminCompassLessonEditor } from "@/components/academy/AdminCompassLessonEditor";
import { findCourse } from "@/lib/academy/compassCatalog";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyClassroomLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const catalog = await loadAcademyCatalogWithDb({ includeDrafts: true });
  const found = findCourse(catalog, courseId);
  if (!found) notFound();

  const lesson = found.course.lessons?.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  return (
    <div className="pt-6">
      <AdminCompassLessonEditor
        category={found.category}
        course={found.course}
        lesson={lesson}
      />
    </div>
  );
}
