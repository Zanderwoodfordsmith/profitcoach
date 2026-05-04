import Link from "next/link";

import type { AcademyCategory, AcademyCourse, AcademyLesson } from "@/lib/academy/types";
import { getSignaturePillarTitleById } from "@/lib/signatureModelV2";
import { toYouTubeEmbedUrl } from "@/lib/videoEmbed";

import { AcademyMarkdown } from "./AcademyMarkdown";

type Props = {
  category: AcademyCategory;
  course: AcademyCourse;
  lesson: AcademyLesson;
  /** e.g. `/coach/academy/classroom` — used for sidebar and “all courses” links */
  basePath: string;
};

export function ClassroomLessonPlayer({ category, course, lesson, basePath }: Props) {
  const lessons = course.lessons ?? [];
  const embedUrl = lesson.videoUrl ? toYouTubeEmbedUrl(lesson.videoUrl) : null;
  const pillarEyebrow =
    getSignaturePillarTitleById(course.compassPillarId) ?? category.title;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col-reverse gap-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 lg:w-80">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            href={basePath}
            className="text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            ← All courses
          </Link>
          <p className="mt-3 text-[10px] font-light uppercase tracking-[0.28em] text-slate-500">
            {pillarEyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{course.title}</h2>

          <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
            {lessons.map((l) => {
              const active = l.id === lesson.id;
              return (
                <li key={l.id}>
                  <Link
                    href={`${basePath}/${course.id}/${l.id}`}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-amber-100 font-medium text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="shrink-0" aria-hidden>
                      {l.emoji ?? "▸"}
                    </span>
                    <span className="min-w-0 leading-snug">{l.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <header className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {lesson.emoji ? `${lesson.emoji} ` : ""}
              {lesson.title}
            </h1>
          </header>

          {lesson.videoUrl ? (
            <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
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
              ) : (
                <div className="p-6 text-sm text-slate-300">
                  <p>Video URL is set but is not a recognized YouTube or Vimeo link.</p>
                  <a
                    href={lesson.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sky-400 underline"
                  >
                    Open video
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-8 flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
              No video for this lesson yet. Add a URL in the catalog when you are ready.
            </div>
          )}

          {lesson.bodyMarkdown ? (
            <AcademyMarkdown markdown={lesson.bodyMarkdown} />
          ) : (
            <p className="text-sm text-slate-500">No written content for this lesson yet.</p>
          )}
        </article>
      </div>
    </div>
  );
}
