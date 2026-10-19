import type { ReactNode } from "react";

import { ResourcesShell } from "@/components/resources/ResourcesShell";
import { loadResourceSearchText } from "@/lib/resources/loadLibrary";

export default async function CoachResourcesLayout({ children }: { children: ReactNode }) {
  const searchText = await loadResourceSearchText();
  return <ResourcesShell searchText={searchText}>{children}</ResourcesShell>;
}
