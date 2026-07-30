"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft } from "lucide-react";

import { AcademyMarkdown } from "@/components/academy/AcademyMarkdown";
import {
  LessonProgressHeaderControl,
  LessonProgressSidebarControl,
  useLessonProgress,
} from "@/components/academy/LessonProgressControls";
import { LessonPageEyebrow } from "@/components/academy/LessonPageEyebrow";
import { LessonResourcesPanel } from "@/components/academy/LessonResourcesPanel";
import { LessonTranscriptPanel } from "@/components/academy/LessonTranscriptPanel";
import { hasInAppLessonContent } from "@/lib/academy/lessonContentUtils";
import type {
  LegacyHubCatalog,
  LegacyHubCourse,
  LegacyHubLesson,
  LegacyHubSection,
} from "@/lib/academy/legacyHubCatalog";
import type { AcademyResourceRow } from "@/lib/academy/resources";
import {
  courseDurationLabel,
  flattenSections,
  legacyLessonCount,
  lessonContextInCourse,
  sectionContainsLesson,
  sectionDurationLabel,
  sectionLessonCount,
} from "@/lib/academy/legacyHubCatalog";
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
  /**
   * Where the course contents rail sits on large screens.
   * Simplified uses left (Skool-style); Current keeps right.
   */
  contentsPosition?: "left" | "right";
  /**
   * `minimal` strips eyebrow, lesson-count chrome, and boxy section cards —
   * course title + progress bar in the rail (Simplified).
   */
  chrome?: "default" | "minimal";
};

function durationLabel(raw: string): string | null {
  const t = raw.trim().replace(/^\(|\)$/g, "").trim();
  return t || null;
}

function collectAncestorSectionIds(
  sections: LegacyHubSection[],
  lessonId: string,
  ancestors: string[] = [],
): string[] | null {
  for (const section of sections) {
    if (section.lessons.some((l) => l.id === lessonId)) {
      return [...ancestors, section.id];
    }
    if (section.sections?.length) {
      const hit = collectAncestorSectionIds(section.sections, lessonId, [
        ...ancestors,
        section.id,
      ]);
      if (hit) return hit;
    }
  }
  return null;
}

function initialOpenSectionIds(course: LegacyHubCourse, activeLessonId: string): Set<string> {
  const path = collectAncestorSectionIds(course.sections, activeLessonId);
  if (path?.length) return new Set(path);
  const first = course.sections[0];
  return new Set(first ? [first.id] : []);
}

function CourseProgressSummary({
  course,
  className = "mt-3",
}: {
  course: LegacyHubCourse;
  className?: string;
}) {
  const { progress } = useLessonProgress();
  const total = legacyLessonCount(course);
  const completed = useMemo(() => {
    let n = 0;
    for (const section of flattenSections(course.sections)) {
      for (const l of section.lessons) {
        if (progress[l.id] === "completed") n += 1;
      }
    }
    return n;
  }, [course.sections, progress]);
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  /** Fill too narrow for the label — place it just past the green tip. */
  const labelOutside = pct < 10;

  return (
    <div className={`relative h-6 rounded-full bg-slate-200 ${className}`}>
      <div
        className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% complete`}
      />
      <span
        className={`pointer-events-none absolute top-1/2 z-10 text-[11px] font-semibold tabular-nums ${
          labelOutside ? "text-slate-600" : "text-white"
        }`}
        style={
          labelOutside
            ? { left: `calc(${pct}% + 0.35rem)`, transform: "translateY(-50%)" }
            : { left: `calc(${pct}% - 0.35rem)`, transform: "translate(-100%, -50%)" }
        }
      >
        {pct}%
      </span>
    </div>
  );
}

/** Tiny 12-o'clock dial for category completion (BOSS checklist ring style). */
function CategoryProgressDial({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const size = 16;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : completed / total;
  const allDone = total > 0 && completed === total;

  if (allDone) {
    return (
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
        aria-label="Category complete"
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }

  return (
    <svg
      className="h-4 w-4 shrink-0 -rotate-90"
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`${completed} of ${total} lessons complete`}
      role="img"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-slate-200"
      />
      {ratio > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-emerald-600"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
        />
      ) : null}
    </svg>
  );
}

function CategoryDialForSection({ section }: { section: LegacyHubSection }) {
  const { progress } = useLessonProgress();
  const total = sectionLessonCount(section);
  let completed = 0;
  for (const node of flattenSections([section])) {
    for (const l of node.lessons) {
      if (progress[l.id] === "completed") completed += 1;
    }
  }
  return <CategoryProgressDial completed={completed} total={total} />;
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
  contentsPosition = "right",
  chrome = "default",
}: Props) {
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() =>
    initialOpenSectionIds(course, lesson.id)
  );

  useEffect(() => {
    const path = collectAncestorSectionIds(course.sections, lesson.id);
    if (!path?.length) return;
    setOpenSectionIds((prev) => {
      const next = new Set(prev);
      for (const id of path) next.add(id);
      return next;
    });
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
  const contentsOnLeft = contentsPosition === "left";
  const minimal = chrome === "minimal";

  function toggleSection(id: string) {
    setOpenSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderLessonRows(lessons: LegacyHubLesson[], indentClass: string) {
    return (
      <ul className={indentClass}>
        {lessons.map((l) => {
          const active = l.id === lesson.id;
          const dur = durationLabel(l.duration);
          return (
            <li key={l.id}>
              <div
                className={
                  minimal
                    ? `relative z-0 flex min-w-0 items-center gap-2 py-2 text-sm transition before:pointer-events-none before:absolute before:-inset-x-2 before:inset-y-0 before:z-[-1] before:rounded-md before:content-[''] ${
                        active
                          ? "text-[15px] font-medium text-slate-900 before:bg-sky-100"
                          : "font-normal text-slate-700 hover:before:bg-slate-50"
                      }`
                    : `flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                        active
                          ? "bg-sky-600 font-medium text-white shadow-sm"
                          : "font-normal text-slate-700 hover:bg-slate-50"
                      }`
                }
              >
                <LessonProgressSidebarControl
                  lessonId={l.id}
                  active={minimal ? false : active}
                />
                <Link
                  href={`${basePath}/${course.id}/${l.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      minimal ? "leading-normal" : "leading-snug"
                    }`}
                  >
                    {l.title}
                  </span>
                  {dur ? (
                    <span
                      className={`shrink-0 tabular-nums text-xs ${
                        minimal
                          ? active
                            ? "text-slate-500"
                            : "text-slate-400"
                          : active
                            ? "text-sky-100"
                            : "text-slate-500"
                      }`}
                    >
                      {dur}
                    </span>
                  ) : null}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  /** Tier label only (Core / Premium) — left-aligned, not an accordion. */
  function renderRuleSection(section: LegacyHubSection, depth: number) {
    const hasChildren = Boolean(section.sections?.length);

    return (
      <li key={section.id} className="[overflow-anchor:none]">
        <p
          className={`text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${
            depth === 0 ? "mb-1 mt-5 first:mt-1" : "mb-1 mt-3"
          }`}
        >
          {section.title}
        </p>
        {hasChildren ? (
          <ul className={minimal ? "space-y-1" : "space-y-2"}>
            {section.sections!.map((child) =>
              child.presentation === "rule"
                ? renderRuleSection(child, depth + 1)
                : renderAccordionSection(child, depth),
            )}
          </ul>
        ) : section.lessons.length > 0 ? (
          renderLessonRows(
            section.lessons,
            minimal ? "space-y-0.5 pb-0.5" : "space-y-0.5 px-2 py-1",
          )
        ) : null}
      </li>
    );
  }

  function renderAccordionSection(section: LegacyHubSection, depth: number) {
    const secOpen = openSectionIds.has(section.id);
    const hasChildren = Boolean(section.sections?.length);
    const sectionHasActive = sectionContainsLesson(section, lesson.id);
    const highlightCollapsedCategory =
      minimal && sectionHasActive && !secOpen;
    const rolledUpDuration = sectionDurationLabel(section);
    const nestedIndent = minimal
      ? depth > 0
        ? "pl-5"
        : ""
      : "";

    return (
      <li
        key={section.id}
        className={
          minimal
            ? `[overflow-anchor:none] ${nestedIndent}`
            : "overflow-hidden rounded-xl bg-white/80 ring-1 ring-slate-200/60"
        }
      >
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={
            minimal
              ? `relative z-0 flex w-full items-start gap-2 px-0 py-2.5 text-left text-sm font-semibold text-slate-800 transition before:pointer-events-none before:absolute before:-inset-x-2 before:inset-y-0 before:z-[-1] before:rounded-md before:content-[''] hover:before:bg-slate-100/80 ${
                  highlightCollapsedCategory ? "before:bg-sky-100" : ""
                }`
              : `flex w-full gap-2 px-3.5 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-white ${
                  secOpen ? "items-start" : "items-center"
                }`
          }
          aria-expanded={secOpen}
        >
          <span className="flex min-w-0 flex-1 items-start gap-2">
            {minimal ? (
              <span className="mt-0.5 flex shrink-0">
                <CategoryDialForSection section={section} />
              </span>
            ) : null}
            <span
              className={`min-w-0 flex-1 leading-snug ${
                secOpen ? "whitespace-normal break-words" : "truncate"
              }`}
            >
              {section.title}
            </span>
          </span>
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5">
            {rolledUpDuration ? (
              <span className="tabular-nums text-xs font-medium text-slate-400">
                {rolledUpDuration}
              </span>
            ) : null}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                secOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </span>
        </button>
        {secOpen ? (
          hasChildren ? (
            <ul className={minimal ? "space-y-1 pb-1" : "space-y-2 px-2 pb-2"}>
              {section.sections!.map((child) =>
                child.presentation === "rule"
                  ? renderRuleSection(child, depth + 1)
                  : renderAccordionSection(child, depth + 1),
              )}
            </ul>
          ) : section.lessons.length > 0 ? (
            renderLessonRows(
              section.lessons,
              minimal
                ? "space-y-0.5 pb-1 pl-5"
                : "space-y-0.5 border-t border-slate-100 px-2 py-2",
            )
          ) : null
        ) : null}
      </li>
    );
  }

  function renderSection(section: LegacyHubSection, depth: number) {
    if (section.presentation === "rule") {
      return renderRuleSection(section, depth);
    }
    return renderAccordionSection(section, depth);
  }

  const rolledUpCourseDuration = courseDurationLabel(course);

  const sectionList = (
    <ul
      className={
        minimal
          ? "mt-6 space-y-1 [overflow-anchor:none]"
          : "mt-5 max-h-[50vh] space-y-3 overflow-y-auto lg:max-h-[calc(100vh-12rem)]"
      }
    >
      {course.sections.map((section) => renderSection(section, 0))}
    </ul>
  );

  const sidebar = (
    <aside
      className={`w-full shrink-0 lg:self-start ${
        minimal
          ? "lg:w-[22.5rem]"
          : contentsOnLeft
            ? "lg:w-80"
            : "lg:w-96"
      } ${minimal ? "" : "lg:sticky lg:top-28"}`}
    >
      {minimal ? (
        <div>
          <Link
            href={basePath}
            className="mb-3 inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition hover:text-sky-700"
          >
            <ChevronLeft className="-ml-1 h-3.5 w-3.5 shrink-0" aria-hidden />
            Classroom
          </Link>
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={basePath}
              className="min-w-0 text-xl font-semibold leading-none tracking-tight text-slate-900 transition hover:text-sky-700"
            >
              {course.title}
            </Link>
            {rolledUpCourseDuration ? (
              <span className="shrink-0 text-xs font-medium tabular-nums text-slate-400">
                {rolledUpCourseDuration}
              </span>
            ) : null}
          </div>
          <CourseProgressSummary course={course} className="mt-[11px]" />
          {sectionList}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-100/80 p-5 ring-1 ring-slate-200/70">
          <p className="text-sm font-semibold text-slate-900">Course contents</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
          </p>
          {sectionList}
        </div>
      )}
    </aside>
  );

  const main = (
    <div className="min-w-0 flex-1">
      {mainPanelOverride && headerActions ? (
        <div className="mb-3 flex justify-end gap-2">{headerActions}</div>
      ) : null}
      {mainPanelOverride ?? (
        <article
          className={
            minimal
              ? "rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50 md:p-8"
              : "rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 md:p-8"
          }
        >
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div className="min-w-0">
              {!minimal && ctx ? (
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {ctx.section.title}
                </p>
              ) : null}
              <h2
                className={
                  minimal
                    ? "text-2xl font-semibold leading-none tracking-tight text-slate-900 md:text-3xl"
                    : "mt-1.5 text-xl font-semibold text-slate-900 md:text-2xl"
                }
              >
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
  );

  return (
    <div className={`flex flex-col ${minimal ? "gap-5 pt-[15px]" : "gap-8"}`}>
      {!minimal ? (
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
      ) : null}

      <div
        className={`flex min-h-[calc(100vh-10rem)] flex-col lg:flex-row lg:items-start ${
          minimal ? "gap-5 lg:gap-8" : "gap-8"
        } ${contentsOnLeft && !minimal ? "lg:gap-6" : ""}`}
      >
        {contentsOnLeft ? (
          <>
            {sidebar}
            {main}
          </>
        ) : (
          <>
            {main}
            {sidebar}
          </>
        )}
      </div>
    </div>
  );
}
