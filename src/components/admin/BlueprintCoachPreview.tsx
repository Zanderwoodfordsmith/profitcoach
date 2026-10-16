"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { supabaseClient } from "@/lib/supabaseClient";

const PREVIEW_KEY = "blueprint-preview-coach";
/** Picker value for a blank blueprint: what a brand new coach sees. Nothing is saved. */
const EMPTY_PREVIEW = "empty";

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

/** A coach who has started a blueprint, from /api/admin/practice. */
type BlueprintRow = {
  coach_id: string;
  full_name: string;
  status: string | null;
  completeness_score: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  capturing: "Capturing",
  extracted: "Captured",
  coach_reviewed: "Coach reviewed",
  admin_reviewed: "BCA reviewed",
  decision_recorded: "Decision made",
  ready_to_build: "Ready to build",
  building: "Building",
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

type ToolbarSetter = (node: ReactNode) => void;

const BlueprintToolbarContext = createContext<ToolbarSetter | null>(null);

/** Lets the coach picker sit in the page header so the document sidebars can fill the page. */
export function BlueprintToolbarProvider({
  setToolbar,
  children,
}: {
  setToolbar: ToolbarSetter;
  children: ReactNode;
}) {
  return (
    <BlueprintToolbarContext.Provider value={setToolbar}>
      {children}
    </BlueprintToolbarContext.Provider>
  );
}

function coachName(c: CoachRow) {
  return c.full_name?.trim() || c.coach_business_name?.trim() || c.slug || "Coach";
}

/**
 * The coach-facing Blueprint pages, mounted in admin for one chosen coach.
 * The coach id is passed straight to the practice API, so the global
 * "View as coach" setting is never changed.
 */
export function BlueprintCoachPreview({ children }: { children: ReactNode }) {
  const setToolbar = useContext(BlueprintToolbarContext);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  /** Coaches with a blueprint, in name order: what the arrows page through. */
  const [started, setStarted] = useState<BlueprintRow[]>([]);
  // Admin pages render only after the session check, so this runs client-side.
  const [coachId, setCoachId] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(PREVIEW_KEY);
    } catch {
      return null;
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
      const list = body.coaches ?? [];
      list.sort((a, b) => coachName(a).localeCompare(coachName(b), undefined, { sensitivity: "base" }));
      setCoaches(list);
      const practice = (await practiceRes.json().catch(() => ({}))) as { items?: BlueprintRow[] };
      // Names from the coach list, so the switcher matches the rest of admin.
      const nameById = new Map(list.map((c) => [c.id, coachName(c)]));
      const rows = (practice.items ?? [])
        .filter((row) => nameById.has(row.coach_id))
        .map((row) => ({ ...row, full_name: nameById.get(row.coach_id) ?? row.full_name }));
      rows.sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }));
      setStarted(rows);
    })();
  }, []);

  const choose = useCallback((id: string) => {
    const next = id || null;
    setCoachId(next);
    try {
      if (next) window.sessionStorage.setItem(PREVIEW_KEY, next);
      else window.sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      // Ignore: selection just will not survive a reload.
    }
  }, []);

  const position = started.findIndex((row) => row.coach_id === coachId);
  const current = position >= 0 ? started[position] : null;

  /** Next or previous coach with a blueprint, staying on the same page. */
  const step = useCallback(
    (delta: 1 | -1) => {
      if (!started.length) return;
      const from = position >= 0 ? position : delta === 1 ? -1 : 0;
      const next = (from + delta + started.length) % started.length;
      choose(started[next].coach_id);
    },
    [choose, position, started]
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

  useLayoutEffect(() => {
    if (!setToolbar) return;
    setToolbar(
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="blueprint-preview-coach" className="text-sm font-medium text-slate-700">
          Viewing as
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!started.length}
            aria-label="Previous coach"
            title="Previous coach ( [ )"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <select
            id="blueprint-preview-coach"
            value={coachId ?? ""}
            onChange={(e) => choose(e.target.value)}
            className="min-w-[16rem] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Choose a coach…</option>
            <option value={EMPTY_PREVIEW}>Empty blueprint (preview, nothing saves)</option>
            {started.length ? (
              <optgroup label="With a blueprint">
                {started.map((row) => (
                  <option key={row.coach_id} value={row.coach_id}>
                    {row.full_name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={started.length ? "Not started" : "Coaches"}>
              {coaches
                .filter((c) => !started.some((row) => row.coach_id === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {coachName(c)}
                  </option>
                ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!started.length}
            aria-label="Next coach"
            title="Next coach ( ] )"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {coachId === EMPTY_PREVIEW
            ? "A blank blueprint. Try the boxes: nothing is saved."
            : current
              ? `${position + 1} of ${started.length} · ${STATUS_LABEL[current.status ?? ""] ?? "Started"} · ${Math.round(current.completeness_score ?? 0)}% captured. [ and ] switch coach, same page.`
              : "Edits and approvals save to this coach's blueprint. [ and ] switch coach, same page."}
        </p>
      </div>
    );
    return () => setToolbar(null);
  }, [setToolbar, coachId, coaches, choose, started, step, current, position]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {error ? <p className="px-4 py-2 text-sm text-rose-600 md:px-6">{error}</p> : null}
      {coachId === EMPTY_PREVIEW ? (
        <PracticeProvider key={EMPTY_PREVIEW} sample basePath="/admin/blueprint/coach">
          <PracticeShell embedded>{children}</PracticeShell>
        </PracticeProvider>
      ) : coachId ? (
        <PracticeProvider key={coachId} coachId={coachId} basePath="/admin/blueprint/coach">
          <PracticeShell embedded>{children}</PracticeShell>
        </PracticeProvider>
      ) : (
        <p className="m-4 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 md:m-6">
          Choose a coach to see their blueprint the way they see it.
        </p>
      )}
    </div>
  );
}
