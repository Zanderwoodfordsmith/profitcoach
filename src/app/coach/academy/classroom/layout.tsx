import type { ReactNode } from "react";

import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";

export default function CoachAcademyClassroomLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LessonProgressProvider courseId="classroom">{children}</LessonProgressProvider>
  );
}
