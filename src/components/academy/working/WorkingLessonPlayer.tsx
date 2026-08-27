"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check, ChevronLeft } from "lucide-react";

import { CoreClientWorkingStage } from "@/components/academy/working/CoreClientWorkingStage";
import { WorkingLessonIntro } from "@/components/academy/working/WorkingLessonIntro";
import { WorkingLessonSketchStage } from "@/components/academy/working/WorkingLessonSketchStage";
import { useWorkingLessonProgress } from "@/components/academy/working/useWorkingLessonProgress";
import { LessonGuidePanel } from "@/components/academy/LessonGuidePanel";
import { LessonPlayerTabs } from "@/components/academy/LessonPlayerTabs";
import { LessonQaPanel } from "@/components/academy/LessonQaPanel";
import {
  WORKING_COURSE,
  WORKING_LESSONS,
  type WorkingLessonDef,
  type WorkingLessonId,
} from "@/lib/academy/workingLessons";

const BASE = "/admin/academy/classroom/working";

const LESSON_SLAB = "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60";
const LESSON_SLAB_GUTTER = "px-6 md:px-8";
const LESSON_SLAB_HEADER = `${LESSON_SLAB_GUTTER} pt-5 pb-4 md:pt-6 md:pb-5`;
const LESSON_SLAB_STAGE = LESSON_SLAB_GUTTER;
const LESSON_SLAB_BODY_AFTER = `${LESSON_SLAB_GUTTER} pt-3.5 pb-6 md:pt-4 md:pb-8`;

function ProgressTick({
  done,
  onToggle,
  label,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      aria-label={done ? `Mark ${label} as not done` : `Mark ${label} as done`}
      aria-pressed={done}
      className={
        done
          ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white shadow-sm hover:border-emerald-700 hover:bg-emerald-700"
          : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300/90 bg-transparent text-slate-300 hover:border-slate-400 hover:text-slate-400"
      }
    >
      <Check className="h-3 w-3" strokeWidth={done ? 3 : 2.5} aria-hidden />
    </button>
  );
}

function CourseProgressSummary({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const labelOutside = pct < 10;

  return (
    <div className="relative mt-[11px] h-6 rounded-full bg-slate-200">
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

export function WorkingLessonPlayer({ lesson }: { lesson: WorkingLessonDef }) {
  const { isDone, setDone, completedCount } = useWorkingLessonProgress();
  const locked = isDone(lesson.id);

  const communityCourseId = "get-calls";
  const communityLessonId = lesson.classroomLessonId ?? lesson.id;

  const stage = useMemo(() => {
    if (lesson.id === "core-client") {
      return (
        <CoreClientWorkingStage
          locked={locked}
          onLock={() => setDone("core-client", true)}
        />
      );
    }
    return (
      <WorkingLessonSketchStage
        lessonId={lesson.id as Exclude<WorkingLessonId, "core-client">}
        locked={locked}
        onLock={() => setDone(lesson.id, true)}
      />
    );
  }, [lesson.id, locked, setDone]);

  return (
    <div className="flex flex-col gap-5 pt-[15px]">
      <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <aside className="w-full shrink-0 lg:w-[22.5rem] lg:self-start">
          <div>
            <Link
              href="/admin/academy/classroom"
              className="mb-3 inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition hover:text-sky-700"
            >
              <ChevronLeft className="-ml-1 h-3.5 w-3.5 shrink-0" aria-hidden />
              Classroom
            </Link>
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`${BASE}/${WORKING_LESSONS[0].id}`}
                className="min-w-0 text-xl font-semibold leading-none tracking-tight text-slate-900 transition hover:text-sky-700"
              >
                {WORKING_COURSE.title}
              </Link>
              <span className="shrink-0 text-xs font-medium text-slate-400">
                Working
              </span>
            </div>
            <CourseProgressSummary
              completed={completedCount}
              total={WORKING_LESSONS.length}
            />
            <ul className="mt-6 space-y-0.5 [overflow-anchor:none]">
              {WORKING_LESSONS.map((item) => {
                const active = item.id === lesson.id;
                const done = isDone(item.id);
                return (
                  <li key={item.id}>
                    <div
                      className={`group/lesson relative z-0 flex min-w-0 items-center gap-2 py-2 text-sm transition before:pointer-events-none before:absolute before:-inset-x-2 before:inset-y-0 before:z-[-1] before:rounded-md before:content-[''] ${
                        active
                          ? "text-[15px] font-medium text-sky-950 before:bg-sky-100"
                          : "font-normal text-slate-700 hover:before:bg-slate-50"
                      }`}
                    >
                      <ProgressTick
                        done={done}
                        label={item.title}
                        onToggle={() => setDone(item.id, !done)}
                      />
                      <Link
                        href={`${BASE}/${item.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <span className="min-w-0 flex-1 truncate leading-normal">
                          {item.title}
                        </span>
                        <span
                          className={`shrink-0 text-xs ${
                            active ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          Working
                        </span>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <article className="min-w-0">
            <div className={LESSON_SLAB}>
              <header
                className={`${LESSON_SLAB_HEADER} flex items-start justify-between gap-3`}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold leading-snug tracking-tight text-slate-900 md:text-[26px]">
                    {lesson.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className={
                    locked
                      ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white shadow-sm hover:border-emerald-700 hover:bg-emerald-700"
                      : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300/90 bg-transparent text-slate-300 hover:border-slate-400 hover:text-slate-400"
                  }
                  aria-label={
                    locked ? "Mark lesson as not done" : "Mark lesson as done"
                  }
                  aria-pressed={locked}
                  onClick={() => setDone(lesson.id, !locked)}
                >
                  <Check className="h-4 w-4" strokeWidth={locked ? 3 : 2.5} aria-hidden />
                </button>
              </header>

              <div className={`${LESSON_SLAB_STAGE} space-y-3`}>
                <WorkingLessonIntro
                  title={lesson.introTitle}
                  body={lesson.introBody}
                  seconds={lesson.introSeconds}
                />
                {stage}
              </div>

              <div className={LESSON_SLAB_BODY_AFTER}>
                <LessonPlayerTabs
                  flush
                  overview={
                    <div className="max-w-prose space-y-3 text-[15px] leading-relaxed text-slate-700">
                      {lesson.overviewMarkdown.split("\n\n").map((para) => (
                        <p key={para}>{para}</p>
                      ))}
                    </div>
                  }
                  showGuide
                  guide={
                    <LessonGuidePanel
                      guideMarkdown={lesson.guideMarkdown}
                      lessonId={lesson.id}
                    />
                  }
                  qa={
                    <LessonQaPanel
                      courseId={communityCourseId}
                      lessonId={communityLessonId}
                      lessonPath={`${BASE}/${lesson.id}`}
                      viewerIsAdmin
                    />
                  }
                />
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
