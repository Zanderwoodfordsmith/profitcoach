"use client";

import { useState } from "react";
import { PlaybookOverviewContent } from "./PlaybookOverviewContent";
import type { PlaybookContent } from "@/lib/playbookContentTypes";

type TabId = "overview" | "client" | "coaches";

type Props = {
  content: PlaybookContent;
  activeTab?: TabId;
  showClientTab?: boolean;
  showCoachesTab?: boolean;
  /** Base path for related playbook links (e.g. /client/playbooks) */
  basePath?: string;
};

export function PlaybookTabs({
  content,
  activeTab: controlledTab,
  showClientTab = true,
  showCoachesTab = false,
  basePath = "/playbooks",
}: Props) {
  const [internalTab, setInternalTab] = useState<TabId>("overview");
  const activeTab = controlledTab ?? internalTab;

  const setTab = (t: TabId) => {
    if (!controlledTab) setInternalTab(t);
  };

  const tabBtn = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`border-b-2 px-0 py-3 text-sm font-semibold tracking-tight transition ${
        activeTab === id
          ? "border-[#0c5290] text-[#0c5290]"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-10">
      <div className="border-b border-slate-200/80">
        <nav className="-mb-px flex flex-wrap gap-x-8 gap-y-1" aria-label="Playbook sections">
          {tabBtn("overview", "Overview")}
          {showClientTab ? tabBtn("client", "Client") : null}
          {showCoachesTab ? tabBtn("coaches", "Coaches") : null}
        </nav>
      </div>

      {activeTab === "overview" && (
        <PlaybookOverviewContent content={content} basePath={basePath} />
      )}
      {activeTab === "client" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Checklists and actions for this playbook — coming soon.
          </p>
        </div>
      )}
      {activeTab === "coaches" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Coach-facing notes and scripts for this playbook — coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
