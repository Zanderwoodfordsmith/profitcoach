import type { ReactNode } from "react";

import { AcademyCurrentShell } from "@/components/academy/AcademyCurrentShell";

export default function CoachAcademyLayout({ children }: { children: ReactNode }) {
  return <AcademyCurrentShell>{children}</AcademyCurrentShell>;
}
