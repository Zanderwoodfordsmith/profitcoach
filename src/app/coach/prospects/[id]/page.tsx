"use client";

import { Suspense, use } from "react";
import { ProspectWorkspace } from "@/components/prospects/ProspectWorkspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function CoachProspectDetailPage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <ProspectWorkspace contactId={id} />
    </Suspense>
  );
}
