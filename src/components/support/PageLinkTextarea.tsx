"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { coachPages } from "@/components/community/ContentLinkPicker";
import { CHAT_PAGES } from "@/lib/support/chatPages";
import {
  activePageLinkQuery,
  insertPageLink,
  matchPageLinks,
  type PageLinkOption,
} from "@/lib/support/pageLinks";

function allPages(): PageLinkOption[] {
  const merged: PageLinkOption[] = [
    // "Scorecard" is what we call it in messages; the sidebar says BOSS Score.
    ...coachPages().map((page) =>
      page.label === "BOSS Score"
        ? { ...page, description: `${page.description ?? ""} scorecard` }
        : page
    ),
    { path: "/coach/campaigns?tab=magnets", label: "Lead magnets", group: "Get Clients" },
    ...CHAT_PAGES.map((page) => ({
      path: page.path,
      label: page.name,
      group: page.group,
      description: page.about,
    })),
  ];
  return merged.filter(
    (page, i) => merged.findIndex((other) => other.path === page.path) === i
  );
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

type MenuPos = { left: number; width: number; top?: number; bottom?: number };

/** A textarea where `@@` opens a list of app pages and picking one adds a link. */
export function PageLinkTextarea({
  value,
  onValueChange,
  textareaRef,
  onKeyDown,
  ...rest
}: Props) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? ownRef;
  const pages = useMemo(() => allPages(), []);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  /** The `@@` Escape was pressed on, so it stays shut until a new one. */
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<MenuPos | null>(null);

  const active = focused ? activePageLinkQuery(value, caret) : null;
  const query = active?.query ?? null;
  const matches = useMemo(
    () => (query === null ? [] : matchPageLinks(pages, query)),
    [query, pages]
  );
  const open = Boolean(active) && active?.start !== dismissedStart && matches.length > 0;
  const shown = Math.min(highlight, Math.max(0, matches.length - 1));

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const above = rect.top > window.innerHeight - rect.bottom;
      setPos({
        left: rect.left,
        width: Math.min(rect.width, 420),
        ...(above
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, ref]);

  function pick(page: PageLinkOption) {
    if (!active) return;
    const { next, caret: nextCaret } = insertPageLink(
      value,
      { start: active.start, end: caret },
      page
    );
    onValueChange(next);
    setCaret(nextCaret);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function syncCaret(el: HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? 0);
  }

  return (
    <>
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          syncCaret(e.target);
          setHighlight(0);
        }}
        onSelect={(e) => syncCaret(e.currentTarget)}
        onClick={(e) => syncCaret(e.currentTarget)}
        onKeyUp={(e) => syncCaret(e.currentTarget)}
        onFocus={(e) => {
          setFocused(true);
          syncCaret(e.currentTarget);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          // ⌘ or Ctrl + Return still sends with the list open.
          if (open && !e.metaKey && !e.ctrlKey) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : matches.length - 1;
              setHighlight((shown + step) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[shown]!);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setDismissedStart(active?.start ?? null);
              return;
            }
          }
          onKeyDown?.(e);
        }}
      />
      {open && pos
        ? createPortal(
            <ul
              role="listbox"
              aria-label="Link a page"
              style={pos}
              className="fixed z-[300] max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {matches.map((page, i) => (
                <li key={page.path} role="option" aria-selected={i === shown}>
                  <button
                    type="button"
                    // Keep focus in the textarea so the caret stays put.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(page);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm ${
                      i === shown ? "bg-slate-100" : ""
                    }`}
                  >
                    <span className="truncate text-slate-900">{page.label}</span>
                    <span className="shrink-0 text-xs text-slate-500">{page.group}</span>
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </>
  );
}
