import type { ReactNode } from "react";

import { ResourcesShell } from "@/components/resources/ResourcesShell";

/** The search text loads after sign-in (/api/academy/resources?search=1), not with the page. */
export default function CoachResourcesLayout({ children }: { children: ReactNode }) {
  return <ResourcesShell>{children}</ResourcesShell>;
}
