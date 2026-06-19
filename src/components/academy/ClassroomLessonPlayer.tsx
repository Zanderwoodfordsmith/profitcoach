import Link from "next/link";

import type { AcademyCategory, AcademyCourse, AcademyLesson } from "@/lib/academy/types";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { getSignaturePillarTitleById } from "@/lib/signatureModelV2";
import { toYouTubeEmbedUrl } from "@/lib/videoEmbed";

import { AcademyMarkdown } from "./AcademyMarkdown";
import { LessonPageEyebrow } from "./LessonPageEyebrow";
import {
  LessonProgressHeaderControl,
  LessonProgressSidebarControl,
} from "./LessonProgressControls";

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
  const directVideoUrl =
    lesson.videoUrl && !embedUrl && isDirectVideoFileUrl(lesson.videoUrl)
      ? lesson.videoUrl
      : null;
  const pillarEyebrow =
    getSignaturePillarTitleById(course.compassPillarId) ?? category.title;
  const programsPath = basePath.replace(/\/classroom\/?$/, "/programs");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <LessonPageEyebrow
          crumbs={[
            { label: "All programmes", href: programsPath },
            { label: "Classroom", href: basePath },
            { label: course.title },
          ]}
        />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          {course.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{pillarEyebrow}</p>
      </header>

      <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 md:p-8">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
              <h2 className="min-w-0 text-xl font-semibold text-slate-900 md:text-2xl">
                {lesson.emoji ? `${lesson.emoji} ` : ""}
                {lesson.title}
              </h2>
              <LessonProgressHeaderControl lessonId={lesson.id} />
            </header>

            {lesson.videoUrl ? (
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
              <div className="mb-8 flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                No video for this lesson yet.
              </div>
            )}

            {lesson.bodyMarkdown ? (
              <AcademyMarkdown markdown={lesson.bodyMarkdown} />
            ) : (
              <p className="text-sm text-slate-500">No written content for this lesson yet.</p>
            )}
          </article>
        </div>

        <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-96 lg:self-start">
          <div className="rounded-2xl bg-slate-100/80 p-5 ring-1 ring-slate-200/70">
            <p className="text-sm font-semibold text-slate-900">Course contents</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
            </p>

            <ul className="mt-5 max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
              {lessons.map((l) => {
                const active = l.id === lesson.id;
                return (
                  <li key={l.id}>
                    <Link
                      href={`${basePath}/${course.id}/${l.id}`}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition ${
                        active
                          ? "bg-sky-600 font-medium text-white shadow-sm"
                          : "text-slate-700 hover:bg-white/80"
                      }`}
                    >
                      <span className="shrink-0" aria-hidden>
                        {l.emoji ?? "▸"}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{l.title}</span>
                      <LessonProgressSidebarControl lessonId={l.id} align="right" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
