"use client";

import { useRef } from "react";
import { FileUp } from "lucide-react";

import { LessonFeaturedMedia } from "@/components/academy/LessonFeaturedMedia";
import { LessonRichTextEditor } from "@/components/academy/LessonRichTextEditor";
import {
  readMarkdownFile,
  splitTitleFromImportedMarkdown,
} from "@/lib/academy/importLessonMarkdown";
import { uploadAcademyLessonVideoFile } from "@/lib/academyLessonVideo";
import { supabaseClient } from "@/lib/supabaseClient";

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
  bodyMarkdown: string;
  onBodyMarkdownChange: (value: string) => void;
  uploading: boolean;
  onUploadingChange: (value: boolean) => void;
  onError: (message: string) => void;
  onSubmit: (e: React.FormEvent) => void;
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
  bodyMarkdown,
  onBodyMarkdownChange,
  uploading,
  onUploadingChange,
  onError,
  onSubmit,
}: Props) {
  const importInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      onUploadingChange(false);
    }
  }

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
    >
      <header className="mb-6 border-b border-slate-100 pb-4">
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
      </header>

      <LessonFeaturedMedia
        videoUrl={videoUrl}
        onVideoUrlChange={onVideoUrlChange}
        uploading={uploading}
        onUploadFile={(file) => void handleVideoUpload(file)}
      />

      <div className="border-t border-slate-100 pt-6">
        <div className="mb-3 flex justify-end">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
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
          onTitleFromPaste={handleTitleFromPaste}
        />
        <p className="mt-2 text-xs text-slate-400">
          Formatted as coaches will see it. Paste from Google Docs with Cmd/Ctrl+V. Save to
          publish.
        </p>
      </div>
    </form>
  );
}
