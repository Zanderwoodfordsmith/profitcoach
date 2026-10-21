"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Columns3,
  ImageIcon,
  ImagePlus,
  Loader2,
  MessageSquare,
  OctagonAlert,
  Play,
  Plus,
  Rows3,
  ScatterChart,
  Trash2,
  X,
} from "lucide-react";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  ROADMAP_AREAS,
  ROADMAP_AREA_META,
  ROADMAP_EASE_LEVELS,
  ROADMAP_IMPACT_HINT,
  ROADMAP_SCORES,
  ROADMAP_STATUSES,
  type RoadmapChecklistItem,
  type RoadmapComment,
  type RoadmapJob,
  type RoadmapStatus,
} from "@/lib/roadmap/types";

function areaMeta(area: string) {
  return (
    ROADMAP_AREA_META[area] ?? {
      label: area,
      hint: "",
      dot: "bg-slate-300",
      chip: "bg-slate-100 text-slate-600",
    }
  );
}

/** Jobs still to be built: what the graph maps and the filter pills count. */
const OPEN_STATUSES: RoadmapStatus[] = ["todo", "up_next", "in_progress"];

const STATUS_META: Record<RoadmapStatus, { label: string; chip: string }> = {
  todo: { label: "To do", chip: "bg-slate-200/80 text-slate-700" },
  up_next: { label: "Up next", chip: "bg-orange-100 text-orange-800" },
  in_progress: { label: "In progress", chip: "bg-blue-100 text-blue-800" },
  review: { label: "Review", chip: "bg-yellow-200/80 text-yellow-900" },
  done: { label: "Done", chip: "bg-emerald-100 text-emerald-800" },
  live: { label: "Live", chip: "bg-teal-100 text-teal-800" },
  evaluate: { label: "Evaluate", chip: "bg-violet-100 text-violet-800" },
  parked: { label: "Parked", chip: "bg-slate-200/70 text-slate-500" },
  vetoed: { label: "Vetoed", chip: "bg-rose-100 text-rose-700" },
};

/**
 * Ideas first, then workflow order, left to right. A column key is its main
 * status; Ideas and To do hold more than one (see COLUMN_SECTIONS). Blocked
 * is a red flag on the card (blocked_by set), not a column.
 */
const BOARD_COLUMNS: RoadmapStatus[] = [
  "parked",
  "todo",
  "in_progress",
  "review",
  "done",
  "live",
];

/** Column titles where they differ from the status label. */
const COLUMN_LABEL: Partial<Record<RoadmapStatus, string>> = {
  parked: "Ideas",
};

/**
 * Columns split into sections, top to bottom. Up next has no heading so the
 * first card lines up with the other columns; To do's own section is "Later".
 */
const COLUMN_SECTIONS: Partial<
  Record<RoadmapStatus, { status: RoadmapStatus; label: string | null; tone: string }[]>
> = {
  parked: [
    { status: "evaluate", label: "Evaluate", tone: "text-violet-700" },
    { status: "parked", label: "Parked", tone: "text-slate-500" },
    { status: "vetoed", label: "Vetoed", tone: "text-rose-600" },
  ],
  todo: [
    { status: "up_next", label: null, tone: "" },
    { status: "todo", label: "Later", tone: "text-slate-500" },
  ],
};

/** Where a card added from a column's "+ Add" lands. */
const COLUMN_ADD_STATUS: Partial<Record<RoadmapStatus, RoadmapStatus>> = {
  parked: "evaluate",
};

const IDEA_STATUSES: RoadmapStatus[] = ["evaluate", "parked", "vetoed"];

/** Columns rendered as a narrow strip until expanded. */
const DEFAULT_COLLAPSED: RoadmapStatus[] = ["parked", "live"];

const SECTIONS_KEY = "roadmap-collapsed-sections";

/** Status pills on an open job, in the same order as the board. */
const PICKER_ORDER: RoadmapStatus[] = [
  ...IDEA_STATUSES,
  ...ROADMAP_STATUSES.filter((s) => !IDEA_STATUSES.includes(s)),
];

const LIST_ORDER: RoadmapStatus[] = [
  "review",
  "in_progress",
  "up_next",
  "todo",
  "done",
  "live",
  "evaluate",
  "parked",
  "vetoed",
];

const VIEW_STORAGE_KEY = "roadmap-view";
const BOARD_GROUP_KEY = "roadmap-board-group";

/** Filter value for jobs with no project label. */
const NO_PROJECT = "__none__";

/** Red at 1 up to green at 5, for impact, ease and their total. */
const SCORE_TONE: Record<number, { fill: string; text: string; soft: string }> = {
  1: { fill: "bg-rose-500", text: "text-rose-700", soft: "bg-rose-50" },
  2: { fill: "bg-orange-400", text: "text-orange-700", soft: "bg-orange-50" },
  3: { fill: "bg-amber-400", text: "text-amber-700", soft: "bg-amber-50" },
  4: { fill: "bg-lime-500", text: "text-lime-700", soft: "bg-lime-50" },
  5: { fill: "bg-emerald-500", text: "text-emerald-700", soft: "bg-emerald-50" },
};

/** Short job reference, e.g. #12. */
function JobNumber({ n }: { n: number }) {
  return (
    <span className="shrink-0 tabular-nums">
      <span className="opacity-60">#</span>
      {n}
    </span>
  );
}

type ViewMode = "board" | "list" | "graph";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminRoadmapPage() {
  const { profile } = useDashboardProfile();
  const [jobs, setJobs] = useState<RoadmapJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>("all");
  /** "all", NO_PROJECT, or a project label. */
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [boardGroup, setBoardGroup] = useState<"none" | "project">("none");
  /** Board sections folded shut (by status), e.g. Vetoed. */
  const [foldedSections, setFoldedSections] = useState<Set<RoadmapStatus>>(
    () => new Set(["vetoed"])
  );
  /** A card is being dragged: shows the Up next drop strip when it's empty. */
  const [dragging, setDragging] = useState(false);
  const [lastArea, setLastArea] = useState<string>("get-clients");
  /** Where the add composer is open: a board column's status, "list", or "toolbar". */
  const [composingIn, setComposingIn] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("board");
  const [dragOverStatus, setDragOverStatus] = useState<RoadmapStatus | null>(
    null
  );
  /** Page header height, so the list's column headings stick just below it. */
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [expandedColumns, setExpandedColumns] = useState<Set<RoadmapStatus>>(
    () => new Set(BOARD_COLUMNS.filter((s) => !DEFAULT_COLLAPSED.includes(s)))
  );
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const dragActiveRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "list" || stored === "board" || stored === "graph") {
        setView(stored);
      }
      if (window.localStorage.getItem(BOARD_GROUP_KEY) === "project") {
        setBoardGroup("project");
      }
      const folded = window.localStorage.getItem(SECTIONS_KEY);
      if (folded) setFoldedSections(new Set(JSON.parse(folded) as RoadmapStatus[]));
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function toggleSection(status: RoadmapStatus) {
    setFoldedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      try {
        window.localStorage.setItem(SECTIONS_KEY, JSON.stringify([...next]));
      } catch {
        /* noop */
      }
      return next;
    });
  }

  function changeBoardGroup(next: "none" | "project") {
    setBoardGroup(next);
    try {
      window.localStorage.setItem(BOARD_GROUP_KEY, next);
    } catch {
      /* noop */
    }
  }

  function switchView(next: ViewMode) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    setError(null);
    const res = await fetch("/api/admin/roadmap", { headers });
    if (!res.ok) {
      setError("Could not load jobs.");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { jobs?: RoadmapJob[] };
    setJobs(body.jobs ?? []);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [load]);

  const addJob = useCallback(
    async (
      title: string,
      area: string,
      status: RoadmapStatus,
      project?: string | null
    ) => {
      const headers = await authHeaders();
      if (!headers) return;
      setLastArea(area);
      // Land at the bottom of the lane it was added from.
      const sortOrder =
        Math.max(
          0,
          ...jobs.filter((j) => j.status === status).map((j) => j.sort_order)
        ) + 1;
      const res = await fetch("/api/admin/roadmap", {
        method: "POST",
        headers,
        body: JSON.stringify({ title, area, status, sortOrder, project }),
      });
      if (res.ok) await load();
    },
    [authHeaders, jobs, load]
  );

  const patchJob = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const headers = await authHeaders();
      if (!headers) return;
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? ({ ...j, ...patch } as RoadmapJob) : j))
      );
      await fetch(`/api/admin/roadmap/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      await load();
    },
    [authHeaders, load]
  );

  const uploadImages = useCallback(
    async (id: string, files: File[]) => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      // No Content-Type header — the browser sets the multipart boundary.
      const headers = { Authorization: `Bearer ${session.access_token}` };
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/admin/roadmap/${id}/images`, {
          method: "POST",
          headers,
          body: fd,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          window.alert(body?.error ?? `Could not upload ${file.name}.`);
        }
      }
      await load();
    },
    [load]
  );

  const deleteImage = useCallback(
    async (id: string, imageId: string) => {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch(
        `/api/admin/roadmap/${id}/images?imageId=${encodeURIComponent(imageId)}`,
        { method: "DELETE", headers }
      );
      await load();
    },
    [authHeaders, load]
  );

  const removeJob = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this job?")) return;
      const headers = await authHeaders();
      if (!headers) return;
      setOpenJobId((open) => (open === id ? null : open));
      setJobs((prev) => prev.filter((j) => j.id !== id));
      await fetch(`/api/admin/roadmap/${id}`, { method: "DELETE", headers });
      await load();
    },
    [authHeaders, load]
  );

  function handleDrop(e: React.DragEvent, status: RoadmapStatus) {
    e.preventDefault();
    setDragOverStatus(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    void patchJob(id, { status });
  }

  function dropHandlers(status: RoadmapStatus) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverStatus(status);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOverStatus((s) => (s === status ? null : s));
      },
      onDrop: (e: React.DragEvent) => handleDrop(e, status),
    };
  }

  const areas = useMemo(() => {
    const all = new Set<string>(ROADMAP_AREAS);
    for (const j of jobs) all.add(j.area);
    return [...all];
  }, [jobs]);

  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      if (OPEN_STATUSES.includes(j.status)) {
        counts.set(j.area, (counts.get(j.area) ?? 0) + 1);
      }
    }
    return counts;
  }, [jobs]);

  const projects = useMemo(
    () =>
      [...new Set(jobs.map((j) => j.project).filter((p): p is string => !!p))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [jobs]
  );

  const visible = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (areaFilter === "all" || j.area === areaFilter) &&
          (projectFilter === "all" ||
            (projectFilter === NO_PROJECT ? !j.project : j.project === projectFilter))
      ),
    [jobs, areaFilter, projectFilter]
  );

  const openJob = openJobId
    ? jobs.find((j) => j.id === openJobId) ?? null
    : null;

  const viewToggle = (
    <div className="flex overflow-hidden rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => switchView("board")}
        title="Board view"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition ${
          view === "board"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Columns3 className="h-3.5 w-3.5" /> Board
      </button>
      <button
        type="button"
        onClick={() => switchView("list")}
        title="List view"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition ${
          view === "list"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Rows3 className="h-3.5 w-3.5" /> List
      </button>
      <button
        type="button"
        onClick={() => switchView("graph")}
        title="Impact vs ease"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition ${
          view === "graph"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <ScatterChart className="h-3.5 w-3.5" /> Graph
      </button>
    </div>
  );

  const composeArea = areaFilter !== "all" ? areaFilter : lastArea;

  /** Faint "+ Add" at the foot of a lane; opens the composer in place. */
  /** project: the lane's label; undefined falls back to the project filter. */
  function addSlot(
    key: string,
    status: RoadmapStatus,
    area?: string,
    project?: string | null
  ) {
    const laneProject =
      project !== undefined
        ? project
        : projectFilter !== "all" && projectFilter !== NO_PROJECT
          ? projectFilter
          : null;
    if (composingIn === key) {
      return (
        <AddJobComposer
          areas={areas}
          defaultArea={area ?? composeArea}
          onSubmit={(title, area) => addJob(title, area, status, laneProject)}
          onCancel={() => setComposingIn(null)}
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => setComposingIn(key)}
        className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-400/80 transition hover:bg-slate-200/60 hover:text-slate-600"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    );
  }

  /** One row of status columns: the whole board, or one project's lane. */
  function renderBoard(
    subset: RoadmapJob[],
    lanePrefix: string,
    project: string | null | undefined,
    showProject: boolean
  ) {
    const cards = (rows: RoadmapJob[]) =>
      rows.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          dragActiveRef={dragActiveRef}
          onOpen={() => setOpenJobId(job.id)}
          showProject={showProject}
        />
      ));
    return (
      <div
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
        className={`flex items-start gap-3 overflow-x-auto pb-4 ${lanePrefix ? "mt-2" : "mt-4"}`}
      >
        {BOARD_COLUMNS.map((status) => {
          const sections = COLUMN_SECTIONS[status];
          const statuses = sections ? sections.map((x) => x.status) : [status];
          const headerCount = subset.filter((j) => statuses.includes(j.status)).length;
          const label = COLUMN_LABEL[status] ?? STATUS_META[status].label;
          const addStatus = COLUMN_ADD_STATUS[status] ?? status;
          const expanded = expandedColumns.has(status);
          if (!expanded) {
            return (
              <div
                key={`${lanePrefix}${status}`}
                {...dropHandlers(status)}
                onClick={() =>
                  setExpandedColumns((prev) => new Set([...prev, status]))
                }
                className={`flex h-72 w-10 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl py-3 transition ${
                  dragOverStatus === status
                    ? "bg-sky-100 ring-1 ring-sky-400"
                    : "bg-slate-100/80 hover:bg-slate-200/70"
                }`}
                title={`${label} (${headerCount}) — click to expand`}
              >
                <span className="text-xs font-semibold text-slate-500">
                  {headerCount}
                </span>
                <span
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {label}
                </span>
              </div>
            );
          }
          const upNextCount =
            status === "todo"
              ? subset.filter((j) => j.status === "up_next").length
              : 0;
          return (
            <div
              key={`${lanePrefix}${status}`}
              {...(sections ? {} : dropHandlers(status))}
              className={`min-w-72 flex-1 basis-0 rounded-xl p-2 transition ${
                !sections && dragOverStatus === status
                  ? "bg-sky-100 ring-1 ring-sky-400"
                  : "bg-slate-100/80"
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1 pt-0.5">
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      status === "parked"
                        ? "bg-slate-200/80 text-slate-700"
                        : STATUS_META[status].chip
                    }`}
                  >
                    {label}
                  </span>
                  {upNextCount > 0 ? (
                    <span className="text-xs font-semibold text-orange-600">
                      {upNextCount} up next
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-400">
                    {headerCount}
                  </span>
                  {DEFAULT_COLLAPSED.includes(status) ? (
                    <button
                      type="button"
                      aria-label={`Collapse ${label}`}
                      onClick={() =>
                        setExpandedColumns((prev) => {
                          const next = new Set(prev);
                          next.delete(status);
                          return next;
                        })
                      }
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              </div>
              {sections ? (
                <div className="flex flex-col gap-2">
                  {sections.map((section) => {
                    const rows = subset.filter((j) => j.status === section.status);
                    const over = dragOverStatus === section.status;
                    // Up next: no heading; while empty it only shows as a drop strip mid-drag.
                    if (section.label === null) {
                      if (rows.length === 0 && !dragging) return null;
                      return (
                        <div
                          key={section.status}
                          {...dropHandlers(section.status)}
                          className={`flex flex-col gap-2 rounded-md transition ${
                            over ? "bg-orange-100 ring-1 ring-orange-400" : ""
                          }`}
                        >
                          {cards(rows)}
                          {rows.length === 0 ? (
                            <p className="rounded-md border border-dashed border-orange-300 px-2 py-2 text-xs font-medium text-orange-600">
                              Drop here for Up next
                            </p>
                          ) : null}
                        </div>
                      );
                    }
                    // "Later" only needs a heading when Up next sits above it.
                    const showHeading =
                      section.status !== "todo" || upNextCount > 0 || dragging;
                    const folded = showHeading && foldedSections.has(section.status);
                    return (
                      <div
                        key={section.status}
                        {...dropHandlers(section.status)}
                        className={`rounded-md transition ${
                          over ? "bg-sky-100 ring-1 ring-sky-400" : ""
                        }`}
                      >
                        {showHeading ? (
                          <button
                            type="button"
                            aria-expanded={!folded}
                            onClick={() => toggleSection(section.status)}
                            className={`flex w-full items-center gap-1.5 px-1 py-1 text-left text-[11px] font-bold uppercase tracking-wide ${section.tone}`}
                          >
                            <Caret open={!folded} />
                            {section.label}
                            <span className="font-medium tabular-nums opacity-60">
                              {rows.length}
                            </span>
                          </button>
                        ) : null}
                        {folded ? null : (
                          <div className="flex min-h-6 flex-col gap-2 pt-0.5">
                            {cards(rows)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {addSlot(`${lanePrefix}${status}`, addStatus, undefined, project)}
                </div>
              ) : (
                <div className="flex min-h-12 flex-col gap-2">
                  {cards(subset.filter((j) => j.status === status))}
                  {addSlot(`${lanePrefix}${status}`, addStatus, undefined, project)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      <StickyPageHeader
        rootRef={headerRef}
        title="Academy"
        description="Review = built, waiting for Zander to check. Done = checked and pushed (may still be admin-only). Live = coaches can see it. Projects group related jobs. Ask the AI panel to add or update jobs from any screen."
        tabs={<LessonImportTabs />}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {viewToggle}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAreaFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              areaFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAreaFilter(a)}
              title={areaMeta(a).hint || undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                areaFilter === a
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${areaMeta(a).dot}`} />
              {areaMeta(a).label}
              {openCounts.get(a) ? (
                <span
                  className={`tabular-nums ${
                    areaFilter === a ? "text-white/60" : "text-slate-400"
                  }`}
                >
                  {openCounts.get(a)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Project"
          className={`rounded-lg border px-2 py-1 text-xs font-medium focus:border-sky-400 focus:outline-none ${
            projectFilter === "all"
              ? "border-slate-200 bg-white text-slate-600"
              : "border-slate-900 bg-slate-900 text-white"
          }`}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={NO_PROJECT}>No project</option>
        </select>
        {view === "board" ? (
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            Group by
            <select
              value={boardGroup}
              onChange={(e) => changeBoardGroup(e.target.value as "none" | "project")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-sky-400 focus:outline-none"
            >
              <option value="none">Nothing</option>
              <option value="project">Project</option>
            </select>
          </label>
        ) : null}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() =>
              setComposingIn((c) => (c === "toolbar" ? null : "toolbar"))
            }
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add job
          </button>
          {composingIn === "toolbar" ? (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setComposingIn(null)}
              />
              <div className="absolute right-0 top-full z-40 mt-1.5 w-80 max-w-[calc(100vw-2rem)]">
                <AddJobComposer
                  areas={areas}
                  defaultArea={composeArea}
                  onSubmit={async (title, area) => {
                    await addJob(
                      title,
                      area,
                      "todo",
                      projectFilter !== "all" && projectFilter !== NO_PROJECT
                        ? projectFilter
                        : null
                    );
                    setComposingIn(null);
                  }}
                  onCancel={() => setComposingIn(null)}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <p className="py-10 text-sm text-slate-500">Loading roadmap…</p>
      ) : view === "graph" ? (
        <ImpactEaseGraph
          jobs={visible}
          allJobs={jobs}
          onOpen={setOpenJobId}
          onScore={(id, impact, ease) => void patchJob(id, { impact, ease })}
        />
      ) : view === "list" ? (
        <RoadmapListTable
          jobs={visible}
          areas={areas}
          onOpen={setOpenJobId}
          onPatch={patchJob}
          addSlot={addSlot}
          stickyTop={headerHeight}
          projects={projects}
        />
      ) : boardGroup === "project" ? (
        <div className="mt-4 flex flex-col gap-6">
          {[...projects, null]
            .map((project) => ({
              project,
              rows: visible.filter((j) => (j.project ?? null) === project),
            }))
            .filter((lane) => lane.rows.length > 0)
            .map((lane) => (
              <section key={lane.project ?? NO_PROJECT}>
                <h2 className="flex items-baseline gap-2 px-1 text-lg font-medium tracking-[-0.01em] text-slate-950">
                  {lane.project ?? "No project"}
                  <span className="text-sm tabular-nums text-slate-400">
                    {lane.rows.length}
                  </span>
                </h2>
                {renderBoard(
                  lane.rows,
                  `lane:${lane.project ?? NO_PROJECT}:`,
                  lane.project,
                  false
                )}
              </section>
            ))}
        </div>
      ) : (
        renderBoard(visible, "", undefined, true)
      )}

      {openJob ? (
        <JobDetailModal
          job={openJob}
          authorName={
            profile?.first_name ||
            profile?.full_name ||
            "Admin"
          }
          onClose={() => setOpenJobId(null)}
          onPatch={patchJob}
          onDelete={removeJob}
          onUploadImages={uploadImages}
          onDeleteImage={deleteImage}
          areas={areas}
          projects={projects}
        />
      ) : null}
    </div>
  );
}

function JobMetaBadges({
  job,
  showBlocked = true,
}: {
  job: RoadmapJob;
  showBlocked?: boolean;
}) {
  const checklistDone = job.checklist?.filter((c) => c.done).length ?? 0;
  const checklistTotal = job.checklist?.length ?? 0;
  const commentCount = job.comments?.length ?? 0;
  const imageCount = job.images?.length ?? 0;
  return (
    <>
      {showBlocked && job.blocked_by ? (
        <span title={`Blocked by: ${job.blocked_by}`}>
          <OctagonAlert className="h-3.5 w-3.5 shrink-0 text-rose-500" />
        </span>
      ) : null}
      {job.notes?.trim() ? (
        <span title="Has a description" className="shrink-0 text-slate-400">
          <AlignLeft className="h-3 w-3" aria-label="Has a description" />
        </span>
      ) : null}
      {imageCount > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-slate-400">
          <ImageIcon className="h-3 w-3" />
          {imageCount}
        </span>
      ) : null}
      {checklistTotal > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-slate-400">
          <CheckSquare className="h-3 w-3" />
          {checklistDone}/{checklistTotal}
        </span>
      ) : null}
      {commentCount > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-slate-400">
          <MessageSquare className="h-3 w-3" />
          {commentCount}
        </span>
      ) : null}
      {job.visibility === "members" ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
          title="Member-visible"
        />
      ) : null}
    </>
  );
}

function JobCard({
  job,
  dragActiveRef,
  onOpen,
  showProject = true,
}: {
  job: RoadmapJob;
  dragActiveRef: React.MutableRefObject<boolean>;
  onOpen: () => void;
  showProject?: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        dragActiveRef.current = true;
        e.dataTransfer.setData("text/plain", job.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          dragActiveRef.current = false;
        }, 0);
      }}
      onClick={() => {
        if (dragActiveRef.current) return;
        onOpen();
      }}
      className={`cursor-pointer rounded-lg border bg-white px-3 py-2.5 transition hover:shadow-sm active:cursor-grabbing ${
        job.status === "up_next"
          ? "border-orange-200 border-l-2 border-l-orange-400 hover:border-orange-300"
          : job.status === "review"
            ? "border-yellow-200 border-l-2 border-l-yellow-400 hover:border-yellow-300"
            : job.status === "vetoed"
              ? "border-slate-200 opacity-60 hover:border-slate-300 hover:opacity-100"
              : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {showProject && job.project ? (
        <p className="mb-0.5 truncate text-[11px] font-semibold text-slate-500">
          {job.project}
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium leading-snug text-slate-900">
          {job.title}
        </p>
        {job.blocked_by ? (
          <span title={`Blocked by: ${job.blocked_by}`} className="shrink-0">
            <OctagonAlert className="h-3.5 w-3.5 text-rose-500" />
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <span className="text-xs font-medium text-slate-400">
          <JobNumber n={job.job_number} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${areaMeta(job.area).dot}`}
          />
          <span className="truncate">{areaMeta(job.area).label}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <JobMetaBadges job={job} showBlocked={false} />
        </span>
      </div>
    </div>
  );
}

function JobDetailModal({
  job,
  authorName,
  onClose,
  onPatch,
  onDelete,
  onUploadImages,
  onDeleteImage,
  areas,
  projects,
}: {
  job: RoadmapJob;
  authorName: string;
  onClose: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUploadImages: (id: string, files: File[]) => Promise<void>;
  onDeleteImage: (id: string, imageId: string) => Promise<void>;
  areas: string[];
  projects: string[];
}) {
  const [title, setTitle] = useState(job.title);
  const [notes, setNotes] = useState(job.notes ?? "");
  const [blockedBy, setBlockedBy] = useState(job.blocked_by ?? "");
  const [project, setProject] = useState(job.project ?? "");
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0 || uploading) return;
      setUploading(true);
      try {
        await onUploadImages(job.id, images);
      } finally {
        setUploading(false);
      }
    },
    [job.id, onUploadImages, uploading]
  );

  useEffect(() => {
    setTitle(job.title);
    setNotes(job.notes ?? "");
    setBlockedBy(job.blocked_by ?? "");
    setProject(job.project ?? "");
  }, [job.id, job.title, job.notes, job.blocked_by, job.project]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveChecklist(next: RoadmapChecklistItem[]) {
    void onPatch(job.id, { checklist: next });
  }

  function addChecklistItem() {
    const text = newItem.trim();
    if (!text) return;
    saveChecklist([
      ...(job.checklist ?? []),
      { id: newId(), text, done: false },
    ]);
    setNewItem("");
  }

  function addComment() {
    const text = newComment.trim();
    if (!text) return;
    const next: RoadmapComment[] = [
      ...(job.comments ?? []),
      { id: newId(), text, author: authorName, created_at: new Date().toISOString() },
    ];
    void onPatch(job.id, { comments: next });
    setNewComment("");
  }

  const checklist = job.checklist ?? [];
  const comments = job.comments ?? [];
  const images = job.images ?? [];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative my-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
            f.type.startsWith("image/")
          );
          if (files.length > 0) {
            e.preventDefault();
            void uploadFiles(files);
          }
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:bg-slate-50 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        {/* Header */}
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-700">
            <JobNumber n={job.job_number} />
            <span className="text-sky-700/50"> · </span>
            {areaMeta(job.area).label}
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== job.title) void onPatch(job.id, { title: t });
            }}
            className="mt-1.5 w-full border-0 bg-transparent p-0 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-0 sm:text-xl"
          />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {PICKER_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void onPatch(job.id, { status: s })}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  job.status === s
                    ? STATUS_META[s].chip
                    : "bg-white text-slate-400 hover:bg-slate-100"
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[min(65vh,600px)] overflow-y-auto pt-5">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              list="roadmap-projects"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              onBlur={() => {
                const next = project.trim() || null;
                if (next !== (job.project ?? null)) {
                  void onPatch(job.id, { project: next ?? "" });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Project"
              aria-label="Project"
              className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
            />
            <datalist id="roadmap-projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <select
              value={job.area}
              onChange={(e) => void onPatch(job.id, { area: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 focus:border-sky-400 focus:outline-none"
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {areaMeta(a).label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                void onPatch(job.id, {
                  visibility:
                    job.visibility === "members" ? "internal" : "members",
                })
              }
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                job.visibility === "members"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {job.visibility === "members"
                ? "Members — on public roadmap"
                : "Internal"}
            </button>
            {job.app_path ? (
              <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
                {job.app_path}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <ScorePicker
              label="Impact"
              hint={ROADMAP_IMPACT_HINT}
              value={job.impact}
              onChange={(impact) => void onPatch(job.id, { impact })}
            />
            <ScorePicker
              label="Ease"
              hint={job.ease ? ROADMAP_EASE_LEVELS[job.ease] : "5 = under an hour"}
              value={job.ease}
              onChange={(ease) => void onPatch(job.id, { ease })}
            />
          </div>

          <input
            value={blockedBy}
            onChange={(e) => setBlockedBy(e.target.value)}
            onBlur={() => {
              if ((blockedBy.trim() || null) !== (job.blocked_by ?? null)) {
                void onPatch(job.id, { blockedBy: blockedBy.trim() || null });
              }
            }}
            placeholder="Blocked by… (leave empty if not blocked)"
            className="mt-3 w-full rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-1.5 text-sm text-amber-900 placeholder:text-amber-800/45 focus:border-amber-400 focus:outline-none"
          />

          {/* Scope / notes */}
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Scope</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((notes.trim() || null) !== (job.notes ?? null)) {
                void onPatch(job.id, { notes: notes.trim() || null });
              }
            }}
            rows={4}
            placeholder="What exactly is this job? Crisp enough that an agent could pick it up."
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          />

          {/* Reference images */}
          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Images{images.length > 0 ? ` · ${images.length}` : ""}
            </h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Add images"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void uploadFiles(files);
              }}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Design refs and screenshots for whoever builds this — upload or
            paste a screenshot anywhere in this card.
          </p>
          {images.length > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    title={img.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="h-full w-full object-cover transition group-hover:opacity-90"
                      loading="lazy"
                    />
                  </a>
                  <button
                    type="button"
                    aria-label={`Remove ${img.name}`}
                    onClick={() => void onDeleteImage(job.id, img.id)}
                    className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Checklist */}
          <h3 className="mt-5 text-sm font-semibold text-slate-900">
            Checklist
            {checklist.length > 0
              ? ` · ${checklist.filter((c) => c.done).length}/${checklist.length}`
              : ""}
          </h3>
          <div className="mt-1.5 flex flex-col gap-1">
            {checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() =>
                    saveChecklist(
                      checklist.map((c) =>
                        c.id === item.id ? { ...c, done: !c.done } : c
                      )
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                />
                <span
                  className={`flex-1 text-sm ${
                    item.done
                      ? "text-slate-400 line-through"
                      : "text-slate-800"
                  }`}
                >
                  {item.text}
                </span>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() =>
                    saveChecklist(checklist.filter((c) => c.id !== item.id))
                  }
                  className="rounded p-0.5 text-slate-300 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addChecklistItem();
                }}
                placeholder="Add checklist item…"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                disabled={!newItem.trim()}
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {/* Comments */}
          <h3 className="mt-5 text-sm font-semibold text-slate-900">
            Comments
          </h3>
          <div className="mt-1.5 flex flex-col gap-2.5">
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">
                  {c.author ?? "Admin"}{" "}
                  <span className="font-normal text-slate-400">
                    ·{" "}
                    {new Date(c.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
                  {c.text}
                </p>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addComment();
                  }
                }}
                rows={2}
                placeholder="Add a comment…"
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={addComment}
                disabled={!newComment.trim()}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-400">
            Added{" "}
            {new Date(job.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <button
            type="button"
            onClick={() => void onDelete(job.id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete job
          </button>
        </div>
      </div>
    </div>
  );
}

function AddJobComposer({
  areas,
  defaultArea,
  onSubmit,
  onCancel,
}: {
  areas: string[];
  defaultArea: string;
  onSubmit: (title: string, area: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState(defaultArea);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await onSubmit(t, area);
      setTitle("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-sky-300 bg-white p-1.5 shadow-sm">
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="What's the job?"
        className="w-full resize-none border-0 bg-transparent p-1 text-[13px] leading-snug text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
      <div className="flex flex-wrap items-center gap-1">
        {areas.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(a)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
              area === a
                ? areaMeta(a).chip
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            {areaMeta(a).label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-0.5">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!title.trim()}
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50 disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              Add
            </button>
          )}
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </div>
  );
}

/** Labelled score meter for the job modal. */
function ScorePicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-2.5" title={hint}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <ScoreMeter label={label} value={value} onChange={onChange} size="lg" />
      <span className="text-[11px] text-slate-400">{hint}</span>
    </div>
  );
}

/**
 * Five segments filled up to the score, red at 1 to green at 5. Click a
 * segment to set it; click the current one to clear.
 */
function ScoreMeter({
  label,
  value,
  onChange,
  size = "sm",
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  size?: "sm" | "lg";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const tone = shown ? SCORE_TONE[shown] : null;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex">
        {ROADMAP_SCORES.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(value === n ? null : n)}
            className="group/seg px-px py-1.5 focus:outline-none"
          >
            <span
              className={`block rounded-[3px] transition-colors group-focus-visible/seg:ring-2 group-focus-visible/seg:ring-sky-400 ${
                size === "lg" ? "h-3 w-7" : "h-2.5 w-4"
              } ${
                tone && shown !== null && n <= shown
                  ? `${tone.fill} ${hover !== null && hover !== value ? "opacity-70" : ""}`
                  : "bg-slate-200"
              }`}
            />
          </button>
        ))}
      </div>
      <span
        className={`w-3 text-sm font-semibold tabular-nums ${
          tone ? tone.text : "text-slate-300"
        }`}
      >
        {shown ?? "–"}
      </span>
    </div>
  );
}

/** Impact plus ease as a pill, red at 2 to green at 10. */
function TotalBadge({ total }: { total: number | null }) {
  if (total === null) return <span className="text-slate-300">–</span>;
  const tone = SCORE_TONE[Math.round(total / 2)];
  return (
    <span
      className={`inline-flex min-w-8 justify-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${tone.soft} ${tone.text}`}
    >
      {total}
    </span>
  );
}

/** What each corner of the impact vs ease grid means. */
function zoneFor(impact: number, ease: number) {
  if (impact >= 4 && ease >= 4) return { label: "Quick wins", bg: "bg-emerald-50" };
  if (impact >= 4 && ease <= 2) return { label: "Big bets", bg: "bg-sky-50" };
  if (impact <= 2 && ease >= 4) return { label: "Fill-ins", bg: "bg-amber-50/70" };
  if (impact <= 2 && ease <= 2) return { label: "Not now", bg: "bg-rose-50/60" };
  return null;
}

const GRAPH_STATUSES: RoadmapStatus[] = [...OPEN_STATUSES, "parked"];
const IMPACT_ROWS = [...ROADMAP_SCORES].reverse();

function ImpactEaseGraph({
  jobs,
  allJobs,
  onOpen,
  onScore,
}: {
  jobs: RoadmapJob[];
  allJobs: RoadmapJob[];
  onOpen: (id: string) => void;
  onScore: (id: string, impact: number | null, ease: number | null) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragActiveRef = useRef(false);

  const planned = jobs.filter((j) => GRAPH_STATUSES.includes(j.status));
  const unscored = planned.filter((j) => !(j.impact && j.ease));

  // Effort is what's being built now, across every category.
  const active = allJobs.filter(
    (j) => j.status === "in_progress" || j.status === "up_next"
  );
  const effort = [
    ...new Set([...ROADMAP_AREAS, ...active.map((j) => j.area)]),
  ].map((area) => ({
    area,
    count: active.filter((j) => j.area === area).length,
  }));

  function dropZone(key: string, onDropJob: (job: RoadmapJob) => void) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver((k) => (k === key ? null : k));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(null);
        const job = allJobs.find(
          (j) => j.id === e.dataTransfer.getData("text/plain")
        );
        if (job) onDropJob(job);
      },
    };
  }

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold text-slate-600">
          Where effort is going
          <span className="font-normal text-slate-400">
            {" "}
            · {active.length} in progress or up next
          </span>
        </p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
          {effort.map(({ area, count }) =>
            count > 0 ? (
              <div
                key={area}
                className={areaMeta(area).dot}
                style={{ width: `${(count / active.length) * 100}%` }}
                title={`${areaMeta(area).label}: ${count}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {effort.map(({ area, count }) => (
            <span
              key={area}
              className="flex items-center gap-1.5 text-[11px] text-slate-500"
              title={areaMeta(area).hint || undefined}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${areaMeta(area).dot}`} />
              {areaMeta(area).label}
              <span className="tabular-nums text-slate-400">{count}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid min-w-[640px] grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] gap-1">
            {IMPACT_ROWS.map((impact) => (
              <div key={impact} className="contents">
                <div className="flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-400">
                  {impact}
                </div>
                {ROADMAP_SCORES.map((ease) => {
                  const key = `${impact}-${ease}`;
                  const zone = zoneFor(impact, ease);
                  const corner =
                    (impact === 5 || impact === 1) && (ease === 5 || ease === 1);
                  const cellJobs = planned.filter(
                    (j) => j.impact === impact && j.ease === ease
                  );
                  return (
                    <div
                      key={key}
                      {...dropZone(key, (job) => {
                        if (job.impact !== impact || job.ease !== ease) {
                          onScore(job.id, impact, ease);
                        }
                      })}
                      className={`flex min-h-[5.5rem] flex-col gap-1 rounded-md p-1 transition ${
                        dragOver === key
                          ? "bg-sky-100 ring-1 ring-sky-400"
                          : zone?.bg ?? "bg-slate-50"
                      }`}
                    >
                      {corner && zone ? (
                        <p className="px-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {zone.label}
                        </p>
                      ) : null}
                      {cellJobs.map((job) => (
                        <GraphChip
                          key={job.id}
                          job={job}
                          dragActiveRef={dragActiveRef}
                          onOpen={() => onOpen(job.id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
            <div />
            {ROADMAP_SCORES.map((ease) => (
              <div
                key={ease}
                className="pt-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-400"
              >
                {ease}
              </div>
            ))}
          </div>
          <div className="mt-1 flex min-w-[640px] items-center justify-between pl-6 text-[11px] text-slate-400">
            <span>↑ Impact: results, cash, happiness, your time</span>
            <span>Ease: quicker to live →</span>
          </div>
        </div>

        <aside
          {...dropZone("unscored", (job) => {
            if (job.impact !== null || job.ease !== null) {
              onScore(job.id, null, null);
            }
          })}
          className={`w-full shrink-0 rounded-xl border p-2 transition lg:w-60 ${
            dragOver === "unscored"
              ? "border-sky-400 bg-sky-50"
              : "border-slate-200 bg-slate-100/80"
          }`}
        >
          <p className="px-1 text-xs font-semibold text-slate-600">
            Not scored
            <span className="font-normal text-slate-400"> · {unscored.length}</span>
          </p>
          <p className="px-1 pb-2 text-[11px] text-slate-400">
            Drag onto the grid to score, or open a job and pick numbers.
          </p>
          <div className="flex flex-col gap-1">
            {unscored.map((job) => (
              <GraphChip
                key={job.id}
                job={job}
                dragActiveRef={dragActiveRef}
                onOpen={() => onOpen(job.id)}
              />
            ))}
            {unscored.length === 0 ? (
              <p className="px-1 pb-1 text-[11px] text-slate-400">
                Everything planned is scored.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Shows jobs not yet done. Dashed = parked. Drag a card to rescore it.
      </p>
    </div>
  );
}

function GraphChip({
  job,
  dragActiveRef,
  onOpen,
}: {
  job: RoadmapJob;
  dragActiveRef: React.MutableRefObject<boolean>;
  onOpen: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        dragActiveRef.current = true;
        e.dataTransfer.setData("text/plain", job.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          dragActiveRef.current = false;
        }, 0);
      }}
      onClick={() => {
        if (dragActiveRef.current) return;
        onOpen();
      }}
      title={`#${job.job_number} · ${job.title} (${STATUS_META[job.status].label})`}
      className={`flex min-w-0 cursor-pointer items-center gap-1.5 rounded border bg-white px-1.5 py-1 text-[11px] font-medium leading-tight text-slate-800 transition hover:border-slate-300 hover:shadow-sm active:cursor-grabbing ${
        job.status === "parked"
          ? "border-dashed border-slate-300 opacity-60"
          : job.status === "in_progress"
            ? "border-slate-200 border-l-2 border-l-blue-400"
            : job.status === "up_next"
              ? "border-slate-200 border-l-2 border-l-orange-400"
              : "border-slate-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${areaMeta(job.area).dot}`}
      />
      <span className="truncate">{job.title}</span>
    </div>
  );
}

type ListSortKey = "status" | "number" | "title" | "area" | "impact" | "ease" | "total";
type ListGroup = "project" | "area" | "status" | "none";
type ListSort = { key: ListSortKey; dir: "asc" | "desc" };

const LIST_PREFS_KEY = "roadmap-list-prefs";
const DEFAULT_LIST_SORT: ListSort = { key: "status", dir: "asc" };

/** Impact plus ease, 2-10; null until both are scored. */
function jobTotal(job: RoadmapJob): number | null {
  return job.impact && job.ease ? job.impact + job.ease : null;
}

function Caret({ open }: { open: boolean }) {
  return (
    <Play
      aria-hidden
      fill="currentColor"
      strokeWidth={0}
      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    />
  );
}

function RoadmapListTable({
  jobs,
  areas,
  onOpen,
  onPatch,
  addSlot,
  stickyTop,
  projects,
}: {
  jobs: RoadmapJob[];
  areas: string[];
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  addSlot: (
    key: string,
    status: RoadmapStatus,
    area?: string,
    project?: string | null
  ) => React.ReactNode;
  stickyTop: number;
  projects: string[];
}) {
  // Only mounts in the browser once jobs have loaded, so it can read prefs up front.
  const [prefs] = useState(() => {
    try {
      const raw = window.localStorage.getItem(LIST_PREFS_KEY);
      return raw
        ? (JSON.parse(raw) as {
            group?: ListGroup;
            sort?: ListSort;
            hidden?: RoadmapStatus[];
          })
        : null;
    } catch {
      return null;
    }
  });
  const [group, setGroup] = useState<ListGroup>(prefs?.group ?? "area");
  const [sort, setSort] = useState<ListSort>(prefs?.sort ?? DEFAULT_LIST_SORT);
  /** Statuses switched off in the status filter. */
  const [hidden, setHidden] = useState<Set<RoadmapStatus>>(
    () => new Set(prefs?.hidden ?? [])
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function savePrefs(next: {
    group?: ListGroup;
    sort?: ListSort;
    hidden?: Set<RoadmapStatus>;
  }) {
    const merged = {
      group: next.group ?? group,
      sort: next.sort ?? sort,
      hidden: [...(next.hidden ?? hidden)],
    };
    try {
      window.localStorage.setItem(LIST_PREFS_KEY, JSON.stringify(merged));
    } catch {
      /* noop */
    }
  }

  function sortBy(key: ListSortKey) {
    // Scores open high-first; everything else reads top-down.
    const numeric = key === "impact" || key === "ease" || key === "total";
    const next: ListSort =
      sort.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: numeric ? "desc" : "asc" };
    setSort(next);
    savePrefs({ sort: next });
  }

  function changeGroup(next: ListGroup) {
    setGroup(next);
    setCollapsed(new Set());
    savePrefs({ group: next });
  }

  function toggleStatus(status: RoadmapStatus) {
    const next = new Set(hidden);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setHidden(next);
    savePrefs({ hidden: next });
  }

  const statusCounts = useMemo(() => {
    const counts = new Map<RoadmapStatus, number>();
    for (const j of jobs) counts.set(j.status, (counts.get(j.status) ?? 0) + 1);
    return counts;
  }, [jobs]);

  const shown = useMemo(
    () => jobs.filter((j) => !hidden.has(j.status)),
    [jobs, hidden]
  );

  const sorted = useMemo(() => {
    const statusRank = new Map(LIST_ORDER.map((s, i) => [s, i]));
    const areaRank = new Map(areas.map((a, i) => [a, i]));
    const value = (j: RoadmapJob): number | string | null => {
      switch (sort.key) {
        case "status":
          return statusRank.get(j.status) ?? 99;
        case "number":
          return j.job_number;
        case "title":
          return j.title.toLowerCase();
        case "area":
          return areaRank.get(j.area) ?? 99;
        case "impact":
          return j.impact;
        case "ease":
          return j.ease;
        case "total":
          return jobTotal(j);
      }
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...shown].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      // Unscored rows sit at the bottom whichever way the sort runs.
      if (va === null || vb === null) {
        if (va !== vb) return va === null ? 1 : -1;
      } else if (va !== vb) {
        return (va < vb ? -1 : 1) * sign;
      }
      return (
        (statusRank.get(a.status) ?? 99) - (statusRank.get(b.status) ?? 99) ||
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at)
      );
    });
  }, [shown, areas, sort]);

  const groups = useMemo(() => {
    if (group === "area") {
      return areas
        .map((area) => ({
          key: `area:${area}`,
          label: areaMeta(area).label,
          dot: areaMeta(area).dot,
          hint: areaMeta(area).hint,
          status: "todo" as RoadmapStatus,
          area,
          project: undefined as string | null | undefined,
          rows: sorted.filter((j) => j.area === area),
        }))
        .filter((g) => g.rows.length > 0 || ROADMAP_AREAS.includes(g.area as never));
    }
    if (group === "project") {
      return [...projects, null]
        .map((project) => ({
          key: `project:${project ?? NO_PROJECT}`,
          label: project ?? "No project",
          dot: null,
          hint: "",
          status: "todo" as RoadmapStatus,
          area: undefined,
          project: project as string | null | undefined,
          rows: sorted.filter((j) => (j.project ?? null) === project),
        }))
        .filter((g) => g.rows.length > 0);
    }
    if (group === "status") {
      return LIST_ORDER.map((status) => ({
        key: `status:${status}`,
        label: STATUS_META[status].label,
        dot: null,
        hint: "",
        status,
        area: undefined,
        project: undefined as string | null | undefined,
        rows: sorted.filter((j) => j.status === status),
      })).filter((g) => g.rows.length > 0);
    }
    return [
      {
        key: "all",
        label: null,
        dot: null,
        hint: "",
        status: "todo" as RoadmapStatus,
        area: undefined,
        project: undefined as string | null | undefined,
        rows: sorted,
      },
    ];
  }, [group, areas, projects, sorted]);

  const scoredCount = shown.filter((j) => jobTotal(j) !== null).length;
  const columns: { key: ListSortKey; label: string; right?: boolean }[] = [
    { key: "title", label: "Job" },
    { key: "status", label: "Status" },
    ...(group === "area" ? [] : [{ key: "area" as const, label: "Category" }]),
    { key: "impact", label: "Impact", right: true },
    { key: "ease", label: "Ease", right: true },
    { key: "total", label: "Total", right: true },
  ];

  return (
    <div className="mt-4 max-w-5xl pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-500">
          <span className="font-semibold tabular-nums text-slate-700">
            {scoredCount} of {shown.length}
          </span>{" "}
          scored
        </p>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${shown.length ? (scoredCount / shown.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1" aria-label="Show statuses">
          {LIST_ORDER.map((status) => {
            const on = !hidden.has(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStatus(status)}
                title={on ? `Hide ${STATUS_META[status].label}` : `Show ${STATUS_META[status].label}`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                  on
                    ? STATUS_META[status].chip
                    : "bg-transparent text-slate-400 line-through decoration-slate-300 ring-1 ring-inset ring-slate-200 hover:text-slate-600"
                }`}
              >
                {STATUS_META[status].label}
                <span className="font-medium tabular-nums opacity-60">
                  {statusCounts.get(status) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">
          Group by
          <select
            value={group}
            onChange={(e) => changeGroup(e.target.value as ListGroup)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-sky-400 focus:outline-none"
          >
            <option value="project">Project</option>
            <option value="area">Category</option>
            <option value="status">Status</option>
            <option value="none">Nothing</option>
          </select>
        </label>
      </div>

      {/* Sideways scroll only below lg: an overflow box would stop the headings sticking. */}
      <div className="mt-2 overflow-x-auto lg:overflow-visible">
        <table className="w-full min-w-[52rem] table-fixed text-left text-sm">
          <colgroup>
            <col />
            <col className="w-[8rem]" />
            {group === "area" ? null : <col className="w-[9rem]" />}
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
            <col className="w-[5rem]" />
          </colgroup>
          <thead className="text-xs font-medium text-slate-500">
            <tr>
              {columns.map((col, i) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ top: stickyTop }}
                    className={`sticky z-10 bg-[var(--app-canvas-base)] py-2.5 shadow-[inset_0_-1px_0_rgb(226_232_240)] ${
                      i === 0 ? "pl-[1.625rem] pr-4" : "px-3"
                    } ${col.right ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(col.key)}
                      className={`inline-flex items-center gap-1 transition hover:text-slate-900 ${
                        active ? "text-slate-900" : ""
                      }`}
                    >
                      {col.label}
                      {active ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          {groups.map((g, gi) => {
            const open = !collapsed.has(g.key);
            return (
              <tbody key={g.key}>
                {g.label ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className={`pb-0.5 ${gi === 0 ? "pt-2" : "pt-4"}`}
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(g.key)) next.delete(g.key);
                            else next.add(g.key);
                            return next;
                          })
                        }
                        title={g.hint || undefined}
                        className="inline-flex items-center gap-2.5 py-1 text-left"
                      >
                        <Caret open={open} />
                        {g.dot ? (
                          <span className={`h-2 w-2 rounded-full ${g.dot}`} />
                        ) : null}
                        <span className="text-lg font-medium tracking-[-0.01em] text-slate-950">
                          {g.label}
                        </span>
                        <span className="text-sm tabular-nums text-slate-400">
                          {g.rows.length}
                        </span>
                      </button>
                    </td>
                  </tr>
                ) : null}
                {open
                  ? g.rows.map((job) => {
                      const total = jobTotal(job);
                      return (
                          <tr
                            key={job.id}
                            onClick={() => onOpen(job.id)}
                            className="cursor-pointer border-t border-slate-200 align-middle transition hover:bg-white/70"
                          >
                            <td className="py-2.5 pl-[1.625rem] pr-4">
                              <div className="flex min-w-0 items-center gap-2">
                                {/* Fixed, right-aligned slot so titles line up whatever the digit count. */}
                                <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-400">
                                  <JobNumber n={job.job_number} />
                                </span>
                                <span className="truncate font-medium text-slate-900">
                                  {job.title}
                                </span>
                                {group !== "project" && job.project ? (
                                  <span className="shrink-0 rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                    {job.project}
                                  </span>
                                ) : null}
                                <span className="flex shrink-0 items-center gap-2">
                                  <JobMetaBadges job={job} />
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[job.status].chip}`}
                              >
                                {STATUS_META[job.status].label}
                              </span>
                            </td>
                            {group === "area" ? null : (
                              <td className="px-3 py-2.5">
                                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${areaMeta(job.area).dot}`}
                                  />
                                  <span className="truncate">{areaMeta(job.area).label}</span>
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-1.5 text-right">
                              <ScoreMeter
                                label={`Impact for ${job.title}`}
                                value={job.impact}
                                onChange={(impact) => void onPatch(job.id, { impact })}
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <ScoreMeter
                                label={`Ease for ${job.title}`}
                                value={job.ease}
                                onChange={(ease) => void onPatch(job.id, { ease })}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <TotalBadge total={total} />
                            </td>
                          </tr>
                      );
                    })
                  : null}
                {open ? (
                  <tr>
                    <td colSpan={columns.length} className="pb-1 pl-5 pt-0.5">
                      <div className="max-w-sm">
                        {addSlot(`list:${g.key}`, g.status, g.area, g.project)}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            );
          })}
        </table>
        {jobs.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">No jobs yet.</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">
            Every status is switched off. Tap one above to show it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
