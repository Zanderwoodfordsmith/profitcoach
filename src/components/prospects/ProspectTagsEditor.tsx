"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  MAX_PROSPECT_TAG_LENGTH,
  MAX_PROSPECT_TAGS,
  normalizeProspectTag,
} from "@/lib/prospects/tags";

type Props = {
  tags: string[];
  suggestions?: string[];
  saving?: boolean;
  onChange: (tags: string[]) => Promise<void> | void;
};

export function ProspectTagsEditor({
  tags,
  suggestions = [],
  saving = false,
  onChange,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const unusedSuggestions = useMemo(() => {
    const have = new Set(tags.map((tag) => tag.toLowerCase()));
    return suggestions.filter((tag) => !have.has(tag.toLowerCase())).slice(0, 8);
  }, [suggestions, tags]);

  async function commit(next: string[]) {
    setError(null);
    try {
      await onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tags.");
    }
  }

  async function addTag(raw: string) {
    const tag = normalizeProspectTag(raw);
    if (!tag) return;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    if (tags.length >= MAX_PROSPECT_TAGS) {
      setError(`You can add up to ${MAX_PROSPECT_TAGS} tags.`);
      return;
    }
    setDraft("");
    await commit([...tags, tag]);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[12px] font-medium text-sky-900 ring-1 ring-inset ring-sky-200"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              disabled={saving}
              onClick={() =>
                void commit(tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()))
              }
              className="rounded-full p-0.5 text-sky-700 hover:bg-sky-100 disabled:opacity-50"
            >
              <X className="h-3 w-3" strokeWidth={2} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void addTag(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={saving}
          maxLength={MAX_PROSPECT_TAG_LENGTH}
          placeholder={tags.length ? "Add another tag" : "Add a tag"}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
          aria-label="Add a tag"
        />
        <button
          type="submit"
          disabled={saving || !draft.trim()}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {unusedSuggestions.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unusedSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={saving}
              onClick={() => void addTag(tag)}
              className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
