import type { ReactNode } from "react";

/** Academy routes pick their own chrome (ClassroomShell vs bare Archive). */
export default function AdminAcademyLayout({ children }: { children: ReactNode }) {
  return children;
}
