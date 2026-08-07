import { notFound, redirect } from "next/navigation";

import { findHubCourse, firstLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

const BASE = "/admin/academy/archive";
const CLASSROOM = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyProgramsCourseEntryPage({
  params,
}: Props) {
  const { courseId } = await params;
  const archive = findHubCourse(loadArchiveHub(), courseId);
  if (archive) {
    const first = firstLessonInCourse(archive);
    if (!first) redirect(BASE);
    redirect(
      `${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`,
    );
  }

  // Retired full programmes live on the Classroom hub now.
  if (findHubCourse(loadClassroomHub(), courseId)) {
    redirect(`${CLASSROOM}/${encodeURIComponent(courseId)}`);
  }

  notFound();
}
