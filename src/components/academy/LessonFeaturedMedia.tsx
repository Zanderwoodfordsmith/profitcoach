"use client";

import { useCallback, useRef, useState } from "react";
import { Film, Link2, Upload, X } from "lucide-react";

import { isDirectVideoFileUrl } from "@/lib/academy/videoUrl";
import { toYouTubeEmbedUrl } from "@/lib/videoEmbed";

type Props = {
  videoUrl: string;
  onVideoUrlChange: (value: string) => void;
  uploading: boolean;
  onUploadFile: (file: File) => void;
};

export function LessonFeaturedMedia({
  videoUrl,
  onVideoUrlChange,
  uploading,
  onUploadFile,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedDraft, setEmbedDraft] = useState("");

  const trimmed = videoUrl.trim();
  const embedUrl = trimmed ? toYouTubeEmbedUrl(trimmed) : null;
  const directUrl =
    trimmed && !embedUrl && isDirectVideoFileUrl(trimmed) ? trimmed : null;
  const hasVideo = Boolean(embedUrl || directUrl || trimmed);

  const pickFile = useCallback(() => {
    if (!uploading) fileInputRef.current?.click();
  }, [uploading]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onUploadFile(file);
    },
    [onUploadFile]
  );

  function applyEmbed() {
    const url = embedDraft.trim();
    if (url) {
      onVideoUrlChange(url);
      setEmbedOpen(false);
      setEmbedDraft("");
    }
  }

  if (hasVideo) {
    return (
      <div className="group relative mb-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        {embedUrl ? (
          <div className="relative aspect-video w-full">
            <iframe
              title="Lesson video"
              src={embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : directUrl ? (
          <video src={directUrl} controls playsInline className="aspect-video w-full bg-black" />
        ) : (
          <div className="flex aspect-video items-center justify-center p-6 text-center text-sm text-slate-300">
            <p>
              This link is not a recognized YouTube, Vimeo, or video file. Coaches will see an
              open link instead.
            </p>
          </div>
        )}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => {
              onVideoUrlChange("");
              setEmbedOpen(false);
            }}
            className="rounded-full bg-black/70 p-2 text-white hover:bg-black/90"
            aria-label="Remove video"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-t border-slate-800 bg-slate-900/80 px-3 py-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={uploading}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Replace with upload"}
          </button>
          <span className="mx-2 text-slate-600">·</span>
          <button
            type="button"
            onClick={() => {
              setEmbedDraft(trimmed);
              setEmbedOpen(true);
            }}
            className="text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            Change embed URL
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = "";
          }}
        />
        {embedOpen ? (
          <div className="flex gap-2 border-t border-slate-800 bg-slate-900 p-3">
            <input
              type="url"
              value={embedDraft}
              onChange={(e) => setEmbedDraft(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={applyEmbed}
              className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Apply
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`relative mb-8 rounded-2xl border-2 border-dashed px-4 py-8 transition-colors md:px-8 md:py-10 ${
        dragOver ? "border-sky-400 bg-sky-50/50" : "border-slate-200 bg-slate-50/60"
      }`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <p className="text-center text-sm font-semibold text-slate-800">Featured video</p>
      <p className="mx-auto mt-1 max-w-md text-center text-xs text-slate-500">
        Shown at the top of the lesson — upload a file or paste a YouTube / Vimeo link.
      </p>

      <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm transition hover:border-sky-300 hover:bg-sky-50/30 disabled:opacity-60"
        >
          <span className="flex gap-2 text-slate-400">
            <Film className="h-5 w-5" aria-hidden />
            <Upload className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-medium text-slate-700">
            {uploading ? "Uploading…" : "Click or drag to upload"}
          </span>
          <span className="text-xs text-slate-500">MP4, WebM, or MOV · max 50MB</span>
        </button>

        <button
          type="button"
          onClick={() => setEmbedOpen((o) => !o)}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm transition hover:border-sky-300 hover:bg-sky-50/30"
        >
          <Link2 className="h-5 w-5 text-slate-400" aria-hidden />
          <span className="text-sm font-medium text-slate-700">Embed YouTube or Vimeo</span>
          <span className="text-xs text-slate-500">Paste a watch or share link</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadFile(file);
          e.target.value = "";
        }}
      />

      {embedOpen ? (
        <div className="mx-auto mt-4 flex max-w-xl gap-2">
          <input
            type="url"
            value={embedDraft}
            onChange={(e) => setEmbedDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyEmbed();
              }
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            autoFocus
          />
          <button
            type="button"
            onClick={applyEmbed}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}
