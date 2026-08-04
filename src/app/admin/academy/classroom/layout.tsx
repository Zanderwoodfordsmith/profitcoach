import type { ReactNode } from "react";

import { ClassroomShell } from "@/components/academy/ClassroomShell";

export default function AdminAcademyClassroomLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ClassroomShell>{children}</ClassroomShell>;
}
