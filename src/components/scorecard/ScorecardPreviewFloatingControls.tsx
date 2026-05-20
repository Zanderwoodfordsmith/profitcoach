"use client";

import { ScorecardPreviewCoachSwitcher } from "@/components/scorecard/ScorecardPreviewCoachSwitcher";
import { ScorecardPreviewLevelSwitcher } from "@/components/scorecard/ScorecardPreviewLevelSwitcher";

export function ScorecardPreviewFloatingControls({
  coachSlug,
}: {
  coachSlug: string;
}) {
  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col items-stretch gap-2 rounded-xl border border-amber-300/90 bg-white/95 p-2.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.28)] backdrop-blur-md ring-1 ring-amber-200/70 sm:bottom-6 sm:right-6"
      aria-label="Preview controls"
    >
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-900/70">
        Preview only
      </p>
      <div className="flex min-w-[11rem] flex-col gap-1.5 sm:min-w-[13rem]">
        <ScorecardPreviewLevelSwitcher floating />
        <ScorecardPreviewCoachSwitcher
          currentSlug={coachSlug}
          alwaysShow
          floating
        />
      </div>
    </div>
  );
}
