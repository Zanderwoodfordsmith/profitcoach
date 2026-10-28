"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import type { RoadmapJob } from "@/lib/roadmap/types";

/**
 * Claude on a card: the Hand to Claude button (popup header) and the progress
 * lines a cloud Claude session posts while it works (popup body), like Linear's
 * agent activity. See src/lib/roadmap/agent.ts.
 */

export function claudeIsBusy(job: RoadmapJob): boolean {
  return job.agent_status === "queued" || job.agent_status === "working";
}

/** Finished in the cloud, not yet pulled into the folder 3002 serves. */
export function claudeWaitingFor3002(job: RoadmapJob): boolean {
  return (
    job.agent_status === "done" &&
    Boolean(job.agent_head_sha) &&
    job.agent_head_sha !== job.agent_applied_sha &&
    !job.agent_pull_error
  );
}

export function HandToClaudeButton({
  job,
  onHand,
}: {
  job: RoadmapJob;
  onHand: (id: string) => Promise<string | null>;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = claudeIsBusy(job);
  const again = Boolean(job.agent_branch);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy || starting}
        onClick={async () => {
          setStarting(true);
          setError(null);
          setError(await onHand(job.id));
          setStarting(false);
        }}
        title={
          again
            ? "Claude carries on from where it stopped and reads your new comments first"
            : "Claude builds this card in the cloud; it lands on 3002 when done"
        }
        className={buttonClass("second", "small")}
      >
        {busy || starting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? "Claude is on it" : again ? "Send back to Claude" : "Hand to Claude"}
      </button>
      {error ? (
        <p className="absolute right-0 top-full z-10 mt-1 w-72 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const SHOWN = 6;

function time(at: string): string {
  return new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function StatusChip({ job }: { job: RoadmapJob }) {
  if (claudeIsBusy(job)) {
    return (
      <span className={badgeClass("blue", "gap-1.5")}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-600" />
        {job.agent_status === "queued" ? "Starting" : "Working"}
      </span>
    );
  }
  if (job.agent_status === "failed") {
    return <span className={badgeClass("red")}>Stopped</span>;
  }
  if (job.agent_pull_error) {
    return <span className={badgeClass("amber")}>Not on your Mac</span>;
  }
  if (claudeWaitingFor3002(job)) {
    return <span className={badgeClass("amber")}>Waiting for 3002</span>;
  }
  return <span className={badgeClass("green")}>On your Mac</span>;
}

export function ClaudePanel({ job }: { job: RoadmapJob }) {
  const [all, setAll] = useState(false);
  const log = job.agent_log ?? [];
  if (!log.length) return null;
  const lines = all ? log : log.slice(-SHOWN);
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Sparkles className="h-3.5 w-3.5 text-[#0c5290]" aria-hidden />
          Claude
        </h3>
        <StatusChip job={job} />
        {job.agent_branch ? <code className="text-xs text-slate-500">{job.agent_branch}</code> : null}
        {job.agent_session_url ? (
          <a
            href={job.agent_session_url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#0c5290] hover:underline"
          >
            Open the session
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
      {log.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {all ? "Show the latest only" : `Show all ${log.length}`}
        </button>
      ) : null}
      <ol className="mt-2 space-y-1">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`} className="flex gap-3 text-sm leading-snug">
            <span className="w-10 shrink-0 pt-px text-xs tabular-nums text-slate-400">{time(l.at)}</span>
            <span className={l.by === "app" ? "text-slate-500" : "text-slate-800"}>{l.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
