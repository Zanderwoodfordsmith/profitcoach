import type { ReactNode } from "react";

import { LessonProgressProvider } from "@/components/academy/LessonProgressControls";

export default function CoachAcademyVaultLayout({ children }: { children: ReactNode }) {
  return <LessonProgressProvider courseId="vault">{children}</LessonProgressProvider>;
}
