import { notFound, redirect } from "next/navigation";

import { findHubCourse, firstLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";

const BASE = "/admin/academy/vault";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyVaultCourseEntryPage({ params }: Props) {
  const { courseId } = await params;
  const course = findHubCourse(loadVaultHub(), courseId);
  if (!course) notFound();

  const first = firstLessonInCourse(course);
  if (!first) redirect(BASE);

  redirect(`${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`);
}
