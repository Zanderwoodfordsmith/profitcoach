"use client";

import { notFound, useParams } from "next/navigation";
import { Suspense } from "react";

import { StickyPageHeader } from "@/components/layout";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { ScriptView } from "@/components/salesCall/ScriptLibraryPage";
import { scriptById } from "@/lib/salesCall/library";

export default function CoachScriptPage() {
  const script = scriptById(String(useParams().script ?? ""));
  if (!script) notFound();
  return (
    <div className="flex flex-col">
      <StickyPageHeader title="Get Clients" description={script.summary} tabs={<CoachToolsHubTabs hub="get-clients" />} />
      <Suspense fallback={null}>
        <ScriptView script={script} />
      </Suspense>
    </div>
  );
}
