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
import { supabaseClient } from "@/lib/supabaseClient";

const FORM_ID = "legacy-lesson-edit-form";

type Props = {
  data: HubCatalog;
  course: HubCourse;
  lesson: HubLesson;
  initialVideoUrl?: string | null;
  initialBodyMarkdown?: string;
  initialGuideMarkdown?: string;
  basePath: string;
  classroomHref: string;
  lessonResources?: AcademyResourceRow[];
  contentsPosition?: "left" | "right";
  chrome?: "default" | "minimal";
  /** Which hub JSON the course comes from — picks the save route. */
  hub?: "archive" | "classroom";
};

export function AdminClassroomLessonEditor({
  data,
  course: initialCourse,
  lesson: initialLesson,
  initialVideoUrl = null,
  initialBodyMarkdown = "",
  initialGuideMarkdown = "",
  basePath,
  classroomHref,
  lessonResources = [],
  contentsPosition,
  chrome,
  hub = "archive",
}: Props) {
  const [course, setCourse] = useState(initialCourse);
  const [lesson, setLesson] = useState(initialLesson);
  const [savedVideoUrl, setSavedVideoUrl] = useState(initialVideoUrl ?? "");
  const [savedBodyMarkdown, setSavedBodyMarkdown] = useState(initialBodyMarkdown ?? "");
  const [savedGuideMarkdown, setSavedGuideMarkdown] = useState(
    initialGuideMarkdown ?? ""
  );
  const [savedRecommendedActions, setSavedRecommendedActions] = useState(
    initialLesson.recommendedActions ?? []
  );
  const [savedTitle, setSavedTitle] = useState(initialLesson.title);
  const [savedDuration, setSavedDuration] = useState(initialLesson.duration ?? "");
  const [title, setTitle] = useState(initialLesson.title);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? "");
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editRequested = searchParams.get("edit") === "1";

  // `?edit=1` (from the sidebar menu) opens the editor, then drops the param.
  useEffect(() => {
    if (!editRequested) return;
    setEditing(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [editRequested, pathname, router, searchParams]);

  const displayVideoUrl = editing ? videoUrl.trim() || null : savedVideoUrl || null;
  const displayBody = editing ? bodyMarkdown : savedBodyMarkdown;
  const displayGuide = editing ? guideMarkdown : savedGuideMarkdown;
  const displayRecommendedActions = editing
    ? recommendedActions.filter((action) => action.text.trim())
    : savedRecommendedActions;
  const displayTitle = editing ? title : savedTitle;

  const isDirty = useMemo(
    () =>
      editing &&
      isLessonEditDirty(
        {
          title,
          videoUrl,
          duration,
          bodyMarkdown,
          guideMarkdown,
          recommendedActions,
        },
        {
          title: savedTitle,
          videoUrl: savedVideoUrl ?? "",
          duration: savedDuration,
          bodyMarkdown: savedBodyMarkdown,
          guideMarkdown: savedGuideMarkdown,
          recommendedActions: savedRecommendedActions,
        }
      ),
    [
      editing,
      title,
      videoUrl,
      duration,
      bodyMarkdown,
      guideMarkdown,
      recommendedActions,
      savedTitle,
      savedVideoUrl,
      savedDuration,
      savedBodyMarkdown,
      savedGuideMarkdown,
      savedRecommendedActions,
    ]
  );

  const { dialogOpen, stay, leave, requestLeave } =
    useUnsavedChangesGuard(isDirty);

  const discardEdits = useCallback(() => {
    setEditing(false);
    setTitle(savedTitle);
    setVideoUrl(savedVideoUrl ?? "");
    setBodyMarkdown(savedBodyMarkdown);
    setGuideMarkdown(savedGuideMarkdown);
    setRecommendedActions(savedRecommendedActions);
    setDuration(savedDuration);
    setSaveError(null);
  }, [
    savedTitle,
    savedVideoUrl,
    savedBodyMarkdown,
    savedGuideMarkdown,
    savedRecommendedActions,
    savedDuration,
  ]);

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
          body: JSON.stringify({
            title: trimmedTitle,
            videoUrl: videoUrl.trim() || null,
            bodyMarkdown,
            guideMarkdown,
            recommendedActions: recommendedActions.filter((action) =>
              action.text.trim()
            ),
            duration: duration.trim() || null,
          }),
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

      const nextTitle = payload.lesson?.title ?? trimmedTitle;
      const nextVideo = payload.lesson?.videoUrl ?? null;
      const nextBody = payload.lesson?.bodyMarkdown ?? "";
      const nextGuide = payload.lesson?.guideMarkdown ?? "";
      const nextRecommendedActions = payload.lesson?.recommendedActions ?? [];
      const nextDuration = payload.lesson?.duration ?? "";
      setSavedTitle(nextTitle);
      setSavedVideoUrl(nextVideo ?? "");
      setSavedBodyMarkdown(nextBody);
      setSavedGuideMarkdown(nextGuide);
      setSavedRecommendedActions(nextRecommendedActions);
      setSavedDuration(nextDuration);
      setTitle(nextTitle);
      setVideoUrl(nextVideo ?? "");
      setBodyMarkdown(nextBody);
      setGuideMarkdown(nextGuide);
      setRecommendedActions(nextRecommendedActions);
      setDuration(nextDuration);
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
    >
      <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );

  const displayLesson: HubLesson = {
    ...lesson,
    title: displayTitle,
    recommendedActions: displayRecommendedActions,
  };

  return (
    <div className="flex flex-col gap-4">
      <UnsavedChangesDialog open={dialogOpen} onStay={stay} onLeave={leave} />

      {saveError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
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
        bodyMarkdown={displayBody}
        guideMarkdown={displayGuide}
        transcriptText={lesson.transcriptText ?? null}
        lessonResources={lessonResources}
        contentsPosition={contentsPosition}
        chrome={chrome}
        viewerIsAdmin
        canEditLessons
        contentSource="classroom"
        headerActions={headerActions}
        mainPanelOverride={
          editing ? (
            <LessonContentEditForm
              formId={FORM_ID}
              courseId={contentSourceCourseId(lesson.id)}
              lessonId={lesson.id}
              title={title}
              onTitleChange={setTitle}
              videoUrl={videoUrl}
              onVideoUrlChange={setVideoUrl}
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
            />
          ) : undefined
        }
      />
    </div>
  );
}
