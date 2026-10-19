import type { ReactNode } from "react";

import { ClassroomShell } from "@/components/academy/ClassroomShell";
import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";

export default function AdminAcademyVaultLayout({ children }: { children: ReactNode }) {
  return (
    <ClassroomShell>
      <LessonProgressProvider courseId="vault">{children}</LessonProgressProvider>
    </ClassroomShell>
  );
}
