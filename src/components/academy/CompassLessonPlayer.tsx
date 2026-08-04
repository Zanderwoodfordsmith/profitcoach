"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { AcademyCategory, AcademyCourse, AcademyLesson } from "@/lib/academy/types";
import { lessonCommunityTabLabel } from "@/lib/academy/lessonCommunityChannel";
import { nextLessonInSequence } from "@/lib/academy/hubCatalog";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { getSignaturePillarTitleById } from "@/lib/signatureModelV2";
import { parseLessonVideoEmbed } from "@/lib/videoEmbed";

import { LessonGuidePanel } from "./LessonGuidePanel";
import { LessonOverviewPanel } from "./LessonOverviewPanel";
import { LessonPageEyebrow } from "./LessonPageEyebrow";
import { LessonPlayerTabs } from "./LessonPlayerTabs";
import { LessonQaPanel } from "./LessonQaPanel";
import { LessonVideoHandoff } from "./LessonVideoHandoff";
import { LessonMediaPlayer } from "./LessonMediaPlayer";
import {
  LessonProgressHeaderControl,
  LessonProgressSidebarControl,
  useReportLessonWatchProgress,
} from "./LessonProgressControls";

type Props = {
  category: AcademyCategory;
  course: AcademyCourse;
  lesson: AcademyLesson;
  /** e.g. `/coach/academy/compass` — used for sidebar and “all courses” links */
  basePath: string;
  viewerIsAdmin?: boolean | null;
};

export function CompassLessonPlayer({
  category,
  course,
  lesson,
  basePath,
  viewerIsAdmin = null,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const lessons = course.lessons ?? [];
  const videoEmbed = lesson.videoUrl ? parseLessonVideoEmbed(lesson.videoUrl) : null;
  const directVideoUrl =
    lesson.videoUrl && !videoEmbed && isDirectVideoFileUrl(lesson.videoUrl)
      ? lesson.videoUrl
      : null;
  const reportWatchProgress = useReportLessonWatchProgress(lesson.id);
  const [showVideoHandoff, setShowVideoHandoff] = useState(false);

  useEffect(() => {
    setShowVideoHandoff(false);
  }, [lesson.id]);

  const nextLesson = useMemo(
    () =>
      nextLessonInSequence(lessons, lesson.id, {
        includeDrafts: Boolean(viewerIsAdmin),
      }),
    [lessons, lesson.id, viewerIsAdmin],
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
  const pillarEyebrow =
    getSignaturePillarTitleById(course.compassPillarId) ?? category.title;
  const programsPath = basePath.replace(/\/classroom\/?$/, "/programs");
  const overviewMarkdown = lesson.bodyMarkdown ?? "";
  const guideMarkdown = lesson.guideMarkdown ?? "";
  const transcriptText = lesson.transcriptText ?? null;

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
            <header className="mb-6 flex items-start justify-between gap-3 border-b border-slate-100 pb-5">
              <h2 className="min-w-0 flex-1 text-base font-semibold text-slate-900 md:text-xl">
                {lesson.emoji ? `${lesson.emoji} ` : ""}
                {lesson.title}
              </h2>
              <div className="shrink-0">
                <LessonProgressHeaderControl lessonId={lesson.id} />
              </div>
            </header>

            {lesson.videoUrl || lesson.audioUrl?.trim() ? (
              <div className="overflow-hidden rounded-2xl shadow-md">
                <LessonMediaPlayer
                  courseId={course.id}
                  lessonId={lesson.id}
                  title={lesson.title}
                  videoUrl={lesson.videoUrl}
                  audioUrl={lesson.audioUrl}
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
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                No media for this lesson yet.
              </div>
            )}
            <LessonPlayerTabs
              overview={
                <LessonOverviewPanel
                  courseId={course.id}
                  lessonId={lesson.id}
                  bodyMarkdown={overviewMarkdown}
                  hasGuide={Boolean(guideMarkdown.trim())}
                  recommendedActions={lesson.recommendedActions ?? []}
                  readOnlyActions={Boolean(viewerIsAdmin)}
                />
              }
              showGuide={Boolean(guideMarkdown.trim())}
              guide={
                guideMarkdown.trim() ? (
                  <LessonGuidePanel guideMarkdown={guideMarkdown} />
                ) : null
              }
              qa={
                <LessonQaPanel
                  courseId={course.id}
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
                    <div
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition ${
                        active
                          ? "bg-sky-600 font-medium text-white shadow-sm"
                          : "text-slate-700 hover:bg-white/80"
                      }`}
                    >
                      <LessonProgressSidebarControl lessonId={l.id} active={active} />
                      <Link
                        href={`${basePath}/${course.id}/${l.id}`}
                        className="min-w-0 flex-1 leading-snug"
                      >
                        {l.title}
                      </Link>
                    </div>
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
