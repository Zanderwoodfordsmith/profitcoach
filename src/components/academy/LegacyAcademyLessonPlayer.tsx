"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Video } from "lucide-react";

import type {
  LegacyHubCatalog,
  LegacyHubCourse,
  LegacyHubLesson,
} from "@/lib/academy/legacyHubCatalog";
import { lessonContextInCourse } from "@/lib/academy/legacyHubCatalog";

type Props = {
  data: LegacyHubCatalog;
  course: LegacyHubCourse;
  lesson: LegacyHubLesson;
  basePath: string;
  classroomHref: string;
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
}: Props) {
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() =>
    initialOpenSectionIds(course, lesson.id),
  );

  useEffect(() => {
    const sec = course.sections.find((s) => s.lessons.some((l) => l.id === lesson.id));
    if (sec) {
      setOpenSectionIds((prev) => new Set(prev).add(sec.id));
    }
  }, [course.sections, lesson.id]);

  const ctx = useMemo(
    () => lessonContextInCourse(course, lesson.id),
    [course, lesson.id],
  );
  const noticeText = lesson.notice ?? data.lessonPanelNotice;

  function toggleSection(id: string) {
    setOpenSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col-reverse gap-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 lg:w-80">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            href={basePath}
            className="text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            ← All programmes
          </Link>
          <Link
            href={classroomHref}
            className="mt-2 block text-xs font-medium text-slate-500 hover:text-sky-800"
          >
            ← Classroom
          </Link>
          <p className="mt-3 text-[10px] font-light uppercase tracking-[0.28em] text-slate-500">
            Business Coach Academy
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{course.title}</h2>

          <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
            {course.sections.map((section) => {
              const secOpen = openSectionIds.has(section.id);
              return (
                <li key={section.id} className="rounded-lg border border-slate-100 bg-slate-50/80">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-900 transition hover:bg-white/90"
                    aria-expanded={secOpen}
                  >
                    <span className="min-w-0 leading-snug">{section.title}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        secOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  {secOpen && (
                    <ul className="border-t border-slate-100 px-2 py-1">
                      {section.lessons.map((l) => {
                        const active = l.id === lesson.id;
                        const dur = durationLabel(l.duration);
                        return (
                          <li key={l.id}>
                            <Link
                              href={`${basePath}/${course.id}/${l.id}`}
                              className={`flex items-start gap-2 rounded-lg px-2 py-2.5 text-sm transition ${
                                active
                                  ? "bg-amber-100 font-medium text-slate-900"
                                  : "font-normal text-slate-700 hover:bg-white"
                              }`}
                            >
                              <span
                                className="mt-0.5 shrink-0 text-slate-400"
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
                                <span className="shrink-0 tabular-nums text-xs text-slate-500">
                                  {dur}
                                </span>
                              ) : null}
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

      <div className="min-w-0 flex-1">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <header className="mb-6 border-b border-slate-100 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {ctx ? `${course.title} · ${ctx.section.title}` : course.title}
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
              {lesson.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {lesson.hasVideo ? "Includes video on Disco" : "Resource / non-video on Disco"}
            </p>
          </header>

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
        </article>
      </div>
    </div>
  );
}
