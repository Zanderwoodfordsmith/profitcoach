"use client";

import { Upload } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type DragEvent,
} from "react";

import { mediaKindForMime, resolveCommunityPostMediaMime } from "@/lib/communityPostMedia";

type DropHandler = (files: File[]) => void;

const DropContext = createContext<((handler: DropHandler) => () => void) | null>(null);

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

/**
 * A chat panel you can drop files on. The files go to `onFiles`, or to the
 * message box inside that calls `useFileDrop`. Nothing happens (and no
 * overlay shows) until one of them is there.
 */
export function FileDropZone({
  onFiles,
  className = "",
  children,
  ...rest
}: ComponentProps<"div"> & { onFiles?: DropHandler }) {
  const inner = useRef<DropHandler | null>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  const register = useCallback((handler: DropHandler) => {
    inner.current = handler;
    return () => {
      if (inner.current === handler) inner.current = null;
    };
  }, []);

  const target = () => onFiles ?? inner.current;

  return (
    <DropContext.Provider value={register}>
      <div
        {...rest}
        className={`relative ${className}`}
        onDragEnter={(e) => {
          if (!hasFiles(e) || !target()) return;
          e.preventDefault();
          depth.current += 1;
          setOver(true);
        }}
        onDragOver={(e) => {
          if (!hasFiles(e) || !target()) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!hasFiles(e) || !target()) return;
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(false);
        }}
        onDrop={(e) => {
          const handler = target();
          if (!hasFiles(e) || !handler) return;
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) handler(files);
        }}
      >
        {children}
        {over ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-1.5 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/90 text-sky-800"
          >
            <Upload className="h-6 w-6" strokeWidth={1.75} />
            <p className="text-sm font-semibold">Drop to add to your message</p>
          </div>
        ) : null}
      </div>
    </DropContext.Provider>
  );
}

/** Lets a message box take files dropped anywhere on its panel. Pass null to switch it off. */
export function useFileDrop(handler: DropHandler | null) {
  const register = useContext(DropContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  const on = handler !== null;
  useEffect(() => {
    if (!register || !on) return;
    return register((files) => latest.current?.(files));
  }, [register, on]);
}

/** Sorts dropped files the way the message box buttons do. Anything unknown counts as a document. */
export function sortDroppedFiles(files: File[]) {
  const sorted = { images: [] as File[], videos: [] as File[], audio: [] as File[], documents: [] as File[] };
  for (const file of files) {
    const kind = mediaKindForMime(resolveCommunityPostMediaMime(file) ?? "");
    if (kind === "image") sorted.images.push(file);
    else if (kind === "video") sorted.videos.push(file);
    else if (kind === "audio") sorted.audio.push(file);
    else sorted.documents.push(file);
  }
  return sorted;
}

/** A dropped audio file as a voice note waiting to send. */
export function voiceNoteFromFile(file: File) {
  return {
    blob: file as Blob,
    filename: file.name || "voice-note.m4a",
    mime: resolveCommunityPostMediaMime(file) ?? "audio/mpeg",
    url: URL.createObjectURL(file),
  };
}
