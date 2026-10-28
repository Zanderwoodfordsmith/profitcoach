"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import {
  PROJECT_HEALTHS,
  PROJECT_HEALTH_META,
  healthOf,
  type ProjectHealth,
  type RoadmapProjectUpdate,
} from "@/lib/roadmap/projectTypes";
import { roadmapAuthHeaders } from "./useRoadmapData";

function day(at: string): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * A project's updates as a comment thread (28 Oct): oldest at the top, the
 * newest just above the box, like BOSS Pro's activity panel. Each update says
 * how it's going (on track, at risk, off track); the latest is the project's
 * health. The box starts on the last health so posting is one step.
 */
export function ProjectUpdates({
  project,
  onPosted,
}: {
  project: string;
  onPosted: (update: RoadmapProjectUpdate) => void;
}) {
  const [updates, setUpdates] = useState<RoadmapProjectUpdate[] | null>(null);
  const [health, setHealth] = useState<ProjectHealth>("on_track");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await roadmapAuthHeaders();
      if (!headers || cancelled) return;
      const res = await fetch(`/api/admin/roadmap/projects/updates?project=${encodeURIComponent(project)}`, { headers }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { updates?: RoadmapProjectUpdate[] } | null;
      if (cancelled) return;
      const list = data?.updates ?? [];
      setUpdates(list);
      if (list[0]) setHealth(list[0].health);
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  // The box grows with what's typed, up to about six lines.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [body]);

  const post = async () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    const headers = await roadmapAuthHeaders();
    const res = headers
      ? await fetch("/api/admin/roadmap/projects/updates", {
          method: "POST",
          headers,
          body: JSON.stringify({ project, health, body: body.trim() }),
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
    setBody("");
  };

  const newestFirst = updates ?? [];
  const shown = (all ? newestFirst : newestFirst.slice(0, 3)).slice().reverse();
  const now = healthOf(newestFirst[0]);

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ui font-medium text-slate-950">Updates</h2>
        {updates?.length ? (
          <span className="inline-flex items-center gap-1.5 text-caption text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${PROJECT_HEALTH_META[now].dot}`} aria-hidden />
            {PROJECT_HEALTH_META[now].label}
          </span>
        ) : null}
      </div>

      {updates === null ? (
        <p className="mt-3 text-sm text-slate-400">Loading…</p>
      ) : updates.length ? (
        <>
          {updates.length > 3 ? (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-caption font-medium text-slate-500 hover:text-slate-900">
              {all ? "Show the latest only" : `Show all ${updates.length}`}
            </button>
          ) : null}
          <ol className="mt-3 space-y-4">
            {shown.map((u) => {
              const who = u.author_name ?? "Admin";
              return (
                <li key={u.id} className="flex gap-2.5">
                  <span
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-caption font-medium text-slate-600"
                    aria-hidden
                  >
                    {who.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-caption text-slate-500">
                      <span className="font-medium text-slate-800">{who}</span>
                      <time className="tabular-nums">{day(u.created_at)}</time>
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${PROJECT_HEALTH_META[u.health].dot}`} aria-hidden />
                        {PROJECT_HEALTH_META[u.health].label}
                      </span>
                    </p>
                    {u.body ? <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{u.body}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">No updates yet. Say how it&apos;s going below.</p>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white transition focus-within:border-[#0c5290]/40 focus-within:ring-2 focus-within:ring-[#0c5290]/10">
        <textarea
          ref={box}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void post();
            }
          }}
          rows={1}
          placeholder="Post an update…"
          aria-label="Post an update"
          className="block w-full resize-none rounded-t-xl border-0 bg-transparent px-3 pt-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
          <div className="flex items-center gap-0.5" role="radiogroup" aria-label="How is it going?">
            {PROJECT_HEALTHS.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={health === h}
                onClick={() => setHealth(h)}
                title={PROJECT_HEALTH_META[h].label}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium transition ${
                  health === h ? PROJECT_HEALTH_META[h].chip : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${PROJECT_HEALTH_META[h].dot}`} aria-hidden />
                {health === h ? PROJECT_HEALTH_META[h].label : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!body.trim() || posting}
            onClick={() => void post()}
            aria-label="Post update"
            title="Post (Ctrl or Cmd + Enter)"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0c5290] text-white transition hover:bg-[#0a4479] disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-caption font-medium text-rose-600">{error}</p> : null}
    </section>
  );
}
