"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { StickyPageHeader } from "@/components/layout";
import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";

// Parked 4 Nov (job 176): admins open it from Admin → Links, under projects on hold.
const JOBS_PATH = "/coach/blueprint/jobs";

/**
 * My Blueprint: an overview with a List | Board switch, then one page per
 * part of the practice, each with its own chat. Drawn in the clean look for
 * everyone since 4 Nov.
 */
export default function PracticeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onJobs = pathname === JOBS_PATH;

  return (
    <>
      <StickyPageHeader
        bleedInset="px-4 md:px-7"
        title="My Blueprint"
      />
      {onJobs ? (
        // Jobs show Blueprint sections inside them, so they keep the Blueprint's data but not its sidebar.
        <PracticeProvider>{children}</PracticeProvider>
      ) : (
        <PracticeProvider>
          <PracticeShell embedded>{children}</PracticeShell>
        </PracticeProvider>
      )}
    </>
  );
}
