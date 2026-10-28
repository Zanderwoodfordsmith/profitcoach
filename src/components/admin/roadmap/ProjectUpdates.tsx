"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_HEALTHS,
  PROJECT_HEALTH_META,
  UPDATE_STALE_DAYS,
  healthOf,
  type ProjectHealth,
  type RoadmapProjectUpdate,
} from "@/lib/roadmap/projectTypes";
import { buttonClass } from "@/components/ui/Button";
import { HealthChip } from "./roadmapHealth";
import { roadmapAuthHeaders } from "./useRoadmapData";

function day(at: string): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * A project's updates, like Linear's: how it's going (on track, at risk, off
 * track) and a few lines on why. The latest one is the project's health on the
 * Initiatives tab; after a week without one, its dot turns grey.
 */
export function ProjectUpdates({
  project,
  onPosted,
}: {
  project: string;
  onPosted: (update: RoadmapProjectUpdate) => void;
}) {
  const [updates, setUpdates] = useState<RoadmapProjectUpdate[] | null>(null);
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await roadmapAuthHeaders();
      if (!headers || cancelled) return;
      const res = await fetch(`/api/admin/roadmap/projects/updates?project=${encodeURIComponent(project)}`, { headers }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { updates?: RoadmapProjectUpdate[] } | null;
      if (!cancelled) setUpdates(data?.updates ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  const post = async () => {
    if (!health) return;
    setPosting(true);
    setError(null);
    const headers = await roadmapAuthHeaders();
    const res = headers
      ? await fetch("/api/admin/roadmap/projects/updates", {
          method: "POST",
          headers,
          body: JSON.stringify({ project, health, body }),
        }).catch(() => null)
      : null;
    const data = (await res?.json().catch(() => null)) as { update?: RoadmapProjectUpdate; error?: string } | null;
    setPosting(false);
    if (!res?.ok || !data?.update) {
      setError(data?.error ?? "That didn't post. Try again.");
      return;
    }
    setUpdates((prev) => [data.update!, ...(prev ?? [])]);
    onPosted(data.update);
    setHealth(null);
    setBody("");
  };

  const now = healthOf(updates?.[0]);
  const shown = all ? updates ?? [] : (updates ?? []).slice(0, 3);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium tracking-[-0.01em] text-slate-950">Updates</h2>
        {updates ? <HealthChip health={now} /> : null}
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How is it going?">
          {PROJECT_HEALTHS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={health === h}
              onClick={() => setHealth(h)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                health === h ? `${PROJECT_HEALTH_META[h].chip} border-transparent` : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${PROJECT_HEALTH_META[h].dot}`} aria-hidden />
              {PROJECT_HEALTH_META[h].label}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="How's it going? What's done, what's next, anything in the way."
          className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {health ? `Post one at least every ${UPDATE_STALE_DAYS} days, or its dot turns grey.` : "Pick how it's going first."}
          </p>
          <button type="button" disabled={!health || posting} onClick={() => void post()} className={buttonClass("main", "small")}>
            {posting ? "Posting…" : "Post update"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
      </div>

      {updates === null ? (
        <p className="mt-3 text-sm text-slate-400">Loading updates…</p>
      ) : updates.length ? (
        <ol className="mt-4 space-y-4">
          {shown.map((u) => (
            <li key={u.id} className="border-l-2 border-slate-200 pl-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <HealthChip health={u.health} />
                <span>{u.author_name ?? "Admin"}</span>
                <span className="tabular-nums">{day(u.created_at)}</span>
              </div>
              {u.body ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{u.body}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-slate-400">No updates yet.</p>
      )}
      {updates && updates.length > 3 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-900">
          {all ? "Show the latest only" : `Show all ${updates.length}`}
        </button>
      ) : null}
    </section>
  );
}
