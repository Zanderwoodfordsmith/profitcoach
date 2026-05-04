"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";

type CoachListRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

function coachDisplayName(c: CoachListRow): string {
  return (
    c.full_name?.trim() ||
    c.coach_business_name?.trim() ||
    c.slug ||
    "Coach"
  );
}

function coachSearchText(c: CoachListRow): string {
  return [c.full_name, c.coach_business_name, c.slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type Props = {
  coachName: string | null;
};

export function AdminCoachImpersonationSwitcher({ coachName }: Props) {
  const { impersonatingCoachId, setImpersonatingCoachId } = useImpersonation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coaches, setCoaches] = useState<CoachListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((c) => coachSearchText(c).includes(q));
  }, [coaches, query]);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setLoadError("Not signed in.");
        setCoaches([]);
        return;
      }
      const res = await fetch("/api/admin/coaches", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        coaches?: CoachListRow[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(body.error ?? "Could not load coaches.");
        setCoaches([]);
        return;
      }
      const list = body.coaches ?? [];
      list.sort((a, b) =>
        coachDisplayName(a).localeCompare(coachDisplayName(b), undefined, {
          sensitivity: "base",
        })
      );
      setCoaches(list);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleToggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setQuery("");
    void loadCoaches();
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectCoach(id: string) {
    if (id === impersonatingCoachId) {
      setOpen(false);
      return;
    }
    setImpersonatingCoachId(id);
    setOpen(false);
    setQuery("");
  }

  const label = coachName ?? "Coach";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={handleToggleOpen}
        className="group flex min-w-0 max-w-[10rem] items-center gap-0.5 rounded px-0.5 text-left sm:max-w-[14rem]"
        title="Switch to another coach (same page)"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate text-[11px] font-medium text-amber-950 underline decoration-amber-600/0 underline-offset-2 group-hover:decoration-amber-800/70 sm:text-xs">
          {label}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-amber-900 transition-transform sm:h-3.5 sm:w-3.5 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[110] w-[min(18rem,calc(100vw-5rem))] rounded-lg border border-amber-400/80 bg-white py-2 shadow-lg ring-1 ring-black/5"
          role="listbox"
          aria-label="Coaches"
        >
          <div className="px-2 pb-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or slug…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500"
              aria-label="Filter coaches"
            />
          </div>
          <div className="max-h-52 overflow-y-auto px-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : loadError ? (
              <p className="px-2 py-2 text-xs text-rose-600">{loadError}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">
                {coaches.length === 0 ? "No coaches found." : "No matches."}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((c) => {
                  const active = c.id === impersonatingCoachId;
                  const primary = coachDisplayName(c);
                  const secondary =
                    c.full_name?.trim() && c.coach_business_name?.trim()
                      ? c.coach_business_name
                      : null;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectCoach(c.id)}
                        className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                          active
                            ? "bg-amber-100 text-amber-950"
                            : "text-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        <span className="font-medium leading-tight">
                          {primary}
                        </span>
                        {secondary ? (
                          <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                            {secondary}
                          </span>
                        ) : null}
                        <span className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {c.slug}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
