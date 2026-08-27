"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  chapterHasStepContent,
  isSalesNavBaseSearchChapter,
  type LessonVideoChapter,
} from "@/lib/academy/lessonVideoChapters";
import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { parseLessonVideoEmbed } from "@/lib/videoEmbed";

import { AcademyMarkdown } from "./AcademyMarkdown";
import { LessonBaseSearchCta } from "./LessonBaseSearchCta";

type Props = {
  chapters: LessonVideoChapter[];
  initialChapterId?: string | null;
};

function StepVideo({ videoUrl }: { videoUrl: string }) {
  const embed = parseLessonVideoEmbed(videoUrl);
  const directUrl =
    !embed && isDirectVideoFileUrl(videoUrl) ? videoUrl : null;

  if (embed?.kind === "youtube" || embed?.kind === "vimeo") {
    return (
      <div className="relative mb-5 aspect-video w-full overflow-hidden rounded-xl bg-slate-950">
        <iframe
          title="Step video"
          src={embed.embedUrl}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (directUrl) {
    return (
      <video
        src={directUrl}
        controls
        playsInline
        className="mb-5 aspect-video w-full rounded-xl bg-black"
      />
    );
  }

  return null;
}

export function LessonChapterGuidesPanel({ chapters, initialChapterId = null }: Props) {
  const chaptersWithGuides = useMemo(
    () => chapters.filter(chapterHasStepContent),
    [chapters]
  );

  const defaultOpenId = useMemo(() => {
    if (initialChapterId) {
      const match = chaptersWithGuides.find((chapter) => chapter.id === initialChapterId);
      if (match) return match.id;
    }
    if (chaptersWithGuides.length === 1) {
      return chaptersWithGuides[0]?.id ?? null;
    }
    return null;
  }, [chaptersWithGuides, initialChapterId]);

  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    defaultOpenId ? new Set([defaultOpenId]) : new Set()
  );

  useEffect(() => {
    setOpenIds(defaultOpenId ? new Set([defaultOpenId]) : new Set());
  }, [defaultOpenId, chaptersWithGuides]);

  if (chaptersWithGuides.length === 0) return null;

  function toggleChapter(chapterId: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {chaptersWithGuides.map((chapter) => {
        const open = openIds.has(chapter.id);
        const contentLessonId = chapter.sourceLessonId?.trim() || null;
        const baseSearchOnly = isSalesNavBaseSearchChapter(chapter);
        const guideMarkdown = chapter.guideMarkdown?.trim() || "";
        const bodyMarkdown = chapter.bodyMarkdown?.trim() || "";
        const videoUrl = chapter.videoUrl?.trim() || "";

        return (
          <section
            key={chapter.id}
            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white"
          >
            <button
              type="button"
              onClick={() => toggleChapter(chapter.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-slate-900">
                  {chapter.title}
                </span>
                {chapter.optional ? (
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">
                    Optional — skip if you want to keep coaching low-profile
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
            {open ? (
              <div className="border-t border-slate-100 px-4 pb-5 pt-4">
                {contentLessonId ? (
                  <LessonBaseSearchCta lessonId={contentLessonId} />
                ) : null}
                {videoUrl ? <StepVideo videoUrl={videoUrl} /> : null}
                {!baseSearchOnly && guideMarkdown ? (
                  <AcademyMarkdown markdown={guideMarkdown} variant="guide" />
                ) : null}
                {!baseSearchOnly && !guideMarkdown && bodyMarkdown ? (
                  <AcademyMarkdown markdown={bodyMarkdown} variant="guide" />
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
