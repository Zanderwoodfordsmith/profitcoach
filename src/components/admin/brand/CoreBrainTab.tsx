"use client";

import { useEffect, useState } from "react";

import { CoreBrainKnowledgeTab } from "@/components/admin/brand/CoreBrainKnowledgeTab";
import { CoreBrainSkillsTab } from "@/components/admin/brand/CoreBrainSkillsTab";

export type CoreBrainSubTab = "knowledge" | "skills";

function normalizeBrainSubTab(raw: string | null): CoreBrainSubTab {
  if (raw === "skills" || raw === "create-hub" || raw === "prompts") {
    return "skills";
  }
  return "knowledge";
}

export function CoreBrainTab({
  initialBrainTab,
  initialOpen,
}: {
  initialBrainTab?: string | null;
  initialOpen?: string | null;
}) {
  const [subTab, setSubTab] = useState<CoreBrainSubTab>(
    normalizeBrainSubTab(initialBrainTab ?? null)
  );
  const [openItem, setOpenItem] = useState<string | null>(
    subTab === "skills" ? initialOpen ?? null : null
  );
  const [openFile, setOpenFile] = useState<string | null>(
    subTab === "knowledge" ? initialOpen ?? null : null
  );

  useEffect(() => {
    const next = normalizeBrainSubTab(initialBrainTab ?? null);
    setSubTab(next);
    if (initialOpen) {
      if (next === "skills") setOpenItem(initialOpen);
      if (next === "knowledge") setOpenFile(initialOpen);
    }
  }, [initialBrainTab, initialOpen]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["knowledge", "Knowledge"],
            ["skills", "Skills & tools"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              subTab === key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "knowledge" ? (
        <CoreBrainKnowledgeTab initialOpenFile={openFile} />
      ) : (
        <CoreBrainSkillsTab initialOpen={openItem} />
      )}
    </div>
  );
}
