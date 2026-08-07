import { redirect } from "next/navigation";

import { findHubCourse } from "@/lib/academy/hubCatalog";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

const BASE = "/coach/academy/classroom";

type Props = { params: Promise<{ courseId: string }> };

/** Retired hub: keep old programme links working by landing on the new card. */
export default async function CoachAcademyProgramsCourseEntryPage({ params }: Props) {
  const { courseId } = await params;
  const course = findHubCourse(loadClassroomHub(), courseId);
  redirect(course ? `${BASE}/${encodeURIComponent(course.id)}` : BASE);
}
