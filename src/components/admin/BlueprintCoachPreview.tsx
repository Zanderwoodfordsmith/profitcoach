"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { supabaseClient } from "@/lib/supabaseClient";

const PREVIEW_KEY = "blueprint-preview-coach";

/**
 * Show this coach when the Blueprint opens next. For links opened inside the
 * app (Support's docked chat): the page can mount before the address bar has
 * the new ?coach=, so it reads this instead.
 */
export function previewCoachNext(coachId: string) {
  try {
    window.sessionStorage.setItem(PREVIEW_KEY, coachId);
  } catch {
    // The ?coach= in the link still works on a full load.
  }
}
/** Picker value for a blank blueprint: what a brand new coach sees. Nothing is saved. */
const EMPTY_PREVIEW = "empty";
/** Shown first when no coach has been chosen yet. */
const DEMO_COACH_ID = "5cb89c87-88a9-4cfc-9f95-9591f74f8529";

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

/** A coach who has started a blueprint, from /api/admin/practice. */
type BlueprintRow = {
  coach_id: string;
  status: string | null;
  completeness_score: number | null;
};

/** progress: percent captured, drawn as a small ring; detail: the words behind it, on hover. */
type Option = { id: string; name: string; detail: string | null; progress: number | null; started: boolean };

/** A small ring for how much of a coach's Blueprint is captured. */
function ProgressRing({ value, title }: { value: number; title: string | null }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const done = value >= 100;
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 -rotate-90" role="img" aria-label={title ?? `${value}% captured`}>
      {title ? <title>{title}</title> : null}
      <circle cx="8" cy="8" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke={done ? "#1ec4b6" : "#1a8fd4"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, Math.max(0, value)) / 100) * c} ${c}`}
      />
    </svg>
  );
}

const STATUS_LABEL: Record<string, string> = {
  capturing: "Capturing",
  extracted: "Captured",
  coach_reviewed: "Coach reviewed",
  admin_reviewed: "BCA reviewed",
  decision_recorded: "Decision made",
  ready_to_build: "Ready to build",
  building: "Building",
};

function coachName(c: CoachRow) {
  return c.full_name?.trim() || c.coach_business_name?.trim() || c.slug || "Coach";
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Whose blueprint this is. Click the name to switch coach; the page stays the same. */
function CoachSwitcher({
  current,
  options,
  onChoose,
  onStep,
}: {
  current: Option | null;
  options: Option[];
  onChoose: (id: string) => void;
  onStep: (delta: 1 | -1) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The menu is drawn on the page body, under the button: the contents column clips anything inside it.
  const [at, setAt] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!boxRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function toggle() {
    setQuery("");
    if (open) return setOpen(false);
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) setAt({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)) });
    setOpen(true);
  }

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const name = current?.name ?? "Choose a coach";

  return (
    <div ref={boxRef} className="relative flex min-w-0 items-center">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title="Switch coach ( [ and ] step through)"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pl-4 pr-2 text-left hover:bg-slate-100"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-medium text-[#0f172a]">{name}</span>

        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && at ? createPortal(
        <div ref={menuRef} style={at} className="fixed z-[100] w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a coach"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          <ul className="mt-1 max-h-80 overflow-y-auto">
            {shown.map((o, i) => {
              const firstUnstarted = !o.started && (i === 0 || shown[i - 1]?.started);
              return (
                <li key={o.id}>
                  {firstUnstarted && !q ? (
                    <p className="px-2.5 pb-1 pt-2 text-kicker font-semibold uppercase text-slate-400">
                      Not started
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      onChoose(o.id);
                      setOpen(false);
                    }}
                    aria-current={o.id === current?.id ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                      o.id === current?.id ? "bg-slate-100 font-medium" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-800" title={o.detail ?? undefined}>
                      {o.name}
                    </span>
                    {o.progress !== null ? <ProgressRing value={o.progress} title={o.detail} /> : null}
                  </button>
                </li>
              );
            })}
            {!shown.length ? <li className="px-2.5 py-2 text-sm text-slate-500">No coach by that name.</li> : null}
          </ul>
          {/* Previous and next live here so the name gets the row's full width. The [ and ] keys work too. */}
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-1 pt-1.5">
            <button
              type="button"
              onClick={() => onStep(-1)}
              title="Previous coach ( [ )"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-caption font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Previous
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              title="Next coach ( ] )"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-caption font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

/**
 * Admin → Blueprint: exactly the coach's blueprint, for one coach at a time.
 * The coach id goes straight to the practice API, so the global "View as
 * coach" setting is never changed.
 */
export function BlueprintCoachPreview({ children }: { children: ReactNode }) {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [started, setStarted] = useState<BlueprintRow[]>([]);
  // Admin pages render only after the session check, so this runs client-side.
  const [coachId, setCoachId] = useState<string>(() => {
    try {
      // Links from the Coaches → Blueprint overview name the coach.
      const linked = new URLSearchParams(window.location.search).get("coach");
      if (linked) window.sessionStorage.setItem(PREVIEW_KEY, linked);
      return linked || window.sessionStorage.getItem(PREVIEW_KEY) || DEMO_COACH_ID;
    } catch {
      return DEMO_COACH_ID;
    }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Not signed in.");
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [res, practiceRes] = await Promise.all([
        fetch("/api/admin/coaches", { headers }),
        fetch("/api/admin/practice", { headers }),
      ]);
      const body = (await res.json().catch(() => ({}))) as { coaches?: CoachRow[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not load coaches.");
        return;
      }
      setCoaches(body.coaches ?? []);
      const practice = (await practiceRes.json().catch(() => ({}))) as { items?: BlueprintRow[] };
      setStarted(practice.items ?? []);
    })();
  }, []);

  /** Coaches with a blueprint first (what the arrows step through), then the rest, by name. */
  const options = useMemo<Option[]>(() => {
    const byId = new Map(started.map((row) => [row.coach_id, row]));
    const all = coaches.map((c) => {
      const row = byId.get(c.id);
      return {
        id: c.id,
        name: coachName(c),
        detail: row
          ? `${STATUS_LABEL[row.status ?? ""] ?? "Started"} · ${Math.round(row.completeness_score ?? 0)}% captured`
          : null,
        progress: row ? Math.round(row.completeness_score ?? 0) : null,
        started: Boolean(row),
      };
    });
    const sort = (a: Option, b: Option) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return [
      ...all.filter((o) => o.started).sort(sort),
      ...all.filter((o) => !o.started).sort(sort),
      { id: EMPTY_PREVIEW, name: "Empty blueprint", detail: "Preview only, nothing saves", progress: null, started: false },
    ];
  }, [coaches, started]);

  const choose = useCallback((id: string) => {
    setCoachId(id);
    try {
      window.sessionStorage.setItem(PREVIEW_KEY, id);
    } catch {
      // Selection just will not survive a reload.
    }
  }, []);

  const step = useCallback(
    (delta: 1 | -1) => {
      const ring = options.filter((o) => o.started);
      if (!ring.length) return;
      const at = ring.findIndex((o) => o.id === coachId);
      const from = at >= 0 ? at : delta === 1 ? -1 : 0;
      choose(ring[(from + delta + ring.length) % ring.length].id);
    },
    [choose, coachId, options]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "[") step(-1);
      else if (e.key === "]") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const current = options.find((o) => o.id === coachId) ?? null;
  const switcher = <CoachSwitcher current={current} options={options} onChoose={choose} onStep={step} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {error ? <p className="px-4 py-2 text-sm text-rose-600 md:px-6">{error}</p> : null}
      {coachId === EMPTY_PREVIEW ? (
        <PracticeProvider key={EMPTY_PREVIEW} sample basePath="/admin/blueprint/coach">
          <PracticeShell embedded switcher={switcher}>{children}</PracticeShell>
        </PracticeProvider>
      ) : (
        <PracticeProvider key={coachId} coachId={coachId} basePath="/admin/blueprint/coach">
          <PracticeShell embedded switcher={switcher}>{children}</PracticeShell>
        </PracticeProvider>
      )}
    </div>
  );
}
