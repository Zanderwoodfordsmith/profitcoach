"use client";

import { Suspense } from "react";
import { use } from "react";
import { ClientCoachingWorkspace } from "@/components/clientCoaching/ClientCoachingWorkspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function CoachClientWorkspacePage({ params }: PageProps) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <ClientCoachingWorkspace contactId={id} />
    </Suspense>
  );
}
