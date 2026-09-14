"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { ProspectTagChip } from "@/components/prospects/ProspectTagChip";
import {
  MAX_PROSPECT_TAG_LENGTH,
  MAX_PROSPECT_TAGS,
  normalizeProspectTag,
} from "@/lib/prospects/tags";
import {
  DEFAULT_PROSPECT_TAGS,
  mergeProspectTagCatalog,
  sortProspectTagCatalog,
} from "@/lib/prospects/tagAppearance";

const PANEL_WIDTH = 220;
const VIEWPORT_MARGIN = 12;

type Props = {
  tags: string[];
  catalog?: string[];
  saving?: boolean;
  disabled?: boolean;
  onChange: (tags: string[]) => Promise<void> | void;
};

function hasTag(tags: string[], tag: string): boolean {
  const key = tag.toLowerCase();
  return tags.some((item) => item.toLowerCase() === key);
}

export function ProspectHeaderTags({
  tags,
  catalog = [],
  saving = false,
  disabled = false,
  onChange,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setDraft("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !creating) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, creating]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
      let left = rect.left;
      left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN)
      );

      const panelHeight = panelRef.current?.offsetHeight || 180;
      const stickyTop =
        document.querySelector("header")?.getBoundingClientRect().bottom ?? 72;
      const below = rect.bottom + 6;
      const above = rect.top - panelHeight - 6;
      let top = below;
      if (below + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
        top = above >= stickyTop + VIEWPORT_MARGIN ? above : below;
      }
      top = Math.min(top, window.innerHeight - panelHeight - VIEWPORT_MARGIN);
      top = Math.max(stickyTop + VIEWPORT_MARGIN, top);

      setPosition((cur) => {
        if (cur && cur.left === left && cur.top === top && cur.width === width) {
          return cur;
        }
        return { left, top, width };
      });
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, tags, catalog, creating, draft, error]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (creating) {
          setCreating(false);
          setDraft("");
          setError(null);
          return;
        }
        setOpen(false);
      }
    }

    const listen = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown, true);
    }, 0);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(listen);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, creating]);

  const unused = useMemo(() => {
    const list = mergeProspectTagCatalog(DEFAULT_PROSPECT_TAGS, catalog);
    return sortProspectTagCatalog(
      list.filter((tag) => !hasTag(tags, tag)),
      []
    );
  }, [catalog, tags]);

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
    if (hasTag(tags, tag)) {
      setDraft("");
      setCreating(false);
      return;
    }
    if (tags.length >= MAX_PROSPECT_TAGS) {
      setError(`You can add up to ${MAX_PROSPECT_TAGS} tags.`);
      return;
    }
    setDraft("");
    setCreating(false);
    await commit([...tags, tag]);
  }

  async function removeTag(tag: string) {
    await commit(tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  }

  const canAddMore = tags.length < MAX_PROSPECT_TAGS;
  const query = normalizeProspectTag(draft) ?? "";

  const panel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="menu"
      aria-label="Add a tag"
      className="fixed z-[220] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: position?.width ?? PANEL_WIDTH,
        visibility: position ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="max-h-56 overflow-y-auto p-2">
        {unused.length ? (
          <div className="flex flex-wrap gap-1.5">
            {unused.map((tag) => (
              <ProspectTagChip
                key={tag}
                tag={tag}
                size="editor"
                disabled={saving || !canAddMore}
                title={`Add ${tag}`}
                onClick={() => void addTag(tag)}
              />
            ))}
          </div>
        ) : !creating ? (
          <p className="px-1 py-1.5 text-sm text-slate-500">
            {tags.length ? "Every tag is on this prospect." : "No tags yet."}
          </p>
        ) : null}
      </div>
      <div className="border-t border-slate-100">
        {creating ? (
          <form
            className="px-2 py-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void addTag(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              disabled={saving || !canAddMore}
              maxLength={MAX_PROSPECT_TAG_LENGTH}
              placeholder="New tag name"
              aria-label="New tag name"
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
            />
          </form>
        ) : (
          <button
            type="button"
            role="menuitem"
            disabled={saving || !canAddMore}
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            New tag
          </button>
        )}
      </div>
      {error ? (
        <p className="border-t border-rose-100 px-3 py-2 text-xs text-rose-600">
          {error}
        </p>
      ) : null}
      {query && creating ? (
        <span className="sr-only">Press Enter to create {query}</span>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || saving}
        aria-label={open ? "Close tags" : "Add a tag"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={
          disabled
            ? "Link a prospect to add tags"
            : open
              ? "Close"
              : "Add a tag"
        }
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
          open
            ? "bg-slate-800 text-white hover:bg-slate-700"
            : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        } disabled:opacity-50`}
      >
        {open ? (
          <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        ) : (
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        )}
      </button>
      {tags.length === 0 && !open ? (
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => {
            if (disabled) return;
            setOpen(true);
          }}
          className="text-[12px] font-medium text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
        >
          Add tag
        </button>
      ) : null}
      {tags.map((tag) => (
        <ProspectTagChip
          key={tag}
          tag={tag}
          size="editor"
          disabled={saving}
          removeOnHover
          onRemove={disabled ? undefined : () => void removeTag(tag)}
        />
      ))}
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
