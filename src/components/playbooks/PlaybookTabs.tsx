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

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Playbook tabs">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              activeTab === "overview"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Overview
          </button>
          {showClientTab && (
            <button
              type="button"
              onClick={() => setTab("client")}
              className={`border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "client"
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Client
            </button>
          )}
          {showCoachesTab && (
            <button
              type="button"
              onClick={() => setTab("coaches")}
              className={`border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "coaches"
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Coaches
            </button>
          )}
        </nav>
      </div>

      {activeTab === "overview" && (
        <PlaybookOverviewContent content={content} basePath={basePath} />
      )}
      {activeTab === "client" && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">
            Checklists and actions for this playbook — coming soon.
          </p>
        </div>
      )}
      {activeTab === "coaches" && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">
            Coach-facing notes and scripts for this playbook — coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
