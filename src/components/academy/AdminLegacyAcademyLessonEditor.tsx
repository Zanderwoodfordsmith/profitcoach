"use client";

import { useState } from "react";

import { LessonContentEditForm } from "@/components/academy/LessonContentEditForm";
import { LegacyAcademyLessonPlayer } from "@/components/academy/LegacyAcademyLessonPlayer";
import type {
  LegacyHubCatalog,
  LegacyHubCourse,
  LegacyHubLesson,
} from "@/lib/academy/legacyHubCatalog";
import type { AcademyResourceRow } from "@/lib/academy/resources";
import { supabaseClient } from "@/lib/supabaseClient";

const FORM_ID = "legacy-lesson-edit-form";

type Props = {
  data: LegacyHubCatalog;
  course: LegacyHubCourse;
  lesson: LegacyHubLesson;
  initialVideoUrl?: string | null;
  initialBodyMarkdown?: string;
  basePath: string;
  classroomHref: string;
  lessonResources?: AcademyResourceRow[];
};

export function AdminLegacyAcademyLessonEditor({
  data,
  course: initialCourse,
  lesson: initialLesson,
  initialVideoUrl = null,
  initialBodyMarkdown = "",
  basePath,
  classroomHref,
  lessonResources = [],
}: Props) {
  const [course, setCourse] = useState(initialCourse);
  const [lesson, setLesson] = useState(initialLesson);
  const [savedVideoUrl, setSavedVideoUrl] = useState(initialVideoUrl ?? "");
  const [savedBodyMarkdown, setSavedBodyMarkdown] = useState(initialBodyMarkdown ?? "");
  const [savedTitle, setSavedTitle] = useState(initialLesson.title);
  const [title, setTitle] = useState(initialLesson.title);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(initialBodyMarkdown ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const displayVideoUrl = editing ? videoUrl.trim() || null : savedVideoUrl || null;
  const displayBody = editing ? bodyMarkdown : savedBodyMarkdown;
  const displayTitle = editing ? title : savedTitle;

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
        `/api/admin/academy/programs/lessons/${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`,
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
          }),
        }
      );
      const payload = (await res.json()) as {
        course?: LegacyHubCourse;
        lesson?: LegacyHubLesson;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save");

      if (payload.course) setCourse(payload.course);
      if (payload.lesson) setLesson(payload.lesson);

      const nextTitle = payload.lesson?.title ?? trimmedTitle;
      const nextVideo = payload.lesson?.videoUrl ?? null;
      const nextBody = payload.lesson?.bodyMarkdown ?? "";
      setSavedTitle(nextTitle);
      setSavedVideoUrl(nextVideo ?? "");
      setSavedBodyMarkdown(nextBody);
      setTitle(nextTitle);
      setVideoUrl(nextVideo ?? "");
      setBodyMarkdown(nextBody);
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
        onClick={() => {
          setEditing(false);
          setTitle(savedTitle);
          setVideoUrl(savedVideoUrl ?? "");
          setBodyMarkdown(savedBodyMarkdown);
          setSaveError(null);
        }}
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
      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
    >
      Edit lesson
    </button>
  );

  const displayLesson: LegacyHubLesson = { ...lesson, title: displayTitle };

  return (
    <div className="flex flex-col gap-4">
      {saveError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {saveError}
        </p>
      ) : null}

      <LegacyAcademyLessonPlayer
        data={data}
        course={course}
        lesson={displayLesson}
        basePath={basePath}
        classroomHref={classroomHref}
        videoUrl={displayVideoUrl}
        bodyMarkdown={displayBody}
        transcriptText={lesson.transcriptText ?? null}
        lessonResources={lessonResources}
        headerActions={headerActions}
        mainPanelOverride={
          editing ? (
            <LessonContentEditForm
              formId={FORM_ID}
              courseId={course.id}
              lessonId={lesson.id}
              title={title}
              onTitleChange={setTitle}
              videoUrl={videoUrl}
              onVideoUrlChange={setVideoUrl}
              bodyMarkdown={bodyMarkdown}
              onBodyMarkdownChange={setBodyMarkdown}
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
