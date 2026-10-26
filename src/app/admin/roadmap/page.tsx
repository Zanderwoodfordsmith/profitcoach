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
  ArrowUpDown,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Flag,
  Folder,
  Gauge,
  ImageIcon,
  ImagePlus,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  MessageSquare,
  OctagonAlert,
  Plus,
  Rows3,
  ScatterChart,
  Search,
  Sigma,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { RoadmapProjectsView } from "@/components/admin/roadmap/RoadmapProjectsView";
import { Caret, MetaDropdown, SCORE_TONE, ScoreDropdown, useDismiss } from "@/components/admin/roadmap/roadmapUi";
import { WorkshopActivityPanel } from "@/components/BossGrid/WorkshopActivityPanel";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import type { WorkshopComment } from "@/lib/playbookSessionNotes";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  ROADMAP_AREAS,
  ROADMAP_AREA_META,
  ROADMAP_EASE_LEVELS,
  ROADMAP_IMPACT_LEVELS,
  ROADMAP_SCORES,
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
  done: { label: "Ready", chip: "bg-emerald-100 text-emerald-800" },
  staged: { label: "On staging", chip: "bg-cyan-100 text-cyan-800" },
  live: { label: "Live", chip: "bg-slate-300/80 text-slate-700" },
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
  Record<
    RoadmapStatus,
    {
      status: RoadmapStatus;
      label: string | null;
      tone: string;
      /** Unheaded sections only: the strip shown mid-drag while empty. */
      dropHint?: string;
    }[]
  >
> = {
  parked: [
    { status: "evaluate", label: "Evaluate", tone: "text-violet-700" },
    { status: "parked", label: "Parked", tone: "text-slate-500" },
    { status: "vetoed", label: "Vetoed", tone: "text-rose-600" },
  ],
  todo: [
    { status: "up_next", label: null, tone: "", dropHint: "Drop here for Up next" },
    { status: "todo", label: "Later", tone: "text-slate-500" },
  ],
  done: [
    { status: "done", label: null, tone: "", dropHint: "Drop here once you've checked it" },
    { status: "staged", label: "On staging", tone: "text-cyan-700" },
  ],
};

/** Where a card added from a column's "+ Add" lands. */
const COLUMN_ADD_STATUS: Partial<Record<RoadmapStatus, RoadmapStatus>> = {
  parked: "evaluate",
};


/** Columns rendered as a narrow strip until expanded. */
const DEFAULT_COLLAPSED: RoadmapStatus[] = ["parked", "live"];

const SECTIONS_KEY = "roadmap-collapsed-sections";

/** Cards shown per board list before "Show N more". */
const CARD_LIMIT = 15;

/** Closest to shipping first, then planned work, ideas, and Live last. */
const LIST_ORDER: RoadmapStatus[] = [
  "done",
  "staged",
  "review",
  "in_progress",
  "up_next",
  "todo",
  "evaluate",
  "parked",
  "vetoed",
  "live",
];

/** The Filter's status list, grouped like the status dropdown, in LIST_ORDER. */
const FILTER_STATUS_GROUPS: { label: string | null; items: RoadmapStatus[] }[] = [
  { label: "Ready", items: ["done", "staged"] },
  { label: null, items: ["review"] },
  { label: null, items: ["in_progress"] },
  { label: "To do", items: ["up_next", "todo"] },
  { label: "Ideas", items: ["evaluate", "parked", "vetoed"] },
  { label: null, items: ["live"] },
];

/** Hidden until ticked in Filter. */
const DEFAULT_HIDDEN_STATUSES: RoadmapStatus[] = ["live"];

const VIEW_STORAGE_KEY = "roadmap-view";
const BOARD_GROUP_KEY = "roadmap-board-group";
const BOARD_SORT_KEY = "roadmap-board-sort";
const CARD_STYLE_KEY = "roadmap-card-style";

/** Board card look: clean (21 Oct) or the earlier classic one, kept to compare. */
type CardStyle = "clean" | "classic";

/** Statuses where a missing Done when is worth flagging on the card. */
const NEEDS_DONE_WHEN: RoadmapStatus[] = ["todo", "up_next", "in_progress", "review", "evaluate"];

type BoardSort = "total" | "impact" | "ease" | "added";

const BOARD_SORTS: { key: BoardSort; label: string }[] = [
  { key: "total", label: "Total (impact + ease)" },
  { key: "impact", label: "Impact" },
  { key: "ease", label: "Ease" },
  { key: "added", label: "Date added" },
];

/** Filter value for jobs with no project label. */
const NO_PROJECT = "__none__";

/** Red flag for urgent jobs. */
function UrgentFlag({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <span title="Urgent" className="inline-flex shrink-0">
      <Flag className={`${className} fill-rose-500 text-rose-500`} aria-label="Urgent" />
    </span>
  );
}

/** Short job reference, e.g. #12. */
function JobNumber({ n }: { n: number }) {
  return (
    <span className="shrink-0 tabular-nums">
      <span className="opacity-60">#</span>
      {n}
    </span>
  );
}

type ViewMode = "board" | "list" | "graph" | "projects";

/** Every word in the search box must appear in the job's number, title, notes, Done when or project. */
function matchesSearch(job: RoadmapJob, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [`#${job.job_number}`, job.title, job.notes, job.done_when, job.project]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

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
  /** Categories ticked in Filter; empty = all. */
  const [areaFilter, setAreaFilter] = useState<Set<string>>(() => new Set());
  /** Projects ticked in Filter (NO_PROJECT for jobs without one); empty = all. */
  const [projectFilter, setProjectFilter] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toolbarMenu, setToolbarMenu] = useState<
    "filter" | "sort" | "group" | "cards" | null
  >(null);
  const [boardSort, setBoardSort] = useState<BoardSort>("total");
  const [cardStyle, setCardStyle] = useState<CardStyle>("clean");
  const [listGroup, setListGroup] = useState<ListGroup>("area");
  const [listSort, setListSort] = useState<ListSort>(DEFAULT_LIST_SORT);
  /** Statuses unticked in Filter: hidden on every view. */
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<RoadmapStatus>>(
    () => new Set(DEFAULT_HIDDEN_STATUSES)
  );
  const closeToolbarMenu = useCallback(() => setToolbarMenu(null), []);
  const toolbarMenuRef = useDismiss(toolbarMenu !== null, closeToolbarMenu);
  const [boardGroup, setBoardGroup] = useState<"none" | "project">("none");
  /** Board sections folded shut (by status), e.g. Vetoed. */
  const [foldedSections, setFoldedSections] = useState<Set<RoadmapStatus>>(
    () => new Set(["vetoed"])
  );
  /** Board lists opened past the first CARD_LIMIT cards. */
  const [showAll, setShowAll] = useState<Set<string>>(() => new Set());
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
      if (stored === "list" || stored === "board" || stored === "graph" || stored === "projects") {
        setView(stored);
      }
      if (window.localStorage.getItem(BOARD_GROUP_KEY) === "project") {
        setBoardGroup("project");
      }
      const listPrefs = window.localStorage.getItem(LIST_PREFS_KEY);
      if (listPrefs) {
        const parsed = JSON.parse(listPrefs) as {
          group?: ListGroup;
          sort?: ListSort;
          hidden?: RoadmapStatus[];
        };
        if (parsed.group) setListGroup(parsed.group);
        if (parsed.sort) setListSort(parsed.sort);
        if (parsed.hidden) setHiddenStatuses(new Set(parsed.hidden));
      }
      if (window.localStorage.getItem(CARD_STYLE_KEY) === "classic") {
        setCardStyle("classic");
      }
      const storedSort = window.localStorage.getItem(BOARD_SORT_KEY);
      if (BOARD_SORTS.some((o) => o.key === storedSort)) {
        setBoardSort(storedSort as BoardSort);
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

  function saveListPrefs(next: {
    group?: ListGroup;
    sort?: ListSort;
    hidden?: Set<RoadmapStatus>;
  }) {
    try {
      window.localStorage.setItem(
        LIST_PREFS_KEY,
        JSON.stringify({
          group: next.group ?? listGroup,
          sort: next.sort ?? listSort,
          hidden: [...(next.hidden ?? hiddenStatuses)],
        })
      );
    } catch {
      /* noop */
    }
  }

  function sortListBy(key: ListSortKey) {
    // Scores open high-first; everything else reads top-down.
    const numeric = key === "impact" || key === "ease" || key === "total";
    const next: ListSort =
      listSort.key === key
        ? { key, dir: listSort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: numeric ? "desc" : "asc" };
    setListSort(next);
    saveListPrefs({ sort: next });
  }

  function changeListGroup(next: ListGroup) {
    setListGroup(next);
    saveListPrefs({ group: next });
  }

  function toggleHiddenStatus(status: RoadmapStatus) {
    const next = new Set(hiddenStatuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setHiddenStatuses(next);
    saveListPrefs({ hidden: next });
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

  /** Saves still on their way; a reload while any are pending would undo them on screen. */
  const pendingSavesRef = useRef(0);
  /** Only the newest reload may replace the jobs. */
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const seq = ++loadSeqRef.current;
    setError(null);
    const res = await fetch("/api/admin/roadmap", { headers });
    if (!res.ok) {
      setError("Could not load jobs.");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { jobs?: RoadmapJob[] };
    // Stale answer (a newer reload started, or a save is still in flight): skip it.
    if (seq !== loadSeqRef.current || pendingSavesRef.current > 0) return;
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
      // Show the change straight away (API names map onto the row's columns).
      const { doneWhen, blockedBy, ...rest } = patch;
      const onScreen = {
        ...rest,
        ...(doneWhen !== undefined ? { done_when: doneWhen || null } : {}),
        ...(blockedBy !== undefined ? { blocked_by: blockedBy || null } : {}),
      };
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? ({ ...j, ...onScreen } as RoadmapJob) : j))
      );
      pendingSavesRef.current += 1;
      try {
        await fetch(`/api/admin/roadmap/${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(patch),
        });
      } finally {
        pendingSavesRef.current -= 1;
      }
      // One reload once the last save lands.
      if (pendingSavesRef.current === 0) await load();
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
          !hiddenStatuses.has(j.status) &&
          (areaFilter.size === 0 || areaFilter.has(j.area)) &&
          (projectFilter.size === 0 || projectFilter.has(j.project ?? NO_PROJECT)) &&
          matchesSearch(j, search)
      ),
    [jobs, areaFilter, projectFilter, hiddenStatuses, search]
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
      <button
        type="button"
        onClick={() => switchView("projects")}
        title="One row per project: stage, goal, impact and ease, loose dates"
        className={`inline-flex items-center gap-1.5 border-l border-slate-200 px-2.5 py-1.5 text-xs font-medium transition ${
          view === "projects"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Folder className="h-3.5 w-3.5" /> Projects
      </button>
    </div>
  );

  /** Board order: urgent first, then highest first, unscored at the bottom; "added" is oldest first. */
  const boardJobs = useMemo(() => {
    const score = (j: RoadmapJob) =>
      boardSort === "total" ? jobTotal(j) : boardSort === "impact" ? j.impact : j.ease;
    return [...visible].sort((a, b) => {
      // Urgent jobs jump the queue whatever the sort.
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (boardSort === "added") return a.created_at.localeCompare(b.created_at);
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) {
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      }
      return (jobTotal(b) ?? 0) - (jobTotal(a) ?? 0) || a.sort_order - b.sort_order;
    });
  }, [visible, boardSort]);

  const composeArea = areaFilter.size === 1 ? [...areaFilter][0] : lastArea;
  /** New jobs join the project when exactly one is ticked in Filter. */
  const filterProject =
    projectFilter.size === 1 && !projectFilter.has(NO_PROJECT) ? [...projectFilter][0] : null;
  const filterCount = areaFilter.size + projectFilter.size + hiddenStatuses.size;
  const statusCounts = new Map<RoadmapStatus, number>();
  for (const j of jobs) statusCounts.set(j.status, (statusCounts.get(j.status) ?? 0) + 1);
  const toggleIn = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

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
        : filterProject;
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
          variant={cardStyle}
        />
      ));
    // Long lists show the top cards (the board is sorted best first) and fold the rest.
    const limitedCards = (rows: RoadmapJob[], key: string) => {
      const all = showAll.has(key);
      return (
        <>
          {cards(all ? rows : rows.slice(0, CARD_LIMIT))}
          {rows.length > CARD_LIMIT ? (
            <button
              type="button"
              onClick={() =>
                setShowAll((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800"
            >
              {all ? "Show fewer" : `Show ${rows.length - CARD_LIMIT} more`}
            </button>
          ) : null}
        </>
      );
    };
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
              // Header stays put; the cards scroll inside the column.
              style={{ maxHeight: `calc(100dvh - ${headerHeight + 150}px)` }}
              className={`flex min-h-48 min-w-72 flex-1 basis-0 flex-col rounded-xl p-2 transition ${
                !sections && dragOverStatus === status
                  ? "bg-sky-100 ring-1 ring-sky-400"
                  : "bg-slate-100/80"
              }`}
            >
              <div className="mb-2 flex shrink-0 items-center justify-between px-1 pt-0.5">
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
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-0.5">
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
                            over
                              ? section.status === "up_next"
                                ? "bg-orange-100 ring-1 ring-orange-400"
                                : "bg-sky-100 ring-1 ring-sky-400"
                              : ""
                          }`}
                        >
                          {cards(rows)}
                          {rows.length === 0 ? (
                            <p
                              className={`rounded-md border border-dashed px-2 py-2 text-xs font-medium ${
                                section.status === "up_next"
                                  ? "border-orange-300 text-orange-600"
                                  : "border-slate-300 text-slate-500"
                              }`}
                            >
                              {section.dropHint}
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
                            className={`flex w-full items-center gap-1.5 px-1 py-1 text-left text-kicker font-semibold uppercase ${section.tone}`}
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
                            {limitedCards(rows, `${lanePrefix}${section.status}`)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {addSlot(`${lanePrefix}${status}`, addStatus, undefined, project)}
                </div>
              ) : (
                <div className="flex min-h-12 flex-col gap-2">
                  {limitedCards(
                    subset.filter((j) => j.status === status),
                    `${lanePrefix}${status}`
                  )}
                  {addSlot(`${lanePrefix}${status}`, addStatus, undefined, project)}
                </div>
              )}
              </div>
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
        title="Product"
        description="Review = built, check it on 3002. Ready = checked, goes out with the next ;stage. On staging = on staging.theprofitcoach.com, waiting for ;live. Live = coaches have it. Projects group related jobs. Ask the AI panel to add or update jobs from any screen."
        tabs={<LessonImportTabs />}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-200/80 pb-4">
        {viewToggle}
        <div ref={toolbarMenuRef} className="flex items-center gap-1">
          <div className="relative">
            <TableToolbarButton
              label="Filter"
              aria-haspopup="true"
              aria-expanded={toolbarMenu === "filter"}
              active={toolbarMenu === "filter" || filterCount > 0}
              badge={filterCount > 0 ? filterCount : null}
              onClick={() => setToolbarMenu((m) => (m === "filter" ? null : "filter"))}
              icon={<FilterSlidersIcon className="h-5 w-5 text-slate-500" />}
            />
            {toolbarMenu === "filter" ? (
              <div className="absolute left-0 top-full z-[90] mt-1 max-h-[min(40rem,78vh)] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]">
                <p className="mb-1 px-2 text-xs font-semibold text-slate-700">
                  Status <span className="font-normal text-slate-400">· untick to hide</span>
                </p>
                <div className="flex flex-col">
                  {FILTER_STATUS_GROUPS.map((group, gi) => (
                    <div key={gi}>
                      {group.label ? (
                        <p className="px-2 pb-0.5 pt-1.5 text-kicker font-semibold uppercase text-slate-400">
                          {group.label}
                        </p>
                      ) : null}
                      {group.items.map((st) => (
                        <label
                          key={st}
                          className={`flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-sm text-slate-700 hover:bg-slate-50 ${
                            group.label ? "pl-5" : "pl-2"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenStatuses.has(st)}
                            onChange={() => toggleHiddenStatus(st)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                          />
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[st].chip}`} />
                          <span className="flex-1 truncate">
                            {STATUS_MENU_LABEL[st] ?? STATUS_META[st].label}
                          </span>
                          <span className="text-xs tabular-nums text-slate-400">
                            {statusCounts.get(st) ?? 0}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="mb-1 mt-3 border-t border-slate-100 px-2 pt-3 text-xs font-semibold text-slate-700">
                  Category
                </p>
                {areas.map((a) => (
                  <label
                    key={a}
                    title={areaMeta(a).hint || undefined}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={areaFilter.has(a)}
                      onChange={() => setAreaFilter((f) => toggleIn(f, a))}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                    />
                    <span className={`h-2 w-2 rounded-full ${areaMeta(a).dot}`} />
                    <span className="flex-1">{areaMeta(a).label}</span>
                    {openCounts.get(a) ? (
                      <span className="text-xs tabular-nums text-slate-400">{openCounts.get(a)}</span>
                    ) : null}
                  </label>
                ))}
                <p className="mb-1 mt-3 border-t border-slate-100 px-2 pt-3 text-xs font-semibold text-slate-700">
                  Project
                </p>
                <div className="max-h-56 overflow-y-auto">
                  {[...projects, NO_PROJECT].map((p) => (
                    <label
                      key={p}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={projectFilter.has(p)}
                        onChange={() => setProjectFilter((f) => toggleIn(f, p))}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                      />
                      <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span className={`flex-1 truncate ${p === NO_PROJECT ? "text-slate-400" : ""}`}>
                        {p === NO_PROJECT ? "No project" : p}
                      </span>
                    </label>
                  ))}
                </div>
                {filterCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAreaFilter(new Set());
                      setProjectFilter(new Set());
                      setHiddenStatuses(new Set());
                      saveListPrefs({ hidden: new Set() });
                    }}
                    className="mt-2 w-full rounded-lg border-t border-slate-100 px-2 pt-2 text-left text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Clear all filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {view !== "graph" ? (
            <div className="relative">
              <TableToolbarButton
                label="Sort"
                aria-haspopup="true"
                aria-expanded={toolbarMenu === "sort"}
                active={toolbarMenu === "sort"}
                onClick={() => setToolbarMenu((m) => (m === "sort" ? null : "sort"))}
                icon={<ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {toolbarMenu === "sort" ? (
                <div className="absolute left-0 top-full z-[90] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]">
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold text-slate-700">
                    {view === "board" ? "Sort cards by" : "Sort rows by"}
                  </p>
                  {view === "board"
                    ? BOARD_SORTS.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => {
                            setBoardSort(o.key);
                            try {
                              window.localStorage.setItem(BOARD_SORT_KEY, o.key);
                            } catch {
                              /* noop */
                            }
                            setToolbarMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <span className="flex-1">{o.label}</span>
                          {boardSort === o.key ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
                        </button>
                      ))
                    : LIST_SORT_OPTIONS.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => sortListBy(o.key)}
                          title={listSort.key === o.key ? "Click again to flip the order" : undefined}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <span className="flex-1">{o.label}</span>
                          {listSort.key === o.key ? (
                            listSort.dir === "asc" ? (
                              <ArrowUp className="h-4 w-4 text-slate-500" aria-hidden />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-slate-500" aria-hidden />
                            )
                          ) : null}
                        </button>
                      ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {view !== "graph" ? (
            <div className="relative">
              <TableToolbarButton
                label="Group"
                aria-haspopup="true"
                aria-expanded={toolbarMenu === "group"}
                active={toolbarMenu === "group" || (view === "board" && boardGroup !== "none")}
                onClick={() => setToolbarMenu((m) => (m === "group" ? null : "group"))}
                icon={<Layers className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {toolbarMenu === "group" ? (
                <div className="absolute left-0 top-full z-[90] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]">
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold text-slate-700">Group by</p>
                  {(view === "board"
                    ? ([
                        { key: "none", label: "Nothing" },
                        { key: "project", label: "Project" },
                      ] as const)
                    : LIST_GROUP_OPTIONS
                  ).map((o) => {
                    const current = view === "board" ? boardGroup : listGroup;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => {
                          if (view === "board") changeBoardGroup(o.key as "none" | "project");
                          else changeListGroup(o.key as ListGroup);
                          setToolbarMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex-1">{o.label}</span>
                        {current === o.key ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          {view === "board" ? (
            <div className="relative">
              <TableToolbarButton
                label="Cards"
                aria-haspopup="true"
                aria-expanded={toolbarMenu === "cards"}
                active={toolbarMenu === "cards"}
                onClick={() => setToolbarMenu((m) => (m === "cards" ? null : "cards"))}
                icon={<LayoutGrid className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {toolbarMenu === "cards" ? (
                <div className="absolute left-0 top-full z-[90] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]">
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold text-slate-700">Card style</p>
                  {(
                    [
                      ["clean", "Clean", "Dot, progress bar, flags"],
                      ["classic", "Classic", "The earlier look"],
                    ] as const
                  ).map(([key, label, hint]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setCardStyle(key);
                        try {
                          window.localStorage.setItem(CARD_STYLE_KEY, key);
                        } catch {
                          /* noop */
                        }
                        setToolbarMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="flex-1">
                        {label}
                        <span className="block text-xs text-slate-400">{hint}</span>
                      </span>
                      {cardStyle === key ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {searchOpen || search ? (
          <div className="relative ml-auto">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => {
                if (!search.trim()) setSearchOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setSearchOpen(false);
                }
              }}
              placeholder="Find a job"
              aria-label="Find a job"
              className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-7 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Find a job"
            title="Find a job"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setComposingIn((c) => (c === "toolbar" ? null : "toolbar"))
            }
            className={buttonClass("main", "small")}
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
                      filterProject
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
      ) : view === "projects" ? (
        <RoadmapProjectsView
          jobs={jobs}
          stickyTop={headerHeight}
          authHeaders={authHeaders}
          onOpenProject={(name) => {
            setProjectFilter(new Set([name]));
            switchView("list");
          }}
        />
      ) : view === "graph" ? (
        <ImpactEaseGraph
          jobs={visible}
          allJobs={jobs}
          onOpen={setOpenJobId}
          onScore={(id, impact, ease) => void patchJob(id, { impact, ease })}
          stickyTop={headerHeight}
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
          key={listGroup}
          group={listGroup}
          sort={listSort}
          onSortBy={sortListBy}
        />
      ) : boardGroup === "project" ? (
        <div className="mt-4 flex flex-col gap-6">
          {[...projects, null]
            .map((project) => ({
              project,
              rows: boardJobs.filter((j) => (j.project ?? null) === project),
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
        renderBoard(boardJobs, "", undefined, true)
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

/** The clean card: title leads, one quiet row, progress along the bottom. */
function CleanJobCard({
  job,
  dragActiveRef,
  onOpen,
  showProject,
}: {
  job: RoadmapJob;
  dragActiveRef: React.MutableRefObject<boolean>;
  onOpen: () => void;
  showProject: boolean;
}) {
  const total = jobTotal(job);
  const checklistDone = job.checklist?.filter((c) => c.done).length ?? 0;
  const checklistTotal = job.checklist?.length ?? 0;
  const commentCount = job.comments?.length ?? 0;
  const imageCount = job.images?.length ?? 0;
  const missingDoneWhen = !job.done_when?.trim() && NEEDS_DONE_WHEN.includes(job.status);
  const edge = job.blocked_by
    ? "bg-rose-500"
    : job.status === "up_next"
      ? "bg-orange-400"
      : null;
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
      role="button"
      tabIndex={0}
      aria-label={job.title}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onClick={() => {
        if (dragActiveRef.current) return;
        onOpen();
      }}
      className={`relative cursor-pointer overflow-hidden rounded-lg border outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 hover:shadow-sm active:cursor-grabbing ${
        job.blocked_by
          ? "border-rose-200 bg-rose-50/70 hover:border-rose-300"
          : "border-slate-200 bg-white hover:border-slate-300"
      } ${job.status === "vetoed" ? "opacity-60 hover:opacity-100" : ""}`}
    >
      {edge ? <span className={`absolute inset-y-0 left-0 w-1 ${edge}`} aria-hidden /> : null}
      <div className="py-2.5 pl-3.5 pr-3">
        {showProject && job.project ? (
          // Project line carries the Total, so the title gets the full width.
          <>
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <p className="truncate text-caption font-medium text-slate-500">{job.project}</p>
              <span className="flex shrink-0 items-center gap-1.5">
                {job.urgent ? <UrgentFlag /> : null}
                {total !== null ? <TotalBadge total={total} size="sm" /> : null}
              </span>
            </div>
            <p className="line-clamp-3 text-sm font-medium leading-snug text-slate-900">
              {job.title}
            </p>
          </>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-3 text-sm font-medium leading-snug text-slate-900">
              {job.title}
            </p>
            <span className="flex shrink-0 items-center gap-1.5">
              {job.urgent ? <UrgentFlag /> : null}
              {total !== null ? <TotalBadge total={total} size="sm" /> : null}
            </span>
          </div>
        )}
        {job.blocked_by ? (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-rose-700">
            Blocked: {job.blocked_by}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2.5 text-xs text-slate-500">
          <span
            title={areaMeta(job.area).label}
            className={`h-2 w-2 shrink-0 rounded-full ${areaMeta(job.area).dot}`}
          />
          {missingDoneWhen ? (
            <span className="font-medium text-amber-600" title="Open the job and add what finished looks like">
              No done when
            </span>
          ) : null}
          {imageCount > 0 ? (
            <span className="flex items-center gap-0.5">
              <ImageIcon className="h-3 w-3" aria-hidden />
              {imageCount}
            </span>
          ) : null}
          {commentCount > 0 ? (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" aria-hidden />
              {commentCount}
            </span>
          ) : null}
          {checklistTotal > 0 ? (
            <span className="tabular-nums">
              {checklistDone}/{checklistTotal}
            </span>
          ) : null}
          <span className="ml-auto">
            <JobNumber n={job.job_number} />
          </span>
        </div>
      </div>
      {checklistTotal > 0 ? (
        <div className="h-1 w-full bg-slate-100" aria-hidden>
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function JobCard({
  job,
  dragActiveRef,
  onOpen,
  showProject = true,
  variant = "clean",
}: {
  job: RoadmapJob;
  dragActiveRef: React.MutableRefObject<boolean>;
  onOpen: () => void;
  showProject?: boolean;
  variant?: CardStyle;
}) {
  if (variant === "clean") {
    return (
      <CleanJobCard
        job={job}
        dragActiveRef={dragActiveRef}
        onOpen={onOpen}
        showProject={showProject}
      />
    );
  }
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
      role="button"
      tabIndex={0}
      aria-label={job.title}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onClick={() => {
        if (dragActiveRef.current) return;
        onOpen();
      }}
      className={`cursor-pointer rounded-lg border bg-white px-3 py-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 hover:shadow-sm active:cursor-grabbing ${
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
        <p className="mb-0.5 truncate text-caption font-medium text-slate-500">
          {job.project}
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium leading-snug text-slate-900">
          {job.title}
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          {job.urgent ? <UrgentFlag /> : null}
          {job.blocked_by ? (
            <span title={`Blocked by: ${job.blocked_by}`}>
              <OctagonAlert className="h-3.5 w-3.5 text-rose-500" />
            </span>
          ) : null}
          {jobTotal(job) !== null ? <TotalBadge total={jobTotal(job)} size="sm" /> : null}
        </span>
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

/** The status menu: board columns in order, with Ideas, To do and Ready split into their parts. */
const STATUS_MENU: { label: string | null; items: RoadmapStatus[] }[] = [
  { label: "Ideas", items: ["evaluate", "parked", "vetoed"] },
  { label: "To do", items: ["up_next", "todo"] },
  { label: null, items: ["in_progress"] },
  { label: null, items: ["review"] },
  { label: "Ready", items: ["done", "staged"] },
  { label: null, items: ["live"] },
];

/** Menu names where a status reads differently inside its group. */
const STATUS_MENU_LABEL: Partial<Record<RoadmapStatus, string>> = {
  todo: "Later",
};

/** Closes a popover when the pointer goes down outside it. */
function StatusDropdown({
  value,
  onChange,
}: {
  value: RoadmapStatus;
  onChange: (status: RoadmapStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Status: ${STATUS_META[value].label}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-w-36 items-center justify-between gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90 ${STATUS_META[value].chip}`}
      >
        {STATUS_META[value].label}
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {STATUS_MENU.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-1 border-t border-slate-100 pt-1" : ""}>
              {group.label ? (
                <p className="px-2 pb-0.5 pt-1 text-kicker font-semibold uppercase text-slate-400">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 ${
                    group.label ? "pl-5" : "pl-2"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[s].chip}`} />
                  <span className="flex-1">{STATUS_MENU_LABEL[s] ?? STATUS_META[s].label}</span>
                  {value === s ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** ClickUp-style property row: grey icon and label, then the value. */
function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Folder;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
      <span className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A value that opens a small menu of options. */
/** Pick a project from the list, or type to find or add one. */
function ProjectDropdown({
  value,
  projects,
  onChange,
}: {
  value: string | null;
  projects: string[];
  onChange: (project: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const ref = useDismiss(open, close);
  const q = query.trim();
  const shown = projects.filter((p) => p.toLowerCase().includes(q.toLowerCase()));
  const canAdd = q.length > 0 && !projects.some((p) => p.toLowerCase() === q.toLowerCase());
  const pick = (project: string | null) => {
    onChange(project);
    close();
  };
  return (
    <div ref={ref} className="relative inline-flex max-w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition hover:bg-slate-100"
      >
        {value ? (
          <span className="truncate font-medium text-slate-800">{value}</span>
        ) : (
          <span className="text-slate-400">Empty</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
              if (e.key === "Enter") {
                if (canAdd) pick(q);
                else if (shown.length === 1) pick(shown[0]);
              }
            }}
            placeholder="Find or add a project"
            className="mb-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {shown.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="flex-1 truncate">{p}</span>
                {value === p ? <Check className="h-4 w-4 text-slate-500" aria-hidden /> : null}
              </button>
            ))}
            {canAdd ? (
              <button
                type="button"
                onClick={() => pick(q)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-sky-700 transition hover:bg-sky-50"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Add “{q}”
              </button>
            ) : null}
            {shown.length === 0 && !canAdd ? (
              <p className="px-2 py-1.5 text-sm text-slate-400">No projects yet.</p>
            ) : null}
          </div>
          {value ? (
            <button
              type="button"
              onClick={() => pick(null)}
              className="mt-1 w-full rounded-lg border-t border-slate-100 px-2 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Roadmap comments in the shape the BOSS Pro comments panel uses, and back. */
function toPanelComments(comments: RoadmapComment[]): WorkshopComment[] {
  return comments.map((c) => ({
    id: c.id,
    author: "coach",
    authorName: c.author ?? "Admin",
    text: c.text,
    createdAt: c.created_at,
    editedAt: c.edited_at ?? undefined,
    replies: (c.replies ?? []).map((r) => ({
      id: r.id,
      author: "coach",
      authorName: r.author ?? "Admin",
      text: r.text,
      createdAt: r.created_at,
    })),
  }));
}

function fromPanelComments(comments: WorkshopComment[]): RoadmapComment[] {
  return comments.map((c) => ({
    id: c.id,
    author: c.authorName ?? null,
    text: c.text,
    created_at: c.createdAt,
    edited_at: c.editedAt ?? null,
    replies: c.replies.map((r) => ({
      id: r.id,
      author: r.authorName ?? null,
      text: r.text,
      created_at: r.createdAt,
    })),
  }));
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
  const [doneWhen, setDoneWhen] = useState(job.done_when ?? "");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);
  /** The big title has scrolled away: show the slim bar instead. */
  const [compact, setCompact] = useState(false);
  const [blockedBy, setBlockedBy] = useState(job.blocked_by ?? "");
  const [newItem, setNewItem] = useState("");
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  // The title wraps onto as many lines as it needs.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

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
    setDoneWhen(job.done_when ?? "");
    setBlockedBy(job.blocked_by ?? "");
  }, [job.id, job.title, job.notes, job.done_when, job.blocked_by]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = headingRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { root, threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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

  const checklist = job.checklist ?? [];
  const panelComments = toPanelComments(job.comments ?? []);
  const images = job.images ?? [];

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
      />
      <div
        className="absolute left-1/2 top-1/2 h-[min(88vh,880px)] w-[min(calc(100vw-1.5rem),72rem)] -translate-x-1/2 -translate-y-1/2"
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

        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5 lg:flex-row">
          {/* Main */}
          <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {/* Slim bar that stays put once the title scrolls away, like ClickUp */}
            <div className="sticky top-0 z-20 h-0">
              <div
                aria-hidden={!compact}
                className={`absolute inset-x-0 top-0 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur transition md:px-10 ${
                  compact ? "opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white ${STATUS_META[job.status].chip}`}
                  title={STATUS_META[job.status].label}
                />
                {job.urgent ? <UrgentFlag className="h-4 w-4" /> : null}
                <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
                  {job.title}
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  <JobNumber n={job.job_number} />
                </span>
                <TotalBadge total={jobTotal(job)} />
              </div>
            </div>
            <div className="px-6 pb-8 pt-7 md:px-10 md:pt-8">
              <div ref={headingRef} className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <p className="text-kicker font-semibold uppercase text-slate-500">
                    Job <JobNumber n={job.job_number} />
                    {job.project ? <span className="text-slate-400"> · {job.project}</span> : null}
                  </p>
                  <textarea
                    ref={titleRef}
                    value={title}
                    rows={1}
                    onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
                    onBlur={() => {
                      const t = title.trim();
                      if (t && t !== job.title) void onPatch(job.id, { title: t });
                    }}
                    className="mt-1 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight text-slate-900 focus:outline-none focus:ring-0 md:text-heading"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={job.urgent}
                    onClick={() => void onPatch(job.id, { urgent: !job.urgent })}
                    title={job.urgent ? "Urgent: click to clear" : "Mark as urgent (jumps the queue)"}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ${
                      job.urgent
                        ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                        : "text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-600"
                    }`}
                  >
                    <Flag
                      className={`h-4 w-4 ${job.urgent ? "fill-rose-500 text-rose-500" : ""}`}
                      aria-hidden
                    />
                    {job.urgent ? "Urgent" : null}
                  </button>
                  <StatusDropdown
                    value={job.status}
                    onChange={(status) => void onPatch(job.id, { status })}
                  />
                </div>
              </div>

              {/* Properties */}
              <div className="mt-5 grid gap-x-10 gap-y-1 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <MetaRow icon={Folder} label="Project">
                    <ProjectDropdown
                      value={job.project}
                      projects={projects}
                      onChange={(next) => void onPatch(job.id, { project: next ?? "" })}
                    />
                  </MetaRow>
                  <MetaRow icon={Tag} label="Category">
                    <MetaDropdown
                      display={
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <span className={`h-2 w-2 rounded-full ${areaMeta(job.area).dot}`} />
                          {areaMeta(job.area).label}
                        </span>
                      }
                      options={areas.map((a) => ({
                        key: a,
                        selected: job.area === a,
                        onSelect: () => void onPatch(job.id, { area: a }),
                        node: (
                          <>
                            <span className={`h-2 w-2 rounded-full ${areaMeta(a).dot}`} />
                            {areaMeta(a).label}
                          </>
                        ),
                      }))}
                    />
                  </MetaRow>
                  <MetaRow icon={OctagonAlert} label="Blocked by">
                    <input
                      value={blockedBy}
                      onChange={(e) => setBlockedBy(e.target.value)}
                      onBlur={() => {
                        if ((blockedBy.trim() || null) !== (job.blocked_by ?? null)) {
                          void onPatch(job.id, { blockedBy: blockedBy.trim() || null });
                        }
                      }}
                      placeholder="Not blocked"
                      className={`w-full rounded-md border border-transparent px-2 py-1 placeholder:text-slate-400 hover:bg-slate-100 focus:border-sky-400 focus:bg-white focus:outline-none ${
                        job.blocked_by ? "bg-rose-50 font-medium text-rose-700" : "bg-transparent text-slate-800"
                      }`}
                    />
                  </MetaRow>
                </div>
                <div className="flex flex-col gap-1">
                  <MetaRow icon={Zap} label="Impact">
                    <ScoreDropdown
                      value={job.impact}
                      names={ROADMAP_IMPACT_LEVELS}
                      onChange={(impact) => void onPatch(job.id, { impact })}
                    />
                  </MetaRow>
                  <MetaRow icon={Gauge} label="Ease">
                    <ScoreDropdown
                      value={job.ease}
                      names={ROADMAP_EASE_LEVELS}
                      onChange={(ease) => void onPatch(job.id, { ease })}
                    />
                  </MetaRow>
                  <MetaRow icon={Sigma} label="Total">
                    <span className="px-1">
                      <TotalBadge total={jobTotal(job)} />
                    </span>
                  </MetaRow>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200" role="presentation" />

              {/* Done when */}
              <h3 className="mt-5 text-sm font-semibold text-slate-900">Done when</h3>
              <textarea
                value={doneWhen}
                onChange={(e) => setDoneWhen(e.target.value)}
                onBlur={() => {
                  if ((doneWhen.trim() || null) !== (job.done_when ?? null)) {
                    void onPatch(job.id, { doneWhen: doneWhen.trim() || null });
                  }
                }}
                rows={3}
                placeholder="What finished looks like, in a sentence or two. Review checks against this."
                className="mt-1.5 w-full resize-y rounded-lg border border-emerald-200 bg-emerald-50/40 px-3.5 py-2.5 text-sm font-medium leading-relaxed text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
              />

              {/* Scope */}
              <h3 className="mt-5 text-sm font-semibold text-slate-900">Scope</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if ((notes.trim() || null) !== (job.notes ?? null)) {
                    void onPatch(job.id, { notes: notes.trim() || null });
                  }
                }}
                rows={12}
                placeholder="Why it matters, what's in and out, links and notes."
                className="mt-1.5 min-h-64 w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
              />

              {/* Checklist */}
              <h3 className="mt-6 text-sm font-semibold text-slate-900">
                Checklist
                {checklist.length > 0 ? (
                  <span className="font-normal text-slate-400">
                    {" "}
                    · {checklist.filter((c) => c.done).length}/{checklist.length}
                  </span>
                ) : null}
              </h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="group flex items-start gap-2.5">
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
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                    />
                    <span
                      className={`flex-1 text-sm leading-snug ${
                        item.done ? "text-slate-400 line-through" : "text-slate-800"
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
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addChecklistItem();
                  }}
                  placeholder="+ Add an item, press Enter"
                  className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 hover:bg-slate-50 focus:border-sky-400 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Links */}
              {job.app_path ? (
                <>
                  <h3 className="mt-6 text-sm font-semibold text-slate-900">Links</h3>
                  <div className="mt-2">
                    <MetaRow icon={Link2} label="Page">
                      <a
                        href={job.app_path}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 font-medium text-sky-700 hover:underline"
                      >
                        {job.app_path}
                      </a>
                    </MetaRow>
                  </div>
                </>
              ) : null}

              {/* Images */}
              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Images
                  {images.length > 0 ? (
                    <span className="font-normal text-slate-400"> · {images.length}</span>
                  ) : null}
                </h3>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={buttonClass("second", "small")}
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
              <p className="mt-0.5 text-xs text-slate-400">
                Design refs and screenshots. Paste a screenshot anywhere in this card.
              </p>
              {images.length > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <a href={img.url} target="_blank" rel="noreferrer" title={img.name}>
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

              {/* Footer */}
              <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
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
                  className={buttonClass("delete", "small")}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete job
                </button>
              </div>
            </div>
          </div>

          {/* Comments: the same panel as a BOSS Pro playbook */}
          <WorkshopActivityPanel
            activity={[]}
            comments={panelComments}
            editable
            defaultAuthor="coach"
            defaultAuthorName={authorName}
            onCommentsChange={(next) =>
              void onPatch(job.id, { comments: fromPanelComments(next) })
            }
            onActivityAppend={() => {}}
            collapsed={commentsCollapsed}
            onCollapsedChange={setCommentsCollapsed}
            allowManage
            emptyText="No comments yet."
          />
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
        className="w-full resize-none border-0 bg-transparent p-1 text-ui leading-snug text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
      <div className="flex flex-wrap items-center gap-1">
        {areas.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArea(a)}
            className={`rounded-full px-2 py-0.5 text-caption font-semibold transition ${
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
              className="rounded px-1.5 py-0.5 text-caption font-medium text-sky-700 transition hover:bg-sky-50 disabled:text-slate-300 disabled:hover:bg-transparent"
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
function TotalBadge({
  total,
  size = "md",
}: {
  total: number | null;
  size?: "sm" | "md";
}) {
  if (total === null) return <span className="text-slate-300">–</span>;
  const tone = SCORE_TONE[Math.round(total / 2)];
  return (
    <span
      title="Total: impact + ease"
      className={`inline-flex justify-center rounded-full font-semibold tabular-nums ${tone.soft} ${tone.text} ${
        size === "sm" ? "min-w-6 px-1.5 py-px text-xs" : "min-w-8 px-2 py-0.5 text-sm"
      }`}
    >
      {total}
    </span>
  );
}

/** What each corner of the impact vs ease grid means. */
function zoneFor(impact: number, ease: number) {
  if (impact >= 4 && ease >= 4)
    return { label: "Quick wins", hint: "Do these first", bg: "bg-emerald-100 ring-emerald-200", text: "text-emerald-700" };
  if (impact >= 4 && ease <= 2)
    return { label: "Big bets", hint: "Plan these properly", bg: "bg-sky-100 ring-sky-200", text: "text-sky-700" };
  if (impact <= 2 && ease >= 4)
    return { label: "Fill-ins", hint: "When there's a gap", bg: "bg-amber-100 ring-amber-200", text: "text-amber-700" };
  if (impact <= 2 && ease <= 2)
    return { label: "Not now", hint: "Park or drop", bg: "bg-rose-100 ring-rose-200", text: "text-rose-700" };
  return null;
}

const GRAPH_STATUSES: RoadmapStatus[] = [...OPEN_STATUSES, "evaluate", "parked"];
const GRAPH_SIDEBAR_KEY = "roadmap-graph-sidebar";
/**
 * Graph chip dots: only the stages worth spotting. To do has no dot, so a
 * plain chip is a to-do. Checked for colour-blind separation (dataviz validator).
 */
const GRAPH_STATUS_DOT: Partial<Record<RoadmapStatus, { color: string; label: string }>> = {
  in_progress: { color: "#2563eb", label: "In progress" },
  up_next: { color: "#f97316", label: "Up next" },
  evaluate: { color: "#a855f7", label: "Idea" },
  parked: { color: "#a855f7", label: "Idea" },
};

/** Chips a grid square shows before "+N more", like a calendar day. */
const CELL_LIMIT = 4;
const IMPACT_ROWS = [...ROADMAP_SCORES].reverse();

function ZoneLabel({
  zone,
  right,
}: {
  zone: { label: string; hint: string; text: string };
  right: boolean;
}) {
  return (
    <div className={`px-0.5 leading-tight ${right ? "text-right" : ""}`}>
      <p className={`text-sm font-semibold ${zone.text}`}>{zone.label}</p>
      <p className={`text-caption opacity-80 ${zone.text}`}>{zone.hint}</p>
    </div>
  );
}

/** Category colours for the donut; the same hues as the category dots. */
const AREA_HEX: Record<string, string> = {
  "set-up": "#8b5cf6",
  "get-clients": "#0ea5e9",
  "keep-clients": "#10b981",
  platform: "#f59e0b",
};

/** Share of in-progress and up-next jobs per category, as a donut. */
function EffortDonut({ effort, total }: { effort: { area: string; count: number }[]; total: number }) {
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 1 ? 2 : 0; // 2px surface gap between segments
  // Where each segment starts along the ring.
  const starts = effort.reduce<number[]>(
    (acc, _segment, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (effort[i - 1].count / Math.max(total, 1)) * circumference],
    []
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${total} jobs in progress or up next`}
      className="shrink-0"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {effort.map(({ area, count }, i) => {
        if (count === 0 || total === 0) return null;
        const len = (count / total) * circumference;
        return (
          <circle
            key={area}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={AREA_HEX[area] ?? "#94a3b8"}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(len - gap, 0)} ${circumference - Math.max(len - gap, 0)}`}
            strokeDashoffset={-starts[i]}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-opacity hover:opacity-80"
          >
            <title>{`${areaMeta(area).label}: ${count} of ${total}`}</title>
          </circle>
        );
      })}
      <text x="50%" y="47%" textAnchor="middle" className="fill-slate-900 text-2xl font-bold">
        {total}
      </text>
      <text x="50%" y="62%" textAnchor="middle" className="fill-slate-500 text-[11px]">
        jobs
      </text>
    </svg>
  );
}

function ImpactEaseGraph({
  jobs,
  allJobs,
  onOpen,
  onScore,
  stickyTop,
}: {
  jobs: RoadmapJob[];
  allJobs: RoadmapJob[];
  onOpen: (id: string) => void;
  onScore: (id: string, impact: number | null, ease: number | null) => void;
  stickyTop: number;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragActiveRef = useRef(false);
  /** Squares opened past CELL_LIMIT. */
  const [openCells, setOpenCells] = useState<Set<string>>(() => new Set());
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return window.localStorage.getItem(GRAPH_SIDEBAR_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  function toggleSidebar() {
    setSidebarOpen((open) => {
      try {
        window.localStorage.setItem(GRAPH_SIDEBAR_KEY, open ? "closed" : "open");
      } catch {
        /* noop */
      }
      return !open;
    });
  }

  // Within each square: urgent first, then closest to shipping, ideas last.
  const statusRank = new Map(LIST_ORDER.map((st, i) => [st, i]));
  const planned = jobs
    .filter((j) => GRAPH_STATUSES.includes(j.status))
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        (statusRank.get(a.status) ?? 99) - (statusRank.get(b.status) ?? 99) ||
        a.sort_order - b.sort_order
    );
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

  // The grid fills the screen below the toolbar; crowded cells scroll inside.
  const height = `max(34rem, calc(100dvh - ${stickyTop + 128}px))`;

  return (
    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div
        className={cardClass("plain", "min-w-0 flex-1 overflow-x-auto py-3 pl-1 pr-3")}
        style={{ height }}
      >
        <div className="flex h-full min-w-[40rem] flex-col">
            <div className="grid min-h-0 flex-1 grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] grid-rows-5">
              {IMPACT_ROWS.map((impact) => (
                <div key={impact} className="contents">
                  <div
                    className="flex items-center justify-center text-sm font-bold tabular-nums text-slate-600"
                    title={`Impact ${impact}: ${ROADMAP_IMPACT_LEVELS[impact]}`}
                  >
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
                        title={`Impact ${impact} (${ROADMAP_IMPACT_LEVELS[impact]}), ease ${ease} (${ROADMAP_EASE_LEVELS[ease]})`}
                        // Each square's edge is a shade darker than its zone, so the
                        // zones read as blocks and the squares stay visible.
                        className={`flex min-h-0 flex-col gap-1 overflow-y-auto p-1.5 ring-inset transition ${
                          dragOver === key
                            ? "bg-sky-200/70 ring-2 ring-sky-500"
                            : `ring-1 ${zone?.bg ?? "bg-slate-50 ring-slate-200"}`
                        }`}
                      >
                        {/* Zone name in its outer corner: top row on top, bottom row at the foot. */}
                        {corner && zone && impact === 5 ? (
                          <ZoneLabel zone={zone} right={ease === 5} />
                        ) : null}
                        {(openCells.has(key) ? cellJobs : cellJobs.slice(0, CELL_LIMIT)).map(
                          (job) => (
                            <GraphChip
                              key={job.id}
                              job={job}
                              dragActiveRef={dragActiveRef}
                              onOpen={() => onOpen(job.id)}
                            />
                          )
                        )}
                        {cellJobs.length > CELL_LIMIT ? (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenCells((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                            className="self-start rounded px-1 py-0.5 text-caption font-medium text-slate-500 transition hover:bg-white/70 hover:text-slate-800"
                          >
                            {openCells.has(key) ? "Show fewer" : `+${cellJobs.length - CELL_LIMIT} more`}
                          </button>
                        ) : null}
                        {corner && zone && impact === 1 ? (
                          <div className="mt-auto">
                            <ZoneLabel zone={zone} right={ease === 5} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* X axis: numbers, then both axis titles on one line */}
            <div className="grid shrink-0 grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] pt-1.5">
              <div />
              {ROADMAP_SCORES.map((ease) => (
                <div
                  key={ease}
                  className="text-center text-sm font-bold tabular-nums text-slate-600"
                  title={`Ease ${ease}: ${ROADMAP_EASE_LEVELS[ease]}`}
                >
                  {ease}
                </div>
              ))}
            </div>
            <div className="flex shrink-0 items-center justify-between pl-0.5 pt-1.5 text-sm font-medium text-slate-700">
              <span>↑ Impact: bigger results</span>
              <span>Ease: quicker to deliver →</span>
            </div>
        </div>
      </div>

      {!sidebarOpen ? (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Show effort and not scored"
          style={{ height }}
          className="hidden w-10 shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 py-3 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 lg:flex"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span
            className="text-xs font-medium"
            style={{ writingMode: "vertical-rl" }}
          >
            Effort · Not scored {unscored.length}
          </span>
        </button>
      ) : null}
      <div
        className={`w-full shrink-0 flex-col gap-3 lg:w-72 ${sidebarOpen ? "flex" : "flex lg:hidden"}`}
        style={{ height }}
      >
        <section className={cardClass("plain", "relative shrink-0 p-4")}>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Hide this column"
            className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <h3 className="text-sm font-semibold text-slate-900">Where effort is going</h3>
          <p className="text-xs text-slate-500">In progress and up next</p>
          {active.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Nothing in progress or up next.</p>
          ) : (
            <div className="mt-3 flex items-center gap-4">
              <EffortDonut effort={effort} total={active.length} />
              <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                {effort.map(({ area, count }) => (
                  <li
                    key={area}
                    title={areaMeta(area).hint || undefined}
                    className="flex items-center gap-2 text-xs text-slate-700"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: AREA_HEX[area] ?? "#94a3b8" }}
                    />
                    <span className="flex-1 truncate">{areaMeta(area).label}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section
          {...dropZone("unscored", (job) => {
            if (job.impact !== null || job.ease !== null) {
              onScore(job.id, null, null);
            }
          })}
          className={`flex min-h-48 flex-1 flex-col rounded-xl border p-3 transition ${
            dragOver === "unscored"
              ? "border-sky-400 bg-sky-50"
              : "border-slate-200 bg-slate-100/80"
          }`}
        >
          <h3 className="px-1 text-sm font-semibold text-slate-900">
            Not scored
            <span className="font-normal text-slate-500"> · {unscored.length}</span>
          </h3>
          <p className="px-1 pb-2 text-xs text-slate-500">
            Drag onto the grid to score, or open a job and pick numbers.
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {unscored.map((job) => (
              <GraphChip
                key={job.id}
                job={job}
                dragActiveRef={dragActiveRef}
                onOpen={() => onOpen(job.id)}
              />
            ))}
            {unscored.length === 0 ? (
              <p className="px-1 pb-1 text-xs text-slate-500">Everything planned is scored.</p>
            ) : null}
          </div>
          <div className="mt-2 border-t border-slate-200/80 px-1 pt-2 text-caption text-slate-500">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {[
                { color: "#2563eb", label: "In progress" },
                { color: "#f97316", label: "Up next" },
                { color: null, label: "To do" },
                { color: "#a855f7", label: "Idea" },
              ].map((k) => (
                <span key={k.label} className="flex items-center gap-1.5">
                  {k.color ? (
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.color }} />
                  ) : (
                    <span className="h-2 w-2 rounded-full ring-1 ring-inset ring-slate-300" />
                  )}
                  {k.label}
                </span>
              ))}
            </p>
            <p className="mt-1">Dashed = parked. Drag a card to rescore it.</p>
          </div>
        </section>
      </div>
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
      className={`flex min-w-0 cursor-pointer items-center gap-1.5 rounded border bg-white px-1.5 py-1 text-caption font-medium leading-tight text-slate-800 transition hover:border-slate-300 hover:shadow-sm active:cursor-grabbing ${
        job.status === "parked" ? "border-dashed border-slate-300 opacity-60" : "border-slate-200"
      }`}
    >
      {GRAPH_STATUS_DOT[job.status] ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: GRAPH_STATUS_DOT[job.status]!.color }}
        />
      ) : null}
      {job.urgent ? <UrgentFlag className="h-3 w-3" /> : null}
      <span className="truncate">{job.title}</span>
    </div>
  );
}

type ListSortKey =
  | "status"
  | "number"
  | "title"
  | "project"
  | "area"
  | "impact"
  | "ease"
  | "total";
type ListGroup = "project" | "area" | "status" | "none";
type ListSort = { key: ListSortKey; dir: "asc" | "desc" };

// v2 (21 Oct): new status order and Live hidden by default; older saved prefs are ignored.
const LIST_PREFS_KEY = "roadmap-list-prefs-v2";
const DEFAULT_LIST_SORT: ListSort = { key: "status", dir: "asc" };
const LIST_JOB_WIDTH_KEY = "roadmap-list-job-width";

const LIST_SORT_OPTIONS: { key: ListSortKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "impact", label: "Impact" },
  { key: "ease", label: "Ease" },
  { key: "status", label: "Status" },
  { key: "project", label: "Project" },
  { key: "area", label: "Category" },
  { key: "title", label: "Name" },
  { key: "number", label: "Number" },
];

const LIST_GROUP_OPTIONS: { key: ListGroup; label: string }[] = [
  { key: "project", label: "Project" },
  { key: "area", label: "Category" },
  { key: "status", label: "Status" },
  { key: "none", label: "Nothing" },
];

/** Impact plus ease, 2-10; null until both are scored. */
function jobTotal(job: RoadmapJob): number | null {
  return job.impact && job.ease ? job.impact + job.ease : null;
}

function RoadmapListTable({
  jobs,
  areas,
  onOpen,
  onPatch,
  addSlot,
  stickyTop,
  projects,
  group,
  sort,
  onSortBy,
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
  group: ListGroup;
  sort: ListSort;
  onSortBy: (key: ListSortKey) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  /** The Job column's width; drag its right edge to stretch it. */
  const [jobWidth, setJobWidth] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(LIST_JOB_WIDTH_KEY));
      return saved >= 240 && saved <= 960 ? saved : 440;
    } catch {
      return 440;
    }
  });

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = jobWidth;
    let latest = startWidth;
    const onMove = (ev: PointerEvent) => {
      latest = Math.min(960, Math.max(240, startWidth + ev.clientX - startX));
      setJobWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        window.localStorage.setItem(LIST_JOB_WIDTH_KEY, String(latest));
      } catch {
        /* noop */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

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
        case "project":
          return j.project?.toLowerCase() ?? null;
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
    const urgentFirst = ["total", "impact", "ease", "status"].includes(sort.key);
    return [...jobs].sort((a, b) => {
      if (urgentFirst && a.urgent !== b.urgent) return a.urgent ? -1 : 1;
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
  }, [jobs, areas, sort]);

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

  const scoredCount = jobs.filter((j) => jobTotal(j) !== null).length;
  const columns: { key: ListSortKey; label: string; width: number; right?: boolean }[] = [
    { key: "title", label: "Job", width: jobWidth },
    { key: "status", label: "Status", width: 130 },
    ...(group === "project" ? [] : [{ key: "project" as const, label: "Project", width: 180 }]),
    ...(group === "area" ? [] : [{ key: "area" as const, label: "Category", width: 150 }]),
    { key: "impact", label: "Impact", width: 150, right: true },
    { key: "ease", label: "Ease", width: 150, right: true },
    { key: "total", label: "Total", width: 80, right: true },
  ];
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  return (
    <div className="mt-4 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-500">
          <span className="font-semibold tabular-nums text-slate-700">
            {scoredCount} of {jobs.length}
          </span>{" "}
          scored
        </p>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${jobs.length ? (scoredCount / jobs.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Sideways scroll only below lg: an overflow box would stop the headings sticking. */}
      <div className="mt-2 overflow-x-auto lg:overflow-visible">
        <table className="table-fixed text-left text-sm" style={{ width: tableWidth }}>
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
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
                    {i === 0 ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Drag to resize the Job column"
                        onPointerDown={startResize}
                        className="absolute inset-y-1 right-0 w-1.5 cursor-col-resize rounded-full transition hover:bg-sky-300 active:bg-sky-400"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSortBy(col.key)}
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
                                {job.urgent ? <UrgentFlag /> : null}
                                <span className="truncate font-medium text-slate-900">
                                  {job.title}
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <JobMetaBadges job={job} />
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-caption font-semibold ${STATUS_META[job.status].chip}`}
                              >
                                {STATUS_META[job.status].label}
                              </span>
                            </td>
                            {group === "project" ? null : (
                              <td className="px-3 py-2.5">
                                <span className="block truncate text-xs text-slate-600">
                                  {job.project ?? <span className="text-slate-300">–</span>}
                                </span>
                              </td>
                            )}
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
          <p className="py-6 text-sm text-slate-400">
            No jobs match. Check the Filter menu.
          </p>
        ) : null}
      </div>
    </div>
  );
}
