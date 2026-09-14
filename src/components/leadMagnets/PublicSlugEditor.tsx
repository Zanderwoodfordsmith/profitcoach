"use client";

import { useCallback, useEffect, useState } from "react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

const PUBLIC_SHARE_HOST = "theprofitcoach.com";

type Props = {
  slug: string;
  onSlugChange: (slug: string) => void;
  framed?: boolean;
};

export function PublicSlugEditor({ slug, onSlugChange, framed = true }: Props) {
  const [draft, setDraft] = useState(slug);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"success" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(slug);
  }, [slug]);

  const save = useCallback(async () => {
    const normalized = draft.toLowerCase().trim();
    if (!normalized) {
      setMessage("error");
      setError("Add a slug so share links work.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      setMessage("error");
      setError("Lowercase letters, numbers, and hyphens only.");
      return;
    }
    const headers = await getCoachAuthHeaders();
    if (!headers) {
      setMessage("error");
      setError("Sign in required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ slug: normalized }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setMessage("error");
      setError(body.error ?? "Could not save.");
      return;
    }
    setDraft(normalized);
    onSlugChange(normalized);
    setMessage("success");
    window.setTimeout(() => setMessage(null), 2000);
  }, [draft, onSlugChange]);

  return (
    <div
      className={
        framed
          ? "rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm shadow-slate-200/40"
          : ""
      }
    >
      <p
        className={
          framed
            ? "text-sm font-semibold text-slate-900"
            : "text-lg font-bold leading-snug text-slate-900"
        }
      >
        Your public URL
      </p>
      <p
        className={
          framed
            ? "mt-0.5 text-[13px] leading-snug text-slate-500"
            : "mt-2 text-sm leading-relaxed text-slate-600"
        }
      >
        Used on Boss Score, Boss Pro, and booking links.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
          <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500">
            {PUBLIC_SHARE_HOST}/
          </span>
          <input
            id="public-url-slug"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toLowerCase())}
            onBlur={() => {
              if (draft.trim() !== slug) void save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            placeholder="your-name"
            autoComplete="off"
            spellCheck={false}
            aria-label="Public URL slug"
            className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="shrink-0 text-[15px] font-medium text-[#0c5290] hover:text-[#051e36] disabled:text-slate-300"
        >
          {saving ? "Saving" : message === "success" ? "Saved" : "Save"}
        </button>
      </div>
      {message === "error" && error ? (
        <p className="mt-2 text-[13px] text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
