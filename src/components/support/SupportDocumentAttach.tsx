"use client";

import { Paperclip, X } from "lucide-react";
import {
  SUPPORT_DOCUMENT_ACCEPT,
  validateSupportMediaFile,
} from "@/lib/communityPostMedia";

export type PendingSupportDocument = {
  key: string;
  file: File;
};

export function takeSupportDocuments(
  files: FileList | File[] | null,
  room: number
): { accepted: PendingSupportDocument[]; error: string | null } {
  if (!files || room <= 0) {
    return { accepted: [], error: room <= 0 ? "You can attach up to 6 files." : null };
  }
  const accepted: PendingSupportDocument[] = [];
  let error: string | null = null;
  for (const file of Array.from(files).slice(0, room)) {
    const validated = validateSupportMediaFile(file);
    if ("error" in validated) {
      error = validated.error;
      continue;
    }
    if (validated.kind !== "file") {
      error = "Use the image or video button for that file type.";
      continue;
    }
    accepted.push({ key: crypto.randomUUID(), file });
  }
  return { accepted, error };
}

export function SupportDocumentAttachButton({
  disabled = false,
  onPick,
}: {
  disabled?: boolean;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <label
      title="Attach a document"
      className={`inline-flex cursor-pointer rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <Paperclip className="h-4 w-4" strokeWidth={1.75} />
      <span className="sr-only">Attach a document</span>
      <input
        type="file"
        accept={SUPPORT_DOCUMENT_ACCEPT}
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function SupportPendingDocuments({
  files,
  disabled = false,
  onRemove,
}: {
  files: PendingSupportDocument[];
  disabled?: boolean;
  onRemove: (key: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {files.map((item) => (
        <li
          key={item.key}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
            {item.file.name}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(item.key)}
            className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40"
            aria-label={`Remove ${item.file.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
