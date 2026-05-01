import { notFound } from "next/navigation";

import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { findCourse, loadAcademyCatalog } from "@/lib/academy/catalog";

const BASE = "/admin/academy";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const catalog = await loadAcademyCatalog();
  const found = findCourse(catalog, courseId);
  if (!found) notFound();

  const lesson = found.course.lessons?.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  return (
    <div className="flex flex-col gap-4 pt-6">
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950"
        role="note"
      >
        <strong className="font-semibold">Admin:</strong> edit this lesson in{" "}
        <code className="rounded bg-amber-100/80 px-1">content/academy/catalog.json</code>, then
        deploy.
      </div>
      <ClassroomLessonPlayer
        category={found.category}
        course={found.course}
        lesson={lesson}
        basePath={BASE}
      />
    </div>
  );
}
