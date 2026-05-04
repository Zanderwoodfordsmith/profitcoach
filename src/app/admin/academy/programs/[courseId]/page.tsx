import { notFound, redirect } from "next/navigation";

import { findLegacyCourse, firstLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";

const BASE = "/admin/academy/programs";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyProgramsCourseEntryPage({ params }: Props) {
  const { courseId } = await params;
  const data = loadLegacyHub();
  const course = findLegacyCourse(data, courseId);
  if (!course) notFound();

  const first = firstLessonInCourse(course);
  if (!first) redirect(BASE);

  redirect(`${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`);
}
