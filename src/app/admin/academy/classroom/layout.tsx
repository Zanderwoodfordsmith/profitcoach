import type { ReactNode } from "react";

import { ClassroomShell } from "@/components/academy/ClassroomShell";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";

export default function AdminAcademyClassroomLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClassroomShell>
      <LessonProgressProvider courseId="classroom">{children}</LessonProgressProvider>
    </ClassroomShell>
  );
}
