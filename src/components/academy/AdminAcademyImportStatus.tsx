"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import type { AcademyImportSnapshotReport } from "@/lib/academy/academyImportSnapshot";
import type { AcademyImportOverride } from "@/lib/academy/academyImportOverrides";
import { AdminAcademyImportUnmatchedTable } from "@/components/academy/AdminAcademyImportUnmatchedTable";
import {
  buildOrderedCourseGroups,
  type LessonImportFilter,
  type LessonImportStatusReport,
  type LessonImportStatusRow,
  type LessonVideoImportStatus,
} from "@/lib/academy/lessonImportStatusClient";

type Props = {
  status: LessonImportStatusReport;
  snapshot: AcademyImportSnapshotReport | null;
  snapshotUpdatedAt: string | null;
  importOverrides: AcademyImportOverride[];
};

const VIDEO_STATUS_META: Record<
  LessonVideoImportStatus,
  { label: string; className: string }
> = {
  video_ready: {
    label: "Video in app",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  video_missing: {
    label: "Video missing",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  no_video: {
    label: "No video",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

function LessonStatusBadge({ row }: { row: LessonImportStatusRow }) {
  const meta = VIDEO_STATUS_META[row.videoStatus];
  return (
    <div className="flex min-w-0 flex-col items-end gap-0.5 sm:items-start">
      <span
        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
      >
        {meta.label}
      </span>
      {row.missingContent ? (
        <span className="text-[10px] text-amber-700">Content missing</span>
      ) : null}
      {row.missingTranscript ? (
        <span className="text-[10px] text-amber-700">Transcript missing</span>
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

  const courses = useMemo(
    () =>
      status.catalogOrder.courses.map((c) => [c.id, c.title] as const),
    [status.catalogOrder]
  );

  const courseGroups = useMemo(() => {
    const groups = buildOrderedCourseGroups(status.lessons, status.catalogOrder, filter);
    if (courseFilter === "all") return groups;
    return groups.filter((c) => c.courseId === courseFilter);
  }, [status.lessons, status.catalogOrder, filter, courseFilter]);

  const filteredLessonCount = useMemo(
    () => courseGroups.reduce((n, c) => n + c.lessonCount, 0),
    [courseGroups]
  );

  const lessonTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const row of status.lessons) {
      titles[`${row.courseId}:${row.lessonId}`] = row.lessonTitle;
    }
    return titles;
  }, [status.lessons]);

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

  function expandAll() {
    const courses = new Set(courseGroups.map((c) => c.courseId));
    const sections = new Set(courseGroups.flatMap((c) => c.sections.map((s) => s.sectionKey)));
    setOpenCourses(courses);
    setOpenSections(sections);
  }

  return (
    <div className="w-full max-w-[110rem] space-y-8 pb-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Import progress (programmes)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Legacy <code className="text-xs">hasVideo</code> vs in-app video, lesson content, and
          transcripts on each lesson.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Lessons</dt>
            <dd className="text-lg font-semibold text-slate-900">{summary.lessonCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Video in app</dt>
            <dd className="text-lg font-semibold text-emerald-700">{summary.inAppVideoCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Missing video</dt>
            <dd className="text-lg font-semibold text-rose-700">{summary.missingVideoCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Missing content</dt>
            <dd className="text-lg font-semibold text-amber-700">{summary.missingContentCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Missing transcript</dt>
            <dd className="text-lg font-semibold text-amber-700">
              {summary.missingTranscriptCount}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(VIDEO_STATUS_META) as LessonVideoImportStatus[]).map((key) => (
            <span
              key={key}
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VIDEO_STATUS_META[key].className}`}
            >
              {VIDEO_STATUS_META[key].label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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
              <option value="missingVideo">Missing video only</option>
              <option value="missingContent">Missing content only</option>
              <option value="missingTranscript">Missing transcript only</option>
            </select>
          </div>
          <div>
            <label htmlFor="course-filter" className="block text-xs font-medium text-slate-600">
              Programme
            </label>
            <select
              id="course-filter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All programmes</option>
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
          <p className="ml-auto text-sm text-slate-500">{filteredLessonCount} lessons</p>
        </div>

        <div className="divide-y divide-slate-100">
          {courseGroups.map((course) => {
            const courseOpen = openCourses.has(course.courseId);
            return (
              <div key={course.courseId}>
                <button
                  type="button"
                  onClick={() => toggleCourse(course.courseId)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80"
                  aria-expanded={courseOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        courseOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                    <span className="font-semibold text-slate-900">{course.courseTitle}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {course.lessonCount} lessons
                    {course.gapCount > 0 ? (
                      <span className="ml-2 font-medium text-rose-600">{course.gapCount} gaps</span>
                    ) : null}
                  </span>
                </button>

                {courseOpen ? (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {course.sections.map((section) => {
                      const secOpen = openSections.has(section.sectionKey);
                      return (
                        <div key={section.sectionKey} className="border-b border-slate-100 last:border-0">
                          <button
                            type="button"
                            onClick={() => toggleSection(section.sectionKey)}
                            className="flex w-full items-center justify-between gap-3 py-2.5 pl-8 pr-4 text-left hover:bg-white/60"
                            aria-expanded={secOpen}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <ChevronDown
                                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                                  secOpen ? "rotate-180" : ""
                                }`}
                                aria-hidden
                              />
                              <span className="text-sm font-medium text-slate-800">
                                {section.sectionTitle}
                              </span>
                            </span>
                            <span className="text-xs text-slate-500">
                              {section.lessons.length} lessons
                              {section.gapCount > 0 ? (
                                <span className="ml-2 font-medium text-rose-600">
                                  {section.gapCount} gaps
                                </span>
                              ) : null}
                            </span>
                          </button>

                          {secOpen ? (
                            <ul className="space-y-0 bg-white pb-2">
                              {section.lessons.map((row) => (
                                <li
                                  key={row.lessonId}
                                  className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-50 py-2.5 pl-16 pr-4 hover:bg-slate-50/50"
                                >
                                  <Link
                                    href={row.adminLessonHref}
                                    className="min-w-0 flex-1 text-sm font-normal text-slate-700 hover:text-sky-800"
                                  >
                                    {row.lessonTitle}
                                  </Link>
                                  <LessonStatusBadge row={row} />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Drive files not matched to a lesson</h2>
        {!snapshot ? (
          <p className="mt-4 text-sm text-slate-500">
            No snapshot yet. After{" "}
            <code className="text-xs">import-academy-lessons-from-drive-folder.ts --apply</code>, unmatched
            files appear here.
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
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ambiguous ({ambiguous.length})
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Re-run import with <code className="text-xs">--include-ambiguous</code> or confirm
                      links above.
                    </p>
                  </div>
                ) : null}

                {oversized.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <X className="h-3.5 w-3.5 text-rose-600" aria-hidden />
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
    </div>
  );
}
