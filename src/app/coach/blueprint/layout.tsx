"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { StickyPageHeader } from "@/components/layout";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { PracticeProvider, usePractice } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { buttonClass } from "@/components/ui/Button";
import { useImpersonation } from "@/contexts/ImpersonationContext";

// Parked 4 Nov (job 176): admins open it from Admin → Links, under projects on hold.
const JOBS_PATH = "/coach/blueprint/jobs";

/**
 * My Blueprint: an overview with a List | Board switch, then one page per
 * part of the practice, each with its own chat. Drawn in the clean look for
 * everyone since 4 Nov.
 *
 * An admin using the app as a coach (Launches → To check opens here, 21 Nov)
 * sees that coach's Blueprint as they do, plus BCA's layer: Ava's drafts in
 * place and Release. Coaches never see that layer.
 */
export default function PracticeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onJobs = pathname === JOBS_PATH;
  const { profile } = useDashboardProfile();
  const { impersonatingCoachId } = useImpersonation();
  const adminViewing = profile?.role === "admin" ? impersonatingCoachId : null;

  return (
    <PracticeProvider coachId={adminViewing}>
      <StickyPageHeader bleedInset="px-4 md:px-7" title="My Blueprint" actions={adminViewing ? <BackToLaunches /> : undefined} />
      {/* Jobs show Blueprint sections inside them, so they keep the Blueprint's data but not its sidebar. */}
      {onJobs ? children : <PracticeShell embedded>{children}</PracticeShell>}
    </PracticeProvider>
  );
}

/** Whose Blueprint this is, and the way back. Leaving stops "Use as". */
function BackToLaunches() {
  const { coachName } = usePractice();
  const { clearImpersonation } = useImpersonation();
  return (
    <div className="flex items-center gap-3">
      {coachName ? <span className="hidden truncate text-sm text-slate-500 lg:inline">{coachName}&apos;s Blueprint</span> : null}
      <Link href="/admin?view=launch" onClick={() => clearImpersonation()} className={buttonClass("second", "small")}>
        <ArrowLeft className="size-3.5" aria-hidden />
        Launch
      </Link>
    </div>
  );
}
