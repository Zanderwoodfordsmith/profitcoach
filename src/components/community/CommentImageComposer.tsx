"use client";

import { FileText, Mic, Paperclip, X } from "lucide-react";
import type { ReactNode } from "react";
import { PreviewableMedia } from "@/components/media/AttachmentPreviewModal";
import { FileDropZone } from "@/components/messaging/FileDropZone";
import {
  COMMUNITY_COMMENT_MEDIA_MAX,
  validateCommunityCommentFile,
  validateCommunityCommentImageFile,
} from "@/lib/communityCommentMedia";
import {
  SUPPORT_DOCUMENT_ACCEPT,
  mediaKindForMime,
  resolveCommunityPostMediaMime,
} from "@/lib/communityPostMedia";

export type PendingCommentImage = {
  key: string;
  file: File;
  previewUrl: string;
};

type SharedProps = {
  pending: PendingCommentImage[];
  onChange: (next: PendingCommentImage[]) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
  onAttachInteract?: () => void;
  /** Take videos, voice notes and documents too, not just images. */
  anyFile?: boolean;
};

const ANY_FILE_ACCEPT = `image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mov,audio/*,${SUPPORT_DOCUMENT_ACCEPT}`;

function addPendingFiles(
  pending: PendingCommentImage[],
  files: File[],
  onChange: (next: PendingCommentImage[]) => void,
  onError: ((message: string) => void) | undefined,
  anyFile: boolean
) {
  const room = COMMUNITY_COMMENT_MEDIA_MAX - pending.length;
  if (room <= 0) {
    onError?.(`You can add up to ${COMMUNITY_COMMENT_MEDIA_MAX} files.`);
    return;
  }
  if (files.length > room) {
    onError?.(`You can add up to ${COMMUNITY_COMMENT_MEDIA_MAX} files.`);
  }

  const validate = anyFile
    ? validateCommunityCommentFile
    : validateCommunityCommentImageFile;
  const next = [...pending];
  for (const file of files.slice(0, room)) {
    const validated = validate(file);
    if ("error" in validated) {
      onError?.(validated.error);
      continue;
    }
    next.push({
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }
  onChange(next);
}

export function CommentAttachButton({
  pending,
  onChange,
  disabled = false,
  onError,
  onAttachInteract,
  anyFile = false,
  className = "",
  size = "md",
}: SharedProps & { className?: string; size?: "sm" | "md" }) {
  const buttonClass =
    size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconClass = size === "md" ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4";
  const label = anyFile ? "Attach files" : "Attach images";

  return (
    <label
      className={`inline-flex ${buttonClass} shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 ${
        disabled || pending.length >= COMMUNITY_COMMENT_MEDIA_MAX
          ? "pointer-events-none opacity-50"
          : "cursor-pointer"
      } ${className}`}
      aria-label={label}
      title={anyFile ? "Attach a picture, video or document (or drop it in)" : label}
      onMouseDown={(e) => {
        e.preventDefault();
        onAttachInteract?.();
      }}
    >
      <Paperclip className={`${iconClass} shrink-0`} strokeWidth={1.75} />
      <input
        type="file"
        accept={anyFile ? ANY_FILE_ACCEPT : "image/jpeg,image/png,image/webp"}
        multiple
        className="sr-only"
        disabled={disabled || pending.length >= COMMUNITY_COMMENT_MEDIA_MAX}
        onChange={(e) => {
          onAttachInteract?.();
          addPendingFiles(
            pending,
            Array.from(e.target.files ?? []),
            onChange,
            onError,
            anyFile
          );
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** Drop files anywhere on a comment box to attach them. */
export function CommentFileDrop({
  pending,
  onChange,
  disabled = false,
  onError,
  onAttachInteract,
  children,
  className,
}: Omit<SharedProps, "anyFile"> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FileDropZone
      className={className}
      onFiles={
        disabled
          ? undefined
          : (files) => {
              onAttachInteract?.();
              addPendingFiles(pending, files, onChange, onError, true);
            }
      }
    >
      {children}
    </FileDropZone>
  );
}

function pendingKind(file: File) {
  return mediaKindForMime(resolveCommunityPostMediaMime(file) ?? "") ?? "file";
}

export function CommentImagePreviews({
  pending,
  onChange,
  disabled = false,
}: Pick<SharedProps, "pending" | "onChange" | "disabled">) {
  if (pending.length === 0) return null;

  const remove = (key: string) => {
    const removed = pending.find((p) => p.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(pending.filter((p) => p.key !== key));
  };

  return (
    <ul className="flex flex-wrap gap-2">
      {pending.map((p) => {
        const kind = pendingKind(p.file);
        return (
          <li key={p.key} className="relative inline-block">
            {kind === "image" || kind === "video" ? (
              <PreviewableMedia
                url={p.previewUrl}
                kind={kind}
                mediaClassName="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-14 max-w-[14rem] items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                {kind === "audio" ? (
                  <Mic className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} />
                )}
                <span className="min-w-0 truncate">{p.file.name}</span>
              </span>
            )}
            <button
              type="button"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
              aria-label="Remove attachment"
              disabled={disabled}
              onClick={() => remove(p.key)}
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function clearPendingCommentImages(pending: PendingCommentImage[]): void {
  for (const p of pending) {
    URL.revokeObjectURL(p.previewUrl);
  }
}
