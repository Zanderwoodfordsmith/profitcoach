"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CompassLessonPlayer } from "@/components/academy/CompassLessonPlayer";
import { LessonContentEditForm } from "@/components/academy/LessonContentEditForm";
import { UnsavedChangesDialog } from "@/components/academy/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isLessonEditDirty } from "@/lib/academy/lessonEditDirty";
import type { AcademyCategory, AcademyCourse, AcademyLesson } from "@/lib/academy/types";
import { supabaseClient } from "@/lib/supabaseClient";

const BASE = "/admin/academy/compass";
const FORM_ID = "classroom-lesson-edit-form";

type Props = {
  category: AcademyCategory;
  course: AcademyCourse;
  lesson: AcademyLesson;
};

type LessonPayload = {
  category: AcademyCategory;
  course: AcademyCourse;
  lesson: AcademyLesson;
};

export function AdminCompassLessonEditor({ category, course, lesson: initialLesson }: Props) {
  const [categoryState, setCategoryState] = useState(category);
  const [courseState, setCourseState] = useState(course);
  const [lesson, setLesson] = useState(initialLesson);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialLesson.title);
  const [videoUrl, setVideoUrl] = useState(initialLesson.videoUrl ?? "");
  const [duration, setDuration] = useState(initialLesson.duration ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(initialLesson.bodyMarkdown ?? "");
  const [guideMarkdown, setGuideMarkdown] = useState(initialLesson.guideMarkdown ?? "");
  const [recommendedActions, setRecommendedActions] = useState(
    initialLesson.recommendedActions ?? []
  );

  const applyPayload = useCallback((data: LessonPayload) => {
    setCategoryState(data.category);
    setCourseState(data.course);
    setLesson(data.lesson);
    setTitle(data.lesson.title);
    setVideoUrl(data.lesson.videoUrl ?? "");
    setDuration(data.lesson.duration ?? "");
    setBodyMarkdown(data.lesson.bodyMarkdown ?? "");
    setGuideMarkdown(data.lesson.guideMarkdown ?? "");
    setRecommendedActions(data.lesson.recommendedActions ?? []);
  }, []);

  useEffect(() => {
    if (editing) return;
    setTitle(lesson.title);
    setVideoUrl(lesson.videoUrl ?? "");
    setDuration(lesson.duration ?? "");
    setBodyMarkdown(lesson.bodyMarkdown ?? "");
    setGuideMarkdown(lesson.guideMarkdown ?? "");
    setRecommendedActions(lesson.recommendedActions ?? []);
  }, [editing, lesson]);

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
          title: lesson.title,
          videoUrl: lesson.videoUrl ?? "",
          duration: lesson.duration ?? "",
          bodyMarkdown: lesson.bodyMarkdown ?? "",
          guideMarkdown: lesson.guideMarkdown ?? "",
          recommendedActions: lesson.recommendedActions ?? [],
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
      lesson,
    ]
  );

  const { dialogOpen, stay, leave, requestLeave } =
    useUnsavedChangesGuard(isDirty);

  const discardEdits = useCallback(() => {
    setEditing(false);
    setTitle(lesson.title);
    setVideoUrl(lesson.videoUrl ?? "");
    setDuration(lesson.duration ?? "");
    setBodyMarkdown(lesson.bodyMarkdown ?? "");
    setGuideMarkdown(lesson.guideMarkdown ?? "");
    setRecommendedActions(lesson.recommendedActions ?? []);
    setSaveError(null);
  }, [lesson]);

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
        `/api/admin/academy/lessons/${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`,
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
      const data = (await res.json()) as LessonPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      applyPayload(data);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const previewLesson: AcademyLesson = editing
    ? {
        ...lesson,
        title: title.trim() || lesson.title,
        videoUrl: videoUrl.trim() || null,
        duration: duration.trim() || undefined,
        bodyMarkdown,
        guideMarkdown,
        recommendedActions: recommendedActions.filter((action) =>
          action.text.trim()
        ),
      }
    : lesson;

  const headerTitle = `${lesson.emoji ? `${lesson.emoji} ` : ""}${editing ? title : lesson.title}`;

  return (
    <div className="flex flex-col gap-4">
      <UnsavedChangesDialog open={dialogOpen} onStay={stay} onLeave={leave} />

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="min-w-0">
          <Link href={BASE} className="text-xs text-slate-500 hover:text-slate-700">
            ← All courses
          </Link>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{headerTitle}</h2>
          <p className="text-sm text-slate-500">{course.title}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
            >
              Edit lesson
            </button>
          ) : (
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
          )}
        </div>
      </div>

      {saveError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {saveError}
        </p>
      ) : null}

      {editing ? (
        <LessonContentEditForm
          formId={FORM_ID}
          courseId={course.id}
          lessonId={lesson.id}
          title={title}
          onTitleChange={setTitle}
          titlePrefix={lesson.emoji}
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
      ) : (
        <CompassLessonPlayer
          category={categoryState}
          course={courseState}
          lesson={previewLesson}
          basePath={BASE}
          viewerIsAdmin
        />
      )}
    </div>
  );
}
