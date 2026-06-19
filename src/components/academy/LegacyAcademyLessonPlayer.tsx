"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, FileText, Video } from "lucide-react";

import { AcademyMarkdown } from "@/components/academy/AcademyMarkdown";
import {
  LessonProgressHeaderControl,
  LessonProgressSidebarControl,
} from "@/components/academy/LessonProgressControls";
import { LessonPageEyebrow } from "@/components/academy/LessonPageEyebrow";
import { LessonResourcesPanel } from "@/components/academy/LessonResourcesPanel";
import { LessonTranscriptPanel } from "@/components/academy/LessonTranscriptPanel";
import { hasInAppLessonContent } from "@/lib/academy/lessonContentUtils";
import type {
  LegacyHubCatalog,
  LegacyHubCourse,
  LegacyHubLesson,
} from "@/lib/academy/legacyHubCatalog";
import type { AcademyResourceRow } from "@/lib/academy/resources";
import { legacyLessonCount, lessonContextInCourse } from "@/lib/academy/legacyHubCatalog";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { toYouTubeEmbedUrl } from "@/lib/videoEmbed";

type Props = {
  data: LegacyHubCatalog;
  course: LegacyHubCourse;
  lesson: LegacyHubLesson;
  basePath: string;
  classroomHref: string;
  videoUrl?: string | null;
  bodyMarkdown?: string;
  transcriptText?: string | null;
  lessonResources?: AcademyResourceRow[];
  /** Admin edit / save controls — shown top-right of the lesson panel */
  headerActions?: ReactNode;
  /** Replaces the main lesson panel (e.g. edit form) while keeping the sidebar */
  mainPanelOverride?: ReactNode;
};

function durationLabel(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("(") && t.endsWith(")")) return t;
  return `(${t})`;
}

function initialOpenSectionIds(course: LegacyHubCourse, activeLessonId: string): Set<string> {
  const ids = new Set<string>();
  for (const section of course.sections) {
    if (section.lessons.some((l) => l.id === activeLessonId)) {
      ids.add(section.id);
    }
  }
  if (ids.size === 0 && course.sections[0]) {
    ids.add(course.sections[0].id);
  }
  return ids;
}

export function LegacyAcademyLessonPlayer({
  data,
  course,
  lesson,
  basePath,
  classroomHref,
  videoUrl = null,
  bodyMarkdown = "",
  transcriptText = null,
  lessonResources = [],
  headerActions,
  mainPanelOverride,
}: Props) {
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() =>
    initialOpenSectionIds(course, lesson.id)
  );

  useEffect(() => {
    const sec = course.sections.find((s) => s.lessons.some((l) => l.id === lesson.id));
    if (sec) {
      setOpenSectionIds((prev) => new Set(prev).add(sec.id));
    }
  }, [course.sections, lesson.id]);

  const ctx = useMemo(
    () => lessonContextInCourse(course, lesson.id),
    [course, lesson.id]
  );
  const noticeText = lesson.notice ?? data.lessonPanelNotice;
  const inApp = hasInAppLessonContent(videoUrl, bodyMarkdown, transcriptText);
  const embedUrl = videoUrl ? toYouTubeEmbedUrl(videoUrl) : null;
  const directVideoUrl =
    videoUrl && !embedUrl && isDirectVideoFileUrl(videoUrl) ? videoUrl : null;
  const lessonCount = legacyLessonCount(course);

  function toggleSection(id: string) {
    setOpenSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sidebar = (
    <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-96 lg:self-start">
      <div className="rounded-2xl bg-slate-100/80 p-5 ring-1 ring-slate-200/70">
        <p className="text-sm font-semibold text-slate-900">Course contents</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
        </p>

        <ul className="mt-5 max-h-[50vh] space-y-3 overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
          {course.sections.map((section) => {
            const secOpen = openSectionIds.has(section.id);
            return (
              <li key={section.id} className="overflow-hidden rounded-xl bg-white/80 ring-1 ring-slate-200/60">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-white"
                  aria-expanded={secOpen}
                >
                  <span className="min-w-0 leading-snug">{section.title}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      secOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>
                {secOpen && (
                  <ul className="space-y-0.5 border-t border-slate-100 px-2 py-2">
                    {section.lessons.map((l) => {
                      const active = l.id === lesson.id;
                      const dur = durationLabel(l.duration);
                      return (
                        <li key={l.id}>
                          <Link
                            href={`${basePath}/${course.id}/${l.id}`}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm transition ${
                              active
                                ? "bg-sky-600 font-medium text-white shadow-sm"
                                : "font-normal text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`mt-0.5 shrink-0 ${active ? "text-sky-100" : "text-slate-400"}`}
                              title={l.hasVideo ? "Video lesson" : "Non-video / resource"}
                            >
                              {l.hasVideo ? (
                                <Video className="h-4 w-4" aria-hidden />
                              ) : (
                                <FileText className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 leading-snug">{l.title}</span>
                            {dur ? (
                              <span
                                className={`shrink-0 tabular-nums text-xs ${
                                  active ? "text-sky-100" : "text-slate-500"
                                }`}
                              >
                                {dur}
                              </span>
                            ) : null}
                            <LessonProgressSidebarControl lessonId={l.id} align="right" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <LessonPageEyebrow
          crumbs={[
            { label: "All programmes", href: basePath },
            { label: "Classroom", href: classroomHref },
            { label: course.title },
          ]}
        />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          {course.title}
        </h1>
      </header>

      <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {mainPanelOverride && headerActions ? (
            <div className="mb-3 flex justify-end gap-2">{headerActions}</div>
          ) : null}
          {mainPanelOverride ?? (
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 md:p-8">
              <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
                <div className="min-w-0">
                  {ctx ? (
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {ctx.section.title}
                    </p>
                  ) : null}
                  <h2 className="mt-1.5 text-xl font-semibold text-slate-900 md:text-2xl">
                    {lesson.title}
                  </h2>
                  {!inApp ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {lesson.hasVideo ? "Includes video on Disco" : "Resource / non-video on Disco"}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LessonProgressHeaderControl lessonId={lesson.id} />
                  {headerActions ? headerActions : null}
                </div>
              </header>

              {inApp ? (
                <>
                  {videoUrl ? (
                    <div className="mb-8 overflow-hidden rounded-2xl bg-slate-950 shadow-md">
                      {embedUrl ? (
                        <div className="relative aspect-video w-full">
                          <iframe
                            title={lesson.title}
                            src={embedUrl}
                            className="absolute inset-0 h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      ) : directVideoUrl ? (
                        <video
                          src={directVideoUrl}
                          controls
                          playsInline
                          className="aspect-video w-full bg-black"
                        />
                      ) : (
                        <div className="p-6 text-sm text-slate-300">
                          <p>Video URL is set but is not a recognized embed or video file.</p>
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-sky-400 underline"
                          >
                            Open video
                          </a>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {transcriptText?.trim() ? (
                    <LessonTranscriptPanel transcriptText={transcriptText} />
                  ) : null}

                  {bodyMarkdown.trim() ? (
                    <AcademyMarkdown markdown={bodyMarkdown} />
                  ) : transcriptText?.trim() ? null : (
                    <p className="text-sm text-slate-500">No written content for this lesson yet.</p>
                  )}

                  <LessonResourcesPanel resources={lessonResources} />
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-600">
                    {noticeText}
                  </p>

                  <div className="mt-8">
                    <a
                      href={lesson.academyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500"
                    >
                      {lesson.title}
                    </a>
                  </div>

                  <LessonResourcesPanel resources={lessonResources} />
                </>
              )}
            </article>
          )}
        </div>

        {sidebar}
      </div>
    </div>
  );
}
