"use client";

import { useEffect, useState, type ReactNode } from "react";

import { PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { supabaseClient } from "@/lib/supabaseClient";

const PREVIEW_KEY = "blueprint-preview-coach";

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
};

function coachName(c: CoachRow) {
  return c.full_name?.trim() || c.coach_business_name?.trim() || c.slug || "Coach";
}

/**
 * The coach-facing Blueprint pages, mounted in admin for one chosen coach.
 * The coach id is passed straight to the practice API, so the global
 * "View as coach" setting is never changed.
 */
export function BlueprintCoachPreview({ children }: { children: ReactNode }) {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
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
      const res = await fetch("/api/admin/coaches", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { coaches?: CoachRow[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not load coaches.");
        return;
      }
      const list = body.coaches ?? [];
      list.sort((a, b) => coachName(a).localeCompare(coachName(b), undefined, { sensitivity: "base" }));
      setCoaches(list);
    })();
  }, []);

  function choose(id: string) {
    const next = id || null;
    setCoachId(next);
    try {
      if (next) window.sessionStorage.setItem(PREVIEW_KEY, next);
      else window.sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      // Ignore: selection just will not survive a reload.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="blueprint-preview-coach" className="text-sm font-medium text-slate-700">
          Viewing as
        </label>
        <select
          id="blueprint-preview-coach"
          value={coachId ?? ""}
          onChange={(e) => choose(e.target.value)}
          className="min-w-[16rem] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Choose a coach…</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {coachName(c)}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">Edits and approvals save to this coach&apos;s blueprint.</p>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {coachId ? (
        <PracticeProvider key={coachId} coachId={coachId} basePath="/admin/blueprint/coach">
          <PracticeShell embedded>{children}</PracticeShell>
        </PracticeProvider>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          Choose a coach to see their blueprint the way they see it.
        </p>
      )}
    </div>
  );
}
