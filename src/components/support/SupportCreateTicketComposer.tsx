"use client";

import { ImagePlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { profileInitialsFromName } from "@/lib/communityProfile";
import {
  COMMUNITY_POST_MEDIA_MAX,
  inferCommunityPostMediaKindFromUrl,
  uploadCommunityPostMediaFile,
  validateCommunityPostMediaFile,
  type CommunityPostMediaItem,
} from "@/lib/communityPostMedia";
import { notifySupportCountsChanged } from "@/components/layout/useNewFeedbackCount";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  SUPPORT_AUTHOR_SELECT,
  normalizeSupportAuthor,
  normalizeSupportTicketType,
  mapSupportTicketRow,
  type SupportTicket,
  type SupportTicketType,
} from "@/lib/support/tickets";

type PendingMedia = { key: string; file: File; previewUrl: string };

const TYPE_OPTIONS: { value: SupportTicketType; label: string }[] = [
  { value: "question", label: "Question" },
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
];

type Props = {
  avatarUrl: string | null;
  authorLabel: string;
  onClose: () => void;
  onCreated: (ticket: SupportTicket) => void;
};

export function SupportCreateTicketComposer({
  avatarUrl,
  authorLabel,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [type, setType] = useState<SupportTicketType>("question");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    details.trim().length > 0 &&
    !saving;

  const pendingPreviews = useMemo(
    () =>
      pendingMedia.map((p) => ({
        key: p.key,
        previewUrl: p.previewUrl,
        isVideo:
          p.file.type.startsWith("video/") ||
          inferCommunityPostMediaKindFromUrl(p.file.name) === "video",
      })),
    [pendingMedia]
  );

  function addPendingFiles(files: File[]) {
    const room = COMMUNITY_POST_MEDIA_MAX - pendingMedia.length;
    if (room <= 0) return;
    const next = [...pendingMedia];
    for (const file of files.slice(0, room)) {
      const validated = validateCommunityPostMediaFile(file);
      if ("error" in validated) {
        setError(validated.error);
        continue;
      }
      next.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingMedia(next);
  }

  function removePending(key: string) {
    const removed = pendingMedia.find((p) => p.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    setPendingMedia(pendingMedia.filter((p) => p.key !== key));
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user?.id) throw new Error("Could not determine your account.");

      const media: CommunityPostMediaItem[] = [];
      for (const item of pendingMedia) {
        const up = await uploadCommunityPostMediaFile(item.file);
        if ("error" in up) throw new Error(up.error);
        media.push(up.media);
      }

      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_reports")
        .insert({
          created_by: user.id,
          type,
          title: title.trim(),
          details: details.trim(),
          media: media.length > 0 ? media : null,
          page_path:
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : null,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        })
        .select(
          `id, created_at, created_by, ticket_number, type, title, details, page_path, status, media, author:profiles!created_by (${SUPPORT_AUTHOR_SELECT})`
        )
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("Ticket was not created.");

      const created = mapSupportTicketRow(data);
      for (const p of pendingMedia) URL.revokeObjectURL(p.previewUrl);
      notifySupportCountsChanged();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="relative z-50 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-ticket-title"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:bg-slate-50 hover:text-slate-800"
        aria-label="Close"
      >
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
            <span className="text-xs font-semibold text-slate-600">
              {profileInitialsFromName(authorLabel)}
            </span>
          </span>
        )}
        <p id="create-ticket-title" className="text-[15px] text-slate-600">
          <span className="font-semibold text-slate-900">Your</span>{" "}
          <span className="text-slate-500">new ticket</span>
        </p>
      </div>

      <div className="mt-3 space-y-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border-0 border-b border-slate-200 bg-transparent px-0 pb-2 text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-0"
        />
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened? What were you trying to do?"
          rows={5}
          className="w-full resize-y border-0 bg-transparent px-0 pb-1 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        {pendingPreviews.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pendingPreviews.map((p) => (
              <li key={p.key} className="relative">
                {p.isVideo ? (
                  <video
                    src={p.previewUrl}
                    muted
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                )}
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                  aria-label="Remove attachment"
                  onClick={() => removePending(p.key)}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50/80 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            aria-label="Add photos or videos"
            title="Add photos or videos"
          >
            <ImagePlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              className="sr-only"
              disabled={pendingMedia.length >= COMMUNITY_POST_MEDIA_MAX}
              onChange={(e) => {
                addPendingFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SupportTicketType)}
              aria-label="Ticket type"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onClose}
              className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
              className="rounded-lg bg-sky-700 px-5 py-2.5 text-base font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
