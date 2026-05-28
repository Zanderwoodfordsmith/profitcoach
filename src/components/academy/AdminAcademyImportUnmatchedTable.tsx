"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, Link2, Trash2 } from "lucide-react";

import type { AcademyImportOverride } from "@/lib/academy/academyImportOverrides";
import { formatDriveImportFileDisplay } from "@/lib/academy/formatDriveImportFileName";
import type { AcademyImportSnapshotReport } from "@/lib/academy/academyImportSnapshot";
import {
  buildImportLinkLessonPickGroups,
  type LessonImportCatalogOrder,
  type LessonImportStatusRow,
} from "@/lib/academy/lessonImportStatusClient";
import { supabaseClient } from "@/lib/supabaseClient";

type UnmatchedRow = NonNullable<AcademyImportSnapshotReport["unmatched"]>[number];

type Props = {
  unmatched: UnmatchedRow[];
  initialOverrides: AcademyImportOverride[];
  catalogOrder: LessonImportCatalogOrder;
  lessons: LessonImportStatusRow[];
  lessonTitles: Record<string, string>;
  snapshotUpdatedAt: string | null;
};

type LinkFilter = "all" | "pending" | "linked";
type MediaGroupKind = "video" | "transcript";

const MEDIA_GROUPS: Array<{ kind: MediaGroupKind; label: string }> = [
  { kind: "video", label: "Videos" },
  { kind: "transcript", label: "Transcripts" },
];

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function scorePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase();
}

/** Resolve suggested lesson key from snapshot IDs or title (older snapshots only stored title). */
function resolveSuggestedPick(
  row: UnmatchedRow,
  lessonTitles: Record<string, string>
): string {
  if (row.bestLessonCourseId && row.bestLessonId) {
    const key = lessonKey(row.bestLessonCourseId, row.bestLessonId);
    if (lessonTitles[key] !== undefined) return key;
  }

  const title = row.bestLessonTitle?.trim();
  if (!title) return "";

  const want = normalizeTitle(title);
  const matches = Object.entries(lessonTitles).filter(
    ([, lessonTitle]) => normalizeTitle(lessonTitle) === want
  );

  if (row.courseId) {
    const inCourse = matches.find(([key]) => key.startsWith(`${row.courseId}:`));
    if (inCourse) return inCourse[0];
  }

  if (matches.length === 1) return matches[0]![0];

  if (row.bestLessonCourseId) {
    const inBestCourse = matches.find(([key]) =>
      key.startsWith(`${row.bestLessonCourseId}:`)
    );
    if (inBestCourse) return inBestCourse[0];
  }

  return matches[0]?.[0] ?? "";
}

function suggestedDisplayTitle(
  row: UnmatchedRow,
  suggestedKey: string,
  lessonTitles: Record<string, string>
): string {
  return lessonTitles[suggestedKey] ?? row.bestLessonTitle ?? suggestedKey;
}

function inferImportFileKind(relativePath: string): MediaGroupKind | null {
  const lower = relativePath.replace(/\\/g, "/").toLowerCase();
  if (lower.includes("/videos/") || /\.(mp4|mov|webm|m4v)(\.\w+)?$/.test(lower)) {
    return "video";
  }
  if (lower.includes("/transcripts/") || /\.(docx|txt|vtt|srt)(\.\w+)?$/.test(lower)) {
    return "transcript";
  }
  return null;
}

function filterPickGroupsForRow(
  groups: ReturnType<typeof buildImportLinkLessonPickGroups>,
  excludeKeys: ReadonlySet<string>
): ReturnType<typeof buildImportLinkLessonPickGroups> {
  return groups
    .map((group) => ({
      ...group,
      keys: group.keys.filter((key) => !excludeKeys.has(key)),
    }))
    .filter((group) => group.keys.length > 0);
}

export function AdminAcademyImportUnmatchedTable({
  unmatched,
  initialOverrides,
  catalogOrder,
  lessons,
  lessonTitles,
  snapshotUpdatedAt,
}: Props) {
  const lessonsByKey = useMemo(() => {
    const map = new Map<string, LessonImportStatusRow>();
    for (const lesson of lessons) {
      map.set(lessonKey(lesson.courseId, lesson.lessonId), lesson);
    }
    return map;
  }, [lessons]);

  const pickGroupsByFileKind = useMemo(() => {
    const video = buildImportLinkLessonPickGroups("video", catalogOrder, lessonsByKey);
    const transcript = buildImportLinkLessonPickGroups("transcript", catalogOrder, lessonsByKey);
    return { video, transcript };
  }, [catalogOrder, lessonsByKey]);

  const [overrides, setOverrides] = useState(initialOverrides);
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("pending");
  const [draftLessons, setDraftLessons] = useState<Record<string, string>>({});
  const [useSuggested, setUseSuggested] = useState<Record<string, boolean>>({});
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overrideByPath = useMemo(() => {
    const map = new Map<string, AcademyImportOverride>();
    for (const o of overrides) map.set(o.relativePath, o);
    return map;
  }, [overrides]);

  const unmatchedKindByPath = useMemo(() => {
    const map = new Map<string, MediaGroupKind>();
    for (const row of unmatched) map.set(row.relativePath, row.kind);
    return map;
  }, [unmatched]);

  /** Lessons already linked to another pending file (per video vs transcript). */
  const linkedLessonKeysByKind = useMemo(() => {
    const video = new Set<string>();
    const transcript = new Set<string>();
    for (const o of overrides) {
      const key = lessonKey(o.courseId, o.lessonId);
      const kind =
        unmatchedKindByPath.get(o.relativePath) ?? inferImportFileKind(o.relativePath);
      if (kind === "video") video.add(key);
      else if (kind === "transcript") transcript.add(key);
    }
    return { video, transcript };
  }, [overrides, unmatchedKindByPath]);

  const suggestedByPath = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of unmatched) {
      let suggested = resolveSuggestedPick(row, lessonTitles);
      const reserved =
        row.kind === "video"
          ? linkedLessonKeysByKind.video
          : linkedLessonKeysByKind.transcript;
      if (suggested && reserved.has(suggested)) suggested = "";
      map[row.relativePath] = suggested;
    }
    return map;
  }, [unmatched, lessonTitles, linkedLessonKeysByKind]);

  const sortedRows = useMemo(
    () => [...unmatched].sort((a, b) => b.bestScore - a.bestScore),
    [unmatched]
  );

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const linked = overrideByPath.has(row.relativePath);
      if (linkFilter === "linked") return linked;
      if (linkFilter === "pending") return !linked;
      return true;
    });
  }, [sortedRows, overrideByPath, linkFilter]);

  const groupedRows = useMemo(() => {
    return MEDIA_GROUPS.map((group) => ({
      ...group,
      rows: filteredRows.filter((row) => row.kind === group.kind),
    })).filter((group) => group.rows.length > 0);
  }, [filteredRows]);

  const linkedCount = useMemo(
    () => sortedRows.filter((row) => overrideByPath.has(row.relativePath)).length,
    [sortedRows, overrideByPath]
  );

  async function authFetch(input: RequestInfo, init?: RequestInit) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error("Not signed in");
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  /** What the dropdown displays — shows suggestion even before it is confirmed. */
  function displayPick(row: UnmatchedRow): string {
    const suggested = suggestedByPath[row.relativePath] ?? "";
    const manual = draftLessons[row.relativePath] ?? "";
    if (useSuggested[row.relativePath] === true && suggested) return suggested;
    if (manual) return manual;
    return suggested;
  }

  /** Lesson used when saving — suggestion only counts after the circle is ticked. */
  function effectivePick(row: UnmatchedRow): string {
    const suggested = suggestedByPath[row.relativePath] ?? "";
    const manual = draftLessons[row.relativePath]?.trim() ?? "";
    if (useSuggested[row.relativePath] === true && suggested) return suggested;
    if (manual && manual !== suggested) return manual;
    return "";
  }

  function toggleUseSuggested(row: UnmatchedRow) {
    const suggested = suggestedByPath[row.relativePath];
    if (!suggested) return;
    setUseSuggested((prev) => ({
      ...prev,
      [row.relativePath]: prev[row.relativePath] !== true,
    }));
  }

  async function saveLink(row: UnmatchedRow) {
    const pick = effectivePick(row);
    if (!pick) {
      setError("Choose a lesson before saving the link.");
      return;
    }
    const [courseId, ...rest] = pick.split(":");
    const lessonId = rest.join(":");
    if (!courseId || !lessonId) {
      setError("Invalid lesson selection.");
      return;
    }

    setBusyPath(row.relativePath);
    setError(null);
    try {
      const label = lessonTitles[pick] ?? row.bestLessonTitle ?? lessonId;
      const res = await authFetch("/api/admin/academy/import/overrides", {
        method: "POST",
        body: JSON.stringify({
          relativePath: row.relativePath,
          courseId,
          lessonId,
          lessonTitle: label,
        }),
      });
      const payload = (await res.json()) as { override?: AcademyImportOverride; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save link");
      if (payload.override) {
        setOverrides((prev) => {
          const next = prev.filter((o) => o.relativePath !== row.relativePath);
          return [...next, payload.override!];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save link");
    } finally {
      setBusyPath(null);
    }
  }

  async function clearLink(relativePath: string) {
    setBusyPath(relativePath);
    setError(null);
    try {
      const res = await authFetch("/api/admin/academy/import/overrides", {
        method: "DELETE",
        body: JSON.stringify({ relativePath }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to clear link");
      setOverrides((prev) => prev.filter((o) => o.relativePath !== relativePath));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear link");
    } finally {
      setBusyPath(null);
    }
  }

  if (unmatched.length === 0) {
    return (
      <p className="mt-4 text-sm text-emerald-700">No unmatched Drive files in the last import run.</p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            {unmatched.length} unmatched files
            {snapshotUpdatedAt
              ? ` · snapshot ${new Date(snapshotUpdatedAt).toLocaleString()}`
              : null}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sorted by closest match within each group. The suggested lesson is shown in the dropdown —
            tick the circle to confirm it. Linked lessons are hidden from other rows (video and
            transcript tracked separately).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "linked", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setLinkFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                linkFilter === key
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {key === "pending"
                ? `Pending (${unmatched.length - linkedCount})`
                : key === "linked"
                  ? `Linked (${linkedCount})`
                  : `All (${unmatched.length})`}
            </button>
          ))}
        </div>
      </div>

      {linkedCount > 0 ? (
        <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-900">
          <p className="font-medium">{linkedCount} file link(s) ready for import</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-white/80 p-2 font-mono text-xs text-slate-700">
            {`npm run import-academy-lessons -- --apply --skip-existing --include-ambiguous --continue-on-error --root "<Old Academy path>"`}
          </pre>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
          <colgroup>
            <col className="w-[4.5rem]" />
            <col className="w-[24%]" />
            <col className="w-[36%]" />
            <col className="w-[5.5rem]" />
            <col className="w-[6.5rem]" />
          </colgroup>
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Score</th>
              <th className="px-3 py-2.5">File</th>
              <th className="px-3 py-2.5">Lesson</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {groupedRows.map((group) => (
              <Fragment key={group.kind}>
                <tr className="bg-slate-50/90">
                  <td colSpan={5} className="px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {group.label}
                    </span>
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({group.rows.length})
                    </span>
                  </td>
                </tr>
                {group.rows.map((row) => {
                  const linked = overrideByPath.get(row.relativePath);
                  const suggested = suggestedByPath[row.relativePath] ?? "";
                  const usingSuggested = Boolean(suggested && useSuggested[row.relativePath] === true);
                  const reservedKeys =
                    row.kind === "video"
                      ? linkedLessonKeysByKind.video
                      : linkedLessonKeysByKind.transcript;
                  const pickGroups = filterPickGroupsForRow(
                    row.kind === "video"
                      ? pickGroupsByFileKind.video
                      : pickGroupsByFileKind.transcript,
                    reservedKeys
                  );
                  const listedKeys = new Set(pickGroups.flatMap((group) => group.keys));
                  const pick = displayPick(row);
                  const isBusy = busyPath === row.relativePath;
                  const file = formatDriveImportFileDisplay(row.relativePath);
                  const canLink = Boolean(linked ? false : effectivePick(row));

                  return (
                    <tr key={row.relativePath} className="align-top hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.bestScore >= 0.72
                              ? "bg-emerald-50 text-emerald-800"
                              : row.bestScore >= 0.5
                                ? "bg-amber-50 text-amber-900"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {scorePercent(row.bestScore)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p
                          className="text-sm font-medium leading-snug text-slate-900"
                          title={file.fullPath}
                        >
                          {file.title}
                        </p>
                        {file.folder ? (
                          <p
                            className="mt-0.5 truncate text-xs text-slate-500"
                            title={file.folder}
                          >
                            {file.folder}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5">
                        {linked ? (
                          <div className="flex min-w-0 items-start gap-1">
                            <p
                              className="min-w-0 flex-1 truncate text-xs font-medium text-emerald-800"
                              title={linked.lessonTitle ?? linked.lessonId}
                            >
                              {linked.lessonTitle ?? linked.lessonId}
                            </p>
                            <Link
                              href={`/admin/academy/programs/${linked.courseId}/${linked.lessonId}`}
                              className="shrink-0 rounded p-0.5 text-sky-700 hover:bg-sky-50"
                              title="Open lesson"
                            >
                              <Link2 className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">Open lesson</span>
                            </Link>
                          </div>
                        ) : (
                          <div className="flex min-w-0 items-center gap-1.5">
                            {suggested ? (
                              <button
                                type="button"
                                onClick={() => toggleUseSuggested(row)}
                                disabled={isBusy}
                                className={`shrink-0 rounded-full p-0.5 transition ${
                                  usingSuggested
                                    ? "text-sky-600 hover:text-sky-700"
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                                title={
                                  usingSuggested
                                    ? "Using suggested lesson — click to pick manually"
                                    : `Use suggested: ${row.bestLessonTitle ?? "lesson"}`
                                }
                                aria-pressed={usingSuggested}
                                aria-label={
                                  usingSuggested
                                    ? "Using suggested lesson"
                                    : "Use suggested lesson"
                                }
                              >
                                {usingSuggested ? (
                                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                                ) : (
                                  <Circle className="h-4 w-4" aria-hidden />
                                )}
                              </button>
                            ) : null}
                            <select
                              value={pick}
                              onChange={(e) => {
                                setUseSuggested((prev) => ({
                                  ...prev,
                                  [row.relativePath]: false,
                                }));
                                setDraftLessons((prev) => ({
                                  ...prev,
                                  [row.relativePath]: e.target.value,
                                }));
                              }}
                              className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-700"
                              disabled={isBusy || usingSuggested}
                              title={pick ? lessonTitles[pick] : "Select lesson"}
                            >
                              <option value="">Select…</option>
                              {suggested ? (
                                <option value={suggested}>
                                  {suggestedDisplayTitle(row, suggested, lessonTitles)} (suggested)
                                </option>
                              ) : null}
                              {pickGroups.map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.keys
                                    .filter((key) => key !== suggested)
                                    .map((key) => (
                                      <option key={key} value={key}>
                                        {lessonTitles[key] ?? key}
                                      </option>
                                    ))}
                                </optgroup>
                              ))}
                              {pick && pick !== suggested && !listedKeys.has(pick) ? (
                                <option value={pick}>{lessonTitles[pick] ?? pick}</option>
                              ) : null}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {linked ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            <Check className="h-3 w-3" aria-hidden />
                            Linked
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {linked ? (
                          <button
                            type="button"
                            onClick={() => void clearLink(row.relativePath)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden />
                            Clear
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void saveLink(row)}
                            disabled={isBusy || !canLink}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" aria-hidden />
                            {isBusy ? "…" : "Link"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRows.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No rows for this filter.</p>
      ) : null}
    </div>
  );
}
