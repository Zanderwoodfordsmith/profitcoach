"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";

import type { AcademyImportSnapshotReport } from "@/lib/academy/academyImportSnapshot";
import type { AcademyImportOverride } from "@/lib/academy/academyImportOverrides";
import type { AcademyBodyImportReportRow } from "@/lib/academy/bodyImportReport";
import { AdminAcademyImportUnmatchedTable } from "@/components/academy/AdminAcademyImportUnmatchedTable";
import {
  buildOrderedCourseGroups,
  type LessonImportFilter,
  type LessonImportStatusReport,
  type LessonImportStatusRow,
} from "@/lib/academy/lessonImportStatusClient";

type Props = {
  status: LessonImportStatusReport;
  snapshot: AcademyImportSnapshotReport | null;
  snapshotUpdatedAt: string | null;
  importOverrides: AcademyImportOverride[];
  bodyImportUnresolved: AcademyBodyImportReportRow[];
  bodyImportReportFile: string | null;
  bodyImportTotalRows: number;
};

type ImportCellState = "ok" | "missing" | "na";

const STATUS_COL_WIDTH = "w-[9.5rem]";

function bodyRowKey(row: AcademyBodyImportReportRow): string {
  return `${row.sourceFile}:${row.sourceLine}:${row.title}`;
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
      <span className="inline-flex justify-center text-emerald-600" title={`${label} ready`}>
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">{label} ready</span>
      </span>
    );
  }
  return (
    <span className="inline-flex justify-center text-rose-600" title={`${label} missing`}>
      <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">{label} missing</span>
    </span>
  );
}

function LessonImportStatusColumns({ row }: { row: LessonImportStatusRow }) {
  const videoState: ImportCellState =
    row.videoStatus === "video_ready"
      ? "ok"
      : row.videoStatus === "video_missing"
        ? "missing"
        : "na";

  const transcriptState: ImportCellState =
    row.legacyExpectsVideo || row.hasInAppVideo
      ? row.hasTranscript
        ? "ok"
        : "missing"
      : "na";

  return (
    <div className={`grid shrink-0 ${STATUS_COL_WIDTH} grid-cols-3 gap-1`}>
      <ImportStatusCell state={row.hasContent ? "ok" : "missing"} label="Content" />
      <ImportStatusCell state={videoState} label="Video" />
      <ImportStatusCell state={transcriptState} label="Transcript" />
    </div>
  );
}

function LessonImportStatusHeader() {
  return (
    <div
      className={`grid shrink-0 ${STATUS_COL_WIDTH} grid-cols-3 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400`}
    >
      <span>Content</span>
      <span>Video</span>
      <span>Transcript</span>
    </div>
  );
}

export function AdminAcademyImportStatus({
  status,
  snapshot,
  snapshotUpdatedAt,
  importOverrides,
  bodyImportUnresolved,
  bodyImportReportFile,
  bodyImportTotalRows,
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
  const lessonKeyByLessonId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of status.lessons) {
      const key = `${row.courseId}:${row.lessonId}`;
      if (!map.has(row.lessonId)) map.set(row.lessonId, key);
    }
    return map;
  }, [status.lessons]);
  const lessonOptionGroups = useMemo(() => {
    const byCourse = new Map<string, { label: string; options: Array<{ key: string; title: string }> }>();
    for (const course of status.catalogOrder.courses) {
      byCourse.set(course.id, { label: course.title, options: [] });
    }
    for (const row of status.lessons) {
      const group = byCourse.get(row.courseId);
      if (!group) continue;
      group.options.push({
        key: `${row.courseId}:${row.lessonId}`,
        title: row.lessonTitle,
      });
    }
    return Array.from(byCourse.values()).filter((g) => g.options.length > 0);
  }, [status.catalogOrder.courses, status.lessons]);
  const bodyReviewStorageKey = useMemo(
    () => `academy-body-import-review:${bodyImportReportFile ?? "latest"}`,
    [bodyImportReportFile]
  );
  const defaultBodySelections = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of bodyImportUnresolved) {
      const key = bodyRowKey(row);
      if (row.target?.courseId && row.target?.lessonId) {
        out[key] = `${row.target.courseId}:${row.target.lessonId}`;
        continue;
      }
      const firstCandidateLessonId = row.candidates?.[0]?.lessonId;
      if (!firstCandidateLessonId) continue;
      const found = lessonKeyByLessonId.get(firstCandidateLessonId);
      if (found) out[key] = found;
    }
    return out;
  }, [bodyImportUnresolved, lessonKeyByLessonId]);
  const [bodySelections, setBodySelections] = useState<
    Record<string, { lessonKey: string; confirmed: boolean }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(bodyReviewStorageKey);
        if (raw) {
          return JSON.parse(raw) as Record<string, { lessonKey: string; confirmed: boolean }>;
        }
      } catch {
        // Ignore malformed/blocked localStorage and fall back to defaults.
      }
    }
    const seeded: Record<string, { lessonKey: string; confirmed: boolean }> = {};
    for (const [rowKey, lessonKey] of Object.entries(defaultBodySelections)) {
      seeded[rowKey] = { lessonKey, confirmed: false };
    }
    return seeded;
  });
  const [copiedOverrides, setCopiedOverrides] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(bodyReviewStorageKey, JSON.stringify(bodySelections));
    } catch {
      // Ignore localStorage write errors.
    }
  }, [bodyReviewStorageKey, bodySelections]);

  const { summary } = status;
  const unmatched = snapshot?.unmatched ?? [];
  const ambiguous = snapshot?.ambiguous ?? [];
  const oversized = snapshot?.oversizedVideos ?? [];
  const importErrors = snapshot?.errors ?? [];
  const confirmedBodyCount = useMemo(
    () => Object.values(bodySelections).filter((s) => s.confirmed && s.lessonKey).length,
    [bodySelections]
  );

  async function copyConfirmedBodyOverrides() {
    const titles: Record<string, { courseId: string; lessonId: string }> = {};
    for (const row of bodyImportUnresolved) {
      const rowKey = bodyRowKey(row);
      const state = bodySelections[rowKey];
      if (!state?.confirmed || !state.lessonKey) continue;
      const [courseId, ...rest] = state.lessonKey.split(":");
      const lessonId = rest.join(":");
      if (!courseId || !lessonId) continue;
      titles[row.title] = { courseId, lessonId };
    }

    const payload = {
      _README:
        "Paste into scripts/academy-lesson-body-overrides.json under `titles` (merge keys).",
      titles,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedOverrides(true);
    window.setTimeout(() => setCopiedOverrides(false), 1800);
  }

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
        <p className="mt-4 text-xs text-slate-500">
          <Check className="mr-1 inline h-3.5 w-3.5 text-emerald-600" aria-hidden />
          ready ·
          <X className="mx-1 inline h-3.5 w-3.5 text-rose-600" aria-hidden />
          missing ·
          <Minus className="mx-1 inline h-3.5 w-3.5 text-slate-300" aria-hidden />
          not applicable
        </p>
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

        <div className="hidden border-b border-slate-100 bg-slate-50/80 px-4 py-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
          <span className="pl-12 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Lesson
          </span>
          <LessonImportStatusHeader />
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
                                  className="grid grid-cols-1 items-center gap-2 border-t border-slate-50 py-2.5 pl-16 pr-4 hover:bg-slate-50/50 sm:grid-cols-[1fr_auto] sm:gap-3"
                                >
                                  <Link
                                    href={row.adminLessonHref}
                                    className="min-w-0 text-sm font-normal text-slate-700 hover:text-sky-800"
                                  >
                                    {row.lessonTitle}
                                  </Link>
                                  <LessonImportStatusColumns row={row} />
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Lesson body docs needing manual mapping</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ambiguous/unmatched lesson titles from the doc-body import run.
        </p>
        {bodyImportReportFile ? (
          <p className="mt-2 text-xs text-slate-500">
            Source report: <code className="text-xs">{`reports/${bodyImportReportFile}`}</code> (
            {bodyImportTotalRows} rows)
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No body import report found in reports/ yet.</p>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Pick a lesson, then tick confirm. Confirmed selections are tracked locally and can be copied
          as overrides JSON.
        </p>

        {bodyImportUnresolved.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-700">No unresolved body-import rows.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                {confirmedBodyCount} of {bodyImportUnresolved.length} confirmed
              </p>
              <button
                type="button"
                onClick={() => void copyConfirmedBodyOverrides()}
                disabled={confirmedBodyCount === 0}
                className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copiedOverrides ? "Copied" : "Copy confirmed overrides JSON"}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Confirm</th>
                  <th className="px-3 py-2.5">Kind</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Doc title</th>
                  <th className="px-3 py-2.5">Lesson selection</th>
                  <th className="px-3 py-2.5">Candidates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bodyImportUnresolved.map((row) => (
                  <tr key={`${row.sourceFile}:${row.sourceLine}:${row.title}`} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                        checked={Boolean(bodySelections[bodyRowKey(row)]?.confirmed)}
                        onChange={(e) => {
                          const rowKey = bodyRowKey(row);
                          setBodySelections((prev) => ({
                            ...prev,
                            [rowKey]: {
                              lessonKey: prev[rowKey]?.lessonKey ?? defaultBodySelections[rowKey] ?? "",
                              confirmed: e.target.checked,
                            },
                          }));
                        }}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.kind === "ambiguous"
                            ? "bg-amber-50 text-amber-900"
                            : "bg-rose-50 text-rose-800"
                        }`}
                      >
                        {row.kind}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {Math.round(row.score * 100)}%
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-900">{row.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.sourceFile}:{row.sourceLine}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={bodySelections[bodyRowKey(row)]?.lessonKey ?? defaultBodySelections[bodyRowKey(row)] ?? ""}
                        onChange={(e) => {
                          const rowKey = bodyRowKey(row);
                          setBodySelections((prev) => ({
                            ...prev,
                            [rowKey]: {
                              lessonKey: e.target.value,
                              confirmed: false,
                            },
                          }));
                        }}
                        className="w-full min-w-[18rem] rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        <option value="">Select lesson…</option>
                        {lessonOptionGroups.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.title}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-700">
                      {row.candidates?.length ? (
                        row.candidates.map((c) => (
                          <p key={`${row.title}:${c.lessonId}`}>
                            {Math.round(c.score * 100)}% · <code>{c.lessonId}</code>
                          </p>
                        ))
                      ) : (
                        <span className="text-slate-400">No candidate</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
