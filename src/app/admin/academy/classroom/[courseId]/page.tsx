import { notFound, redirect } from "next/navigation";

import {
  classroomIdsNeedRedirect,
  resolveClassroomCourseId,
} from "@/lib/academy/classroomIdAliases";
import { findHubCourse, firstLessonInCourse } from "@/lib/academy/hubCatalog";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

const BASE = "/admin/academy/classroom";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyClassroomCourseEntryPage({
  params,
}: Props) {
  const { courseId: rawCourseId } = await params;
  const courseId = resolveClassroomCourseId(rawCourseId);

  if (classroomIdsNeedRedirect(rawCourseId)) {
    redirect(`${BASE}/${encodeURIComponent(courseId)}`);
  }

  const data = loadClassroomHub();
  const course = findHubCourse(data, courseId);
  if (!course) notFound();

  const first = firstLessonInCourse(course);
  if (!first) redirect(BASE);

  redirect(`${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(first.id)}`);
}
