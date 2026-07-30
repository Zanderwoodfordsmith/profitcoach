import { notFound, redirect } from "next/navigation";

import { findLegacyCourse, firstLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadSimplifiedHub } from "@/lib/academy/simplifiedHubLoad";

const BASE = "/coach/academy/simplified";

type Props = { params: Promise<{ courseId: string }> };

export default async function CoachAcademySimplifiedCourseEntryPage({
  params,
}: Props) {
  const { courseId } = await params;
  const data = loadSimplifiedHub();
  const course = findLegacyCourse(data, courseId);
  if (!course) notFound();

  const first = firstLessonInCourse(course);
  if (!first) redirect(BASE);

  redirect(`${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`);
}
