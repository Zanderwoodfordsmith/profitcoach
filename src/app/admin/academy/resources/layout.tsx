import type { ReactNode } from "react";

import { ClassroomShell } from "@/components/academy/ClassroomShell";
import { ResourcesShell } from "@/components/resources/ResourcesShell";

export default function AdminAcademyResourcesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClassroomShell>
      <ResourcesShell>{children}</ResourcesShell>
    </ClassroomShell>
  );
}
