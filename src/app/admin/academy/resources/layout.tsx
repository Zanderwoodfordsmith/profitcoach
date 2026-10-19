import type { ReactNode } from "react";

import { ClassroomShell } from "@/components/academy/ClassroomShell";
import { ResourcesShell } from "@/components/resources/ResourcesShell";
import { loadResourceSearchText } from "@/lib/resources/loadLibrary";

export default async function AdminAcademyResourcesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const searchText = await loadResourceSearchText();
  return (
    <ClassroomShell>
      <ResourcesShell searchText={searchText}>{children}</ResourcesShell>
    </ClassroomShell>
  );
}
