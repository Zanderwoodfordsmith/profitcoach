"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  OldAcademyLinkAuditReport,
  OldAcademyLinkLessonHit,
  OldAcademyLinkSource,
} from "@/lib/academy/oldAcademyLinkAuditTypes";

type Props = {
  report: OldAcademyLinkAuditReport;
};

type Filter = "all" | "noInApp" | "homepageStub" | "hubOnly" | "inContent";

const SOURCE_LABELS: Record<OldAcademyLinkSource, string> = {
  hub_academyUrl: "Hub academyUrl",
  hub_bodyMarkdown: "Hub body",
  hub_guideMarkdown: "Hub guide",
  hub_notice: "Hub notice",
  body_markdown: "DB body",
  guide_markdown: "DB guide",
  transcript_text: "DB transcript",
  video_url: "DB video URL",
  audio_url: "DB audio URL",
  resource_url: "Resource URL",
};

function matchesFilter(hit: OldAcademyLinkLessonHit, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "noInApp") return !hit.hasInAppContent;
  if (filter === "homepageStub") return hit.academyUrlIsHomepageStub;
  if (filter === "hubOnly") {
    return hit.occurrences.every((o) => o.source.startsWith("hub_"));
  }
  return hit.occurrences.some(
    (o) =>
      o.source === "body_markdown" ||
      o.source === "guide_markdown" ||
      o.source === "transcript_text" ||
      o.source === "video_url" ||
      o.source === "audio_url",
  );
}

export function AdminOldAcademyLinks({ report }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    for (const lesson of report.lessons) {
      map.set(lesson.courseId, lesson.courseTitle);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [report.lessons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return report.lessons.filter((hit) => {
      if (!matchesFilter(hit, filter)) return false;
      if (courseFilter !== "all" && hit.courseId !== courseFilter) return false;
      if (!q) return true;
      return (
        hit.lessonTitle.toLowerCase().includes(q) ||
        hit.lessonId.toLowerCase().includes(q) ||
        hit.courseTitle.toLowerCase().includes(q) ||
        hit.occurrences.some((o) => o.url.toLowerCase().includes(q))
      );
    });
  }, [report.lessons, filter, courseFilter, query]);

  const { summary } = report;

  return (
    <div className="w-full max-w-[110rem] space-y-6 pb-12">
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-rose-950">
          Dead Disco domain: {report.domain}
        </h2>
        <p className="mt-1 text-sm text-rose-900/80">
          Every Classroom / Archive lesson whose hub <code className="text-xs">academyUrl</code>,
          notice, or in-app content still mentions the old academy. Coaches without in-app
          content see a button to this domain — which no longer works.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-rose-800/70">Lessons with links</dt>
            <dd className="text-lg font-semibold text-rose-950">{summary.lessonCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-rose-800/70">No in-app content</dt>
            <dd className="text-lg font-semibold text-rose-950">
              {summary.withoutInAppContentCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-rose-800/70">Homepage stubs</dt>
            <dd className="text-lg font-semibold text-rose-950">
              {summary.homepageStubCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-rose-800/70">Resource library hits</dt>
            <dd className="text-lg font-semibold text-rose-950">{summary.resourceCount}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Filter
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="all">All matches</option>
            <option value="noInApp">No in-app content (broken CTA)</option>
            <option value="homepageStub">Homepage stubs only</option>
            <option value="hubOnly">Hub academyUrl / notice only</option>
            <option value="inContent">Inside DB content fields</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Course
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">All courses</option>
            {courses.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lesson title, id, or URL…"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <p className="pb-2 text-sm text-slate-500">
          Showing {filtered.length} of {report.lessons.length}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Lesson</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Where</th>
              <th className="px-4 py-3 font-semibold">URLs</th>
              <th className="px-4 py-3 font-semibold">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No lessons match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((hit) => (
                <tr key={`${hit.surface}:${hit.courseId}:${hit.lessonId}`} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{hit.lessonTitle}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      [{hit.surface}] {hit.courseTitle}
                      {hit.sectionTitle ? ` · ${hit.sectionTitle}` : ""}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {hit.lessonId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {hit.hasInAppContent ? (
                        <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Has in-app content
                        </span>
                      ) : (
                        <span className="inline-flex w-fit rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800">
                          Disco CTA only
                        </span>
                      )}
                      {hit.academyUrlIsHomepageStub ? (
                        <span className="inline-flex w-fit rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Homepage stub
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1 text-xs text-slate-600">
                      {Array.from(new Set(hit.occurrences.map((o) => o.source))).map(
                        (source) => (
                          <li key={source}>{SOURCE_LABELS[source]}</li>
                        ),
                      )}
                    </ul>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="max-w-md space-y-1 break-all text-xs text-slate-700">
                      {Array.from(new Set(hit.occurrences.map((o) => o.url))).map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 underline decoration-slate-300 hover:text-slate-900"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={hit.adminLessonHref}
                      className="text-sm font-medium text-slate-900 underline decoration-slate-300 hover:decoration-slate-900"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {report.resources.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Resource library ({report.resources.length})
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {report.resources.map((resource) => (
              <li key={resource.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="font-medium text-slate-900">{resource.title}</span>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-slate-600 underline decoration-slate-300"
                >
                  {resource.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
