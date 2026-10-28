"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft,
  ArrowRight,
  Captions,
  ChevronDown,
  Ellipsis,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  Info,
  Loader2,
  Play,
  Plus,
  Presentation,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";

import {
  CURRENT_LESSON_DECISIONS,
  CURRICULUM_CONTENT_KINDS,
  CURRICULUM_DECISION_HINTS,
  CURRICULUM_DECISION_LABELS,
  CURRICULUM_DECISIONS_LEAVING,
  CURRICULUM_DECISIONS_WITH_TARGET,
  CURRICULUM_LINK_FIELDS,
  CURRICULUM_RULES,
  CURRICULUM_SCOPE_LABELS,
  CURRICULUM_STATUS_LABELS,
  CURRICULUM_STATUSES,
  LESSON_OPENING_STANDARD,
  NEW_LESSON_DECISIONS,
  rowDecision,
  rowDisplayTitle,
  type CurriculumBoard,
  flattenBoardSections,
  type CurriculumBoardRow,
  type CurriculumBoardSection,
  type CurriculumDecision,
  type CurriculumDriveLeftovers,
  type CurriculumLinkKey,
  type CurriculumPlanItem,
  type CurriculumPlanPatch,
  type CurriculumScope,
  type CurriculumStatus,
  type LessonContentPresence,
} from "@/lib/academy/curriculumPlan";
import { LessonImportTabs } from "@/components/admin/LessonImportTabs";
import { StickyPageHeader } from "@/components/layout";
import { Modal } from "@/components/ui/Modal";
import { supabaseClient } from "@/lib/supabaseClient";
import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

const DECISION_TONES: Record<CurriculumDecision, BadgeTone> = {
  undecided: "grey",
  keep: "green",
  rename: "blue",
  update: "amber",
  replace: "amber",
  merge: "blue",
  delete: "red",
  new: "blue",
  later: "grey",
  reference: "grey",
};

const LINK_ICONS: Record<CurriculumLinkKey, typeof FileText> = {
  deckUrl: Presentation,
  scriptUrl: FileText,
  videoUrl: Film,
  sourceUrl: FolderOpen,
};

const CONTENT_ICONS: Record<keyof LessonContentPresence, typeof FileText> = {
  video: Video,
  transcript: Captions,
  written: AlignLeft,
};

const COLUMN_COUNT = 6;
const COLLAPSED_STORAGE_KEY = "curriculum-board:collapsed";

type SectionView = {
  key: string;
  title: string;
  isNew: boolean;
  depth: number;
  rows: CurriculumBoardRow[];
  sections: SectionView[];
  /** Visible lessons in this section and everything under it. */
  count: number;
  /** Every lesson underneath is a draft, so coaches see none of it. */
  allDraft: boolean;
};

function sectionViewLessons(section: SectionView): CurriculumBoardRow[] {
  return [...section.rows, ...section.sections.flatMap(sectionViewLessons)];
}

function buildSectionViews(
  courseId: string,
  sections: CurriculumBoardSection[],
  depth: number,
  rowByKey: Map<string, CurriculumBoardRow>,
  visible: (row: CurriculumBoardRow) => boolean,
): SectionView[] {
  return sections
    .map((s) => {
      const rows = s.rowKeys
        .map((k) => rowByKey.get(k))
        .filter((r): r is CurriculumBoardRow => Boolean(r && visible(r)));
      const children = buildSectionViews(courseId, s.sections, depth + 1, rowByKey, visible);
      const lessons = [...rows, ...children.flatMap(sectionViewLessons)];
      return {
        key: `section:${courseId}:${s.id}`,
        title: s.title,
        isNew: s.isNew,
        depth,
        rows,
        sections: children,
        count: lessons.length,
        allDraft: lessons.length > 0 && lessons.every((r) => Boolean(r.lessonId) && r.isDraft),
      };
    })
    .filter((s) => s.count > 0);
}

function sectionViewKeys(sections: SectionView[]): string[] {
  return sections.flatMap((s) => [s.key, ...sectionViewKeys(s.sections)]);
}

/** Left padding per nesting level, so lessons sit just inside their section. */
const SECTION_INDENT_PX = 24;
const LEVEL_STEP_PX = 22;
const LESSON_INDENT_PX = 52;
const SATELLITE_EXTRA_PX = 24;

/** Whether a row makes something, so its production status matters. */
function tracksProduction(row: CurriculumBoardRow): boolean {
  const decision = rowDecision(row);
  if (CURRICULUM_DECISIONS_LEAVING.has(decision) || decision === "reference") return false;
  return decision === "update" || decision === "new" || (row.plan?.status ?? "not_started") !== "not_started";
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in again to save.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

function DecisionBadge({ decision }: { decision: CurriculumDecision }) {
  return (
    <span
      className={badgeClass(DECISION_TONES[decision], "shrink-0")}
    >
      {CURRICULUM_DECISION_LABELS[decision]}
    </span>
  );
}

function StatusMeter({ status }: { status: CurriculumStatus }) {
  const step = CURRICULUM_STATUSES.indexOf(status);
  const live = status === "live";
  return (
    <span className="inline-flex items-center gap-2" title={CURRICULUM_STATUS_LABELS[status]}>
      <span className="flex gap-0.5" aria-hidden>
        {CURRICULUM_STATUSES.slice(1).map((s, i) => (
          <span
            key={s}
            className={`h-1.5 w-2.5 rounded-full ${
              i < step ? (live ? "bg-emerald-500" : "bg-sky-500") : "bg-slate-200"
            }`}
          />
        ))}
      </span>
      <span className={`text-xs font-medium ${live ? "text-emerald-700" : step > 0 ? "text-slate-800" : "text-slate-400"}`}>
        {CURRICULUM_STATUS_LABELS[status]}
      </span>
    </span>
  );
}

function LinkIcons({ plan }: { plan: CurriculumPlanItem | null }) {
  if (!plan) return null;
  const links = CURRICULUM_LINK_FIELDS.filter((f) => plan[f.key]);
  if (links.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {links.map((f) => {
        const Icon = LINK_ICONS[f.key];
        return (
          <a
            key={f.key}
            href={plan[f.key] ?? undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title={f.label}
            aria-label={f.label}
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </span>
  );
}

/** What the lesson has today: lit when there, faint when missing. */
function ContentIcons({ content }: { content: LessonContentPresence | null }) {
  if (!content) return <span className="text-slate-300">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {CURRICULUM_CONTENT_KINDS.map(({ key, label }) => {
        const Icon = CONTENT_ICONS[key];
        const has = content[key];
        const text = `${label}: ${has ? "yes" : "missing"}`;
        return (
          <span key={key} title={text} aria-label={text} className={has ? "text-slate-700" : "text-slate-300"}>
            <Icon className="h-4 w-4" strokeWidth={has ? 2 : 1.5} />
          </span>
        );
      })}
    </span>
  );
}

const labelClass = "text-xs font-medium text-slate-600";

function RowEditor({
  row,
  rows,
  sectionTitles,
  saving,
  onSave,
  onReset,
}: {
  row: CurriculumBoardRow;
  rows: CurriculumBoardRow[];
  sectionTitles: string[];
  saving: boolean;
  onSave: (patch: CurriculumPlanPatch) => void;
  onReset: () => void;
}) {
  const plan = row.plan;
  const decision = rowDecision(row);
  const [title, setTitle] = useState(plan?.title ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [section, setSection] = useState(plan?.sectionTitle ?? "");
  const [links, setLinks] = useState<Record<CurriculumLinkKey, string>>({
    deckUrl: plan?.deckUrl ?? "",
    scriptUrl: plan?.scriptUrl ?? "",
    videoUrl: plan?.videoUrl ?? "",
    sourceUrl: plan?.sourceUrl ?? "",
  });

  const decisions = row.lessonId ? CURRENT_LESSON_DECISIONS : NEW_LESSON_DECISIONS;
  const intoOptions = useMemo(() => {
    const byCourse = new Map<string, CurriculumBoardRow[]>();
    for (const r of rows) {
      if (r.key === row.key || CURRICULUM_DECISIONS_LEAVING.has(rowDecision(r))) continue;
      const list = byCourse.get(r.courseTitle) ?? [];
      list.push(r);
      byCourse.set(r.courseTitle, list);
    }
    return [...byCourse.entries()];
  }, [rows, row.key]);

  const saveText = (field: "title" | "note", value: string) => {
    if ((plan?.[field] ?? "") === value) return;
    onSave({ [field]: value });
  };

  return (
    <div className={cardClass("plain", "grid gap-4 p-4 sm:p-5 lg:grid-cols-4")}>
      <label className="flex flex-col gap-1.5 lg:col-span-2">
        <span className={labelClass}>{row.lessonId ? "New title (blank keeps the current one)" : "Title"}</span>
        <input
          className={fieldClass("input", "normal")}
          value={title}
          placeholder={row.currentTitle ?? "Lesson title"}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveText("title", title.trim())}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Decision</span>
        <select
          className={fieldClass("select", "normal")}
          value={decision}
          onChange={(e) => {
            const next = e.target.value as CurriculumDecision;
            onSave(
              CURRICULUM_DECISIONS_WITH_TARGET.has(next)
                ? { decision: next }
                : { decision: next, intoKey: null },
            );
          }}
        >
          {decisions.map((d) => (
            <option key={d} value={d}>
              {CURRICULUM_DECISION_LABELS[d]}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{CURRICULUM_DECISION_HINTS[decision]}</span>
      </label>

      {CURRICULUM_DECISIONS_WITH_TARGET.has(decision) ? (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>{decision === "merge" ? "Merges into" : "Replaced by"}</span>
          <select
            className={fieldClass("select", "normal")}
            value={plan?.intoKey ?? ""}
            onChange={(e) => onSave({ intoKey: e.target.value || null })}
          >
            <option value="">Choose a lesson…</option>
            {intoOptions.map(([courseTitle, list]) => (
              <optgroup key={courseTitle} label={courseTitle}>
                {list.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.lessonId ? "" : "New: "}
                    {rowDisplayTitle(r)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : !row.lessonId ? (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Section</span>
          <input
            className={fieldClass("input", "normal")}
            list={`sections-${row.key}`}
            value={section}
            placeholder="Pick a section or type a new one"
            onChange={(e) => setSection(e.target.value)}
            onBlur={() => {
              const next = section.trim() || null;
              if (next !== (plan?.sectionTitle ?? null)) onSave({ sectionTitle: next });
            }}
          />
          <datalist id={`sections-${row.key}`}>
            {sectionTitles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
      ) : (
        <div />
      )}

      {!CURRICULUM_DECISIONS_LEAVING.has(decision) ? (
        <div className="flex flex-col gap-1.5 lg:col-span-4">
          <span className={labelClass}>Status</span>
          <div className="flex flex-wrap gap-1.5">
            {CURRICULUM_STATUSES.map((s) => {
              const active = (plan?.status ?? "not_started") === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => !active && onSave({ status: s })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                    active
                      ? s === "live"
                        ? "bg-emerald-600 text-white ring-emerald-600"
                        : "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-600 ring-slate-200 hover:text-slate-900"
                  }`}
                >
                  {CURRICULUM_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {CURRICULUM_LINK_FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1.5">
          <span className={labelClass}>{f.label} link</span>
          <input
            className={fieldClass("input", "normal")}
            value={links[f.key]}
            placeholder="https://"
            inputMode="url"
            onChange={(e) => setLinks((prev) => ({ ...prev, [f.key]: e.target.value }))}
            onBlur={() => {
              const next = links[f.key].trim() || null;
              if (next !== (plan?.[f.key] ?? null)) onSave({ [f.key]: next });
            }}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1.5 lg:col-span-4">
        <span className={labelClass}>Notes</span>
        <textarea
          className={fieldClass("textarea", "normal", "min-h-24")}
          value={note}
          placeholder="What changes, what to reuse, what is still open"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveText("note", note)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-4">
        <div className="flex items-center gap-3 text-sm">
          {row.adminHref ? (
            <Link
              href={row.adminHref}
              className="inline-flex items-center gap-1.5 font-medium text-sky-800 hover:underline"
            >
              Open current lesson <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
            </span>
          ) : null}
        </div>
        {plan ? (
          <button
            type="button"
            onClick={onReset}
            className={buttonClass("delete", "small")}
          >
            <Trash2 className="h-4 w-4" />
            {row.lessonId ? "Clear plan" : "Remove new lesson"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LessonCell({
  row,
  intoTitle,
  takesIn,
}: {
  row: CurriculumBoardRow;
  intoTitle: string | null;
  takesIn: CurriculumBoardRow[];
}) {
  const decision = rowDecision(row);
  const newTitle = row.plan?.title.trim() ?? "";
  const renamed = Boolean(newTitle && row.currentTitle && newTitle !== row.currentTitle);
  const leaving = CURRICULUM_DECISIONS_LEAVING.has(decision);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`font-medium ${
            leaving ? "text-slate-400 line-through decoration-slate-300" : "text-slate-950"
          }`}
        >
          {row.currentTitle ?? rowDisplayTitle(row)}
        </span>
        {row.isDraft ? (
          <span className={badgeClass("grey")}>Draft</span>
        ) : null}
      </div>
      {renamed ? <p className="mt-0.5 text-xs text-sky-800">New title: {newTitle}</p> : null}
      {intoTitle ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-violet-800">
          <ArrowRight className="h-3 w-3" />
          {decision === "merge" ? "Into" : "Replaced by"} {intoTitle}
        </p>
      ) : CURRICULUM_DECISIONS_WITH_TARGET.has(decision) ? (
        <p className="mt-0.5 text-xs text-orange-700">Pick the lesson it goes into</p>
      ) : null}
      {takesIn.length > 0 ? (
        <p className="mt-0.5 text-xs text-slate-500">
          Takes in {takesIn.map((r) => r.currentTitle ?? rowDisplayTitle(r)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/** Notes stay out of the row height: dots, with the note on hover or focus. */
function NotePeek({ note }: { note: string }) {
  if (!note.trim()) return null;
  return (
    <span className="group/note relative inline-flex">
      <button
        type="button"
        aria-label="Note"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <Ellipsis className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden w-80 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-6 text-slate-700 shadow-lg ring-1 ring-slate-200 group-focus-within/note:block group-hover/note:block"
      >
        {note}
      </span>
    </span>
  );
}

/** Filled caret, right when closed and down when open. */
function Caret({ open, size = "sm" }: { open: boolean; size?: "sm" | "md" }) {
  return (
    <Play
      aria-hidden
      fill="currentColor"
      strokeWidth={0}
      className={`shrink-0 text-slate-500 transition-transform ${size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} ${
        open ? "rotate-90" : ""
      }`}
    />
  );
}

function GroupToggle({
  open,
  onToggle,
  label,
  count,
  isNew,
  draft,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  isNew?: boolean;
  draft?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2.5 py-3 pr-4 text-left"
    >
      <Caret open={open} />
      <span className={`text-sm font-semibold ${draft ? "text-slate-400" : "text-slate-800"}`}>{label}</span>
      {draft ? (
        <span className={badgeClass("grey")}>All draft</span>
      ) : null}
      {isNew ? (
        <span className={badgeClass("blue")}>
          New section
        </span>
      ) : null}
      <span className="text-xs font-medium tabular-nums text-slate-400">{count}</span>
    </button>
  );
}

export function CurriculumPlanBoard({ board: initialBoard }: { board: CurriculumBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [scope, setScope] = useState<CurriculumScope>("classroom");
  const [decisionFilter, setDecisionFilter] = useState<CurriculumDecision | "all">("all");
  const [missingFilter, setMissingFilter] = useState<keyof LessonContentPresence | "all">("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const [headerStuck, setHeaderStuck] = useState(false);

  useEffect(() => setBoard(initialBoard), [initialBoard]);

  // The column header sticks just under the page header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Transparent at rest; once stuck it joins the page header, so it turns white.
  useEffect(() => {
    const check = () => {
      const top = tableRef.current?.getBoundingClientRect().top;
      setHeaderStuck(top != null && top < headerHeight - 0.5);
    };
    check();
    window.addEventListener("scroll", check, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", check, { capture: true });
  }, [headerHeight]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Collapse state is a convenience; start expanded.
    }
  }, []);

  const updateCollapsed = useCallback((next: Set<string>) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggleGroup = useCallback(
    (key: string) => {
      const next = new Set(collapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      updateCollapsed(next);
    },
    [collapsed, updateCollapsed],
  );

  const rowByKey = useMemo(() => new Map(board.rows.map((r) => [r.key, r])), [board.rows]);
  const takesInByKey = useMemo(() => {
    const map = new Map<string, CurriculumBoardRow[]>();
    for (const r of board.rows) {
      const into = r.plan?.intoKey;
      if (!into || !CURRICULUM_DECISIONS_WITH_TARGET.has(rowDecision(r))) continue;
      const list = map.get(into) ?? [];
      list.push(r);
      map.set(into, list);
    }
    return map;
  }, [board.rows]);

  const needle = query.trim().toLowerCase();
  const filtering = Boolean(needle) || decisionFilter !== "all" || missingFilter !== "all";
  const visible = useCallback(
    (row: CurriculumBoardRow) => {
      if (decisionFilter !== "all" && rowDecision(row) !== decisionFilter) return false;
      if (missingFilter !== "all" && (!row.content || row.content[missingFilter])) return false;
      if (needle) {
        const hay = `${rowDisplayTitle(row)} ${row.currentTitle ?? ""} ${row.plan?.note ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    },
    [decisionFilter, missingFilter, needle],
  );

  const scopeCourses = useMemo(
    () => board.courses.filter((c) => c.scope === scope),
    [board.courses, scope],
  );

  const groups = useMemo(
    () =>
      scopeCourses
        .map((course) => {
          const sections = buildSectionViews(course.id, course.sections, 0, rowByKey, visible);
          return {
            id: course.id,
            title: course.title,
            key: `course:${course.id}`,
            sections,
            count: sections.reduce((n, s) => n + s.count, 0),
          };
        })
        .filter((c) => c.count > 0),
    [scopeCourses, rowByKey, visible],
  );

  const allGroupKeys = useMemo(
    () => groups.flatMap((c) => [c.key, ...sectionViewKeys(c.sections)]),
    [groups],
  );

  const sectionTitlesByCourse = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of board.courses) map.set(c.id, flattenBoardSections(c.sections).map((s) => s.title));
    return map;
  }, [board.courses]);

  const replacePlan = useCallback((key: string, plan: CurriculumPlanItem | null) => {
    setBoard((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.key === key ? { ...r, plan } : r)),
    }));
  }, []);

  const save = useCallback(
    async (row: CurriculumBoardRow, patch: CurriculumPlanPatch) => {
      setSavingKey(row.key);
      setError(null);
      try {
        const headers = await authHeaders();
        const res = row.plan
          ? await fetch(`/api/admin/academy/curriculum-plan/${row.plan.id}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(patch),
            })
          : await fetch("/api/admin/academy/curriculum-plan", {
              method: "POST",
              headers,
              body: JSON.stringify({ courseId: row.courseId, lessonId: row.lessonId, patch }),
            });
        const json = (await res.json()) as { item?: CurriculumPlanItem; error?: string };
        if (!res.ok || !json.item) throw new Error(json.error ?? "Could not save.");
        replacePlan(row.key, json.item);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      } finally {
        setSavingKey(null);
      }
    },
    [replacePlan],
  );

  const reset = useCallback(
    async (row: CurriculumBoardRow) => {
      if (!row.plan) return;
      const label = row.lessonId ? "Clear the plan for this lesson?" : "Remove this new lesson from the plan?";
      if (!window.confirm(label)) return;
      setSavingKey(row.key);
      setError(null);
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/admin/academy/curriculum-plan/${row.plan.id}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "Could not remove.");
        }
        if (row.lessonId) {
          replacePlan(row.key, null);
        } else {
          setOpenKey(null);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove.");
      } finally {
        setSavingKey(null);
      }
    },
    [replacePlan, router],
  );

  const addNew = useCallback(
    async (courseId: string, sectionTitle: string, title: string) => {
      setError(null);
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/admin/academy/curriculum-plan", {
          method: "POST",
          headers,
          body: JSON.stringify({
            courseId,
            patch: { title, sectionTitle: sectionTitle || null, decision: "new" },
          }),
        });
        const json = (await res.json()) as { item?: CurriculumPlanItem; error?: string };
        if (!res.ok || !json.item) throw new Error(json.error ?? "Could not add.");
        setAdding(false);
        setOpenKey(`new:${json.item.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add.");
      }
    },
    [router],
  );

  const intoTitle = (row: CurriculumBoardRow) => {
    const key = row.plan?.intoKey;
    if (!key || !CURRICULUM_DECISIONS_WITH_TARGET.has(rowDecision(row))) return null;
    const target = rowByKey.get(key);
    return target ? rowDisplayTitle(target) : "a lesson no longer on the board";
  };

  // Filters show every match, whatever is collapsed.
  const isOpen = (key: string) => filtering || !collapsed.has(key);

  const renderRow = (row: CurriculumBoardRow, lessonPad: number) => {
    const open = openKey === row.key;
    // Drafts are hidden from coaches, so they read as greyed out.
    const dim = row.isDraft && !open ? "opacity-45" : "";
    return (
      <Fragment key={row.key}>
        <tr
          onClick={() => setOpenKey(open ? null : row.key)}
          className={`cursor-pointer border-t border-slate-200 align-top hover:bg-white/70 ${open ? "bg-white/80" : ""}`}
        >
          <td
            className={`py-3 pr-4 ${dim}`}
            style={{ paddingLeft: lessonPad + (row.parentLessonId ? SATELLITE_EXTRA_PX : 0) }}
          >
            <LessonCell row={row} intoTitle={intoTitle(row)} takesIn={takesInByKey.get(row.key) ?? []} />
          </td>
          <td className={`px-4 py-3 ${dim}`}>
            <ContentIcons content={row.content} />
          </td>
          <td className={`px-4 py-3 ${dim}`}>
            <DecisionBadge decision={rowDecision(row)} />
          </td>
          <td className={`px-4 py-3 ${dim}`}>
            {tracksProduction(row) ? (
              <StatusMeter status={row.plan?.status ?? "not_started"} />
            ) : (
              <span className="text-slate-300">–</span>
            )}
          </td>
          <td className={`px-4 py-2 ${dim}`}>
            <LinkIcons plan={row.plan} />
          </td>
          <td className={`px-4 py-2 ${dim}`}>
            <NotePeek note={row.plan?.note ?? ""} />
          </td>
        </tr>
        {open ? (
          <tr className="bg-white/80">
            <td colSpan={COLUMN_COUNT} className="pb-4 pr-4" style={{ paddingLeft: lessonPad }}>
              <RowEditor
                key={`${row.key}:${row.plan?.id ?? "none"}`}
                row={row}
                rows={board.rows}
                sectionTitles={sectionTitlesByCourse.get(row.courseId) ?? []}
                saving={savingKey === row.key}
                onSave={(patch) => void save(row, patch)}
                onReset={() => void reset(row)}
              />
            </td>
          </tr>
        ) : null}
      </Fragment>
    );
  };

  const renderSection = (section: SectionView): ReactNode => {
    const sectionOpen = isOpen(section.key);
    const lessonPad = LESSON_INDENT_PX + LEVEL_STEP_PX * section.depth;
    return (
      <Fragment key={section.key}>
        <tr>
          <td
            colSpan={COLUMN_COUNT}
            className="p-0"
            style={{ paddingLeft: SECTION_INDENT_PX + LEVEL_STEP_PX * section.depth }}
          >
            <GroupToggle
              open={sectionOpen}
              onToggle={() => toggleGroup(section.key)}
              label={section.title}
              count={section.count}
              isNew={section.isNew}
              draft={section.allDraft}
            />
          </td>
        </tr>
        {sectionOpen ? section.rows.map((row) => renderRow(row, lessonPad)) : null}
        {sectionOpen ? section.sections.map(renderSection) : null}
      </Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        rootRef={headerRef}
        title="Academy"
        description={
          <span className="text-lg leading-relaxed text-slate-600">
            Every lesson in the Classroom and the Vault: what it has today, what it
            becomes, and where each new video is up to.
          </span>
        }
        tabs={<LessonImportTabs />}
      />
      <div className="flex w-full flex-col gap-4 pb-16">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-slate-200" role="tablist" aria-label="Where">
            {(Object.keys(CURRICULUM_SCOPE_LABELS) as CurriculumScope[]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                onClick={() => {
                  setScope(s);
                  setAdding(false);
                }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  scope === s ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {CURRICULUM_SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={fieldClass("input", "small", "pl-9")}
              value={query}
              placeholder="Search lessons"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            className={fieldClass("select", "small", "w-auto!")}
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as CurriculumDecision | "all")}
            aria-label="Decision"
          >
            <option value="all">Every decision</option>
            {Object.entries(CURRICULUM_DECISION_LABELS).map(([d, label]) => (
              <option key={d} value={d}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={fieldClass("select", "small", "w-auto!")}
            value={missingFilter}
            onChange={(e) => setMissingFilter(e.target.value as keyof LessonContentPresence | "all")}
            aria-label="Missing"
          >
            <option value="all">Any content</option>
            {CURRICULUM_CONTENT_KINDS.map(({ key, label }) => (
              <option key={key} value={key}>
                No {label.toLowerCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className={buttonClass("quiet")}
          >
            <Info className="h-4 w-4" />
            Rules
          </button>
          <span className="hidden flex-1 sm:block" />
          <button
            type="button"
            onClick={() => updateCollapsed(new Set())}
            className={buttonClass("second")}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => updateCollapsed(new Set(allGroupKeys))}
            className={buttonClass("second")}
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className={buttonClass("main")}
          >
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            New lesson
          </button>
        </div>

        {adding ? (
          <AddLessonForm
            courses={scopeCourses}
            defaultCourseId={scopeCourses[0]?.id ?? ""}
            sectionTitlesByCourse={sectionTitlesByCourse}
            onAdd={addNew}
          />
        ) : null}

        {error ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">{error}</p>
        ) : null}

        {groups.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Nothing matches.
          </p>
        ) : (
          // One table so a single sticky header lines up with every course.
          <div className="overflow-x-auto xl:overflow-visible">
            <table ref={tableRef} className="w-full min-w-[63rem] table-fixed text-left text-sm xl:min-w-0">
              <colgroup>
                <col />
                <col className="w-[7rem]" />
                <col className="w-[9rem]" />
                <col className="w-[11rem]" />
                <col className="w-[8rem]" />
                <col className="w-[5rem]" />
              </colgroup>
              <thead className="text-xs font-medium text-slate-500">
                <tr>
                  {["Lesson", "Has", "Decision", "Status", "Links", "Notes"].map((label, i) => (
                    <th
                      key={label}
                      style={{ top: headerHeight }}
                      className={`sticky z-20 py-2.5 pr-4 shadow-[inset_0_-1px_0_rgb(226_232_240)] ${
                        i === 0 ? "pl-[3.25rem]" : "pl-4"
                      } ${headerStuck ? "bg-white" : ""}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((course, courseIndex) => {
                const courseOpen = isOpen(course.key);
                return (
                  <tbody key={course.key}>
                    <tr>
                      <td colSpan={COLUMN_COUNT} className={`pb-0.5 ${courseIndex === 0 ? "pt-2" : "pt-3"}`}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(course.key)}
                          aria-expanded={courseOpen}
                          className="inline-flex items-center gap-2.5 py-0.5 text-left"
                        >
                          <Caret open={courseOpen} size="md" />
                          <span className="text-lg font-medium tracking-[-0.01em] text-slate-950">{course.title}</span>
                          <span className="text-sm tabular-nums text-slate-400">{course.count}</span>
                        </button>
                      </td>
                    </tr>
                    {courseOpen
                      ? course.sections.map(renderSection)
                      : null}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}

        {scope === "classroom" ? <DriveLeftovers leftovers={board.driveLeftovers} /> : null}

        <Modal
          open={rulesOpen}
          onClose={() => setRulesOpen(false)}
          title="Rules for the new curriculum"
          maxWidthClassName="max-w-2xl"
        >
          <div className="px-5 pb-6 pt-4 sm:px-6">
            <ol className="grid gap-4 sm:grid-cols-2">
              {CURRICULUM_RULES.map((rule, index) => (
                <li key={rule.title} className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">
                    <span className="mr-2 text-slate-400">{index + 1}.</span>
                    {rule.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{rule.body}</p>
                </li>
              ))}
            </ol>
            <div className={cardClass("soft", "mt-6 px-4 py-4 sm:px-5")}>
              <p className="text-sm font-semibold text-slate-950">{LESSON_OPENING_STANDARD.title}</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                {LESSON_OPENING_STANDARD.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

/** Old Academy transcripts in Drive with no lesson: source material for new ones. */
function DriveLeftovers({ leftovers }: { leftovers: CurriculumDriveLeftovers }) {
  const byFolder = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of leftovers.files) {
      const cut = f.relativePath.lastIndexOf("/");
      const folder = cut > 0 ? f.relativePath.slice(0, cut) : "Top folder";
      const list = map.get(folder) ?? [];
      list.push(cut > 0 ? f.relativePath.slice(cut + 1) : f.relativePath);
      map.set(folder, list);
    }
    return [...map.entries()];
  }, [leftovers.files]);

  if (leftovers.files.length === 0) return null;
  const checked = leftovers.checkedAt
    ? new Date(leftovers.checkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <details className={cardClass("plain", "group")}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 sm:px-5">
        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-slate-500 transition-transform group-open:rotate-0" />
        <span className="text-sm font-semibold text-slate-800">Old transcripts in Drive with no lesson</span>
        <span className="text-xs font-medium tabular-nums text-slate-400">{leftovers.files.length}</span>
      </summary>
      <div className="border-t border-slate-200 px-4 pb-5 pt-3 sm:px-5">
        <p className="text-sm leading-6 text-slate-600">
          The Drive check{checked ? ` on ${checked}` : ""} could not match these to a lesson. Use them as the
          source for a new or updated lesson. Some may have been added to a lesson since.
          {leftovers.root ? (
            <span className="mt-1 block break-all text-xs text-slate-400">{leftovers.root}</span>
          ) : null}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {byFolder.map(([folder, files]) => (
            <div key={folder} className="min-w-0">
              <p className="text-xs font-medium text-slate-600">{folder}</p>
              <ul className="mt-1.5 space-y-1">
                {files.map((name, i) => (
                  <li key={`${name}:${i}`} className="flex min-w-0 items-start gap-2 text-sm text-slate-700">
                    <Captions className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 break-words">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function AddLessonForm({
  courses,
  defaultCourseId,
  sectionTitlesByCourse,
  onAdd,
}: {
  courses: CurriculumBoard["courses"];
  defaultCourseId: string;
  sectionTitlesByCourse: Map<string, string[]>;
  onAdd: (courseId: string, sectionTitle: string, title: string) => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [section, setSection] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className={cardClass("plain", "grid gap-3 p-4 sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end")}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        await onAdd(courseId, section.trim(), title.trim());
        setBusy(false);
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Course</span>
        <select className={fieldClass("select", "normal")} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Section</span>
        <input
          className={fieldClass("input", "normal")}
          list="add-lesson-sections"
          value={section}
          placeholder="Pick or type a new one"
          onChange={(e) => setSection(e.target.value)}
        />
        <datalist id="add-lesson-sections">
          {(sectionTitlesByCourse.get(courseId) ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Title</span>
        <input
          className={fieldClass("input", "normal")}
          value={title}
          placeholder="e.g. Handling the contract objection"
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </label>
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className={buttonClass("main")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add
      </button>
    </form>
  );
}
