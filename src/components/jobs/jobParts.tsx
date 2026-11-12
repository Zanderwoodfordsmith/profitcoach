"use client";

import { JOB_STATUS_META, type JobStatus } from "@/lib/launch/jobStatus";
import { LAUNCH_THREADS, type LaunchPhaseKey, type LaunchThread } from "@/lib/launch/threads";

/** Every launch job, in order. Help & support is a chat, not a job. */
export const JOBS: LaunchThread[] = LAUNCH_THREADS.filter((t) => t.phase !== null);

/** The job list's groups: Launch ends at the connection campaign, then calls, clients and keeping them. */
export const JOB_GROUPS: { phase: LaunchPhaseKey; label: string }[] = [
  { phase: "get", label: "Launch" },
  { phase: "calls", label: "Get calls" },
  { phase: "win", label: "Get clients" },
  { phase: "keep", label: "Keep clients" },
];

/** The jobs that count towards done; optional ones don't. */
export const COUNTED_JOBS: LaunchThread[] = JOBS.filter((t) => !t.optional);

export function groupLabel(phase: LaunchPhaseKey | null): string {
  return JOB_GROUPS.find((g) => g.phase === phase)?.label ?? "";
}

export function statusLabel(status: JobStatus, audience: "coach" | "admin" = "coach"): string {
  const meta = JOB_STATUS_META[status];
  return audience === "coach" ? (meta.coachLabel ?? meta.label) : meta.label;
}

/** A slice from twelve o'clock, clockwise, inside the ring (centre 7,7; radius 3.5). */
function pie(fill: number): string {
  const angle = fill * 2 * Math.PI;
  const x = 7 + 3.5 * Math.sin(angle);
  const y = 7 - 3.5 * Math.cos(angle);
  return `M7 7 L7 3.5 A3.5 3.5 0 ${fill > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

const FILL: Partial<Record<JobStatus, number>> = { bca_todo: 0.25, in_progress: 0.5, review: 0.75 };

/**
 * The job's circle: dashed when it needs the coach (faint when it's for
 * later), a quarter, half and three quarters filled as BCA takes it to
 * review, and a tick once done. The roadmap's drawing, Zander's meanings.
 */
export function JobStatusCircle({
  status,
  className = "h-3.5 w-3.5",
  audience = "coach",
}: {
  status: JobStatus;
  className?: string;
  audience?: "coach" | "admin";
}) {
  const { color } = JOB_STATUS_META[status];
  const fill = FILL[status];
  const label = statusLabel(status, audience);
  return (
    <svg viewBox="0 0 14 14" className={`shrink-0 ${color} ${className}`} role="img" aria-label={label} fill="none">
      <title>{label}</title>
      {status === "needs_you" || status === "later" ? (
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.4 2.1" strokeLinecap="round" />
      ) : null}
      {fill ? (
        <>
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d={pie(fill)} fill="currentColor" />
        </>
      ) : null}
      {status === "done" ? (
        <>
          <circle cx="7" cy="7" r="7" fill="currentColor" />
          <path d="M4.2 7.2 6.1 9 9.8 5.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </svg>
  );
}

export function JobStatusChip({ status, audience = "coach" }: { status: JobStatus; audience?: "coach" | "admin" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${JOB_STATUS_META[status].chip}`}
    >
      {statusLabel(status, audience)}
    </span>
  );
}

/** Done out of total as a short bar, green once it's all done. */
export function DoneBar({ done, total, className = "w-14" }: { done: number; total: number; className?: string }) {
  if (total === 0) return null;
  return (
    <span className="inline-flex items-center gap-2" title={`${done} of ${total} done`}>
      <span className={`h-1 overflow-hidden rounded-full bg-slate-200/80 ${className}`} aria-hidden>
        <span
          className={`block h-full rounded-full ${done === total ? "bg-emerald-500" : "bg-sky-600"}`}
          style={{ width: `${(done / total) * 100}%` }}
        />
      </span>
      <span className="text-caption tabular-nums text-slate-500">
        {done}/{total}
      </span>
    </span>
  );
}

/** BCA as an assignee: the Profit Coach favicon (from the brand folder in Drive). */
export function BcaMark({ className = "h-5 w-5" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/bca-icon.svg" alt="" aria-hidden className={`${className} shrink-0 rounded`} />;
}
