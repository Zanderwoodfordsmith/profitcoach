import { redirect } from "next/navigation";

import {
  loadClassroomHub,
  classroomCourseIdForLesson,
} from "@/lib/academy/classroomHubLoad";

const BASE = "/coach/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

/**
 * Retired hub: send old lesson links to whichever card now carries the lesson,
 * since Simplified regroups programmes (Client Acquisition became Get Calls and
 * Win Clients).
 */
export default async function CoachAcademyProgramsLessonPage({ params }: Props) {
  const { lessonId } = await params;
  const courseId = classroomCourseIdForLesson(loadClassroomHub(), lessonId);
  if (!courseId) redirect(BASE);

  redirect(`${BASE}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`);
}
