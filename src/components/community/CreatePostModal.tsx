"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
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
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

type PendingMedia = { key: string; file: File; previewUrl: string };

export function CreatePostModal({ categories, onClose, onCreated }: Props) {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorRole, setAuthorRole] = useState<string | null>(null);
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
    if (!selectableCategories.some((c) => c.id === categoryId)) {
      setCategoryId(selectableCategories[0]?.id ?? "");
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

  const canSubmit =
    title.trim().length > 0 && body.trim().length > 0 && categoryId && !saving;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    if (announcementsCategory && categoryId === announcementsCategory.id && !isAuthorAdmin) {
      setError("Only admins can post in Announcements.");
      return;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="create-post-title"
          className="text-lg font-semibold text-slate-900"
        >
          New post
        </h2>

        {categories.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Categories did not load (Community failed to load from the database).
            Fix the error on the page, refresh, then try again.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <MentionTextarea
            value={body}
            onChange={setBody}
            placeholder="Write something… Use @ to mention someone."
            rows={6}
            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="text-xs leading-snug text-slate-500">
            Basic{" "}
            <span className="font-medium text-slate-600">Markdown</span> is
            supported: **bold**, *italic*, # headings, - bullets, numbered lists,
            blockquotes, and links (https://…).
          </p>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">
                <ImagePlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>Add photos or videos</span>
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
              <span className="text-xs text-slate-500">
                Up to {COMMUNITY_POST_MEDIA_MAX} files · images max 5MB · videos max
                50MB
              </span>
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
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {selectableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {!isAuthorAdmin && announcementsCategory ? (
              <p className="mt-1 text-xs text-slate-500">
                Announcements are admin-only.
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-rose-600">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
