"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FileText,
  GraduationCap,
  LayoutGrid,
  Map as MapIcon,
  Search,
  SquarePen,
  X,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  coachClientsTabItems,
  getClientsTabItems,
  mainNavItems,
} from "@/components/layout/dashboardNavItems";
import type {
  MentionTreeBlueprintPage,
  MentionTreeCourse,
  MentionTreeDocument,
} from "@/app/api/community/mention-content/route";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

type CourseArea = MentionTreeCourse["area"];

export type ContentLinkPick =
  | {
      type: "lesson";
      area: CourseArea;
      courseId: string;
      lessonId: string;
      title: string;
      chapterId?: string;
      /** Start time in seconds. */
      t?: number;
    }
  | { type: "course"; area: CourseArea; courseId: string; title: string }
  | { type: "page"; path: string; title: string };

type LessonPick = Extract<ContentLinkPick, { type: "lesson" }>;

type Tab = "courses" | "pages" | "resources" | "blueprint";

const TABS: { id: Tab; label: string }[] = [
  { id: "courses", label: "Courses" },
  { id: "pages", label: "Pages" },
  { id: "resources", label: "Resources" },
  { id: "blueprint", label: "Blueprint" },
];

/** Mount it only while open, so each opening starts fresh. */
type Props = {
  onClose: () => void;
  onPick: (pick: ContentLinkPick) => void;
};

type RowIcon =
  | "course"
  | "lesson"
  | "chapter"
  | "section"
  | "page"
  | "doc"
  | "bp-page"
  | "bp-section"
  | "box";

type Row = {
  key: string;
  label: string;
  sublabel?: string;
  icon: RowIcon;
  /** 1 = under a section, 2 = a chapter under a sectioned lesson. */
  indent?: 0 | 1 | 2;
  /** Small grey heading drawn above this row. */
  heading?: string;
  /** Line drawn above the heading (Vault under Classroom). */
  divider?: boolean;
  /** Section rows: open or shut. */
  expanded?: boolean;
  /** Lesson + chapter rows: the pick they select. */
  lesson?: LessonPick;
  /** Rows that open (a course, a Blueprint page): adds the whole thing; `activate` opens it. */
  onAdd?: () => void;
  activate: () => void;
};

type PageLink = { path: string; label: string; description?: string; group: string };

/** App pages a coach can point others at, grouped the way the sidebar is. */
function coachPages(): PageLink[] {
  const main: PageLink[] = mainNavItems("/coach").map((item) => ({
    path: item.href,
    label: item.label,
    description: item.description,
    group: "Community and Classroom",
  }));
  main.push(
    {
      path: "/coach/academy/resources",
      label: "Resources",
      description: "Templates, sheets and guides",
      group: "Community and Classroom",
    },
    {
      path: "/coach/academy/vault",
      label: "Vault",
      description: "Extra courses: books, talks and how-tos",
      group: "Community and Classroom",
    },
  );
  const getClients: PageLink[] = getClientsTabItems("/coach")
    .filter((item) => !item.iconOnly && !item.adminPreview)
    .map((item) => ({
      path: item.href,
      label: item.label,
      description: item.description,
      group: "Get Clients",
    }));
  const keepClients: PageLink[] = coachClientsTabItems("/coach")
    .filter((item) => !item.adminPreview)
    .map((item) => ({
      path: item.href,
      label: item.label,
      description: item.description,
      group: "Keep Clients",
    }));
  // My Blueprint has its own tab.
  return [...main, ...getClients, ...keepClients];
}

type Tree = {
  courses: MentionTreeCourse[];
  documents: MentionTreeDocument[];
  blueprint: MentionTreeBlueprintPage[];
};

const EMPTY_TREE: Tree = { courses: [], documents: [], blueprint: [] };
const RESULT_LIMIT = 80;

/** Module-level cache so reopening the picker (or other composers) is instant. */
let TREE_CACHE: Tree | null = null;

async function fetchTree(): Promise<Tree> {
  if (TREE_CACHE) return TREE_CACHE;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return EMPTY_TREE;
  const res = await fetch(`/api/community/mention-content?type=tree`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return EMPTY_TREE;
  const json = (await res.json()) as Partial<Tree>;
  TREE_CACHE = {
    courses: json.courses ?? [],
    documents: json.documents ?? [],
    blueprint: json.blueprint ?? [],
  };
  return TREE_CACHE;
}

function areaLabel(area: CourseArea): string {
  return area === "vault" ? "Vault" : "Classroom";
}

function lessonCount(course: MentionTreeCourse): number {
  return course.sections.reduce((n, s) => n + s.lessons.length, 0);
}

/** "90", "4:30" or "1:02:03" to seconds; null when it is not a time. */
function parseStartTime(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

function formatStartTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function samePick(a: LessonPick | null, b: LessonPick | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.courseId === b.courseId &&
    a.lessonId === b.lessonId &&
    (a.chapterId ?? "") === (b.chapterId ?? "")
  );
}

/**
 * One picker for every link inside the app: a search over everything, then
 * tabs for Courses (Classroom, then the Vault; open a course to pick a lesson
 * or chapter), Pages, Resources and Blueprint (open a page to pick a section
 * or one box; the link opens each reader's own Blueprint there). Lessons are
 * picked first, then the start time is added at the bottom before "Add".
 */
export function ContentLinkPicker({ onClose, onPick }: Props) {
  const [tree, setTree] = useState<Tree>(() => TREE_CACHE ?? EMPTY_TREE);
  const [loading, setLoading] = useState(() => !TREE_CACHE);
  const [tab, setTab] = useState<Tab>("courses");
  /** The search text when a tab was last clicked: that choice holds until the search changes. */
  const [tabChosenFor, setTabChosenFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openCourse, setOpenCourse] = useState<MentionTreeCourse | null>(null);
  const [openBpPage, setOpenBpPage] = useState<MentionTreeBlueprintPage | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<LessonPick | null>(null);
  const [startAt, setStartAt] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const pages = useMemo(() => coachPages(), []);

  useEffect(() => {
    if (TREE_CACHE) return;
    let cancelled = false;
    fetchTree()
      .then((next) => {
        if (cancelled) return;
        setTree(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTree(EMPTY_TREE);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const selectLesson = useCallback((pick: LessonPick) => setSelected(pick), []);

  // Picking a lesson puts the cursor in the start time box.
  useEffect(() => {
    if (selected) startRef.current?.focus();
  }, [selected]);

  const openCourseView = useCallback((course: MentionTreeCourse) => {
    setOpenCourse(course);
    setTab("courses");
    setQuery("");
    setHighlight(0);
    // One section: just show its lessons. Several: start with the first open.
    setOpenSections(new Set(course.sections[0] ? [course.sections[0].title] : []));
  }, []);

  const toggleSection = useCallback((title: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const openBpPageView = useCallback((page: MentionTreeBlueprintPage) => {
    setOpenBpPage(page);
    setTab("blueprint");
    setQuery("");
    setHighlight(0);
  }, []);

  const pickBlueprint = useCallback(
    (path: string, title: string) => onPick({ type: "page", path, title: `Blueprint - ${title}` }),
    [onPick]
  );

  const pickCourse = useCallback(
    (course: MentionTreeCourse) =>
      onPick({ type: "course", area: course.area, courseId: course.courseId, title: course.title }),
    [onPick]
  );

  const view = useMemo<{
    rows: Row[];
    byTab?: Record<Tab, Row[]>;
    counts: Record<Tab, number> | null;
  }>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => text.toLowerCase().includes(needle);

    const courseRow = (course: MentionTreeCourse, extra: Partial<Row> = {}): Row => ({
      key: `course:${course.area}:${course.courseId}`,
      label: course.title,
      sublabel: `${lessonCount(course)} lessons`,
      icon: "course",
      onAdd: () => pickCourse(course),
      activate: () => openCourseView(course),
      ...extra,
    });

    /** A lesson row plus its chapters (all of them, or only `onlyChapters`). */
    const lessonRows = (
      course: MentionTreeCourse,
      lesson: MentionTreeCourse["sections"][number]["lessons"][number],
      opts: { indent: 0 | 1; sublabel?: string; heading?: string; chapterFilter?: string }
    ): Row[] => {
      const base: LessonPick = {
        type: "lesson",
        area: course.area,
        courseId: course.courseId,
        lessonId: lesson.lessonId,
        title: lesson.title,
      };
      const all = lesson.chapters ?? [];
      const shown = opts.chapterFilter
        ? all.filter((c) => c.title.toLowerCase().includes(opts.chapterFilter!))
        : all;
      return [
        {
          key: `lesson:${course.courseId}:${lesson.lessonId}`,
          label: lesson.title,
          sublabel: opts.sublabel,
          icon: "lesson",
          indent: opts.indent,
          heading: opts.heading,
          lesson: base,
          activate: () => selectLesson(base),
        },
        ...shown.map((chapter): Row => {
          const pick: LessonPick = {
            ...base,
            title: `${lesson.title} - ${chapter.title}`,
            chapterId: chapter.chapterId,
          };
          return {
            key: `chapter:${course.courseId}:${lesson.lessonId}:${chapter.chapterId}`,
            label: chapter.title,
            sublabel: `Chapter ${all.indexOf(chapter) + 1} of ${all.length}`,
            icon: "chapter",
            indent: (opts.indent + 1) as 1 | 2,
            lesson: pick,
            activate: () => selectLesson(pick),
          };
        }),
      ];
    };

    const pageRow = (page: PageLink, heading?: string): Row => ({
      key: `page:${page.path}`,
      label: page.label,
      sublabel: page.description,
      icon: "page",
      heading,
      activate: () => onPick({ type: "page", path: page.path, title: page.label }),
    });

    const docRow = (doc: MentionTreeDocument, heading?: string): Row => ({
      key: `doc:${doc.slug}`,
      label: doc.title,
      sublabel: doc.dek ?? doc.group,
      icon: "doc",
      heading,
      activate: () =>
        onPick({
          type: "page",
          path: `/coach/academy/resources/${doc.slug}`,
          title: doc.title,
        }),
    });

    /** A page with sections opens; the Overview (no sections) is added straight away. */
    const bpPageRow = (page: MentionTreeBlueprintPage, heading?: string): Row => {
      const add = () => pickBlueprint(page.href, page.title);
      return {
        key: `bp:${page.slug}`,
        label: page.title,
        sublabel: page.sections.length ? `${page.sections.length} sections` : "Your Blueprint home",
        icon: "bp-page",
        heading,
        onAdd: page.sections.length ? add : undefined,
        activate: page.sections.length ? () => openBpPageView(page) : add,
      };
    };

    const bpSectionRow = (
      page: MentionTreeBlueprintPage,
      section: MentionTreeBlueprintPage["sections"][number],
      sublabel?: string
    ): Row => ({
      key: `bp:${section.anchor}`,
      label: section.title,
      sublabel:
        sublabel ?? (section.boxes.length === 1 ? "1 box" : section.boxes.length ? `${section.boxes.length} boxes` : "Section"),
      icon: "bp-section",
      activate: () => pickBlueprint(`${page.href}#${section.anchor}`, section.title),
    });

    const boxRow = (
      page: MentionTreeBlueprintPage,
      box: MentionTreeBlueprintPage["sections"][number]["boxes"][number],
      opts: { indent: 0 | 1; sublabel?: string }
    ): Row => ({
      key: `bp:f-${box.path}`,
      label: box.label,
      sublabel: opts.sublabel,
      icon: "box",
      indent: opts.indent,
      activate: () => pickBlueprint(`${page.href}#f-${box.path}`, box.label),
    });

    /** Heading only on the first row of each run of the same group. */
    const withHeadings = <T,>(items: T[], groupOf: (item: T) => string, toRow: (item: T, heading?: string) => Row) =>
      items.map((item, i) =>
        toRow(item, i === 0 || groupOf(items[i - 1]) !== groupOf(item) ? groupOf(item) : undefined)
      );

    // Searching fills every tab; the tabs show how many each one found.
    if (needle) {
      const courseRows: Row[] = tree.courses
        .filter((c) => matches(`${c.title} ${areaLabel(c.area)}`))
        .map((course, i) =>
          courseRow(course, {
            heading: i === 0 ? "Courses" : undefined,
            sublabel: `${areaLabel(course.area)} · ${lessonCount(course)} lessons`,
          })
        );
      const lessons: Row[] = [];
      let lessonMatches = 0;
      for (const course of tree.courses) {
        for (const section of course.sections) {
          for (const lesson of section.lessons) {
            if (lessons.length >= RESULT_LIMIT) break;
            const lessonMatch = matches(`${lesson.title} ${course.title} ${section.title}`);
            const chapterMatch = (lesson.chapters ?? []).some((c) => matches(c.title));
            if (!lessonMatch && !chapterMatch) continue;
            lessons.push(
              ...lessonRows(course, lesson, {
                indent: 0,
                sublabel: [areaLabel(course.area), course.title, section.title]
                  .filter((part, i, arr) => part && arr.indexOf(part) === i)
                  .join(" · "),
                heading: lessonMatches === 0 ? "Lessons" : undefined,
                chapterFilter: lessonMatch ? undefined : needle,
              })
            );
            lessonMatches += 1;
          }
        }
      }
      const pageRows = withHeadings(
        pages.filter((p) => matches(`${p.label} ${p.description ?? ""} ${p.group}`)),
        (p) => p.group,
        pageRow
      );
      const docRows = withHeadings(
        tree.documents.filter((d) => matches(`${d.title} ${d.dek ?? ""} ${d.group}`)),
        (d) => d.group,
        docRow
      );
      const bpRows: Row[] = [];
      for (const page of tree.blueprint) {
        if (matches(page.title)) bpRows.push(bpPageRow(page));
        for (const section of page.sections) {
          if (matches(section.title)) bpRows.push(bpSectionRow(page, section, page.title));
          for (const box of section.boxes) {
            if (matches(box.label)) {
              bpRows.push(boxRow(page, box, { indent: 0, sublabel: `${page.title} · ${section.title}` }));
            }
          }
        }
      }
      const byTab: Record<Tab, Row[]> = {
        courses: [...courseRows, ...lessons],
        pages: pageRows,
        resources: docRows,
        blueprint: bpRows,
      };
      return {
        rows: [],
        byTab,
        // A lesson and its chapters count as one find.
        counts: {
          courses: courseRows.length + lessonMatches,
          pages: pageRows.length,
          resources: docRows.length,
          blueprint: bpRows.length,
        } as Record<Tab, number>,
      };
    }

    if (tab === "pages") return { rows: withHeadings(pages, (p) => p.group, pageRow), counts: null };
    if (tab === "resources") {
      return { rows: withHeadings(tree.documents, (d) => d.group, docRow), counts: null };
    }

    if (tab === "blueprint") {
      if (!openBpPage) {
        return { rows: withHeadings(tree.blueprint, (p) => p.group, bpPageRow), counts: null };
      }
      const out: Row[] = [];
      for (const section of openBpPage.sections) {
        out.push(bpSectionRow(openBpPage, section));
        for (const box of section.boxes) out.push(boxRow(openBpPage, box, { indent: 1 }));
      }
      return { rows: out, counts: null };
    }

    if (openCourse) {
      const sectioned = openCourse.sections.length > 1;
      const out: Row[] = [];
      for (const section of openCourse.sections) {
        const expanded = !sectioned || openSections.has(section.title);
        if (sectioned) {
          out.push({
            key: `section:${section.title}`,
            label: section.title,
            sublabel: `${section.lessons.length} lessons`,
            icon: "section",
            expanded,
            activate: () => toggleSection(section.title),
          });
        }
        if (!expanded) continue;
        for (const lesson of section.lessons) {
          out.push(...lessonRows(openCourse, lesson, { indent: sectioned ? 1 : 0 }));
        }
      }
      return { rows: out, counts: null };
    }

    const courseList = tree.courses.map((course, i) => {
      const firstOfArea = i === 0 || tree.courses[i - 1].area !== course.area;
      return courseRow(course, {
        heading: firstOfArea ? areaLabel(course.area) : undefined,
        divider: firstOfArea && i > 0,
      });
    });
    return { rows: courseList, counts: null };
  }, [
    query,
    tab,
    tree,
    pages,
    openCourse,
    openSections,
    openBpPage,
    openCourseView,
    openBpPageView,
    selectLesson,
    toggleSection,
    pickCourse,
    pickBlueprint,
    onPick,
  ]);

  const { counts } = view;
  // A search that finds nothing in this tab shows the first tab that found
  // something, unless this tab was clicked for this same search.
  const shownTab: Tab =
    counts && counts[tab] === 0 && tabChosenFor !== query
      ? (TABS.find((t) => counts[t.id] > 0)?.id ?? tab)
      : tab;
  const rows = view.byTab ? view.byTab[shownTab] : view.rows;

  const safeHighlight = rows.length === 0 ? 0 : Math.min(highlight, rows.length - 1);

  const startSeconds = startAt.trim() ? parseStartTime(startAt) : 0;
  const startInvalid = startSeconds === null;

  const addSelected = useCallback(() => {
    if (!selected || startInvalid) return;
    if (!startSeconds) {
      onPick(selected);
      return;
    }
    onPick({
      ...selected,
      title: `${selected.title} at ${formatStartTime(startSeconds)}`,
      t: startSeconds,
    });
  }, [onPick, selected, startInvalid, startSeconds]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // The start time box: Enter adds the picked lesson.
      if (e.target === startRef.current) {
        if (e.key === "Enter") {
          e.preventDefault();
          addSelected();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
      } else if (e.key === "Enter" && e.target === inputRef.current) {
        e.preventDefault();
        rows[safeHighlight]?.activate();
      }
    },
    [rows, safeHighlight, onClose, addSelected]
  );

  const searching = query.trim().length > 0;
  // The bar above an opened course or Blueprint page: back, its name, and add the whole thing.
  const drill =
    searching
      ? null
      : tab === "courses" && openCourse
        ? {
            title: openCourse.title,
            backLabel: "Back to courses",
            addLabel: "Add whole course",
            onAdd: () => pickCourse(openCourse),
          }
        : tab === "blueprint" && openBpPage
          ? {
              title: openBpPage.title,
              backLabel: "Back to Blueprint pages",
              addLabel: "Add whole page",
              onAdd: () => pickBlueprint(openBpPage.href, openBpPage.title),
            }
          : null;
  const emptyText = searching
    ? "Nothing found"
    : tab === "blueprint"
      ? "Your Blueprint could not load"
      : tab === "resources"
      ? "No resources found"
      : tab === "pages"
        ? "No pages found"
        : "No courses found";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
      onMouseDown={onClose}
    >
      <div
        className={cardClass("raised", "flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden")}
        role="dialog"
        aria-modal="true"
        aria-label="Link to content"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Link to content</h3>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 px-3 pb-2 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder="Search courses, pages, resources and your Blueprint…"
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={shownTab === t.id}
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold transition ${
                  shownTab === t.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => {
                  setTab(t.id);
                  setTabChosenFor(query);
                  setOpenCourse(null);
                  setOpenBpPage(null);
                  setHighlight(0);
                }}
              >
                {t.label}
                {counts ? (
                  <span className={counts[t.id] > 0 ? "text-slate-400" : "text-slate-300"}>
                    {` (${counts[t.id]})`}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {drill ? (
          <div className="flex items-center gap-2 border-y border-slate-100 bg-slate-50/70 px-3 py-2">
            <button
              type="button"
              className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700"
              onClick={() => {
                setOpenCourse(null);
                setOpenBpPage(null);
                setHighlight(0);
              }}
              aria-label={drill.backLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
              {drill.title}
            </span>
            <button
              type="button"
              className={buttonClass("second", "small", "shrink-0")}
              onClick={drill.onAdd}
            >
              {drill.addLabel}
            </button>
          </div>
        ) : null}

        <ul className="min-h-0 flex-1 overflow-auto px-1 pb-2 pt-1" role="listbox">
          {loading ? (
            <li className="px-3 py-3 text-sm text-slate-500">Loading…</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">{emptyText}</li>
          ) : (
            rows.map((row, idx) => {
              const active = idx === safeHighlight;
              const isSelected = samePick(selected, row.lesson);
              const indent = row.indent === 2 ? "pl-14" : row.indent === 1 ? "pl-8" : "pl-2.5";
              return (
                <li key={row.key} role="option" aria-selected={active}>
                  {row.heading ? (
                    <div
                      className={`px-2.5 pb-1 pt-3 text-kicker font-semibold uppercase text-slate-400 ${
                        row.divider ? "mt-2 border-t border-slate-200" : ""
                      }`}
                    >
                      {row.heading}
                    </div>
                  ) : null}
                  <div
                    className={`flex items-center gap-1 rounded-lg ${
                      isSelected
                        ? "bg-sky-50 ring-1 ring-sky-200"
                        : active
                          ? "bg-amber-50"
                          : "hover:bg-slate-50"
                    }`}
                    onMouseEnter={() => setHighlight(idx)}
                  >
                    <button
                      type="button"
                      className={`flex min-w-0 flex-1 items-center gap-2.5 py-2 pr-2 text-left text-sm ${indent}`}
                      onClick={row.activate}
                    >
                      <RowGlyph icon={row.icon} expanded={row.expanded} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`truncate text-slate-900 ${
                            row.icon === "chapter" ? "" : "font-medium"
                          }`}
                        >
                          {row.label}
                        </span>
                        {row.sublabel ? (
                          <span className="truncate text-xs text-slate-500">{row.sublabel}</span>
                        ) : null}
                      </span>
                    </button>
                    {row.onAdd ? (
                      <>
                        <button
                          type="button"
                          className={buttonClass("second", "small", "shrink-0")}
                          onClick={row.onAdd}
                          title={row.icon === "course" ? "Link the whole course" : "Link the whole page"}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="mr-1 shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
                          onClick={row.activate}
                          aria-label={`Open ${row.label}`}
                          title={row.icon === "course" ? "Open to pick a lesson" : "Open to pick a section or box"}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {selected ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{selected.title}</p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <label htmlFor="content-link-start" className="text-slate-700">
                Start the video at
              </label>
              <input
                ref={startRef}
                id="content-link-start"
                type="text"
                inputMode="numeric"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                placeholder="0:00"
                aria-invalid={startInvalid}
                className={fieldClass(
                  "input",
                  "small",
                  `w-20 ${startInvalid ? "border-red-300 focus:border-red-400 focus:ring-red-400/20" : ""}`
                )}
              />
              <span className="text-xs text-slate-400">optional</span>
              <button
                type="button"
                className={buttonClass("main", "small", "ml-auto")}
                disabled={startInvalid}
                onClick={addSelected}
              >
                Add
              </button>
            </div>
            {startInvalid ? (
              <p className="mt-1.5 text-xs text-red-600">Type a time like 4:30</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RowGlyph({ icon, expanded }: { icon: RowIcon; expanded?: boolean }) {
  if (icon === "chapter") {
    return <CornerDownRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />;
  }
  if (icon === "box") {
    return <SquarePen className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />;
  }
  if (icon === "section") {
    const Chevron = expanded ? ChevronDown : ChevronRight;
    return <Chevron className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />;
  }
  const Icon =
    icon === "course"
      ? GraduationCap
      : icon === "page"
        ? LayoutGrid
        : icon === "doc"
          ? FileText
          : icon === "bp-page" || icon === "bp-section"
            ? MapIcon
            : BookOpen;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}
