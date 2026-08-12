"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, FilePenLine, Play } from "lucide-react";

import { AdminLessonSidebarMenu } from "@/components/academy/AdminLessonSidebarMenu";
import {
  LessonProgressHeaderControl,
  LessonProgressSidebarControl,
  useLessonProgress,
  useReportLessonWatchProgress,
} from "@/components/academy/LessonProgressControls";
import { LessonGuidePanel } from "@/components/academy/LessonGuidePanel";
import { LessonOverviewPanel } from "@/components/academy/LessonOverviewPanel";
import { LessonPageEyebrow } from "@/components/academy/LessonPageEyebrow";
import { LessonPlayerTabs } from "@/components/academy/LessonPlayerTabs";
import { LessonQaPanel } from "@/components/academy/LessonQaPanel";
import {
  hasInAppLessonContent,
  splitSectionTitleEyebrow,
} from "@/lib/academy/lessonContentUtils";
import type {
  HubCatalog,
  HubCourse,
  HubLesson,
  HubSection,
} from "@/lib/academy/hubCatalog";
import type { AcademyResourceRow } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { lessonCommunityTabLabel } from "@/lib/academy/lessonCommunityChannel";
import {
  courseDurationLabel,
  firstLessonInCourse,
  flattenSections,
  hubLessonCount,
  lessonContextInCourse,
  nextLessonInCourse,
  sectionContainsLesson,
  sectionDurationLabel,
  sectionLessonCount,
} from "@/lib/academy/hubCatalog";
import { LessonVideoHandoff } from "@/components/academy/LessonVideoHandoff";
import { LessonMediaPlayer } from "@/components/academy/LessonMediaPlayer";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { parseLessonVideoEmbed } from "@/lib/videoEmbed";

type Props = {
  data: HubCatalog;
  course: HubCourse;
  lesson: HubLesson;
  basePath: string;
  classroomHref: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  bodyMarkdown?: string;
  guideMarkdown?: string;
  transcriptText?: string | null;
  lessonResources?: AcademyResourceRow[];
  /** When true, treat the viewer as admin for Ask & Share / impersonation. */
  viewerIsAdmin?: boolean | null;
  /**
   * Where lesson content / visibility is stored in the DB. Simplified hubs use
   * derived course ids, so their rows live under the original programme id.
   */
  contentSource?: "course" | "classroom";
  /** Only set where an admin lesson editor wraps this player (adds Edit to the row menu). */
  canEditLessons?: boolean;
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
  /**
   * Minimal chrome: label for the back link above the course title.
   * Pass `null` to hide (e.g. Archive, which has no catalog above the player).
   */
  contentsBackLabel?: string | null;
};

/**
 * One lesson card: title → inset video → tabs/body.
 * Horizontal padding is shared so title, video, and overview/actions line up.
 * No `overflow-hidden` on the slab — that would become the sticky scroll
 * container and strand the actions rail.
 */
const LESSON_SLAB =
  "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60";
const LESSON_SLAB_GUTTER = "px-6 md:px-8";
const LESSON_SLAB_HEADER = `${LESSON_SLAB_GUTTER} pt-5 pb-4 md:pt-6 md:pb-5`;
/** Continues under the header when there is no video. */
const LESSON_SLAB_BODY = `${LESSON_SLAB_GUTTER} pb-6 md:pb-8`;
/** Tighter top so tabs sit closer under the video. */
const LESSON_SLAB_BODY_AFTER_VIDEO = `${LESSON_SLAB_GUTTER} pt-3.5 pb-6 md:pt-4 md:pb-8`;
const LESSON_SLAB_VIDEO = `${LESSON_SLAB_GUTTER}`;

function durationLabel(raw: string): string | null {
  const t = raw.trim().replace(/^\(|\)$/g, "").trim();
  return t || null;
}

function mapLessonsInCourse(
  course: HubCourse,
  mapLesson: (lesson: HubLesson) => HubLesson | null
): HubCourse {
  const mapSection = (section: HubSection): HubSection => ({
    ...section,
    lessons: section.lessons.flatMap((lesson) => {
      const next = mapLesson(lesson);
      if (!next) return [];
      if (!lesson.satellites?.length) return [next];
      return [
        {
          ...next,
          satellites: lesson.satellites.flatMap((sat) => {
            const mapped = mapLesson(sat);
            return mapped ? [mapped] : [];
          }),
        },
      ];
    }),
    sections: section.sections?.map(mapSection),
  });
  return {
    ...course,
    sections: course.sections.map(mapSection),
  };
}

function setLessonDraftInCourse(
  course: HubCourse,
  lessonId: string,
  draft: boolean
): HubCourse {
  return mapLessonsInCourse(course, (lesson) =>
    lesson.id === lessonId ? { ...lesson, draft } : lesson
  );
}

function removeLessonFromCourse(
  course: HubCourse,
  lessonId: string
): HubCourse {
  return mapLessonsInCourse(course, (lesson) =>
    lesson.id === lessonId ? null : lesson
  );
}

function collectAncestorSectionIds(
  sections: HubSection[],
  lessonId: string,
  ancestors: string[] = [],
): string[] | null {
  for (const section of sections) {
    for (const lesson of section.lessons) {
      if (lesson.id === lessonId) return [...ancestors, section.id];
      if (lesson.satellites?.some((s) => s.id === lessonId)) {
        return [...ancestors, section.id];
      }
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

function initialOpenSectionIds(course: HubCourse, activeLessonId: string): Set<string> {
  const path = collectAncestorSectionIds(course.sections, activeLessonId);
  if (path?.length) return new Set(path);
  const first = course.sections[0];
  return new Set(first ? [first.id] : []);
}

/** One section with only lessons — skip the redundant category accordion. */
function isFlatLessonListCourse(course: HubCourse): boolean {
  if (course.sections.length !== 1) return false;
  const only = course.sections[0];
  return !only.sections?.length && only.lessons.length > 0;
}

function CourseProgressSummary({
  course,
  className = "mt-3",
}: {
  course: HubCourse;
  className?: string;
}) {
  const { progress } = useLessonProgress();
  const total = hubLessonCount(course);
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

function CategoryDialForSection({ section }: { section: HubSection }) {
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

function LessonSidebarRow({
  lesson,
  active,
  minimal,
  href,
  viewerIsAdmin,
  contentCourseId,
  onEdit,
  onDraftChange,
  onDeleted,
}: {
  lesson: HubLesson;
  active: boolean;
  minimal: boolean;
  href: string;
  viewerIsAdmin: boolean;
  contentCourseId: string;
  onEdit?: () => void;
  onDraftChange: (draft: boolean) => void;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dur = durationLabel(lesson.duration);
  const isDraft = lesson.draft === true;
  const activeChrome = minimal ? false : active;
  // Raise the row while its menu is open so the dropdown clears sibling rows.
  const layer = menuOpen ? "z-30" : "z-0";
  // The menu floats over the end of the row, so it needs to fade out whatever
  // sits underneath it using the row's own background colour.
  const menuFade = minimal
    ? active
      ? "bg-gradient-to-l from-sky-100 via-sky-100 to-sky-100/0"
      : "bg-gradient-to-l from-slate-50 via-slate-50 to-slate-50/0"
    : active
      ? "bg-gradient-to-l from-sky-600 via-sky-600 to-sky-600/0"
      : "bg-gradient-to-l from-slate-50 via-slate-50 to-slate-50/0";

  return (
    <li className={minimal ? "" : "relative"}>
      <div
        className={
          minimal
            ? `group/lesson relative ${layer} flex min-w-0 items-center gap-2 py-2 text-sm transition before:pointer-events-none before:absolute before:-inset-x-2 before:inset-y-0 before:z-[-1] before:rounded-md before:content-[''] ${
                active
                  ? "text-[15px] font-medium text-slate-900 before:bg-sky-100"
                  : "font-normal text-slate-700 hover:before:bg-slate-50"
              }`
            : `group/lesson relative ${layer} flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                active
                  ? "bg-sky-600 font-medium text-white shadow-sm"
                  : "font-normal text-slate-700 hover:bg-slate-50"
              }`
        }
      >
        <LessonProgressSidebarControl
          lessonId={lesson.id}
          active={activeChrome}
          draft={isDraft}
        />
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate ${
              minimal ? "leading-normal" : "leading-snug"
            } ${
              isDraft
                ? activeChrome
                  ? "text-white/70"
                  : "text-slate-400"
                : ""
            }`}
          >
            {lesson.title}
          </span>
          {dur ? (
            <span
              className={`shrink-0 tabular-nums text-xs ${
                isDraft
                  ? activeChrome
                    ? "text-white/50"
                    : "text-slate-400"
                  : minimal
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
        {viewerIsAdmin ? (
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pl-8 transition-opacity ${menuFade} ${
              minimal ? "" : "rounded-r-lg pr-2"
            } ${
              menuOpen
                ? "opacity-100"
                : "opacity-0 group-hover/lesson:opacity-100 group-focus-within/lesson:opacity-100"
            }`}
          >
            <span
              className={
                menuOpen
                  ? "pointer-events-auto"
                  : "group-hover/lesson:pointer-events-auto group-focus-within/lesson:pointer-events-auto"
              }
            >
              <AdminLessonSidebarMenu
                contentCourseId={contentCourseId}
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                draft={isDraft}
                active={activeChrome}
                onOpenChange={setMenuOpen}
                onEdit={onEdit}
                onDraftChange={onDraftChange}
                onDeleted={onDeleted}
              />
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function ClassroomLessonPlayer({
  data,
  course: courseProp,
  lesson,
  basePath,
  classroomHref,
  videoUrl = null,
  audioUrl = null,
  bodyMarkdown = "",
  guideMarkdown = "",
  transcriptText = null,
  lessonResources = [],
  viewerIsAdmin = null,
  contentSource = "course",
  canEditLessons = false,
  headerActions,
  mainPanelOverride,
  contentsPosition = "right",
  chrome = "default",
  contentsBackLabel = "Classroom",
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [course, setCourse] = useState(courseProp);
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() =>
    initialOpenSectionIds(courseProp, lesson.id)
  );
  const [showVideoHandoff, setShowVideoHandoff] = useState(false);

  useEffect(() => {
    setCourse(courseProp);
  }, [courseProp]);

  useEffect(() => {
    setShowVideoHandoff(false);
  }, [lesson.id]);
  const resolveContentCourseId = (lessonId: string) =>
    contentSource === "classroom" ? contentSourceCourseId(lessonId) : course.id;

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
  const parentLesson = ctx?.parentLesson ?? null;
  const satelliteSiblings =
    parentLesson?.satellites ?? lesson.satellites ?? null;
  const noticeText = lesson.notice ?? data.lessonPanelNotice;
  const inApp = hasInAppLessonContent(
    videoUrl,
    bodyMarkdown,
    transcriptText,
    guideMarkdown,
    audioUrl
  );
  const videoEmbed = videoUrl ? parseLessonVideoEmbed(videoUrl) : null;
  const directVideoUrl =
    videoUrl && !videoEmbed && isDirectVideoFileUrl(videoUrl) ? videoUrl : null;
  const reportWatchProgress = useReportLessonWatchProgress(lesson.id);
  const nextLesson = useMemo(
    () =>
      nextLessonInCourse(course, lesson.id, {
        includeDrafts: Boolean(viewerIsAdmin),
      }),
    [course, lesson.id, viewerIsAdmin],
  );
  const nextLessonHref = nextLesson
    ? `${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(nextLesson.id)}`
    : null;
  const handoffActionCount = (lesson.recommendedActions ?? []).filter((a) =>
    a.text.trim(),
  ).length;
  const myActionsHref = pathname.startsWith("/admin")
    ? "/admin/signature/actions"
    : "/coach/signature/actions";
  const lessonCount = hubLessonCount(course);
  const contentsOnLeft = contentsPosition === "left";
  const minimal = chrome === "minimal";
  const currentLessonDraft =
    lessonContextInCourse(course, lesson.id)?.lesson.draft === true ||
    lesson.draft === true;

  function toggleSection(id: string) {
    setOpenSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderLessonRows(lessons: HubLesson[], indentClass: string) {
    return (
      <ul className={indentClass}>
        {lessons.map((l) => (
          <LessonSidebarRow
            key={l.id}
            lesson={l}
            active={
              l.id === lesson.id ||
              Boolean(l.satellites?.some((s) => s.id === lesson.id))
            }
            minimal={minimal}
            href={`${basePath}/${course.id}/${l.id}`}
            viewerIsAdmin={Boolean(viewerIsAdmin)}
            contentCourseId={resolveContentCourseId(l.id)}
            onEdit={
              canEditLessons
                ? () => {
                    router.push(
                      `${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(l.id)}?edit=1`
                    );
                  }
                : undefined
            }
            onDraftChange={(draft) => {
              setCourse((prev) => setLessonDraftInCourse(prev, l.id, draft));
              router.refresh();
            }}
            onDeleted={() => {
              const nextCourse = removeLessonFromCourse(course, l.id);
              setCourse(nextCourse);
              if (l.id === lesson.id) {
                const next = firstLessonInCourse(nextCourse);
                router.push(
                  next
                    ? `${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(next.id)}`
                    : basePath
                );
              } else {
                router.refresh();
              }
            }}
          />
        ))}
      </ul>
    );
  }

  function renderSatellitePlaylist(satellites: HubLesson[], heading: string) {
    return (
      <section className="mt-8 border-t border-slate-200/80 pt-6">
        <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Optional extras — watch if you need them.
        </p>
        <ul className="mt-4 space-y-2">
          {satellites.map((sat) => {
            const active = sat.id === lesson.id;
            const dur = durationLabel(sat.duration);
            return (
              <li key={sat.id}>
                <Link
                  href={`${basePath}/${course.id}/${sat.id}`}
                  className={`flex items-start gap-3 rounded-xl px-3 py-3 transition ${
                    active
                      ? "bg-sky-50 ring-1 ring-sky-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      active
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                    aria-hidden
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm leading-snug ${
                        active ? "font-semibold text-slate-900" : "font-medium text-slate-800"
                      }`}
                    >
                      {sat.title}
                    </span>
                    {sat.description?.trim() ? (
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                        {sat.description.trim()}
                      </span>
                    ) : null}
                  </span>
                  {dur ? (
                    <span className="shrink-0 pt-0.5 text-xs tabular-nums text-slate-400">
                      {dur}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  /** Tier label only (Core / Premium) — left-aligned, not an accordion. */
  function renderRuleSection(section: HubSection, depth: number) {
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

  function renderAccordionSection(section: HubSection, depth: number) {
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
            {(() => {
              const parts = splitSectionTitleEyebrow(section.title);
              return (
                <span className="min-w-0 flex-1 leading-snug">
                  {parts.eyebrow ? (
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {parts.eyebrow}
                    </span>
                  ) : null}
                  <span
                    className={`block ${
                      secOpen ? "whitespace-normal break-words" : "truncate"
                    }`}
                  >
                    {parts.title}
                  </span>
                </span>
              );
            })()}
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

  function renderSection(section: HubSection, depth: number) {
    if (section.presentation === "rule") {
      return renderRuleSection(section, depth);
    }
    return renderAccordionSection(section, depth);
  }

  const rolledUpCourseDuration = courseDurationLabel(course);
  const flatLessonList = isFlatLessonListCourse(course);

  const sectionList = flatLessonList ? (
    renderLessonRows(
      course.sections[0].lessons,
      minimal
        ? "mt-6 space-y-0.5 [overflow-anchor:none]"
        : "mt-5 max-h-[50vh] space-y-0.5 overflow-y-auto px-2 py-1 lg:max-h-[calc(100vh-12rem)]",
    )
  ) : (
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
          {contentsBackLabel ? (
            <Link
              href={basePath}
              className="mb-3 inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition hover:text-sky-700"
            >
              <ChevronLeft className="-ml-1 h-3.5 w-3.5 shrink-0" aria-hidden />
              {contentsBackLabel}
            </Link>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            {contentsBackLabel ? (
              <Link
                href={basePath}
                className="min-w-0 text-xl font-semibold leading-none tracking-tight text-slate-900 transition hover:text-sky-700"
              >
                {course.title}
              </Link>
            ) : (
              <h2 className="min-w-0 text-xl font-semibold leading-none tracking-tight text-slate-900">
                {course.title}
              </h2>
            )}
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
        <article className="min-w-0">
          <div className={LESSON_SLAB}>
            {currentLessonDraft && viewerIsAdmin ? (
              <div className="flex items-center gap-2 rounded-t-2xl border-b border-amber-200/80 bg-amber-50 px-6 py-2 md:px-8">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-300/80 bg-white text-amber-600"
                  aria-hidden
                >
                  <FilePenLine className="h-3 w-3" strokeWidth={2.25} />
                </span>
                <p className="text-xs font-medium text-amber-800">
                  Draft — visible to admins only
                </p>
              </div>
            ) : null}
            <header
              className={`${LESSON_SLAB_HEADER} flex items-start justify-between gap-3`}
            >
              <div className="min-w-0 flex-1">
                {!minimal && ctx && !flatLessonList ? (
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    {splitSectionTitleEyebrow(ctx.section.title).eyebrow ??
                      ctx.section.title}
                  </p>
                ) : null}
                <h2
                  className={
                    minimal
                      ? "text-xl font-semibold leading-snug tracking-tight text-slate-900 md:text-[26px]"
                      : "mt-1.5 text-base font-semibold text-slate-900 md:text-xl"
                  }
                >
                  {lesson.title}
                </h2>
                {parentLesson ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Extra for{" "}
                    <Link
                      href={`${basePath}/${course.id}/${parentLesson.id}`}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {parentLesson.title}
                    </Link>
                  </p>
                ) : null}
                {!inApp ? (
                  <p className="mt-2 text-sm text-slate-500">
                    {lesson.hasVideo
                      ? "Includes video on Disco"
                      : "Resource / non-video on Disco"}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <LessonProgressHeaderControl lessonId={lesson.id} />
                {headerActions ? headerActions : null}
              </div>
            </header>

            {inApp ? (
              <>
                {videoUrl || audioUrl?.trim() ? (
                  <div className={LESSON_SLAB_VIDEO}>
                    <LessonMediaPlayer
                      courseId={resolveContentCourseId(lesson.id)}
                      lessonId={lesson.id}
                      title={lesson.title}
                      videoUrl={videoUrl}
                      audioUrl={audioUrl}
                      onWatchProgress={reportWatchProgress}
                      onEnded={() => setShowVideoHandoff(true)}
                      handoff={
                        showVideoHandoff &&
                        (videoEmbed?.kind === "youtube" || directVideoUrl) ? (
                          <LessonVideoHandoff
                            nextLessonTitle={nextLesson?.title ?? null}
                            nextLessonHref={nextLessonHref}
                            actionCount={handoffActionCount}
                            myActionsHref={myActionsHref}
                            onStay={() => setShowVideoHandoff(false)}
                            onContinue={() => {
                              if (!nextLessonHref) {
                                setShowVideoHandoff(false);
                                return;
                              }
                              setShowVideoHandoff(false);
                              router.push(nextLessonHref);
                            }}
                          />
                        ) : null
                      }
                    />
                  </div>
                ) : null}

                <div
                  className={
                    videoUrl || audioUrl?.trim()
                      ? LESSON_SLAB_BODY_AFTER_VIDEO
                      : LESSON_SLAB_BODY
                  }
                >
                  <LessonPlayerTabs
                    flush
                    overview={
                      <LessonOverviewPanel
                        courseId={course.id}
                        lessonId={lesson.id}
                        bodyMarkdown={bodyMarkdown}
                        hasGuide={Boolean(guideMarkdown.trim())}
                        recommendedActions={lesson.recommendedActions ?? []}
                        resources={lessonResources}
                        readOnlyActions={Boolean(viewerIsAdmin)}
                      />
                    }
                    showGuide={Boolean(guideMarkdown.trim())}
                    guide={
                      guideMarkdown.trim() ? (
                        <LessonGuidePanel
                          guideMarkdown={guideMarkdown}
                          lessonId={lesson.id}
                        />
                      ) : null
                    }
                    showRelated={Boolean(satelliteSiblings?.length)}
                    related={
                      satelliteSiblings?.length
                        ? renderSatellitePlaylist(
                            satelliteSiblings,
                            parentLesson
                              ? "More in this lesson"
                              : "Related lessons",
                          )
                        : null
                    }
                    qa={
                      <LessonQaPanel
                        courseId={
                          contentSource === "classroom"
                            ? contentSourceCourseId(lesson.id)
                            : course.id
                        }
                        lessonId={lesson.id}
                        lessonPath={pathname}
                        viewerIsAdmin={viewerIsAdmin}
                      />
                    }
                    qaLabel={lessonCommunityTabLabel(lesson.id)}
                    showTranscript={Boolean(transcriptText?.trim())}
                    transcript={
                      transcriptText?.trim() ? (
                        <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-sans text-sm leading-relaxed text-slate-700">
                          {transcriptText.trim()}
                        </pre>
                      ) : null
                    }
                  />
                </div>
              </>
            ) : (
              <div className={LESSON_SLAB_BODY}>
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

                <LessonPlayerTabs
                  overview={
                    <LessonOverviewPanel
                      courseId={course.id}
                      lessonId={lesson.id}
                      bodyMarkdown=""
                      recommendedActions={lesson.recommendedActions ?? []}
                      resources={lessonResources}
                      readOnlyActions={Boolean(viewerIsAdmin)}
                      emptyOverview={
                        <p className="text-sm text-slate-500">
                          Open this lesson on Disco for the full content, or ask
                          a question below.
                        </p>
                      }
                    />
                  }
                  showRelated={Boolean(satelliteSiblings?.length)}
                  related={
                    satelliteSiblings?.length
                      ? renderSatellitePlaylist(
                          satelliteSiblings,
                          parentLesson
                            ? "More in this lesson"
                            : "Related lessons",
                        )
                      : null
                  }
                  qa={
                    <LessonQaPanel
                      courseId={
                        contentSource === "classroom"
                          ? contentSourceCourseId(lesson.id)
                          : course.id
                      }
                      lessonId={lesson.id}
                      lessonPath={pathname}
                      viewerIsAdmin={viewerIsAdmin}
                    />
                  }
                  qaLabel={lessonCommunityTabLabel(lesson.id)}
                />
              </div>
            )}
          </div>
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
