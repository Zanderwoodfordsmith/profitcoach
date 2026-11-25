"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fieldClass } from "@/components/ui/Field";
import { paginationItems } from "@/lib/communityPagination";

export const TABLE_PAGE_SIZE_OPTIONS = [20, 50, 100, 250, 500, 1000] as const;
export const TABLE_PAGE_SIZE_MIN = 1;
export const TABLE_PAGE_SIZE_MAX = 1000;
export const DEFAULT_TABLE_PAGE_SIZE = 50;

function isPresetPageSize(n: number): boolean {
  return (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

export function clampTablePageSize(n: number): number {
  return Math.min(TABLE_PAGE_SIZE_MAX, Math.max(TABLE_PAGE_SIZE_MIN, Math.floor(n)));
}

/** Page size saved in this browser under `key`, or the default. */
export function readStoredTablePageSize(key: string): number {
  if (typeof window === "undefined") return DEFAULT_TABLE_PAGE_SIZE;
  try {
    const n = Number(window.localStorage.getItem(key));
    if (Number.isInteger(n) && n >= TABLE_PAGE_SIZE_MIN && n <= TABLE_PAGE_SIZE_MAX) {
      return n;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TABLE_PAGE_SIZE;
}

export function storeTablePageSize(key: string, size: number) {
  try {
    window.localStorage.setItem(key, String(size));
  } catch {
    // ignore
  }
}

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  /** Called with a clamped size; the caller should also go back to page 1. */
  onPageSizeChange: (size: number) => void;
  totalCount: number;
  /** Plural noun for the empty label and the per-page aria label, e.g. "people". */
  noun?: string;
  ariaLabel?: string;
  className?: string;
};

/** Footer under a table: Show N per page (or Custom), the range, and page numbers. Same one as the Pool. */
export function TablePaginationFooter({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalCount,
  noun = "people",
  ariaLabel = "Pagination",
  className = "",
}: Props) {
  const [customPicked, setCustomPicked] = useState(false);
  // null = show the current page size; a string = what's being typed.
  const [draft, setDraft] = useState<string | null>(null);
  // A saved size that isn't a preset shows as Custom.
  const customPageSize = customPicked || !isPresetPageSize(pageSize);
  const customDraft = draft ?? String(pageSize);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusRef = useRef(false);

  useEffect(() => {
    if (!customPageSize || !shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [customPageSize]);

  const pageNumbers = useMemo(() => paginationItems(page, totalPages), [page, totalPages]);

  const rangeLabel =
    totalCount === 0
      ? `0 ${noun}`
      : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalCount)} of ${totalCount}`;

  function apply(next: number) {
    const clamped = clampTablePageSize(next);
    if (clamped !== pageSize) onPageSizeChange(clamped);
  }

  function handleSelect(value: string) {
    if (value === "custom") {
      shouldFocusRef.current = true;
      setDraft(null);
      setCustomPicked(true);
      return;
    }
    const next = Number(value);
    if (!isPresetPageSize(next)) return;
    setCustomPicked(false);
    apply(next);
  }

  function commitCustom() {
    const parsed = Number(customDraft);
    setDraft(null);
    if (!Number.isFinite(parsed) || customDraft.trim() === "") return;
    const next = clampTablePageSize(parsed);
    if (next === parsed && isPresetPageSize(next)) setCustomPicked(false);
    apply(next);
  }

  return (
    <nav
      className={`flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-label={ariaLabel}
    >
      <div className="inline-flex items-center gap-2 text-sm text-slate-500">
        <span>Show</span>
        <select
          value={customPageSize ? "custom" : pageSize}
          onChange={(e) => handleSelect(e.target.value)}
          className={fieldClass("select", "small", "w-auto!")}
          aria-label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} per page`}
        >
          {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {customPageSize ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={TABLE_PAGE_SIZE_MIN}
            max={TABLE_PAGE_SIZE_MAX}
            value={customDraft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className={fieldClass(
              "input",
              "small",
              "w-[4.5rem]! tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            )}
            aria-label={`Custom ${noun} per page`}
          />
        ) : null}
        <span>per page</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="tabular-nums text-sm text-slate-500">{rangeLabel}</p>
        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            {pageNumbers.map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`e-${idx}`} className="px-1.5 text-sm text-slate-400" aria-hidden>
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium ${
                    item === page ? "bg-sky-100 text-sky-800" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
