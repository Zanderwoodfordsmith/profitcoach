"use client";

import { StickyPageHeader } from "@/components/layout";

export default function ClientGoalsPage() {
  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        eyebrow="Profit System"
        title="Goals"
        description="Goals content coming soon."
      />
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Placeholder for Goals</p>
      </div>
    </div>
  );
}
