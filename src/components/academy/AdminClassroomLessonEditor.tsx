"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";

import { LessonContentEditForm } from "@/components/academy/LessonContentEditForm";
import { ClassroomLessonPlayer } from "@/components/academy/ClassroomLessonPlayer";
import { UnsavedChangesDialog } from "@/components/academy/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type {
  HubCatalog,
  HubCourse,
  HubLesson,
} from "@/lib/academy/hubCatalog";
import { isLessonEditDirty } from "@/lib/academy/lessonEditDirty";
import type { AcademyResourceRow } from "@/lib/academy/resources";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import type { LessonVideoChapter } from "@/lib/academy/lessonVideoChapters";
import { supabaseClient } from "@/lib/supabaseClient";

const FORM_ID = "legacy-lesson-edit-form";
const SHELL_TARGET = "__shell__";

type Props = {
  data: HubCatalog;
  course: HubCourse;
  lesson: HubLesson;
  initialVideoUrl?: string | null;
  initialAudioUrl?: string | null;
  initialBodyMarkdown?: string;
  initialGuideMarkdown?: string;
  basePath: string;
  classroomHref: string;
  lessonResources?: AcademyResourceRow[];
  contentsPosition?: "left" | "right";
  chrome?: "default" | "minimal";
  /** Which hub JSON the course comes from — picks the save route. */
  hub?: "archive" | "classroom";
  /** Minimal chrome back link; `null` hides it. */
  contentsBackLabel?: string | null;
  /** Open a consolidated step when Edit starts (`?chapter=`). */
  initialChapterId?: string | null;
};

type ChapterDraft = {
  title: string;
  bodyMarkdown: string;
  guideMarkdown: string;
};

function chapterDraftFrom(chapter: LessonVideoChapter): ChapterDraft {
  return {
    title: chapter.title,
    bodyMarkdown: chapter.bodyMarkdown ?? "",
    guideMarkdown: chapter.guideMarkdown ?? "",
  };
}

export function AdminClassroomLessonEditor({
  data,
  course: initialCourse,
  lesson: initialLesson,
  initialVideoUrl = null,
  initialAudioUrl = null,
  initialBodyMarkdown = "",
  initialGuideMarkdown = "",
  basePath,
  classroomHref,
  lessonResources = [],
  contentsPosition,
  chrome,
  hub = "archive",
  contentsBackLabel,
  initialChapterId = null,
}: Props) {
  const [course, setCourse] = useState(initialCourse);
  const [lesson, setLesson] = useState(initialLesson);
  const [savedVideoUrl, setSavedVideoUrl] = useState(initialVideoUrl ?? "");
  const [savedAudioUrl, setSavedAudioUrl] = useState(initialAudioUrl ?? "");
  const [savedBodyMarkdown, setSavedBodyMarkdown] = useState(
    initialBodyMarkdown ?? ""
  );
  const [savedGuideMarkdown, setSavedGuideMarkdown] = useState(
    initialGuideMarkdown ?? ""
  );
  const [savedRecommendedActions, setSavedRecommendedActions] = useState(
    initialLesson.recommendedActions ?? []
  );
  const [savedTitle, setSavedTitle] = useState(initialLesson.title);
  const [savedDuration, setSavedDuration] = useState(
    initialLesson.duration ?? ""
  );
  const [title, setTitle] = useState(initialLesson.title);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? "");
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl ?? "");
  const [duration, setDuration] = useState(initialLesson.duration ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(initialBodyMarkdown ?? "");
  const [guideMarkdown, setGuideMarkdown] = useState(initialGuideMarkdown ?? "");
  const [recommendedActions, setRecommendedActions] = useState(
    initialLesson.recommendedActions ?? []
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const editableSteps = useMemo(
    () =>
      (lesson.videoChapters ?? []).filter((chapter) =>
        Boolean(chapter.sourceLessonId?.trim())
      ),
    [lesson.videoChapters]
  );

  const defaultEditTarget = useMemo(() => {
    if (editableSteps.length === 0) return SHELL_TARGET;
    const shellEmpty =
      !(initialBodyMarkdown ?? "").trim() &&
      !(initialGuideMarkdown ?? "").trim();
    if (!shellEmpty) return SHELL_TARGET;
    if (initialChapterId) {
      const match = editableSteps.find(
        (chapter) => chapter.id === initialChapterId
      );
      if (match) return match.id;
    }
    return editableSteps[0]?.id ?? SHELL_TARGET;
  }, [
    editableSteps,
    initialBodyMarkdown,
    initialGuideMarkdown,
    initialChapterId,
  ]);

  const [editTarget, setEditTarget] = useState(defaultEditTarget);
  const [chapterDrafts, setChapterDrafts] = useState<
    Record<string, ChapterDraft>
  >(() => {
    const next: Record<string, ChapterDraft> = {};
    for (const chapter of initialLesson.videoChapters ?? []) {
      if (!chapter.sourceLessonId?.trim()) continue;
      next[chapter.id] = chapterDraftFrom(chapter);
    }
    return next;
  });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editRequested = searchParams.get("edit") === "1";

  useEffect(() => {
    if (!editRequested) return;
    setEditing(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [editRequested, pathname, router, searchParams]);

  const activeStep = useMemo(
    () => editableSteps.find((chapter) => chapter.id === editTarget) ?? null,
    [editableSteps, editTarget]
  );
  const editingChapter = Boolean(activeStep);
  const contentLessonId = activeStep?.sourceLessonId?.trim() || null;

  const displayVideoUrl = editing
    ? videoUrl.trim() || null
    : savedVideoUrl || null;
  const displayAudioUrl = editing
    ? audioUrl.trim() || null
    : savedAudioUrl || null;
  const displayBody = editing ? bodyMarkdown : savedBodyMarkdown;
  const displayGuide = editing ? guideMarkdown : savedGuideMarkdown;
  const displayRecommendedActions = editing
    ? recommendedActions.filter((action) => action.text.trim())
    : savedRecommendedActions;
  const displayTitle = editing ? title : savedTitle;

  const shellDirty = useMemo(
    () =>
      isLessonEditDirty(
        {
          title,
          videoUrl,
          audioUrl,
          duration,
          bodyMarkdown,
          guideMarkdown,
          recommendedActions,
        },
        {
          title: savedTitle,
          videoUrl: savedVideoUrl ?? "",
          audioUrl: savedAudioUrl ?? "",
          duration: savedDuration,
          bodyMarkdown: savedBodyMarkdown,
          guideMarkdown: savedGuideMarkdown,
          recommendedActions: savedRecommendedActions,
        }
      ),
    [
      title,
      videoUrl,
      audioUrl,
      duration,
      bodyMarkdown,
      guideMarkdown,
      recommendedActions,
      savedTitle,
      savedVideoUrl,
      savedAudioUrl,
      savedDuration,
      savedBodyMarkdown,
      savedGuideMarkdown,
      savedRecommendedActions,
    ]
  );

  const chapterDirty = useMemo(() => {
    if (!activeStep) return false;
    const draft = chapterDrafts[activeStep.id] ?? chapterDraftFrom(activeStep);
    const saved = chapterDraftFrom(activeStep);
    return (
      draft.title !== saved.title ||
      draft.bodyMarkdown !== saved.bodyMarkdown ||
      draft.guideMarkdown !== saved.guideMarkdown
    );
  }, [activeStep, chapterDrafts]);

  const isDirty = editing && (editingChapter ? chapterDirty : shellDirty);

  const { dialogOpen, stay, leave, requestLeave } =
    useUnsavedChangesGuard(isDirty);

  const loadTargetIntoForm = useCallback(
    (targetId: string) => {
      if (targetId === SHELL_TARGET) {
        setTitle(savedTitle);
        setVideoUrl(savedVideoUrl ?? "");
        setAudioUrl(savedAudioUrl ?? "");
        setBodyMarkdown(savedBodyMarkdown);
        setGuideMarkdown(savedGuideMarkdown);
        setRecommendedActions(savedRecommendedActions);
        setDuration(savedDuration);
        return;
      }
      const chapter = editableSteps.find((row) => row.id === targetId);
      if (!chapter) return;
      const draft = chapterDrafts[targetId] ?? chapterDraftFrom(chapter);
      setTitle(draft.title);
      setBodyMarkdown(draft.bodyMarkdown);
      setGuideMarkdown(draft.guideMarkdown);
      setVideoUrl("");
      setAudioUrl("");
      setDuration("");
      setRecommendedActions([]);
    },
    [
      editableSteps,
      chapterDrafts,
      savedTitle,
      savedVideoUrl,
      savedAudioUrl,
      savedBodyMarkdown,
      savedGuideMarkdown,
      savedRecommendedActions,
      savedDuration,
    ]
  );

  const discardEdits = useCallback(() => {
    setEditing(false);
    setSaveError(null);
    const nextDrafts: Record<string, ChapterDraft> = {};
    for (const chapter of lesson.videoChapters ?? []) {
      if (!chapter.sourceLessonId?.trim()) continue;
      nextDrafts[chapter.id] = chapterDraftFrom(chapter);
    }
    setChapterDrafts(nextDrafts);
    setEditTarget(defaultEditTarget);
    if (defaultEditTarget === SHELL_TARGET) {
      setTitle(savedTitle);
      setVideoUrl(savedVideoUrl ?? "");
      setAudioUrl(savedAudioUrl ?? "");
      setBodyMarkdown(savedBodyMarkdown);
      setGuideMarkdown(savedGuideMarkdown);
      setRecommendedActions(savedRecommendedActions);
      setDuration(savedDuration);
    } else {
      const chapter = (lesson.videoChapters ?? []).find(
        (row) => row.id === defaultEditTarget
      );
      if (chapter) {
        const draft = chapterDraftFrom(chapter);
        setTitle(draft.title);
        setBodyMarkdown(draft.bodyMarkdown);
        setGuideMarkdown(draft.guideMarkdown);
      }
    }
  }, [
    lesson.videoChapters,
    defaultEditTarget,
    savedTitle,
    savedVideoUrl,
    savedAudioUrl,
    savedBodyMarkdown,
    savedGuideMarkdown,
    savedRecommendedActions,
    savedDuration,
  ]);

  function switchEditTarget(nextTarget: string) {
    if (nextTarget === editTarget) return;
    const apply = () => {
      if (editTarget !== SHELL_TARGET) {
        setChapterDrafts((prev) => ({
          ...prev,
          [editTarget]: {
            title,
            bodyMarkdown,
            guideMarkdown,
          },
        }));
      }
      setEditTarget(nextTarget);
      if (nextTarget === SHELL_TARGET) {
        setTitle(savedTitle);
        setVideoUrl(savedVideoUrl ?? "");
        setAudioUrl(savedAudioUrl ?? "");
        setBodyMarkdown(savedBodyMarkdown);
        setGuideMarkdown(savedGuideMarkdown);
        setRecommendedActions(savedRecommendedActions);
        setDuration(savedDuration);
        return;
      }
      const chapter = editableSteps.find((row) => row.id === nextTarget);
      if (!chapter) return;
      setChapterDrafts((prev) => {
        const destination = prev[nextTarget] ?? chapterDraftFrom(chapter);
        setTitle(destination.title);
        setBodyMarkdown(destination.bodyMarkdown);
        setGuideMarkdown(destination.guideMarkdown);
        return {
          ...prev,
          ...(editTarget !== SHELL_TARGET
            ? {
                [editTarget]: { title, bodyMarkdown, guideMarkdown },
              }
            : null),
        };
      });
      setVideoUrl("");
      setAudioUrl("");
      setDuration("");
      setRecommendedActions([]);
    };
    if (isDirty) {
      requestLeave(apply);
    } else {
      apply();
    }
  }

  useEffect(() => {
    if (!editing) return;
    setEditTarget(defaultEditTarget);
    loadTargetIntoForm(defaultEditTarget);
    // Only when entering edit mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    if (!editing || !editingChapter || !activeStep) return;
    setChapterDrafts((prev) => ({
      ...prev,
      [activeStep.id]: {
        title,
        bodyMarkdown,
        guideMarkdown,
      },
    }));
  }, [editing, editingChapter, activeStep, title, bodyMarkdown, guideMarkdown]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSaveError("Lesson title is required.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");

      const res = await fetch(
        `/api/admin/academy/${hub}/lessons/${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(
            editingChapter && contentLessonId
              ? {
                  contentLessonId,
                  title: trimmedTitle,
                  bodyMarkdown,
                  guideMarkdown,
                }
              : {
                  title: trimmedTitle,
                  videoUrl: videoUrl.trim() || null,
                  audioUrl: audioUrl.trim() || null,
                  bodyMarkdown,
                  guideMarkdown,
                  recommendedActions: recommendedActions.filter((action) =>
                    action.text.trim()
                  ),
                  duration: duration.trim() || null,
                }
          ),
        }
      );
      const payload = (await res.json()) as {
        course?: HubCourse;
        lesson?: HubLesson;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save");

      if (payload.course) setCourse(payload.course);
      if (payload.lesson) setLesson(payload.lesson);

      const nextLesson = payload.lesson ?? lesson;

      if (editingChapter && activeStep) {
        const refreshed = (nextLesson.videoChapters ?? []).find(
          (chapter) => chapter.id === activeStep.id
        );
        const nextDraft = refreshed
          ? chapterDraftFrom(refreshed)
          : { title: trimmedTitle, bodyMarkdown, guideMarkdown };
        setChapterDrafts((prev) => ({
          ...prev,
          [activeStep.id]: nextDraft,
        }));
        setTitle(nextDraft.title);
        setBodyMarkdown(nextDraft.bodyMarkdown);
        setGuideMarkdown(nextDraft.guideMarkdown);
      } else {
        const nextTitle = payload.lesson?.title ?? trimmedTitle;
        const nextVideo = payload.lesson?.videoUrl ?? null;
        const nextAudio = payload.lesson?.audioUrl ?? null;
        const nextBody = payload.lesson?.bodyMarkdown ?? "";
        const nextGuide = payload.lesson?.guideMarkdown ?? "";
        const nextRecommendedActions = payload.lesson?.recommendedActions ?? [];
        const nextDuration = payload.lesson?.duration ?? "";
        setSavedTitle(nextTitle);
        setSavedVideoUrl(nextVideo ?? "");
        setSavedAudioUrl(nextAudio ?? "");
        setSavedBodyMarkdown(nextBody);
        setSavedGuideMarkdown(nextGuide);
        setSavedRecommendedActions(nextRecommendedActions);
        setSavedDuration(nextDuration);
        setTitle(nextTitle);
        setVideoUrl(nextVideo ?? "");
        setAudioUrl(nextAudio ?? "");
        setBodyMarkdown(nextBody);
        setGuideMarkdown(nextGuide);
        setRecommendedActions(nextRecommendedActions);
        setDuration(nextDuration);
      }

      const synced: Record<string, ChapterDraft> = {};
      for (const chapter of nextLesson.videoChapters ?? []) {
        if (!chapter.sourceLessonId?.trim()) continue;
        synced[chapter.id] = chapterDraftFrom(chapter);
      }
      setChapterDrafts(synced);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const headerActions = editing ? (
    <>
      <button
        type="button"
        onClick={() => requestLeave(discardEdits)}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form={FORM_ID}
        disabled={saving || uploading}
        className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-70"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label="Edit lesson"
      title="Edit lesson"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
    >
      <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );

  const displayLesson: HubLesson = {
    ...lesson,
    title: displayTitle,
    recommendedActions: displayRecommendedActions,
  };

  const stepPicker =
    editableSteps.length > 0 ? (
      <div>
        <label
          htmlFor={`${FORM_ID}-step`}
          className="block text-xs font-medium text-slate-700"
        >
          Editing step
        </label>
        <select
          id={`${FORM_ID}-step`}
          value={editTarget}
          onChange={(e) => switchEditTarget(e.target.value)}
          className="mt-1.5 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        >
          <option value={SHELL_TARGET}>
            Lesson shell (title / media
            {!savedBodyMarkdown.trim() && !savedGuideMarkdown.trim()
              ? " — empty"
              : ""}
            )
          </option>
          {editableSteps.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.title}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-slate-700">
          This lesson’s guides live on the steps below. Pick a step to edit its
          Overview and Guide.
        </p>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <UnsavedChangesDialog open={dialogOpen} onStay={stay} onLeave={leave} />

      {saveError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {saveError}
        </p>
      ) : null}

      <ClassroomLessonPlayer
        data={data}
        course={course}
        lesson={displayLesson}
        basePath={basePath}
        classroomHref={classroomHref}
        videoUrl={displayVideoUrl}
        audioUrl={displayAudioUrl}
        bodyMarkdown={displayBody}
        guideMarkdown={displayGuide}
        transcriptText={lesson.transcriptText ?? null}
        lessonResources={lessonResources}
        contentsPosition={contentsPosition}
        chrome={chrome}
        contentsBackLabel={contentsBackLabel}
        viewerIsAdmin
        canEditLessons
        contentSource="classroom"
        headerActions={headerActions}
        initialChapterId={initialChapterId}
        mainPanelOverride={
          editing ? (
            <LessonContentEditForm
              formId={FORM_ID}
              courseId={contentSourceCourseId(contentLessonId ?? lesson.id)}
              lessonId={contentLessonId ?? lesson.id}
              title={title}
              onTitleChange={setTitle}
              videoUrl={videoUrl}
              onVideoUrlChange={setVideoUrl}
              audioUrl={audioUrl}
              onAudioUrlChange={setAudioUrl}
              duration={duration}
              onDurationChange={setDuration}
              bodyMarkdown={bodyMarkdown}
              onBodyMarkdownChange={setBodyMarkdown}
              guideMarkdown={guideMarkdown}
              onGuideMarkdownChange={setGuideMarkdown}
              recommendedActions={recommendedActions}
              onRecommendedActionsChange={setRecommendedActions}
              uploading={uploading}
              onUploadingChange={setUploading}
              onError={setSaveError}
              onSubmit={handleSave}
              copyOnly={editingChapter}
              headerExtra={stepPicker}
            />
          ) : undefined
        }
      />
    </div>
  );
}
