"use client";

import { ChevronRight, Columns3, MessageSquare, Rows3 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PropertyPill } from "@/components/admin/roadmap/roadmapPills";
import { ViewToggle } from "@/components/admin/roadmap/roadmapUi";
import { AvaHalo } from "@/components/ava/AvaHalo";
import {
  MessageStatusCircle,
  TinyAvatar,
  useBlueprintComments,
  useLaunchProgress,
  withBlueprintActivity,
  type ThreadActivity,
} from "@/components/messages/channelParts";
import { JOB_STATUSES, type JobStatus } from "@/lib/launch/jobStatus";
import { LAUNCH_THREADS, launchThread } from "@/lib/launch/threads";
import { useSectionComments } from "@/components/practice/comments/SectionCommentsContext";
import { formatSupportRelativeCompact, unreadStaffReplyCount, type SupportTicketAuthor } from "@/lib/support/tickets";

import { usePractice } from "@/components/practice/PracticeProvider";

import { useAvaOpen } from "./JobActivity";
import { BcaMark, COUNTED_JOBS, DoneBar, JOBS, JOB_GROUPS, JobStatusChip, JobStatusCircle, groupLabel, statusLabel } from "./jobParts";
import { JobPage, type JobOpen } from "./JobPage";
import { activityOf, useCoachThreads } from "./useCoachThreads";
import { useJobs, type JobState } from "./useJobs";

type View = "list" | "board";

const VIEWS: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "list", label: "List", icon: Rows3 },
  { key: "board", label: "Board", icon: Columns3 },
];

/** The coach's own Blueprint section, for the "Blueprint · …" tags on their messages. */
function coachSectionHref(ref: { page: { slug: string } }, key: string): string {
  return `/coach/blueprint/${ref.page.slug}#s-${key.replace(":", "-")}`;
}


/**
 * My Blueprint as jobs (job 176, admin only for now): the Blueprint upgraded
 * from a document of pages to a list of jobs, like Linear. Each job holds
 * what it is, its parts (the Blueprint sections where answers are captured)
 * and its chat with BCA. Replaces the Messages and Project tabs; the old
 * Blueprint stays one switch away until Zander has checked everything.
 */
export function JobsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { viewerIsAdmin, coachId, coach, threads, setThreads, loading, error, reload } = useCoachThreads();
  const [refreshKey, setRefreshKey] = useState(0);
  const progress = useLaunchProgress(coachId, refreshKey);
  const admin = viewerIsAdmin === true;
  const avaOpen = useAvaOpen(coachId, admin, refreshKey);
  const jobs = useJobs(progress, avaOpen);
  const { reload: reloadBlueprint } = usePractice();
  const blueprintByThread = useBlueprintComments(coachId, refreshKey, coachSectionHref);

  const view: View = params.get("view") === "board" ? "board" : "list";
  const jobKey = params.get("job");
  const messageId = params.get("message");

  // New page: admins only until it's ready.
  useEffect(() => {
    if (viewerIsAdmin === false) router.replace("/coach/blueprint");
  }, [viewerIsAdmin, router]);

  const go = useCallback(
    (next: { view?: View; job?: string | null; message?: string | null; tab?: string | null; part?: string | null }) => {
      const url = new URLSearchParams(params.toString());
      // Already read by the impersonation context; don't carry it into every link.
      url.delete("impersonate");
      for (const [name, value] of Object.entries(next)) {
        if (value && !(name === "view" && value === "list")) url.set(name, value);
        else url.delete(name);
      }
      const query = url.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const pinnedByKey = useMemo(() => {
    const map = new Map<string, (typeof threads)[number]>();
    for (const t of threads) if (launchThread(t.topic)) map.set(t.topic!, t);
    return map;
  }, [threads]);
  const oneOffs = threads.filter((t) => !launchThread(t.topic));
  const sectionComments = useSectionComments();
  /** A job's chat: its messages and Blueprint comments, and how many the coach hasn't read. */
  const activity = (key: string): ChatActivity | undefined => {
    const row = pinnedByKey.get(key);
    const merged = withBlueprintActivity(row ? activityOf(row.replies) : undefined, blueprintByThread[key]);
    if (!merged) return undefined;
    const unreadMessages = row && coachId ? unreadStaffReplyCount(row, row.replies, coachId) : 0;
    const unreadComments = (jobs[key]?.items ?? []).reduce(
      (sum, item) => sum + (item.sectionKey ? (sectionComments?.threads[item.sectionKey]?.unread ?? 0) : 0),
      0
    );
    return { ...merged, unread: unreadMessages + unreadComments };
  };

  const openJob = (key: string) => go({ job: key, message: null, tab: null, part: null });
  const openMessage = (id: string) => go({ job: null, message: id, tab: null, part: null });
  const back = () => go({ job: null, message: null, tab: null, part: null });

  const openThread = launchThread(jobKey);
  const openRow = messageId ? (threads.find((t) => t.id === messageId) ?? null) : null;
  const open: JobOpen | null = openThread
    ? { kind: "job", thread: openThread }
    : openRow
      ? { kind: "message", row: openRow }
      : null;

  // Esc goes back to the jobs, unless you're typing.
  const isOpen = Boolean(open);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (viewerIsAdmin !== true) return null;

  if (open && coach && coachId) {
    const key = open.kind === "job" ? open.thread.key : null;
    return (
      <JobPage
        open={open}
        row={open.kind === "job" ? (pinnedByKey.get(open.thread.key) ?? null) : open.row}
        job={key ? (jobs[key] ?? null) : null}
        coach={coach}
        coachId={coachId}
        comments={key ? (blueprintByThread[key] ?? []) : []}
        onBack={back}
        onOpenJob={openJob}
        onRowChange={(next) => setThreads((current) => current.map((t) => (t.id === next.id ? next : t)))}
        onStarted={async () => {
          await reload();
          setRefreshKey((n) => n + 1);
        }}
        admin={admin}
        initialTab={params.get("tab")}
        initialPart={params.get("part")}
        onOpenPart={(job, part) => go({ job, message: null, tab: "blueprint", part })}
        onAvaChanged={() => {
          reloadBlueprint();
          void reload();
          setRefreshKey((n) => n + 1);
        }}
      />
    );
  }

  // Optional jobs aren't counted: done means the needed ones.
  const states = COUNTED_JOBS.map((j) => jobs[j.key]);
  const doneJobs = states.filter((s) => s?.status === "done").length;
  const yours = states.filter((s) => s?.status === "review" || s?.status === "needs_you");
  const withBca = states.filter((s) => s?.status === "bca_todo" || s?.status === "in_progress").length;
  const help = LAUNCH_THREADS.find((t) => t.phase === null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        <div className="mx-auto w-full max-w-[84rem] px-5 pb-20 pt-8 md:px-10 md:pt-10">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <h1 className="text-title leading-tight text-slate-950">Your plan</h1>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <PropertyPill>
                  <ProgressRing share={COUNTED_JOBS.length ? doneJobs / COUNTED_JOBS.length : 0} />
                  <span className="tabular-nums">
                    {doneJobs} of {COUNTED_JOBS.length} done
                  </span>
                </PropertyPill>
                {yours.length ? (
                  <PropertyPill>
                    <JobStatusCircle status="needs_you" />
                    <span className="tabular-nums">{yours.length} need you</span>
                  </PropertyPill>
                ) : null}
                {withBca ? (
                  <PropertyPill muted>
                    <JobStatusCircle status="in_progress" />
                    <span className="tabular-nums">{withBca} with BCA</span>
                  </PropertyPill>
                ) : null}
              </div>
            </div>
            <ViewToggle value={view} options={VIEWS} onChange={(v) => go({ view: v })} />
          </header>

          {error ? <p className="mt-6 text-sm text-rose-700">{error}</p> : null}

          {loading ? (
            <div className="mt-8 space-y-2" aria-busy="true" aria-label="Loading your jobs">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <>
              {view === "board" ? (
                <div className="mt-8">
                  <JobsBoard jobs={jobs} coach={coach} activity={activity} onOpen={openJob} />
                </div>
              ) : (
                <div className="mt-8">
                  <div aria-hidden className={`${ROW_GRID} border-b border-slate-200 pb-2 text-caption font-medium text-slate-500`}>
                    <span className="pl-[1.625rem]">Job</span>
                    <span className="hidden xl:block">Description</span>
                    <span className="hidden sm:block">Progress</span>
                    <span>Status</span>
                    <span className="hidden xl:block">Who</span>
                    <span className="hidden xl:block">Chat</span>
                    <span className="hidden sm:block" />
                  </div>
                  {JOB_GROUPS.map((group) => {
                    const rows = JOBS.filter((j) => j.phase === group.phase);
                    const counted = rows.filter((j) => !j.optional);
                    const done = counted.filter((j) => jobs[j.key]?.status === "done").length;
                    return (
                      <section key={group.phase} aria-label={group.label}>
                        <div className="mt-px flex items-baseline gap-2.5 bg-slate-50 px-4 py-2">
                          <span className="text-sm font-semibold text-slate-900">{group.label}</span>
                          <span className="text-caption tabular-nums text-slate-400">
                            {done} of {counted.length} done
                          </span>
                        </div>
                        {rows.map((thread) =>
                          jobs[thread.key] ? (
                            <JobRow
                              key={thread.key}
                              job={jobs[thread.key]}
                              coach={coach}
                              activity={activity(thread.key)}
                              onOpen={() => openJob(thread.key)}
                            />
                          ) : null
                        )}
                      </section>
                    );
                  })}
                </div>
              )}

              <section className="mt-10" aria-labelledby="jobs-messages">
                <div className="flex items-baseline gap-2.5 bg-slate-50 px-4 py-2">
                  <h2 id="jobs-messages" className="text-sm font-semibold text-slate-900">
                    Anything else
                  </h2>
                  <span className="text-caption text-slate-400">Questions that aren&rsquo;t about one job</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {help ? (
                    <MessageRow
                      label={help.label}
                      icon={<MessageSquare className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
                      count={pinnedByKey.get(help.key)?.replies.length ?? 0}
                      onOpen={() => openJob(help.key)}
                    />
                  ) : null}
                  {oneOffs.map((row) => (
                    <MessageRow
                      key={row.id}
                      label={row.title?.trim() || row.details.slice(0, 120)}
                      icon={<MessageStatusCircle status={row.status} audience="coach" />}
                      count={row.replies.length}
                      muted={row.status === "resolved"}
                      onOpen={() => openMessage(row.id)}
                    />
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Job, Description, Progress, Status, Who, Chat and the chevron. Wide screens
 * show them all, descriptions in their own column so they line up; mid-size
 * screens keep job, progress and status; phones keep the job and its status.
 */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 sm:grid-cols-[minmax(0,1fr)_7.5rem_8rem_1rem] xl:grid-cols-[14rem_minmax(0,1fr)_7.5rem_8rem_7rem_4.5rem_1rem]";

function ProgressRing({ share }: { share: number }) {
  const r = 5.25;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0 -rotate-90" aria-hidden>
      <circle cx="7" cy="7" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke={share === 1 ? "#10b981" : "#0284c7"}
        strokeWidth="2"
        strokeDasharray={`${c * share} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

type Who = "you" | "bca" | "ava" | null;

/** Whose turn a job is: the coach, BCA, or Ava while she's writing part of it. */
function whoFor(job: JobState): Who {
  if (job.status === "done" || job.status === "later") return null;
  if (job.status === "needs_you" || job.status === "review") return "you";
  return job.items.some((i) => i.building) ? "ava" : "bca";
}

function WhoMark({ who, coach, withLabel = true }: { who: Who; coach: SupportTicketAuthor | null; withLabel?: boolean }) {
  if (!who) return <span className="text-sm text-slate-300">&ndash;</span>;
  const label = who === "you" ? "You" : who === "ava" ? "Ava" : "BCA";
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600" title={label}>
      {who === "you" ? (
        <TinyAvatar label={coach?.full_name ?? "You"} avatarUrl={coach?.avatar_url ?? null} />
      ) : who === "ava" ? (
        <AvaHalo size={20} />
      ) : (
        <BcaMark />
      )}
      {withLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}

type ChatActivity = ThreadActivity & { unread: number };

/** Messages on a job, and a "new" pill while some are unread. */
function ActivityCount({ activity }: { activity: ChatActivity | undefined }) {
  const count = activity?.count ?? 0;
  if (!activity || count === 0) return <span className="text-sm text-slate-300">&ndash;</span>;
  if (activity.unread > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
        title={`${activity.unread} new of ${count}`}
      >
        {activity.unread} new
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums text-slate-500" title={`${count} message${count === 1 ? "" : "s"}${activity.lastAt ? `, last ${formatSupportRelativeCompact(activity.lastAt)}` : ""}`}>
      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      {count}
    </span>
  );
}

/** One job as a table row: circle, name and what it's for, then progress, status, who and chat. */
function JobRow({
  job,
  coach,
  activity,
  onOpen,
}: {
  job: JobState;
  coach: SupportTicketAuthor | null;
  activity: ChatActivity | undefined;
  onOpen: () => void;
}) {
  const { thread, status } = job;
  // Only finished jobs fade. A job still to do matters as much as the rest (Zander, 2 Nov).
  const quiet = status === "done";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${ROW_GRID} group w-full border-b border-slate-100 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex w-3.5 shrink-0 justify-center">
          <JobStatusCircle status={status} />
        </span>
        <span className={`min-w-0 truncate text-sm font-medium ${quiet ? "text-slate-500" : "text-slate-900 group-hover:text-[#0c5290]"}`}>
          {thread.label}
        </span>
        {thread.optional ? <span className="shrink-0 text-caption text-slate-400">Optional</span> : null}
      </span>
      <span className={`hidden min-w-0 truncate text-sm xl:block ${quiet ? "text-slate-400" : "text-slate-500"}`}>{thread.hint}</span>
      <span className="hidden sm:block">
        {job.total ? <DoneBar done={job.done} total={job.total} /> : <span className="text-sm text-slate-300">&ndash;</span>}
      </span>
      <span>
        <JobStatusChip status={status} />
      </span>
      <span className="hidden xl:block">
        <WhoMark who={whoFor(job)} coach={coach} />
      </span>
      <span className="hidden xl:block">
        <ActivityCount activity={activity} />
      </span>
      <ChevronRight className="hidden h-4 w-4 text-slate-300 transition group-hover:text-slate-500 sm:block" aria-hidden />
    </button>
  );
}

/** Board: the same jobs in columns by status, like the roadmap board. To do (not started) folds to a strip. */
function JobsBoard({
  jobs,
  coach,
  activity,
  onOpen,
}: {
  jobs: Record<string, JobState>;
  coach: SupportTicketAuthor | null;
  activity: (key: string) => ChatActivity | undefined;
  onOpen: (key: string) => void;
}) {
  const byStatus = new Map<JobStatus, JobState[]>(JOB_STATUSES.map((s) => [s, []]));
  for (const thread of JOBS) if (jobs[thread.key]) byStatus.get(jobs[thread.key].status)!.push(jobs[thread.key]);
  const later = byStatus.get("later")!;
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {JOB_STATUSES.filter((s) => s !== "later").map((status) => {
        const column = byStatus.get(status)!;
        return (
          <section
            key={status}
            aria-label={statusLabel(status)}
            className="flex min-w-48 flex-1 basis-0 flex-col rounded-xl bg-slate-100/70 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1.5 pt-0.5">
              <span className="flex items-center gap-2">
                <JobStatusCircle status={status} />
                <span className="text-sm font-semibold text-slate-800">{statusLabel(status)}</span>
              </span>
              <span className="text-xs font-medium tabular-nums text-slate-400">{column.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {column.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">No jobs here.</p>
              ) : null}
              {column.map((job) => {
                const chat = activity(job.thread.key);
                const count = chat?.count ?? 0;
                return (
                  <button
                    key={job.thread.key}
                    type="button"
                    onClick={() => onOpen(job.thread.key)}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <div className="px-3.5 py-3">
                      <p className="text-caption font-medium text-slate-400">
                        {groupLabel(job.thread.phase)}
                        {job.thread.optional ? " · Optional" : ""}
                      </p>
                      <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900 group-hover:text-[#0c5290]">
                        {job.thread.label}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{job.thread.hint}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                        {job.total > 0 ? (
                          <span className="tabular-nums">
                            {job.done}/{job.total} done
                          </span>
                        ) : null}
                        {chat?.unread ? (
                          <span className="rounded-full bg-sky-600 px-1.5 py-px font-semibold tabular-nums text-white">
                            {chat.unread} new
                          </span>
                        ) : count > 0 ? (
                          <span className="flex items-center gap-1 tabular-nums">
                            <MessageSquare className="h-3 w-3" aria-hidden />
                            {count}
                          </span>
                        ) : null}
                        <span className="ml-auto">
                          <WhoMark who={whoFor(job)} coach={coach} withLabel={false} />
                        </span>
                      </div>
                    </div>
                    {job.total > 0 ? (
                      <div className="h-1 w-full bg-slate-100" aria-hidden>
                        <div
                          className={`h-full ${job.done === job.total ? "bg-emerald-500" : "bg-sky-600"}`}
                          style={{ width: `${(job.done / job.total) * 100}%` }}
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {later.length ? (
        <section
          aria-label={statusLabel("later")}
          className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-xl bg-slate-100/70 py-3"
          title={`${statusLabel("later")}: ${later.map((j) => j.thread.label).join(", ")}`}
        >
          <span className="text-xs font-semibold tabular-nums text-slate-500">{later.length}</span>
          <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ writingMode: "vertical-rl" }}>
            {statusLabel("later")}
          </span>
        </section>
      ) : null}
    </div>
  );
}

function MessageRow({
  label,
  icon,
  count,
  muted = false,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  muted?: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">{icon}</span>
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            muted ? "text-slate-500" : "text-slate-900 group-hover:text-[#0c5290]"
          }`}
        >
          {label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {count ? `${count} message${count === 1 ? "" : "s"}` : "No messages yet"}
        </span>
      </button>
    </li>
  );
}
