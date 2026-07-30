"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SimplifiedCardProgress } from "@/components/academy/SimplifiedCardProgress";
import type { LessonProgressMap } from "@/lib/academy/lessonProgressTypes";
import { supabaseClient } from "@/lib/supabaseClient";

type LessonSummary = {
  id: string;
};

type Props = {
  href: string;
  courseId: string;
  eyebrow: string;
  eyebrowClassName?: string;
  title: string;
  description: string;
  accentClassName: string;
  coverImageUrl?: string;
  lessons: LessonSummary[];
};

export function SimplifiedCourseOverviewCard({
  href,
  courseId,
  eyebrow,
  eyebrowClassName = "text-sky-700",
  title,
  description,
  accentClassName,
  coverImageUrl,
  lessons,
}: Props) {
  const totalLessons = lessons.length;
  const [progressLabel, setProgressLabel] = useState(
    totalLessons ? `${totalLessons} lessons` : "Open this path",
  );
  const [progressValue, setProgressValue] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token;
      if (!token || !totalLessons || cancelled) return;

      const response = await fetch(
        `/api/coach/academy/lesson-progress/${encodeURIComponent(courseId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = (await response.json().catch(() => ({}))) as { progress?: LessonProgressMap };
      if (cancelled) return;

      const progress = body.progress ?? {};
      const completed = lessons.reduce(
        (count, lesson) => count + (progress[lesson.id] === "completed" ? 1 : 0),
        0,
      );
      setProgressLabel(`${completed} of ${totalLessons} complete`);
      setProgressValue(Math.round((completed / totalLessons) * 100));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessons, totalLessons]);

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.22),0_8px_18px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div
        className={`relative aspect-[16/9] overflow-hidden ${
          coverImageUrl ? "bg-slate-200" : accentClassName
        }`}
      >
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 12% 20%, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at 88% 70%, rgba(255,255,255,0.18), transparent 45%)",
            }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {eyebrow.trim() ? (
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${eyebrowClassName}`}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {description || " "}
        </p>
        <div className="mt-auto pt-4">
          <SimplifiedCardProgress value={progressValue} label={progressLabel} />
        </div>
      </div>
    </Link>
  );
}
