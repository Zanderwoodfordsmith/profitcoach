"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { supabaseClient } from "@/lib/supabaseClient";

const PREVIEW_KEY = "blueprint-preview-coach";
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

type Option = { id: string; name: string; detail: string | null; started: boolean };

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

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
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

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const name = current?.name ?? "Choose a coach";

  return (
    <div ref={boxRef} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        title="Switch coach"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e0f2fe] text-[0.6875rem] font-bold text-[#075985]">
          {current?.id === EMPTY_PREVIEW ? "—" : initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-semibold text-[#0f172a]">{name}</span>
          {current?.detail ? (
            <span className="block truncate text-[0.6875rem] text-slate-500">{current.detail}</span>
          ) : null}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label="Previous coach"
        title="Previous coach ( [ )"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label="Next coach"
        title="Next coach ( ] )"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
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
                    <p className="px-2.5 pb-1 pt-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                      Not started
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      onChoose(o.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-800">{o.name}</span>
                      {o.detail ? <span className="block truncate text-xs text-slate-500">{o.detail}</span> : null}
                    </span>
                    {o.id === current?.id ? <Check className="h-4 w-4 shrink-0 text-[#0369a1]" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
            {!shown.length ? <li className="px-2.5 py-2 text-sm text-slate-500">No coach by that name.</li> : null}
          </ul>
        </div>
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
        started: Boolean(row),
      };
    });
    const sort = (a: Option, b: Option) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return [
      ...all.filter((o) => o.started).sort(sort),
      ...all.filter((o) => !o.started).sort(sort),
      { id: EMPTY_PREVIEW, name: "Empty blueprint", detail: "Preview only, nothing saves", started: false },
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
