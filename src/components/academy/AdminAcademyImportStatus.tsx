"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";

import type { AcademyImportSnapshotReport } from "@/lib/academy/academyImportSnapshot";
import type { AcademyImportOverride } from "@/lib/academy/academyImportOverrides";
import { AdminAcademyImportUnmatchedTable } from "@/components/academy/AdminAcademyImportUnmatchedTable";
import {
  buildOrderedCourseGroups,
  collectSectionKeys,
  flattenLessonImportRows,
  type LessonImportColumnTally,
  type LessonImportColumnTallies,
  type LessonImportFilter,
  type LessonImportKind,
  type LessonImportSectionGroup,
  type LessonImportStatusReport,
  type LessonImportStatusRow,
} from "@/lib/academy/lessonImportStatusClient";

type Props = {
  status: LessonImportStatusReport;
  snapshot: AcademyImportSnapshotReport | null;
  snapshotUpdatedAt: string | null;
  importOverrides: AcademyImportOverride[];
};

type ImportCellState = "ok" | "missing" | "na";
type OverallStatus = "ready" | "gaps" | "partial";

/** Lesson | Time | Status | Content | Video | Transcript */
const STATUS_COLS =
  "grid-cols-[minmax(0,1fr)_3.25rem_7rem_4.25rem_3.5rem_4.75rem] sm:grid-cols-[minmax(0,1fr)_3.75rem_8rem_4.75rem_4rem_5.25rem]";

function lessonExpandKey(row: LessonImportStatusRow): string {
  return `${row.courseId}:${row.lessonId}`;
}

function collectExpandableLessonKeys(rows: LessonImportStatusRow[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    if (row.children?.length) keys.push(lessonExpandKey(row));
  }
  return keys;
}

function collectExpandableLessonKeysFromSection(
  section: LessonImportSectionGroup,
): string[] {
  const keys = collectExpandableLessonKeys(section.lessons);
  for (const child of section.sections) {
    keys.push(...collectExpandableLessonKeysFromSection(child));
  }
  return keys;
}

function ImportStatusCell({
  state,
  label,
}: {
  state: ImportCellState;
  label: string;
}) {
  if (state === "na") {
    return (
      <span className="inline-flex justify-center text-slate-300" title={`${label} not applicable`}>
        <Minus className="h-4 w-4" aria-hidden />
        <span className="sr-only">{label} not applicable</span>
      </span>
    );
  }
  if (state === "ok") {
    return (
      <span className="inline-flex justify-center text-emerald-700" title={`${label} ready`}>
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">{label} ready</span>
      </span>
    );
  }
  return (
    <span className="inline-flex justify-center text-rose-700" title={`${label} missing`}>
      <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">{label} missing</span>
    </span>
  );
}

function lessonStatusStates(row: LessonImportStatusRow): {
  content: ImportCellState;
  video: ImportCellState;
  transcript: ImportCellState;
} {
  return {
    content: row.hasContent ? "ok" : "missing",
    video:
      row.videoStatus === "video_ready"
        ? "ok"
        : row.videoStatus === "video_missing"
          ? "missing"
          : "na",
    transcript: row.hasInAppVideo
      ? row.hasTranscript
        ? "ok"
        : "missing"
      : "na",
  };
}

function overallStatusFromStates(states: {
  content: ImportCellState;
  video: ImportCellState;
  transcript: ImportCellState;
}): OverallStatus {
  const tracked = [states.content, states.video, states.transcript].filter(
    (s) => s !== "na",
  );
  if (tracked.length === 0) return "ready";
  const missing = tracked.filter((s) => s === "missing").length;
  if (missing === 0) return "ready";
  if (missing === tracked.length) return "gaps";
  return "partial";
}

function OverallStatusChip({ status }: { status: OverallStatus }) {
  if (status === "ready") {
    return (
      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/80">
        Ready
      </span>
    );
  }
  if (status === "gaps") {
    return (
      <span className="inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-inset ring-rose-200/80">
        Gaps
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/80">
      Partial
    </span>
  );
}

function PublishBadge({ isDraft }: { isDraft: boolean }) {
  if (isDraft) {
    return (
      <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-inset ring-amber-200/80">
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200/80">
      Live
    </span>
  );
}

function TimeCell({ label }: { label: string | null }) {
  if (!label) {
    return <span className="text-center text-xs tabular-nums text-slate-300">—</span>;
  }
  return (
    <span className="text-center text-xs font-medium tabular-nums text-slate-600">
      {label}
    </span>
  );
}

function ColumnTallyCell({
  tally,
  label,
}: {
  tally: LessonImportColumnTally;
  label: string;
}) {
  if (tally.ok === 0 && tally.missing === 0) {
    return (
      <span className="inline-flex justify-center text-slate-300" title={`${label} not applicable`}>
        <Minus className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{label} not applicable</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center gap-1 text-xs font-medium tabular-nums"
      title={`${label}: ${tally.ok} ready, ${tally.missing} missing`}
    >
      {tally.ok > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-emerald-700">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          {tally.ok}
        </span>
      ) : null}
      {tally.missing > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-rose-700">
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          {tally.missing}
        </span>
      ) : null}
      <span className="sr-only">
        {label}: {tally.ok} ready, {tally.missing} missing
      </span>
    </span>
  );
}

function GroupStatusSummary({ tallies }: { tallies: LessonImportColumnTallies }) {
  return (
    <>
      <div className="flex justify-center">
        <ColumnTallyCell tally={tallies.content} label="Content" />
      </div>
      <div className="flex justify-center">
        <ColumnTallyCell tally={tallies.video} label="Video" />
      </div>
      <div className="flex justify-center">
        <ColumnTallyCell tally={tallies.transcript} label="Transcript" />
      </div>
    </>
  );
}

function FilterScorecard({
  label,
  value,
  active,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number | string;
  active: boolean;
  tone?: "neutral" | "good" | "warn" | "bad";
  onClick: () => void;
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-800"
      : tone === "warn"
        ? "text-amber-900"
        : tone === "bad"
          ? "text-rose-800"
          : "text-slate-900";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 rounded-xl border px-4 py-3 text-left shadow-sm transition ${
        active
          ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200/80"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </button>
  );
}

function lessonKindLabel(kind: LessonImportKind): string {
  switch (kind) {
    case "chaptered":
      return "Chaptered";
    case "chapter":
      return "Chapter";
    case "satellite":
      return "Related";
    default:
      return "Single";
  }
}

function lessonKindBadgeClass(kind: LessonImportKind): string {
  switch (kind) {
    case "chaptered":
      return "bg-violet-50 text-violet-800 ring-violet-200/80";
    case "chapter":
      return "bg-sky-50 text-sky-800 ring-sky-200/80";
    case "satellite":
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
    default:
      return "bg-white text-slate-600 ring-slate-200/80";
  }
}

function LessonKindBadge({ row }: { row: LessonImportStatusRow }) {
  const label = lessonKindLabel(row.kind);
  const parts: string[] = [];
  if (row.kind === "chaptered" && row.chapterCount) {
    parts.push(`${row.chapterCount} chapters`);
  }
  if (row.satelliteCount) {
    parts.push(`${row.satelliteCount} related`);
  }
  const detail = parts.length > 0 ? parts.join(" · ") : null;

  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${lessonKindBadgeClass(row.kind)}`}
      title={detail ?? label}
    >
      {label}
    </span>
  );
}

function metaLessonCount(count: number): string {
  return `${count} lesson${count === 1 ? "" : "s"}`;
}

function TableStatusHeader() {
  return (
    <div
      className={`grid ${STATUS_COLS} items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Lesson
      </span>
      <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Time
      </span>
      <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Status
      </span>
      <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Content
      </span>
      <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Video
      </span>
      <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Transcript
      </span>
    </div>
  );
}

function LessonStatusRow({
  row,
  depth,
  openNestedLessons,
  toggleNestedLesson,
}: {
  row: LessonImportStatusRow;
  depth: number;
  openNestedLessons: Set<string>;
  toggleNestedLesson: (key: string) => void;
}) {
  const states = lessonStatusStates(row);
  const overall = overallStatusFromStates(states);
  const childDepth = depth + 1;
  const hasChildren = Boolean(row.children?.length);
  const expandKey = lessonExpandKey(row);
  const open = openNestedLessons.has(expandKey);

  return (
    <>
      <div
        className={`grid ${STATUS_COLS} items-center gap-2 border-t border-slate-100 px-3 py-2.5 hover:bg-slate-50/80`}
      >
        <div
          className="flex min-w-0 items-center gap-2"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNestedLesson(expandKey)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-expanded={open}
              aria-label={
                open
                  ? "Collapse chapters and related items"
                  : "Expand chapters and related items"
              }
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          ) : (
            <span className="inline-block w-4 shrink-0" aria-hidden />
          )}
          <Link
            href={row.adminLessonHref}
            className="min-w-0 truncate text-sm text-slate-800 hover:text-sky-800"
          >
            {row.lessonTitle}
          </Link>
          <LessonKindBadge row={row} />
        </div>
        <div className="flex justify-center">
          <TimeCell label={row.durationLabel} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <OverallStatusChip status={overall} />
          {row.kind !== "chapter" ? <PublishBadge isDraft={row.isDraft} /> : null}
        </div>
        <div className="flex justify-center">
          <ImportStatusCell state={states.content} label="Content" />
        </div>
        <div className="flex justify-center">
          <ImportStatusCell state={states.video} label="Video" />
        </div>
        <div className="flex justify-center">
          <ImportStatusCell state={states.transcript} label="Transcript" />
        </div>
      </div>
      {open
        ? row.children?.map((child) => (
            <LessonStatusRow
              key={`${child.kind}:${child.lessonId}:${child.chapterId ?? ""}`}
              row={child}
              depth={childDepth}
              openNestedLessons={openNestedLessons}
              toggleNestedLesson={toggleNestedLesson}
            />
          ))
        : null}
    </>
  );
}

function SectionTree({
  section,
  depth,
  openSections,
  toggleSection,
  openNestedLessons,
  toggleNestedLesson,
}: {
  section: LessonImportSectionGroup;
  depth: number;
  openSections: Set<string>;
  toggleSection: (key: string) => void;
  openNestedLessons: Set<string>;
  toggleNestedLesson: (key: string) => void;
}) {
  const open = openSections.has(section.sectionKey);
  const isRule = section.presentation === "rule";
  const hasChildren = section.sections.length > 0 || section.lessons.length > 0;

  return (
    <div className={depth === 0 ? "" : "border-t border-slate-100"}>
      <button
        type="button"
        onClick={() => toggleSection(section.sectionKey)}
        className={`grid w-full ${STATUS_COLS} items-center gap-2 py-2.5 pr-3 text-left hover:bg-slate-50/80 ${
          isRule ? "bg-slate-50/60" : ""
        }`}
        aria-expanded={open}
      >
        <span
          className="flex min-w-0 items-center gap-2"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasChildren ? (
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          ) : (
            <span className="inline-block w-3.5" />
          )}
          <span
            className={
              isRule
                ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                : depth === 0
                  ? "text-sm font-semibold text-slate-800"
                  : "text-sm font-medium text-slate-700"
            }
          >
            {section.sectionTitle}
            <span className="ml-1.5 font-normal tabular-nums text-slate-500">
              ({metaLessonCount(section.lessonCount)})
            </span>
          </span>
        </span>
        <div className="flex justify-center">
          <TimeCell label={section.durationLabel} />
        </div>
        <span aria-hidden />
        <GroupStatusSummary tallies={section.columnTallies} />
      </button>

      {open ? (
        <div>
          {section.lessons.map((row) => (
            <LessonStatusRow
              key={row.lessonId}
              row={row}
              depth={depth + 1}
              openNestedLessons={openNestedLessons}
              toggleNestedLesson={toggleNestedLesson}
            />
          ))}
          {section.sections.map((child) => (
            <SectionTree
              key={child.sectionKey}
              section={child}
              depth={depth + 1}
              openSections={openSections}
              toggleSection={toggleSection}
              openNestedLessons={openNestedLessons}
              toggleNestedLesson={toggleNestedLesson}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminAcademyImportStatus({
  status,
  snapshot,
  snapshotUpdatedAt,
  importOverrides,
}: Props) {
  const [filter, setFilter] = useState<LessonImportFilter>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [openCourses, setOpenCourses] = useState<Set<string>>(() => new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());
  const [openNestedLessons, setOpenNestedLessons] = useState<Set<string>>(() => new Set());
  const [driveOpen, setDriveOpen] = useState(false);

  const courses = useMemo(
    () => status.catalogOrder.courses.map((c) => [c.id, c.title] as const),
    [status.catalogOrder],
  );

  const courseGroups = useMemo(() => {
    const groups = buildOrderedCourseGroups(status.lessons, status.catalogOrder, filter);
    if (courseFilter === "all") return groups;
    return groups.filter((c) => c.courseId === courseFilter);
  }, [status.lessons, status.catalogOrder, filter, courseFilter]);

  const filteredLessonCount = useMemo(
    () => courseGroups.reduce((n, c) => n + c.lessonCount, 0),
    [courseGroups],
  );

  const filteredDurationLabel = useMemo(() => {
    const minutes = courseGroups.reduce((n, c) => n + c.durationMinutes, 0);
    if (minutes <= 0) return null;
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes) % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }, [courseGroups]);

  const lessonTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const row of flattenLessonImportRows(status.lessons)) {
      titles[`${row.courseId}:${row.lessonId}`] = row.lessonTitle;
    }
    return titles;
  }, [status.lessons]);

  const gapsCount = useMemo(
    () =>
      flattenLessonImportRows(status.lessons).filter(
        (row) => row.missingVideo || row.missingContent || row.missingTranscript,
      ).length,
    [status.lessons],
  );

  const { summary } = status;
  const unmatched = snapshot?.unmatched ?? [];
  const ambiguous = snapshot?.ambiguous ?? [];
  const oversized = snapshot?.oversizedVideos ?? [];
  const importErrors = snapshot?.errors ?? [];

  function toggleCourse(courseId: string) {
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function toggleSection(sectionKey: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }

  function toggleNestedLesson(lessonKey: string) {
    setOpenNestedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonKey)) next.delete(lessonKey);
      else next.add(lessonKey);
      return next;
    });
  }

  function expandAll() {
    setOpenCourses(new Set(courseGroups.map((c) => c.courseId)));
    setOpenSections(new Set(courseGroups.flatMap((c) => collectSectionKeys(c.sections))));
    setOpenNestedLessons(
      new Set(
        courseGroups.flatMap((course) =>
          course.sections.flatMap((section) =>
            collectExpandableLessonKeysFromSection(section),
          ),
        ),
      ),
    );
  }

  function collapseAll() {
    setOpenCourses(new Set());
    setOpenSections(new Set());
    setOpenNestedLessons(new Set());
  }

  return (
    <div className="w-full max-w-[110rem] space-y-8 pb-12">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <FilterScorecard
          label="All"
          value={summary.hubLessonCount}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterScorecard
          label="Gaps"
          value={gapsCount}
          active={filter === "gaps"}
          tone="bad"
          onClick={() => setFilter("gaps")}
        />
        <FilterScorecard
          label="Missing video"
          value={summary.missingVideoCount}
          active={filter === "missingVideo"}
          tone="bad"
          onClick={() => setFilter("missingVideo")}
        />
        <FilterScorecard
          label="Missing content"
          value={summary.missingContentCount}
          active={filter === "missingContent"}
          tone="warn"
          onClick={() => setFilter("missingContent")}
        />
        <FilterScorecard
          label="Missing transcript"
          value={summary.missingTranscriptCount}
          active={filter === "missingTranscript"}
          tone="warn"
          onClick={() => setFilter("missingTranscript")}
        />
        <FilterScorecard
          label="Draft"
          value={summary.draftCount}
          active={filter === "draft"}
          tone="warn"
          onClick={() => setFilter("draft")}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <div>
            <label htmlFor="import-filter" className="block text-xs font-medium text-slate-600">
              Show
            </label>
            <select
              id="import-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as LessonImportFilter)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All lessons</option>
              <option value="gaps">Gaps only</option>
              <option value="draft">Draft only</option>
              <option value="published">Published only</option>
              <option value="missingVideo">Missing video only</option>
              <option value="missingContent">Missing content only</option>
              <option value="missingTranscript">Missing transcript only</option>
            </select>
          </div>
          <div>
            <label htmlFor="course-filter" className="block text-xs font-medium text-slate-600">
              Course
            </label>
            <select
              id="course-filter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All courses</option>
              {courses.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Collapse all
          </button>
          <p className="ml-auto text-sm text-slate-600">
            {filteredLessonCount} shown
            {filteredDurationLabel ? ` · ${filteredDurationLabel}` : ""}
          </p>
        </div>

        <TableStatusHeader />

        <div className="divide-y divide-slate-200">
          {courseGroups.map((course) => {
            const courseOpen = openCourses.has(course.courseId);
            return (
              <div key={course.courseId}>
                <button
                  type="button"
                  onClick={() => toggleCourse(course.courseId)}
                  className={`grid w-full ${STATUS_COLS} items-center gap-2 bg-slate-50/90 px-3 py-3.5 text-left hover:bg-slate-100/80`}
                  aria-expanded={courseOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        courseOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                    <span className="font-semibold text-slate-900">
                      {course.courseTitle}
                      <span className="ml-1.5 font-normal tabular-nums text-slate-500">
                        ({metaLessonCount(course.lessonCount)})
                      </span>
                    </span>
                  </span>
                  <div className="flex justify-center">
                    <TimeCell label={course.durationLabel} />
                  </div>
                  <span aria-hidden />
                  <GroupStatusSummary tallies={course.columnTallies} />
                </button>

                {courseOpen ? (
                  <div className="bg-white">
                    {course.sections.map((section) => (
                      <SectionTree
                        key={section.sectionKey}
                        section={section}
                        depth={0}
                        openSections={openSections}
                        toggleSection={toggleSection}
                        openNestedLessons={openNestedLessons}
                        toggleNestedLesson={toggleNestedLesson}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {courseGroups.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No lessons for this filter.</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setDriveOpen((open) => !open)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/80"
          aria-expanded={driveOpen}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
              driveOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              Drive files not matched to a lesson
            </span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Leftover import files to link or ignore
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            {unmatched.length > 0 ? (
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-rose-800 ring-1 ring-inset ring-rose-200/80">
                {unmatched.length} unmatched
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/80">
                Clear
              </span>
            )}
            {ambiguous.length > 0 ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-900 ring-1 ring-inset ring-amber-200/80">
                {ambiguous.length} ambiguous
              </span>
            ) : null}
            {importErrors.length > 0 ? (
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-rose-800 ring-1 ring-inset ring-rose-200/80">
                {importErrors.length} errors
              </span>
            ) : null}
          </span>
        </button>

        {driveOpen ? (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4">
            {!snapshot ? (
              <p className="text-sm text-slate-500">
                No snapshot yet. After{" "}
                <code className="text-xs">
                  import-academy-lessons-from-drive-folder.ts --apply
                </code>
                , unmatched files appear here.
              </p>
            ) : (
              <>
                <AdminAcademyImportUnmatchedTable
                  unmatched={unmatched}
                  initialOverrides={importOverrides}
                  catalogOrder={status.catalogOrder}
                  lessons={status.lessons}
                  lessonTitles={lessonTitles}
                  snapshotUpdatedAt={snapshotUpdatedAt}
                />

                {(ambiguous.length > 0 || oversized.length > 0 || importErrors.length > 0) && (
                  <div className="mt-8 space-y-6 border-t border-slate-100 pt-6">
                    {ambiguous.length > 0 ? (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Ambiguous ({ambiguous.length})
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Re-run import with{" "}
                          <code className="text-xs">--include-ambiguous</code> or confirm links
                          above.
                        </p>
                      </div>
                    ) : null}

                    {oversized.length > 0 ? (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Too large ({oversized.length})
                        </h3>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {oversized.map((o) => (
                            <li key={o.videoPath}>
                              {o.lessonTitle}: {o.sizeMb}MB (max {o.maxMb}MB) — {o.videoPath}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {importErrors.length > 0 ? (
                      <div>
                        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          <X className="h-3.5 w-3.5 text-rose-700" aria-hidden />
                          Errors ({importErrors.length})
                        </h3>
                        <ul className="mt-2 space-y-1 text-sm text-rose-800">
                          {importErrors.map((e) => (
                            <li key={`${e.relativePath}:${e.message}`}>
                              {e.relativePath}: {e.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
