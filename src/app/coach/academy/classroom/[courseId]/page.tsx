import { notFound, redirect } from "next/navigation";

import { findCourse, loadAcademyCatalog } from "@/lib/academy/catalog";

const BASE = "/coach/academy/classroom";

type Props = { params: Promise<{ courseId: string }> };

export default async function CoachAcademyClassroomCourseEntryPage({ params }: Props) {
  const { courseId } = await params;
  const catalog = await loadAcademyCatalog();
  const found = findCourse(catalog, courseId);
  if (!found) notFound();

  const first = found.course.lessons?.[0];
  if (!first) redirect(BASE);

  redirect(`${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`);
}
