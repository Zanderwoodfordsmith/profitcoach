"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { normalizeSearchQuery } from "@/lib/search/types";
import {
  pathWithQuery,
  rememberSearchReturn,
  takeSearchReturn,
} from "@/lib/search/returnTo";

type SearchTopBarTriggerProps = {
  className?: string;
  /** Prefer expand-in-place; on very narrow mobile, jump to the search page. */
  compactNavigate?: boolean;
};

export function SearchTopBarTrigger({
  className = "",
  compactNavigate = false,
}: SearchTopBarTriggerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefix: "/admin" | "/coach" = pathname.startsWith("/admin")
    ? "/admin"
    : "/coach";
  const searchBase = `${prefix}/search`;
  const onSearchPage = pathname === searchBase;
  const qFromUrl = normalizeSearchQuery(searchParams.get("q"));
  const originPathRef = useRef<string | null>(null);
  const wasSearchPageRef = useRef(onSearchPage);

  const [open, setOpen] = useState(onSearchPage);
  const [value, setValue] = useState(onSearchPage ? qFromUrl : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onSearchPage) {
      if (originPathRef.current) {
        rememberSearchReturn(originPathRef.current, searchBase);
      }
      return;
    }
    originPathRef.current = pathWithQuery(pathname, searchParams);
  }, [onSearchPage, pathname, searchBase, searchParams]);

  useEffect(() => {
    if (wasSearchPageRef.current && !onSearchPage) {
      setOpen(false);
      setValue("");
    }
    wasSearchPageRef.current = onSearchPage;
  }, [onSearchPage]);

  useEffect(() => {
    if (!onSearchPage) return;
    setOpen(true);
    if (document.activeElement !== inputRef.current) {
      setValue(qFromUrl);
    }
  }, [onSearchPage, qFromUrl]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  const commitSearch = useCallback(
    (raw: string) => {
      const trimmed = normalizeSearchQuery(raw);
      if (onSearchPage) {
        const params = new URLSearchParams(searchParams.toString());
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
        params.delete("page");
        const qs = params.toString();
        router.replace(qs ? `${searchBase}?${qs}` : searchBase, { scroll: false });
        return;
      }
      if (trimmed.length < 2) return;
      setOpen(false);
      setValue("");
      router.push(`${searchBase}?q=${encodeURIComponent(trimmed)}`);
    },
    [onSearchPage, router, searchBase, searchParams]
  );

  const closeSearch = useCallback(() => {
    if (!onSearchPage) {
      setOpen(false);
      setValue("");
      return;
    }
    const ret = takeSearchReturn(prefix, searchBase);
    setOpen(false);
    setValue("");
    if (ret) {
      router.push(ret);
      return;
    }
    commitSearch("");
  }, [commitSearch, onSearchPage, prefix, router, searchBase]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    const onPointer = (e: MouseEvent) => {
      if (onSearchPage) return;
      if (!rootRef.current?.contains(e.target as Node)) {
        if (!value.trim()) setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [closeSearch, onSearchPage, open, value]);

  useEffect(() => {
    if (!onSearchPage || !open) return;
    const trimmed = normalizeSearchQuery(value);
    if (trimmed === qFromUrl) return;
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${searchBase}?${qs}` : searchBase, { scroll: false });
    }, 320);
    return () => window.clearTimeout(t);
  }, [onSearchPage, open, qFromUrl, router, searchBase, searchParams, value]);

  if (compactNavigate && !open && !onSearchPage) {
    return (
      <button
        type="button"
        aria-label="Search"
        title="Search"
        onClick={() => router.push(searchBase)}
        className={`bg-transparent p-2 text-slate-700 shadow-none ring-0 transition hover:text-slate-900 ${className}`}
      >
        <Search className="h-6 w-6" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className={`flex items-center justify-end ${className}`}>
      <div
        className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
          open
            ? "w-[min(18rem,calc(100vw-7rem))] rounded-full border border-slate-200 bg-white pl-3 pr-1 shadow-sm"
            : "w-10 border-0 bg-transparent shadow-none"
        }`}
      >
        {open ? (
          <>
            <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSearch(value);
                }
              }}
              placeholder="Search…"
              className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              aria-label="Search classroom, community, and members"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={closeSearch}
              className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Search"
            title="Search"
            onClick={() => setOpen(true)}
            className="bg-transparent p-2 text-slate-700 shadow-none ring-0 transition hover:text-slate-900"
          >
            <Search className="h-6 w-6" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}
