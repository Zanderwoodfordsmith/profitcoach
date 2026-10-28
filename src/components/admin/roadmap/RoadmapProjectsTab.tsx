"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Columns3, Plus, Rows3, ScatterChart } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { ProductCanvasToggle } from "@/components/admin/roadmap/ProductCanvasToggle";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import { NewProjectSheet } from "./NewProjectSheet";
import { RoadmapProjectsView, type ProjectsShow } from "./RoadmapProjectsView";
import { ViewToggle } from "./roadmapUi";
import { projectHref, roadmapAuthHeaders, useRoadmapData } from "./useRoadmapData";

const SHOW_KEY = "roadmap-projects-show";

/** Product → Projects: every project as a list, a board by stage, on the impact and ease grid, or on the 12-week timeline. */
export function RoadmapProjectsTab() {
  const router = useRouter();
  const { jobs, error } = useRoadmapData();
  const [creating, setCreating] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [show, setShow] = useState<ProjectsShow>(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(SHOW_KEY) : null;
      return stored === "board" || stored === "graph" || stored === "timeline" ? stored : "list";
    } catch {
      return "list";
    }
  });

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pick = (next: ProjectsShow) => {
    setShow(next);
    try {
      window.localStorage.setItem(SHOW_KEY, next);
    } catch {
      // Remembering the view is only a convenience.
    }
  };

  return (
    <div className="w-full">
      <StickyPageHeader
        rootRef={headerRef}
        title="Product"
        description="Initiatives hold projects; projects hold jobs. Open a project for its write-up and its jobs."
        tabs={<LessonImportTabs />}
        actions={<ProductCanvasToggle />}
      />
      <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-200/80 pb-4">
        <ViewToggle
          value={show}
          onChange={pick}
          options={[
            { key: "list", label: "List", icon: Rows3 },
            { key: "board", label: "Board", icon: Columns3 },
            { key: "graph", label: "Graph", icon: ScatterChart },
            { key: "timeline", label: "Timeline", icon: CalendarRange },
          ]}
        />
        <button type="button" onClick={() => setCreating(true)} className={buttonClass("second", "small", "ml-auto")}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New project
        </button>
      </div>
      {creating ? <NewProjectSheet onClose={() => setCreating(false)} /> : null}
      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {jobs ? (
        <RoadmapProjectsView
          show={show}
          jobs={jobs}
          stickyTop={headerHeight}
          authHeaders={roadmapAuthHeaders}
          onOpenProject={(name) => router.push(projectHref(name))}
        />
      ) : (
        <p className="py-10 text-sm text-slate-500">Loading projects…</p>
      )}
    </div>
  );
}
