"use client";

import { StickyPageHeader } from "@/components/layout";
import { cardClass } from "@/components/ui/Card";

export default function ClientGoalsPage() {
  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        eyebrow="Profit System"
        title="Goals"
        description="Goals content coming soon."
      />
      <div className={cardClass("plain", "p-8")}>
        <p className="text-sm text-slate-500">Placeholder for Goals</p>
      </div>
    </div>
  );
}
