"use client";

import { Paperclip, X } from "lucide-react";
import {
  COMMUNITY_COMMENT_MEDIA_MAX,
  validateCommunityCommentImageFile,
} from "@/lib/communityCommentMedia";

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
};

function addPendingFiles(
  pending: PendingCommentImage[],
  files: File[],
  onChange: (next: PendingCommentImage[]) => void,
  onError?: (message: string) => void
) {
  const room = COMMUNITY_COMMENT_MEDIA_MAX - pending.length;
  if (room <= 0) return;

  const next = [...pending];
  for (const file of files.slice(0, room)) {
    const validated = validateCommunityCommentImageFile(file);
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
  className = "",
  size = "md",
}: SharedProps & { className?: string; size?: "sm" | "md" }) {
  const buttonClass =
    size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconClass = size === "md" ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4";

  return (
    <label
      className={`inline-flex ${buttonClass} shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 ${
        disabled || pending.length >= COMMUNITY_COMMENT_MEDIA_MAX
          ? "pointer-events-none opacity-50"
          : "cursor-pointer"
      } ${className}`}
      aria-label="Attach images"
      title="Attach images"
      onMouseDown={(e) => {
        e.preventDefault();
        onAttachInteract?.();
      }}
    >
      <Paperclip className={`${iconClass} shrink-0`} strokeWidth={1.75} />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || pending.length >= COMMUNITY_COMMENT_MEDIA_MAX}
        onChange={(e) => {
          onAttachInteract?.();
          addPendingFiles(
            pending,
            Array.from(e.target.files ?? []),
            onChange,
            onError
          );
          e.target.value = "";
        }}
      />
    </label>
  );
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
      {pending.map((p) => (
        <li key={p.key} className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.previewUrl}
            alt=""
            className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
          />
          <button
            type="button"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
            aria-label="Remove image"
            disabled={disabled}
            onClick={() => remove(p.key)}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Compact stacked layout for reply composers. */
export function CommentImageComposer({
  pending,
  onChange,
  disabled = false,
  onError,
  onAttachInteract,
}: SharedProps) {
  return (
    <div className="space-y-2">
      <CommentAttachButton
        pending={pending}
        onChange={onChange}
        disabled={disabled}
        onError={onError}
        onAttachInteract={onAttachInteract}
      />
      <CommentImagePreviews
        pending={pending}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

export function clearPendingCommentImages(pending: PendingCommentImage[]): void {
  for (const p of pending) {
    URL.revokeObjectURL(p.previewUrl);
  }
}
