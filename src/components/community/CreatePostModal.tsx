"use client";

import { useCallback, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { CommunityCategory } from "@/components/community/CommunityFeed";
import { MentionTextarea } from "@/components/community/MentionTextarea";
import {
  communityAccessHint,
  supabaseErrorMessage,
} from "@/lib/supabaseErrorMessage";

type Props = {
  categories: CommunityCategory[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

export function CreatePostModal({ categories, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 && body.trim().length > 0 && categoryId && !saving;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const { error: insErr } = await supabaseClient.from("community_posts").insert({
      author_id: user.id,
      category_id: categoryId,
      title: title.trim(),
      body: body.trim(),
    });

    if (insErr) {
      const msg = supabaseErrorMessage(insErr);
      const hint = communityAccessHint(msg);
      setError(hint ? `${msg}\n\n${hint}` : msg);
      setSaving(false);
      return;
    }

    await onCreated();
    setSaving(false);
  }, [body, canSubmit, categoryId, onCreated, title]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
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
