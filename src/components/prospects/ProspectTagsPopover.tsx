"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, Plus } from "lucide-react";
import {
  MAX_PROSPECT_TAG_LENGTH,
  MAX_PROSPECT_TAGS,
  normalizeProspectTag,
} from "@/lib/prospects/tags";
import {
  DEFAULT_PROSPECT_TAGS,
  mergeProspectTagCatalog,
  prospectTagTone,
  sortProspectTagCatalog,
} from "@/lib/prospects/tagAppearance";

const PANEL_WIDTH = 272;
const VIEWPORT_MARGIN = 12;

type Props = {
  open: boolean;
  tags: string[];
  catalog: string[];
  saving?: boolean;
  onClose: () => void;
  onChange: (tags: string[]) => Promise<void> | void;
  children: ReactNode;
};

function hasTag(tags: string[], tag: string): boolean {
  const key = tag.toLowerCase();
  return tags.some((item) => item.toLowerCase() === key);
}

export function ProspectTagsPopover({
  open,
  tags,
  catalog,
  saving = false,
  onClose,
  onChange,
  children,
}: Props) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setError(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

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

      const panelHeight = panelRef.current?.offsetHeight || 220;
      const stickyTop =
        document.querySelector("header")?.getBoundingClientRect().bottom ?? 72;
      const below = rect.bottom + 8;
      const above = rect.top - panelHeight - 8;
      let top = below;
      if (below + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
        top = above >= stickyTop + VIEWPORT_MARGIN ? above : below;
      }
      top = Math.min(
        top,
        window.innerHeight - panelHeight - VIEWPORT_MARGIN
      );
      top = Math.max(stickyTop + VIEWPORT_MARGIN, top);

      setPosition((cur) => {
        if (
          cur &&
          cur.left === left &&
          cur.top === top &&
          cur.width === width
        ) {
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
  }, [open, tags, catalog, draft, error]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      e.stopPropagation();
      onClose();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }

    const listen = window.setTimeout(() => {
      document.addEventListener("click", handlePointerDown, true);
    }, 0);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(listen);
      document.removeEventListener("click", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const query = normalizeProspectTag(draft) ?? "";
  const queryKey = query.toLowerCase();

  const rows = useMemo(() => {
    const list = mergeProspectTagCatalog(
      DEFAULT_PROSPECT_TAGS,
      tags,
      catalog
    );
    const filtered = query
      ? list.filter((tag) => tag.toLowerCase().includes(queryKey))
      : list;
    return sortProspectTagCatalog(filtered, tags);
  }, [catalog, query, queryKey, tags]);

  const canCreate =
    Boolean(query) && !rows.some((tag) => tag.toLowerCase() === queryKey);

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
      return;
    }
    if (tags.length >= MAX_PROSPECT_TAGS) {
      setError(`You can add up to ${MAX_PROSPECT_TAGS} tags.`);
      return;
    }
    setDraft("");
    await commit([...tags, tag]);
  }

  async function toggleTag(tag: string) {
    if (hasTag(tags, tag)) {
      await commit(tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
      return;
    }
    await addTag(tag);
  }

  const panel = open ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label="Tags"
        className="fixed z-[220] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5"
        style={{
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          width: position?.width ?? PANEL_WIDTH,
          visibility: position ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-900">Tags</p>
          <form
            className="mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canCreate) {
                void addTag(draft);
                return;
              }
              const match = rows.find((tag) => tag.toLowerCase() === queryKey);
              if (match) void toggleTag(match);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              disabled={saving}
              maxLength={MAX_PROSPECT_TAG_LENGTH}
              placeholder="Find or create a tag"
              aria-label="Find or create a tag"
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
            />
          </form>
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {rows.map((tag) => {
            const selected = hasTag(tags, tag);
            const tone = prospectTagTone(tag);
            return (
              <button
                key={tag}
                type="button"
                disabled={saving || (!selected && tags.length >= MAX_PROSPECT_TAGS)}
                onClick={() => void toggleTag(tag)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected ? tone.check : "border-slate-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {selected ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                </span>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.swatch}`}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{tag}</span>
              </button>
            );
          })}
          {canCreate ? (
            <button
              type="button"
              disabled={saving || tags.length >= MAX_PROSPECT_TAGS}
              onClick={() => void addTag(draft)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Create “{query}”
            </button>
          ) : null}
          {rows.length === 0 && !canCreate ? (
            <p className="px-3 py-3 text-sm text-slate-500">
              No matching tags. Press Enter to create one.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="border-t border-rose-100 px-3 py-2 text-xs text-rose-600">
            {error}
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {children}
      </div>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
