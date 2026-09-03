"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckSquare,
  Columns3,
  ImageIcon,
  ImagePlus,
  Loader2,
  MessageSquare,
  OctagonAlert,
  Plus,
  Rows3,
  Trash2,
  X,
} from "lucide-react";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout/StickyPageHeader";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  ROADMAP_AREAS,
  ROADMAP_STATUSES,
  type RoadmapChecklistItem,
  type RoadmapComment,
  type RoadmapJob,
  type RoadmapStatus,
} from "@/lib/roadmap/core";

const AREA_LABELS: Record<string, string> = {
  beat1: "Beat 1 · Relaunch",
  beat2: "Beat 2 · Content",
  website: "Website",
  "ai-panel": "AI panel",
  q4: "Q4",
  general: "General",
};

const STATUS_META: Record<RoadmapStatus, { label: string; chip: string }> = {
  todo: { label: "To do", chip: "bg-slate-200/80 text-slate-700" },
  up_next: { label: "Up next", chip: "bg-orange-100 text-orange-800" },
  in_progress: { label: "In progress", chip: "bg-yellow-100 text-yellow-800" },
  done: { label: "Done", chip: "bg-emerald-100 text-emerald-800" },
  live: { label: "Live", chip: "bg-teal-100 text-teal-800" },
  parked: { label: "Parked", chip: "bg-slate-200/70 text-slate-500" },
};

/**
 * Workflow order, left to right. Up next is not a column — it renders as an
 * orange section at the top of the To do lane. Blocked is a red flag on the
 * card (blocked_by set), not a column.
 */
const BOARD_COLUMNS: RoadmapStatus[] = [
  "todo",
  "in_progress",
  "done",
  "live",
  "parked",
];

/** Columns rendered as a narrow strip until expanded. */
const DEFAULT_COLLAPSED: RoadmapStatus[] = ["parked"];

const LIST_ORDER: RoadmapStatus[] = [
  "in_progress",
  "up_next",
  "todo",
  "done",
  "live",
  "parked",
];

const VIEW_STORAGE_KEY = "roadmap-view";

type ViewMode = "board" | "list";

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
  const [newTitle, setNewTitle] = useState("");
  const [newArea, setNewArea] = useState<string>("general");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("board");
  const [dragOverStatus, setDragOverStatus] = useState<RoadmapStatus | null>(
    null
  );
  const [expandedColumns, setExpandedColumns] = useState<Set<RoadmapStatus>>(
    () => new Set(BOARD_COLUMNS.filter((s) => !DEFAULT_COLLAPSED.includes(s)))
  );
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const dragActiveRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "board") setView(stored);
  }, []);

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

  async function addJob() {
    const title = newTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/roadmap", {
        method: "POST",
        headers,
        body: JSON.stringify({ title, area: newArea }),
      });
      if (res.ok) {
        setNewTitle("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

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
    const present = new Set<string>(jobs.map((j) => j.area));
    for (const a of ROADMAP_AREAS) present.add(a);
    return [...present];
  }, [jobs]);

  const visible = useMemo(
    () =>
      areaFilter === "all" ? jobs : jobs.filter((j) => j.area === areaFilter),
    [jobs, areaFilter]
  );

  const listRows = useMemo(() => {
    const rank = new Map(LIST_ORDER.map((s, i) => [s, i]));
    return [...visible].sort(
      (a, b) =>
        (rank.get(a.status) ?? 99) - (rank.get(b.status) ?? 99) ||
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at)
    );
  }, [visible]);

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
    </div>
  );

  return (
    <div className="w-full">
      <StickyPageHeader
        title="Academy"
        description="Done = built and verified. Live = released to coaches. Ask the AI panel to add or update jobs from any screen — jobs marked Members feed the public roadmap later."
        tabs={<LessonImportTabs />}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {viewToggle}
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addJob();
          }}
          placeholder="Add a job…"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
        />
        <select
          value={newArea}
          onChange={(e) => setNewArea(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none"
        >
          {areas.map((a) => (
            <option key={a} value={a}>
              {AREA_LABELS[a] ?? a}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void addJob()}
          disabled={saving || !newTitle.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </button>
        <div className="ml-auto flex flex-wrap gap-1.5">
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
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                areaFilter === a
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {AREA_LABELS[a] ?? a}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <p className="py-10 text-sm text-slate-500">Loading roadmap…</p>
      ) : view === "list" ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {listRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">No jobs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {listRows.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => setOpenJobId(job.id)}
                    className="group flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <span
                      className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold ${STATUS_META[job.status].chip}`}
                    >
                      {STATUS_META[job.status].label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                      {job.title}
                    </span>
                    <JobMetaBadges job={job} />
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">
                      {AREA_LABELS[job.area] ?? job.area}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((status) => {
            const upNext =
              status === "todo"
                ? visible.filter((j) => j.status === "up_next")
                : [];
            const column = visible.filter((j) => j.status === status);
            const headerCount =
              status === "todo" ? column.length + upNext.length : column.length;
            const expanded = expandedColumns.has(status);
            if (!expanded) {
              return (
                <div
                  key={status}
                  {...dropHandlers(status)}
                  onClick={() =>
                    setExpandedColumns((prev) => new Set([...prev, status]))
                  }
                  className={`flex h-64 w-9 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg py-2 transition ${
                    dragOverStatus === status
                      ? "bg-sky-100 ring-1 ring-sky-400"
                      : "bg-slate-100/80 hover:bg-slate-200/70"
                  }`}
                  title={`${STATUS_META[status].label} (${headerCount}) — click to expand`}
                >
                  <span className="text-[11px] font-semibold text-slate-500">
                    {headerCount}
                  </span>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    style={{ writingMode: "vertical-rl" }}
                  >
                    {STATUS_META[status].label}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={status}
                {...(status === "todo" ? {} : dropHandlers(status))}
                className={`w-60 shrink-0 rounded-lg p-1.5 transition ${
                  dragOverStatus === status && status !== "todo"
                    ? "bg-sky-100 ring-1 ring-sky-400"
                    : "bg-slate-100/80"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_META[status].chip}`}
                  >
                    {STATUS_META[status].label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400">
                      {headerCount}
                    </span>
                    {DEFAULT_COLLAPSED.includes(status) ? (
                      <button
                        type="button"
                        aria-label={`Collapse ${STATUS_META[status].label}`}
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
                {status === "todo" ? (
                  <>
                    <div
                      {...dropHandlers("up_next")}
                      className={`rounded-md p-0.5 transition ${
                        dragOverStatus === "up_next"
                          ? "bg-orange-100 ring-1 ring-orange-400"
                          : ""
                      }`}
                    >
                      <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-orange-600">
                        Up next
                      </p>
                      <div className="flex min-h-8 flex-col gap-1.5">
                        {upNext.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            dragActiveRef={dragActiveRef}
                            onOpen={() => setOpenJobId(job.id)}
                          />
                        ))}
                        {upNext.length === 0 ? (
                          <p className="px-1 pb-1 text-[11px] text-slate-400">
                            Drop a card here to queue it
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="my-1.5 border-t border-dashed border-slate-300" />
                    <div
                      {...dropHandlers("todo")}
                      className={`rounded-md p-0.5 transition ${
                        dragOverStatus === "todo"
                          ? "bg-sky-100 ring-1 ring-sky-400"
                          : ""
                      }`}
                    >
                      <div className="flex min-h-12 flex-col gap-1.5">
                        {column.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            dragActiveRef={dragActiveRef}
                            onOpen={() => setOpenJobId(job.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-12 flex-col gap-1.5">
                    {column.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        dragActiveRef={dragActiveRef}
                        onOpen={() => setOpenJobId(job.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
      {imageCount > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-400">
          <ImageIcon className="h-3 w-3" />
          {imageCount}
        </span>
      ) : null}
      {checklistTotal > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-400">
          <CheckSquare className="h-3 w-3" />
          {checklistDone}/{checklistTotal}
        </span>
      ) : null}
      {commentCount > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-400">
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
      className={`cursor-pointer rounded-md border bg-white px-2.5 py-2 transition hover:shadow-sm active:cursor-grabbing ${
        job.status === "up_next"
          ? "border-orange-200 border-l-2 border-l-orange-400 hover:border-orange-300"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[13px] font-medium leading-snug text-slate-900">
          {job.title}
        </p>
        {job.blocked_by ? (
          <span title={`Blocked by: ${job.blocked_by}`} className="shrink-0">
            <OctagonAlert className="h-3.5 w-3.5 text-rose-500" />
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="truncate text-[11px] text-slate-400">
          {AREA_LABELS[job.area] ?? job.area}
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
}: {
  job: RoadmapJob;
  authorName: string;
  onClose: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUploadImages: (id: string, files: File[]) => Promise<void>;
  onDeleteImage: (id: string, imageId: string) => Promise<void>;
  areas: string[];
}) {
  const [title, setTitle] = useState(job.title);
  const [notes, setNotes] = useState(job.notes ?? "");
  const [blockedBy, setBlockedBy] = useState(job.blocked_by ?? "");
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
  }, [job.id, job.title, job.notes, job.blocked_by]);

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
            {AREA_LABELS[job.area] ?? job.area}
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
            {ROADMAP_STATUSES.map((s) => (
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
            <select
              value={job.area}
              onChange={(e) => void onPatch(job.id, { area: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 focus:border-sky-400 focus:outline-none"
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {AREA_LABELS[a] ?? a}
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
