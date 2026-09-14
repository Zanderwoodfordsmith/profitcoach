import type { ReactNode } from "react";

import { resolveClassroomCourseId } from "@/lib/academy/classroomIdAliases";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import { findHubCourse } from "@/lib/academy/hubCatalog";
import { warmupClassroomCourseMetadata } from "@/lib/academy/lessonContent";

type Props = {
  children: ReactNode;
  params: Promise<{ courseId: string }>;
};

export default async function CoachClassroomCourseLayout({
  children,
  params,
}: Props) {
  const { courseId: rawCourseId } = await params;
  const courseId = resolveClassroomCourseId(rawCourseId);
  const course = findHubCourse(loadClassroomHub(), courseId);
  if (course) {
    // Warm the metadata cache without blocking the lesson shell.
    void warmupClassroomCourseMetadata(course);
  }
  return children;
}
