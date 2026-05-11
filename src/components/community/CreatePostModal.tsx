"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, ImagePlus, Video, X } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { CommunityCategory } from "@/components/community/CommunityFeed";
import { MentionTextarea } from "@/components/community/MentionTextarea";
import {
  COMMUNITY_POST_MEDIA_MAX,
  firstCommunityPostImageUrl,
  inferCommunityPostMediaKindFromUrl,
  uploadCommunityPostMediaFile,
} from "@/lib/communityPostMedia";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  coachPersonaForCommunity,
  getCommunityAuthorId,
} from "@/lib/communityEffectiveAuthorId";
import { capitalizeFirstUnicodeLetter } from "@/lib/communityPostCapitalize";

type Props = {
  categories: CommunityCategory[];
  avatarUrl?: string | null;
  authorLabel?: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

type PendingMedia = { key: string; file: File; previewUrl: string };

function toLocalDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CreatePostModal({
  categories,
  avatarUrl = null,
  authorLabel = "You",
  onClose,
  onCreated,
}: Props) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorRole, setAuthorRole] = useState<string | null>(null);
  const [schedulePopoverOpen, setSchedulePopoverOpen] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const isAuthorAdmin = authorRole === "admin";
  const announcementsCategory = useMemo(
    () => categories.find((c) => c.slug === "announcements") ?? null,
    [categories]
  );
  const selectableCategories = useMemo(
    () =>
      isAuthorAdmin
        ? categories
        : categories.filter((c) => c.slug !== "announcements"),
    [categories, isAuthorAdmin]
  );

  useEffect(() => {
    if (categoryId && !selectableCategories.some((c) => c.id === categoryId)) {
      setCategoryId("");
    }
  }, [categoryId, selectableCategories]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const authorId = await getCommunityAuthorId(
        coachPersonaForCommunity(pathname, impersonatingCoachId)
      );
      if (!authorId) {
        if (!cancelled) setAuthorRole(null);
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", authorId)
        .maybeSingle();
      if (!cancelled) setAuthorRole((data?.role as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId, pathname]);

  const revokeAllPending = useCallback((items: PendingMedia[]) => {
    for (const p of items) {
      URL.revokeObjectURL(p.previewUrl);
    }
  }, []);

  const addPendingFiles = useCallback(
    (files: File[]) => {
      setPendingMedia((prev) => {
        const room = COMMUNITY_POST_MEDIA_MAX - prev.length;
        if (room <= 0) return prev;
        const slice = files.slice(0, room);
        const next: PendingMedia[] = slice.map((file) => ({
          key: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        return [...prev, ...next];
      });
    },
    []
  );

  const removePending = useCallback((key: string) => {
    setPendingMedia((prev) => {
      const found = prev.find((p) => p.key === key);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  const pendingMediaRef = useRef(pendingMedia);
  pendingMediaRef.current = pendingMedia;
  useEffect(() => {
    return () => {
      for (const p of pendingMediaRef.current) {
        URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !saving;

  const scheduledAtIso = useMemo(() => {
    if (!scheduledAtLocal) return null;
    const dt = new Date(scheduledAtLocal);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }, [scheduledAtLocal]);

  const scheduleSummary = useMemo(() => {
    if (!scheduledAtIso) return null;
    const dt = new Date(scheduledAtIso);
    return Number.isNaN(dt.getTime())
      ? null
      : dt.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }, [scheduledAtIso]);

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    if (!categoryId) {
      setError("Please choose a category before posting.");
      return;
    }
    if (announcementsCategory && categoryId === announcementsCategory.id && !isAuthorAdmin) {
      setError("Only admins can post in Announcements.");
      return;
    }
    if (isAuthorAdmin && scheduledAtIso) {
      const scheduleMs = new Date(scheduledAtIso).getTime();
      if (Number.isNaN(scheduleMs)) {
        setError("Pick a valid scheduled date and time.");
        return;
      }
      if (scheduleMs <= Date.now()) {
        setError("Scheduled time must be in the future.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    const authorId = await getCommunityAuthorId(
      coachPersonaForCommunity(pathname, impersonatingCoachId)
    );
    if (!authorId) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    const uploaded: { url: string; kind: "image" | "video" }[] = [];
    for (const p of pendingMedia) {
      const up = await uploadCommunityPostMediaFile(p.file, session?.access_token);
      if ("error" in up) {
        setError(up.error);
        setSaving(false);
        return;
      }
      uploaded.push(up.media);
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const mediaPayload = uploaded.length > 0 ? uploaded : null;
    const imageUrl = uploaded.length > 0 ? firstCommunityPostImageUrl(uploaded) : null;

    const { error: insErr } = await supabaseClient.from("community_posts").insert({
      author_id: authorId,
      category_id: categoryId,
      title: capitalizeFirstUnicodeLetter(trimmedTitle),
      body: capitalizeFirstUnicodeLetter(trimmedBody),
      image_url: imageUrl,
      media: mediaPayload,
      published_at:
        isAuthorAdmin && scheduledAtIso ? scheduledAtIso : new Date().toISOString(),
    });

    if (insErr) {
      const msg = supabaseErrorMessage(insErr);
      const hint = communityAccessHint(msg);
      setError(hint ? `${msg}\n\n${hint}` : msg);
      setSaving(false);
      return;
    }

    revokeAllPending(pendingMedia);
    setPendingMedia([]);
    await onCreated();
    setSaving(false);
  }, [
    body,
    canSubmit,
    categoryId,
    impersonatingCoachId,
    onCreated,
    pathname,
    pendingMedia,
    revokeAllPending,
    scheduledAtIso,
    isAuthorAdmin,
    title,
  ]);

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

  return (
    <div
      className="relative z-50 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
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
            <span className="text-xs font-semibold text-slate-600">ME</span>
          </span>
        )}
        <p id="create-post-title" className="text-[15px] text-slate-600">
          <span className="font-semibold text-slate-900">{authorLabel}</span>{" "}
          <span className="text-slate-500">new post</span>
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Categories did not load (Community failed to load from the database).
          Fix the error on the page, refresh, then try again.
        </p>
      ) : null}

      <div className="mt-3 space-y-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border-0 border-b border-slate-200 bg-transparent px-0 pb-2 text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-0"
        />
        <MentionTextarea
          value={body}
          onChange={setBody}
          placeholder="Write something…"
          autoResize
          maxAutoHeightPx={0}
          minAutoHeightPx={140}
          showFormattingToolbar
          className="w-full border-0 bg-transparent px-0 pb-1 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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
                    const files = Array.from(e.target.files ?? []);
                    addPendingFiles(files);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                title="Add a video"
                onClick={() => setVideoDialogOpen(true)}
              >
                <Video className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (error) setError(null);
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                >
                  <option value="">Select category</option>
                  {selectableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
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
                  {saving ? "Posting…" : scheduledAtIso ? "Schedule" : "Post"}
                </button>
                {isAuthorAdmin ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSchedulePopoverOpen((open) => !open)}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                        scheduledAtIso
                          ? "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      title={scheduledAtIso ? "Edit scheduled time" : "Schedule post"}
                      aria-label={scheduledAtIso ? "Edit scheduled time" : "Schedule post"}
                    >
                      <CalendarDays className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                    {schedulePopoverOpen ? (
                      <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Schedule post
                        </p>
                        <input
                          type="datetime-local"
                          value={scheduledAtLocal}
                          onChange={(e) => setScheduledAtLocal(e.target.value)}
                          min={toLocalDateTimeInputValue(new Date(Date.now() + 60_000))}
                          className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                            onClick={() => {
                              setScheduledAtLocal("");
                              setSchedulePopoverOpen(false);
                            }}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            onClick={() => setSchedulePopoverOpen(false)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {isAuthorAdmin && scheduleSummary ? (
                <p className="text-right text-[11px] text-sky-700">
                  Scheduled for {scheduleSummary}
                </p>
              ) : null}
            </div>
          </div>
          {pendingPreviews.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {pendingPreviews.map((p) => (
                <li key={p.key} className="relative inline-block">
                  {p.isVideo ? (
                    <video
                      src={p.previewUrl}
                      muted
                      playsInline
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  )}
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-900"
                    aria-label="Remove attachment"
                    onClick={() => removePending(p.key)}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!isAuthorAdmin && announcementsCategory ? (
            <p className="text-[11px] text-slate-500">Announcements are admin-only.</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-rose-600">{error}</p>
      ) : null}

      {videoDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold text-slate-900">Add video</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="YouTube, Loom, Vimeo, or Wistia link"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500"
                onClick={() => videoFileInputRef.current?.click()}
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Video className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <p className="text-sm">Drag and drop video here</p>
                <button
                  type="button"
                  className="mt-1 text-sm font-medium text-sky-700 hover:underline"
                >
                  or select file
                </button>
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) {
                      addPendingFiles(files);
                    }
                    e.target.value = "";
                    setVideoDialogOpen(false);
                  }}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-4">
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setVideoDialogOpen(false);
                  setVideoUrl("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                disabled={videoUrl.trim().length === 0}
                onClick={() => {
                  if (videoUrl.trim().length > 0) {
                    const next =
                      body.trim().length === 0 ? videoUrl.trim() : `${body}\n${videoUrl.trim()}`;
                    setBody(next);
                  }
                  setVideoDialogOpen(false);
                  setVideoUrl("");
                }}
              >
                ADD
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
