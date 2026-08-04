"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { LessonTabBar, useLessonTabParam, type LessonTab } from "./LessonTabBar";

export type LessonPlayerTabId =
  | "overview"
  | "guide"
  | "resources"
  | "related"
  | "qa"
  | "transcript";

type TabDef = LessonTab<LessonPlayerTabId> & { visible: boolean };

/** Lets panel content move the reader to another tab (Overview → Guide). */
const SelectTabContext = createContext<((id: LessonPlayerTabId) => void) | null>(
  null
);

export function useSelectLessonTab() {
  return useContext(SelectTabContext);
}

type Props = {
  overview: ReactNode;
  guide?: ReactNode;
  showGuide?: boolean;
  resources?: ReactNode;
  showResources?: boolean;
  related?: ReactNode;
  showRelated?: boolean;
  qa: ReactNode;
  /** Community tab label — Wins / Intros for onboarding lessons, else Ask & Share. */
  qaLabel?: string;
  transcript?: ReactNode;
  showTranscript?: boolean;
  /** Drop the top margin where the tabs already start a surface of their own. */
  flush?: boolean;
};

export function LessonPlayerTabs({
  overview,
  guide,
  showGuide = false,
  resources,
  showResources = false,
  related,
  showRelated = false,
  qa,
  qaLabel = "Ask & Share",
  transcript,
  showTranscript = false,
  flush = false,
}: Props) {
  const tabs = useMemo<TabDef[]>(
    () =>
      (
        [
          { id: "overview", label: "Overview", visible: true },
          { id: "guide", label: "Guide", visible: showGuide },
          { id: "resources", label: "Resources", visible: showResources },
          { id: "related", label: "Related", visible: showRelated },
          { id: "qa", label: qaLabel, visible: true },
          { id: "transcript", label: "Transcript", visible: showTranscript },
        ] as TabDef[]
      ).filter((t) => t.visible),
    [qaLabel, showGuide, showResources, showRelated, showTranscript]
  );

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);
  const { activeTab, selectTab } = useLessonTabParam(tabIds, "overview");

  const panel =
    activeTab === "guide"
      ? guide
      : activeTab === "resources"
        ? resources
        : activeTab === "related"
          ? related
          : activeTab === "qa"
            ? qa
            : activeTab === "transcript"
              ? transcript
              : overview;

  return (
    <div className={flush ? undefined : "mt-8"}>
      <LessonTabBar tabs={tabs} activeTab={activeTab} onSelect={selectTab} />
      <div className="pt-5">
        <SelectTabContext.Provider value={selectTab}>
          {panel}
        </SelectTabContext.Provider>
      </div>
    </div>
  );
}
