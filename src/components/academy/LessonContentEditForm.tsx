"use client";

import { useMemo, useRef, type FormEvent, type ReactNode } from "react";
import { FileUp, Headphones, Upload, X } from "lucide-react";

import { LessonFeaturedMedia } from "@/components/academy/LessonFeaturedMedia";
import { LessonRecommendedActionsEditor } from "@/components/academy/LessonRecommendedActionsEditor";
import { LessonRichTextEditor } from "@/components/academy/LessonRichTextEditor";
import {
  LessonTabBar,
  useLessonTabParam,
  type LessonTab,
} from "@/components/academy/LessonTabBar";
import {
  readMarkdownFile,
  splitTitleFromImportedMarkdown,
} from "@/lib/academy/importLessonMarkdown";
import { uploadAcademyLessonAudioFile } from "@/lib/academyLessonAudio";
import { uploadAcademyLessonVideoFile } from "@/lib/academyLessonVideo";
import { probeBrowserMediaDurationLabel } from "@/lib/academy/probeBrowserMediaDuration";
import type { AcademyRecommendedAction } from "@/lib/academy/lessonActions";
import { supabaseClient } from "@/lib/supabaseClient";

/** Mirrors the reader's tabs — actions sit with the Overview, as coaches see them. */
type EditTabId = "overview" | "guide";
const EDIT_TAB_IDS: readonly EditTabId[] = ["overview", "guide"];

type Props = {
  formId: string;
  courseId: string;
  lessonId: string;
  title: string;
  onTitleChange: (value: string) => void;
  /** Shown before the title input (e.g. classroom lesson emoji). */
  titlePrefix?: string;
  videoUrl: string;
  onVideoUrlChange: (value: string) => void;
  audioUrl: string;
  onAudioUrlChange: (value: string) => void;
  /** Sidebar length label, e.g. `6m`. */
  duration: string;
  onDurationChange: (value: string) => void;
  /** Overview tab markdown. */
  bodyMarkdown: string;
  onBodyMarkdownChange: (value: string) => void;
  /** Guide tab markdown (optional long-form). */
  guideMarkdown: string;
  onGuideMarkdownChange: (value: string) => void;
  /** Recommended next steps shown beside the Overview. */
  recommendedActions: AcademyRecommendedAction[];
  onRecommendedActionsChange: (actions: AcademyRecommendedAction[]) => void;
  uploading: boolean;
  onUploadingChange: (value: boolean) => void;
  onError: (message: string) => void;
  onSubmit: (e: FormEvent) => void;
  /**
   * Chapter/step copy only — hide video, audio, duration, and action items.
   * Used when editing a consolidated lesson's nested step.
   */
  copyOnly?: boolean;
  /** Optional control rendered under the title (e.g. step picker). */
  headerExtra?: ReactNode;
};

export function LessonContentEditForm({
  formId,
  courseId,
  lessonId,
  title,
  onTitleChange,
  titlePrefix,
  videoUrl,
  onVideoUrlChange,
  audioUrl,
  onAudioUrlChange,
  duration,
  onDurationChange,
  bodyMarkdown,
  onBodyMarkdownChange,
  guideMarkdown,
  onGuideMarkdownChange,
  recommendedActions,
  onRecommendedActionsChange,
  uploading,
  onUploadingChange,
  onError,
  onSubmit,
  copyOnly = false,
  headerExtra,
}: Props) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const { activeTab, selectTab } = useLessonTabParam(EDIT_TAB_IDS, "overview");

  const tabs = useMemo<LessonTab<EditTabId>[]>(
    () => [
      { id: "overview", label: "Overview" },
      {
        id: "guide",
        label: "Guide",
        hint: guideMarkdown.trim() ? undefined : "Empty",
      },
    ],
    [guideMarkdown]
  );

  async function handleMarkdownImport(file: File) {
    onError("");
    try {
      const raw = await readMarkdownFile(file);
      const { title: importedTitle, body } = splitTitleFromImportedMarkdown(raw);

      if (bodyMarkdown.trim() && body.trim()) {
        const replace = window.confirm(
          "Replace the current lesson content with the imported file? Click Cancel to append instead."
        );
        onBodyMarkdownChange(replace ? body : `${bodyMarkdown.trimEnd()}\n\n${body}`);
      } else {
        onBodyMarkdownChange(body);
      }

      if (importedTitle) {
        const useTitle = window.confirm(
          `Use "${importedTitle}" as the lesson title? (The top heading will be removed from the body so it is not duplicated.)`
        );
        if (useTitle) onTitleChange(importedTitle);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function handleTitleFromPaste(importedTitle: string) {
    const useTitle =
      !title.trim() ||
      window.confirm(
        `Use "${importedTitle}" as the lesson title? (The top heading will be removed from the body.)`
      );
    if (useTitle) onTitleChange(importedTitle);
  }

  async function handleVideoUpload(file: File) {
    onError("");
    onUploadingChange(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const up = await uploadAcademyLessonVideoFile(
        file,
        courseId,
        lessonId,
        session?.access_token
      );
      if ("error" in up) throw new Error(up.error);
      onVideoUrlChange(up.url);
      const label = await probeBrowserMediaDurationLabel(file);
      if (label) onDurationChange(label);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      onUploadingChange(false);
    }
  }

  async function handleAudioUpload(file: File) {
    onError("");
    onUploadingChange(true);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const up = await uploadAcademyLessonAudioFile(
        file,
        courseId,
        lessonId,
        session?.access_token
      );
      if ("error" in up) throw new Error(up.error);
      onAudioUrlChange(up.url);
      // Prefer keeping an existing video-derived duration when both exist.
      if (!duration.trim()) {
        const label = await probeBrowserMediaDurationLabel(file);
        if (label) onDurationChange(label);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      onUploadingChange(false);
    }
  }

  const trimmedAudio = audioUrl.trim();

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] md:p-8"
    >
      <header className="mb-6 border-b border-slate-200/80 pb-4">
        <label className="sr-only" htmlFor={`${formId}-title`}>
          Lesson title
        </label>
        <div className="flex min-w-0 items-center gap-2">
          {titlePrefix ? (
            <span className="shrink-0 text-xl md:text-2xl" aria-hidden>
              {titlePrefix}
            </span>
          ) : null}
          <input
            id={`${formId}-title`}
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            placeholder="Lesson title"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xl font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 md:text-2xl"
          />
        </div>
        {headerExtra ? <div className="mt-4">{headerExtra}</div> : null}
      </header>

      {!copyOnly ? (
        <>
          <LessonFeaturedMedia
            videoUrl={videoUrl}
            onVideoUrlChange={onVideoUrlChange}
            uploading={uploading}
            onUploadFile={(file) => void handleVideoUpload(file)}
          />

          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Headphones className="h-4 w-4 text-slate-500" aria-hidden />
                  Listen audio
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Optional MP3 shown under the video for on-the-go listening.
                </p>
              </div>
              {trimmedAudio ? (
                <button
                  type="button"
                  onClick={() => onAudioUrlChange("")}
                  className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Remove audio"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {trimmedAudio ? (
              <audio className="mt-3 w-full" controls preload="metadata" src={trimmedAudio} />
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => audioInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {uploading
                  ? "Uploading…"
                  : trimmedAudio
                    ? "Replace audio"
                    : "Upload MP3"}
              </button>
              <input
                type="url"
                value={audioUrl}
                onChange={(e) => onAudioUrlChange(e.target.value)}
                placeholder="Or paste an audio URL"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,.mp3,.m4a,.aac,.wav,.ogg"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAudioUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="mb-8 max-w-xs">
            <label
              htmlFor={`${formId}-duration`}
              className="block text-sm font-medium text-slate-700"
            >
              Duration
            </label>
            <input
              id={`${formId}-duration`}
              type="text"
              value={duration}
              onChange={(e) => onDurationChange(e.target.value)}
              placeholder="e.g. 6m"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Shown next to the lesson in the course sidebar. Use minutes like{" "}
              <span className="font-medium text-slate-600">6m</span> or{" "}
              <span className="font-medium text-slate-600">1h 5m</span>.
            </p>
          </div>
        </>
      ) : null}

      <LessonTabBar
        tabs={tabs}
        activeTab={activeTab}
        onSelect={selectTab}
        label="Lesson sections to edit"
      />

      {activeTab === "overview" ? (
        <div className="pt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Short what / why — the first thing coaches read under the video.
            </p>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <FileUp className="h-3.5 w-3.5" aria-hidden />
              Import .md file
              <input
                ref={importInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleMarkdownImport(file);
                }}
              />
            </label>
          </div>

          <LessonRichTextEditor
            markdown={bodyMarkdown}
            onChange={onBodyMarkdownChange}
            courseId={courseId}
            lessonId={lessonId}
            onTitleFromPaste={handleTitleFromPaste}
            onError={onError}
          />
          <p className="mt-2 text-xs text-slate-400">
            Formatted as coaches will see it. Paste from Google Docs, or add
            images with the Image button, drag-and-drop, or Cmd/Ctrl+V.
          </p>

          {!copyOnly ? (
            <div className="mt-8 border-t border-slate-200/80 pt-6">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Action items</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Shown beside the Overview. Use checklist for self-reported steps,
                  or tracked when the system can verify the coach did it.
                </p>
              </div>
              <LessonRecommendedActionsEditor
                actions={recommendedActions}
                onChange={onRecommendedActionsChange}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pt-6">
          <p className="mb-3 text-xs text-slate-500">
            Optional longer walkthrough / SOP. Leave blank and the Guide tab stays
            hidden from coaches.
          </p>
          <LessonRichTextEditor
            markdown={guideMarkdown}
            onChange={onGuideMarkdownChange}
            courseId={courseId}
            lessonId={lessonId}
            onError={onError}
            placeholder="Write the full walkthrough, or paste from Google Docs…"
          />
        </div>
      )}
    </form>
  );
}
