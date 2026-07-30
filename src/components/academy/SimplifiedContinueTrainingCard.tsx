"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SimplifiedCardCta } from "@/components/academy/SimplifiedCardCta";
import type { LessonProgressMap } from "@/lib/academy/lessonProgressTypes";
import { supabaseClient } from "@/lib/supabaseClient";

type CourseLesson = {
  id: string;
  title: string;
};

type CourseQueue = {
  id: string;
  title: string;
  lessons: CourseLesson[];
};

type Props = {
  basePath: string;
  courses: CourseQueue[];
  coverImageUrl?: string;
};

type ResumeState = {
  href: string;
  nextLesson: string;
  courseTitle: string;
  caughtUp: boolean;
};

function firstHref(basePath: string, courseId: string, lessonId: string) {
  return `${basePath}/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

export function SimplifiedContinueTrainingCard({
  basePath,
  courses,
  coverImageUrl = "/academy/simplified/continue-training.jpg",
}: Props) {
  const fallback = useMemo<ResumeState>(() => {
    const firstCourse = courses[0];
    const firstLesson = firstCourse?.lessons[0];
    return {
      href:
        firstCourse && firstLesson
          ? firstHref(basePath, firstCourse.id, firstLesson.id)
          : basePath,
      nextLesson: firstLesson?.title ?? "Start your next lesson",
      courseTitle: firstCourse?.title ?? "Classroom",
      caughtUp: false,
    };
  }, [basePath, courses]);

  const [resumeState, setResumeState] = useState<ResumeState>(fallback);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token || cancelled) return;

      const progressEntries = await Promise.all(
        courses.map(async (course) => {
          const response = await fetch(
            `/api/coach/academy/lesson-progress/${encodeURIComponent(course.id)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const body = (await response.json().catch(() => ({}))) as {
            progress?: LessonProgressMap;
          };
          return [course.id, body.progress ?? {}] as const;
        }),
      );

      if (cancelled) return;

      const progressByCourse = new Map(progressEntries);

      for (const course of courses) {
        const progress = progressByCourse.get(course.id) ?? {};
        for (const lesson of course.lessons) {
          if (progress[lesson.id] === "completed") continue;

          setResumeState({
            href: firstHref(basePath, course.id, lesson.id),
            nextLesson: lesson.title,
            courseTitle: course.title,
            caughtUp: false,
          });
          return;
        }
      }

      setResumeState({
        href: fallback.href,
        nextLesson: "You’re all caught up",
        courseTitle: "Main paths",
        caughtUp: true,
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [basePath, courses, fallback.href]);

  return (
    <Link
      href={resumeState.href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.22),0_8px_18px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#0c5290]">
          Resume Training
        </p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-900">
          Continue Where You Left Off
        </h2>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {resumeState.caughtUp
            ? "Everything in the main simplified path is marked complete."
            : `Next up: ${resumeState.nextLesson} (${resumeState.courseTitle}).`}
        </p>
        <div className="mt-auto pt-4">
          <SimplifiedCardCta>
            {resumeState.caughtUp ? "Review paths" : "Continue"}
          </SimplifiedCardCta>
        </div>
      </div>
    </Link>
  );
}
