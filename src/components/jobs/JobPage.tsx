"use client";

import dynamic from "next/dynamic";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MessageSquare, Play, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { PropertyPill } from "@/components/admin/roadmap/roadmapPills";
import { useDismiss } from "@/components/admin/roadmap/roadmapUi";
import { BlueprintCommentsBlock, MessageStatusCircle, TinyAvatar } from "@/components/messages/channelParts";
import { useSectionComments } from "@/components/practice/comments/SectionCommentsContext";
import { SectionView } from "@/components/practice/document/SectionView";
import { usePractice } from "@/components/practice/PracticeProvider";
import { SupportOpeningBody } from "@/components/support/SeeMoreText";
import { SupportTicketChat } from "@/components/support/SupportTicketChat";
import { buttonClass } from "@/components/ui/Button";
import { itemStatus, type JobStatus } from "@/lib/launch/jobStatus";
import { threadForSectionRef, type LaunchThread } from "@/lib/launch/threads";
import { BLUEPRINT_PAGES, BLUEPRINT_SECTIONS, fieldFilled, sectionByKey, type SectionRef } from "@/lib/practiceKnowledge/blueprint";
import { sectionWorkflow, todoOwner, type WorkflowStatus } from "@/lib/practiceKnowledge/sectionWorkflow";
import { unreadStaffReplyCount, type SupportReply, type SupportTicketAuthor } from "@/lib/support/tickets";
import { isViewingAsCoach } from "@/contexts/ImpersonationContext";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import { supabaseClient } from "@/lib/supabaseClient";
import "@/components/practice/document/blueprint.css";
import "./jobs.css";

import { ActivityTab } from "./JobActivity";
import { BcaMark, JOBS, JobStatusCircle, groupLabel, statusLabel } from "./jobParts";
import type { ProjectThread } from "./useCoachThreads";
import type { JobState } from "./useJobs";

// Loaded when a Blueprint section's comments open, as in the Blueprint itself.
const SidePanel = dynamic(() => import("@/components/practice/SidePanel").then((m) => m.SidePanel), { ssr: false });

const WELCOME_VIDEO = "/tutorials/blueprint-welcome.mp4";
const WELCOME_POSTER = "/tutorials/blueprint-welcome-poster.jpg";

export type JobOpen = { kind: "job"; thread: LaunchThread } | { kind: "message"; row: ProjectThread };

/**
 * One job, like a Linear issue (job 176): what it is and what we need on the
 * left, then its parts, which are the Blueprint sections where the answers
 * are captured (the same boxes Ava reads), then its other steps. Its chat
 * with BCA runs down the right. Help & support and one-off messages open as
 * a chat on their own.
 */
export function JobPage({
  open,
  row,
  job,
  coach,
  coachId,
  comments,
  onBack,
  onOpenJob,
  onRowChange,
  onStarted,
  admin = false,
  initialTab = null,
  initialPart = null,
  onAvaChanged,
  onOpenPart,
}: {
  open: JobOpen;
  /** The job's thread once someone has written in it. */
  row: ProjectThread | null;
  job: JobState | null;
  coach: SupportTicketAuthor;
  coachId: string;
  /** Blueprint comments filed under this job. */
  comments: SupportReply[];
  onBack: () => void;
  onOpenJob: (key: string) => void;
  onRowChange: (next: ProjectThread) => void;
  onStarted: () => Promise<void>;
  /** BCA viewing: shows the Activity tab, where Ava works for BCA. */
  admin?: boolean;
  /** Open on this tab ("activity" from the admin list). */
  initialTab?: string | null;
  /** Open the Blueprint tab at this part ("page:id"), with initialTab "blueprint". */
  initialPart?: string | null;
  /** Ava's work reached the Blueprint or the chat. */
  onAvaChanged?: () => void;
  /** Open another job's Blueprint tab at one of its parts. */
  onOpenPart?: (jobKey: string, sectionKey: string) => void;
}) {
  const sectionComments = useSectionComments();
  const [pane, setPane] = useState<"details" | "chat">("details");
  const scrollRef = useRef<HTMLDivElement>(null);
  const thread = open.kind === "job" ? open.thread : null;
  const key = thread?.key ?? (open.kind === "message" ? open.row.id : "");
  const title = thread?.label ?? (open.kind === "message" ? open.row.title?.trim() || "Message" : "");

  // A new job starts at the top, on its details, with no section comments open.
  // close changes whenever a thread opens, so it's read from a ref: only a new job closes it.
  const closeComments = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    closeComments.current = sectionComments?.close;
  });
  const [paneFor, setPaneFor] = useState(key);
  if (paneFor !== key) {
    setPaneFor(key);
    setPane("details");
  }
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    closeComments.current?.();
  }, [key]);

  // The coach opening a chat reads it, so its "new" goes. An admin viewing as them leaves it unread.
  const rowId = row?.id ?? null;
  const unread = row ? unreadStaffReplyCount(row, row.replies, coachId) : 0;
  const latestRow = useRef(row);
  useEffect(() => {
    latestRow.current = row;
  });
  useEffect(() => {
    if (!rowId || unread === 0 || isViewingAsCoach(coachId)) return;
    void supabaseClient.rpc("mark_support_ticket_read", { p_report_id: rowId }).then(({ error }) => {
      if (error || !latestRow.current) return;
      onRowChange({ ...latestRow.current, coach_last_read_at: new Date().toISOString() });
      notifyCoachSupportReadChanged();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opened chat with unread messages
  }, [rowId, unread > 0, coachId]);

  const index = thread ? JOBS.findIndex((j) => j.key === thread.key) : -1;
  const prev = index > 0 ? JOBS[index - 1] : null;
  const next = index >= 0 && index < JOBS.length - 1 ? JOBS[index + 1] : null;
  const chatCount = (row?.replies.length ?? 0) + comments.length;
  const commentsShown = Boolean(sectionComments?.panelOpen);
  const isJob = Boolean(thread && thread.phase !== null && job);
  const [look, setLook] = useJobsLook();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="flex min-h-12 shrink-0 items-center gap-x-2 border-b border-slate-200 px-3 py-1.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Jobs</span>
          <span className="sr-only sm:hidden">Back to the jobs</span>
        </button>
        <span className="select-none text-slate-300" aria-hidden>
          /
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{title}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className={`mr-1 rounded-lg border border-slate-200 lg:hidden ${isJob ? "flex" : "hidden"}`}>
            {(["details", "chat"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={pane === p}
                onClick={() => setPane(p)}
                className={`px-2.5 py-1 text-xs font-medium first:rounded-l-lg last:rounded-r-lg ${
                  pane === p ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p === "details" ? "Details" : `Chat${chatCount ? ` ${chatCount}` : ""}`}
              </button>
            ))}
          </div>
          {admin && isJob ? <LookSwitch look={look} onChange={setLook} /> : null}
          {index >= 0 ? (
            <>
              <span className="hidden text-caption tabular-nums text-slate-400 sm:inline">
                {index + 1} of {JOBS.length}
              </span>
              <button
                type="button"
                disabled={!prev}
                onClick={() => prev && onOpenJob(prev.key)}
                aria-label={prev ? `Previous job: ${prev.label}` : "No previous job"}
                title={prev?.label}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                disabled={!next}
                onClick={() => next && onOpenJob(next.key)}
                aria-label={next ? `Next job: ${next.label}` : "No next job"}
                title={next?.label}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      </header>

      {!isJob ? (
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          {row ? (
            <SupportTicketChat
              key={row.id}
              ticket={row}
              viewer={coach}
              viewerId={coachId}
              layout="slack"
              preamble={<ChatIntro open={open} />}
              onTicketChange={(nextRow) => onRowChange({ ...row, ...nextRow })}
            />
          ) : thread ? (
            <StartChat
              key={thread.key}
              thread={thread}
              comments={[]}
              coachId={coachId}
              intro={<ChatIntro open={open} />}
              onStarted={onStarted}
            />
          ) : null}
        </div>
      ) : (
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_25rem] ${look === "grey" ? "job-grey" : ""}`}
        >
          <div
            ref={scrollRef}
            // contain:paint, as in the Blueprint: section popups would otherwise lengthen the window.
            className={`bp-doc bp-jobs min-h-0 overflow-y-auto overscroll-contain bg-white [contain:paint] ${pane === "chat" ? "hidden lg:block" : ""}`}
          >
            <div className="@container w-full max-w-[60rem] px-6 pb-24 pt-8 md:px-10 md:pt-10">
              {thread && job ? (
                <JobDetails
                  key={thread.key}
                  thread={thread}
                  job={job}
                  coach={coach}
                  coachId={coachId}
                  scrollRef={scrollRef}
                  admin={admin}
                  initialTab={initialTab}
                  initialPart={initialPart}
                  onAvaChanged={onAvaChanged}
                  onOpenPart={onOpenPart}
                />
              ) : null}
            </div>
          </div>

          <aside
            aria-label={commentsShown ? "Comments" : "Chat"}
            className={`job-chat min-h-0 flex-col border-slate-200 bg-white lg:flex lg:border-l ${pane === "chat" ? "flex" : "hidden"}`}
          >
            {commentsShown ? (
              <SidePanel
                mode="comments"
                sectionKey={sectionComments?.openKey ?? null}
                page={sectionComments?.openKey ? (sectionByKey(sectionComments.openKey)?.page ?? null) : null}
                onClose={() => sectionComments?.close()}
              />
            ) : (
              <>
                <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-100 px-4">
                  <MessageSquare className="h-4 w-4 text-slate-400" aria-hidden />
                  <h2 className="text-sm font-semibold text-slate-900">Chat with BCA</h2>
                  {chatCount ? <span className="text-caption tabular-nums text-slate-400">{chatCount}</span> : null}
                </div>
                {row ? (
                  <SupportTicketChat
                    key={row.id}
                    ticket={row}
                    viewer={coach}
                    viewerId={coachId}
                    layout="slack"
                    extraReplies={comments}
                    onTicketChange={(nextRow) => onRowChange({ ...row, ...nextRow })}
                  />
                ) : thread ? (
                  <StartChat key={thread.key} thread={thread} comments={comments} coachId={coachId} onStarted={onStarted} />
                ) : null}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

type JobTab = "overview" | "blueprint" | "activity";

function JobDetails({
  thread,
  job,
  coach,
  coachId,
  scrollRef,
  admin,
  initialTab,
  initialPart,
  onAvaChanged,
  onOpenPart,
}: {
  thread: LaunchThread;
  job: JobState;
  coach: SupportTicketAuthor;
  coachId: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  admin: boolean;
  initialTab: string | null;
  initialPart: string | null;
  onAvaChanged?: () => void;
  onOpenPart?: (jobKey: string, sectionKey: string) => void;
}) {
  const status = job.status;
  const yours = status === "needs_you" || status === "review";
  // The pages holding this job's parts; a page can be shared (the campaigns are three jobs).
  const pages = BLUEPRINT_PAGES.filter((page) =>
    BLUEPRINT_SECTIONS.some((ref) => ref.page.slug === page.slug && threadForSectionRef(ref) === thread.key)
  );
  const parts = job.items.filter((i) => i.sectionKey);
  const steps = job.items.filter((i) => i.stepKey);
  const [tab, setTab] = useState<JobTab>(
    admin && initialTab === "activity" ? "activity" : initialTab === "blueprint" && pages.length > 0 ? "blueprint" : "overview"
  );
  const [jumpTo, setJumpTo] = useState<string | null>(initialTab === "blueprint" ? initialPart : null);

  // A checklist row opens the Blueprint tab at its part.
  useEffect(() => {
    if (tab !== "blueprint" || !jumpTo) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`s-${jumpTo.replace(":", "-")}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      setJumpTo(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tab, jumpTo]);

  function show(next: JobTab, part: string | null = null) {
    setTab(next);
    setJumpTo(part);
    if (!part) scrollRef.current?.scrollTo(0, 0);
  }

  return (
    <>
      {/* The name is in the top bar; the full header shows on Overview only (Zander, 2 Nov). */}
      {tab === "overview" ? (
      <header>
        <h1 className="text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
          {thread.label}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-lg leading-[1.55] text-[#475569]">{thread.brief?.what ?? thread.hint}</p>
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <PropertyPill>
            <JobStatusCircle status={status} />
            {statusLabel(status)}
          </PropertyPill>
          {status !== "done" && status !== "later" ? (
            <PropertyPill muted={!yours}>
              {yours ? (
                <TinyAvatar label={coach.full_name ?? "You"} avatarUrl={coach.avatar_url ?? null} />
              ) : (
                <BcaMark />
              )}
              {yours ? "Your turn" : "BCA's turn"}
            </PropertyPill>
          ) : null}
          <PropertyPill muted>{groupLabel(thread.phase)}</PropertyPill>
          {job.total > 0 ? (
            <PropertyPill muted>
              <span className="tabular-nums">
                {job.done} of {job.total} done
              </span>
            </PropertyPill>
          ) : null}
        </div>
      </header>
      ) : null}

      {pages.length > 0 || admin ? (
        <div role="tablist" aria-label={thread.label} className={`${tab === "overview" ? "mt-8" : ""} flex gap-6 border-b border-slate-200`}>
          {(
            [
              ["overview", "Overview", null],
              ...(pages.length > 0
                ? ([["blueprint", "Blueprint", parts.length ? `${parts.filter((p) => p.done).length}/${parts.length}` : null]] as const)
                : []),
              // BCA only: Ava's work on this job, before any of it reaches the coach.
              ...(admin ? ([["activity", "Activity", job.avaOpen ? `${job.avaOpen} to check` : null]] as const) : []),
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => show(key)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {key === "activity" ? <Zap className="h-3.5 w-3.5" aria-hidden /> : null}
              {label}
              {count ? <span className="text-caption tabular-nums text-slate-400">{count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "activity" && admin ? (
        <ActivityTab
          coachId={coachId}
          coachName={coach.full_name ?? ""}
          scope={{ key: thread.key, label: thread.label, ava: job.ava }}
          onChanged={() => onAvaChanged?.()}
          onOpenPart={(jobKey, sectionKey) => {
            // Filled in on this job's own Blueprint tab, on another job's, or on a
            // Blueprint page no job has (setup details): the Blueprint itself.
            const page = sectionByKey(sectionKey)?.page.slug;
            if (jobKey === thread.key && pages.length > 0) show("blueprint", sectionKey);
            else if (jobKey) onOpenPart?.(jobKey, sectionKey);
            else if (page) window.location.assign(`/coach/blueprint/${page}#s-${sectionKey.replace(":", "-")}`);
          }}
        />
      ) : tab === "blueprint" && pages.length > 0 ? (
        <BlueprintTab pages={pages} jobKey={thread.key} />
      ) : (
        <>
          {thread.key === "about-you" ? <WelcomeVideo /> : null}

          {thread.brief ? (
            <div
              className={`mt-8 rounded-xl px-5 py-4 ${
                status === "review"
                  ? "bg-yellow-50 ring-1 ring-inset ring-yellow-200"
                  : status === "needs_you"
                    ? "bg-orange-50 ring-1 ring-inset ring-orange-200"
                    : "job-soft bg-slate-50"
              }`}
            >
              <h2 className="text-sm font-semibold text-slate-900">What we need from you</h2>
              <p className="mt-1 text-[15px] leading-normal text-slate-700">{thread.brief.need}</p>
            </div>
          ) : null}

          {parts.length + steps.length > 0 ? (
            <section className="job-panel mt-10" aria-labelledby="job-checklist">
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2.5">
                <h2 id="job-checklist" className="text-sm font-semibold text-slate-900">
                  Checklist
                </h2>
                <span className="text-caption tabular-nums text-slate-400">
                  {job.done} of {job.total} done
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {parts.map((item) => {
                  const s = itemStatus(item);
                  return (
                    <li key={item.sectionKey} className="flex items-center gap-3">
                      {item.sectionKey ? <PartStatusButton sectionKey={item.sectionKey} status={s} /> : null}
                      <button
                        type="button"
                        onClick={() => show("blueprint", item.sectionKey ?? null)}
                        className="group flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left text-sm"
                      >
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            item.done ? "text-slate-400" : "text-slate-800 group-hover:text-[#0c5290]"
                          }`}
                        >
                          {item.label}
                        </span>
                        <span className="shrink-0 text-caption text-slate-400">{statusLabel(s)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden />
                      </button>
                    </li>
                  );
                })}
                {steps.map((item, i) => {
                  // Checks happen in order: only the first open one is anyone's turn yet.
                  const firstOpen = steps.findIndex((step) => !step.done);
                  const s = !item.done && firstOpen >= 0 && i > firstOpen ? "later" : itemStatus(item);
                  return (
                    <li key={item.stepKey} className="flex items-center gap-3 py-2.5 text-sm">
                      <JobStatusCircle status={s} />
                      <span className={`min-w-0 flex-1 truncate ${item.done ? "text-slate-400" : "text-slate-800"}`}>
                        {item.label}
                      </span>
                      <span className="shrink-0 text-caption text-slate-400">{statusLabel(s)}</span>
                      <span className="w-4 shrink-0" aria-hidden />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p className="mt-10 text-sm text-slate-500">Nothing to fill in for this job yet. Ask BCA anything in the chat.</p>
          )}
        </>
      )}
    </>
  );
}

/**
 * A part's circle in the checklist: hover says its status, click changes it,
 * the same choices as the status pill on the part itself.
 */
function PartStatusButton({ sectionKey, status }: { sectionKey: string; status: JobStatus }) {
  const { setSectionStatus } = usePractice();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const part = sectionByKey(sectionKey);
  if (!part) return <JobStatusCircle status={status} />;
  const todo: JobStatus = todoOwner(part) === "coach" ? "needs_you" : "bca_todo";
  const options: { id: WorkflowStatus; shows: JobStatus }[] = [
    { id: "todo", shows: todo },
    { id: "review", shows: "review" },
    { id: "done", shows: "done" },
  ];
  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${part.section.title}: ${statusLabel(status)}. Change status`}
        title={statusLabel(status)}
        onClick={() => setOpen((v) => !v)}
        className="-m-1 rounded-full p-1 transition hover:bg-slate-100"
      >
        <JobStatusCircle status={status} />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={status === option.shows}
              onClick={() => {
                setOpen(false);
                if (status !== option.shows) setSectionStatus(sectionKey, option.id);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <JobStatusCircle status={option.shows} />
              <span className="flex-1">{statusLabel(option.shows)}</span>
              {status === option.shows ? <Check className="h-3.5 w-3.5 text-slate-500" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The job's Blueprint pages: where the answers and BCA's writing are kept, the fields Ava reads. */
function BlueprintTab({ pages, jobKey }: { pages: typeof BLUEPRINT_PAGES; jobKey: string }) {
  const { knowledge, payload, error } = usePractice();
  if (!knowledge || !payload) return <p className="mt-8 text-sm text-slate-600">{error || "Opening your Blueprint…"}</p>;
  return (
    <div className="mt-2">
      {pages.map((page) => (
        <section key={page.slug} className="mt-8" aria-labelledby={`job-page-${page.slug}`}>
          {pages.length > 1 ? (
            <h2 id={`job-page-${page.slug}`} className="mb-2 text-caption font-semibold uppercase tracking-wide text-slate-400">
              {page.title}
            </h2>
          ) : (
            <h2 id={`job-page-${page.slug}`} className="sr-only">
              {page.title}
            </h2>
          )}
          {BLUEPRINT_SECTIONS.filter((r) => r.page.slug === page.slug && r.section.face !== "stored" && threadForSectionRef(r) === jobKey).map((ref) => (
            <JobPart key={ref.key} part={ref} />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * One part of the Blueprint inside a job. A part BCA hasn't written or filled
 * in yet is one quiet line, not an empty box; click it to open it anyway.
 */
function JobPart({ part }: { part: SectionRef }) {
  const { knowledge, payload } = usePractice();
  const [open, setOpen] = useState(false);
  if (!knowledge || !payload) return null;
  const work = sectionWorkflow(part, { ...knowledge, payload });
  const written = part.section.source === "we_build";
  const hasContent = written
    ? Boolean(knowledge.built_sections[part.key])
    : (part.section.fields ?? []).some((field) => fieldFilled(payload, field));
  const waitingOnBca = work.status === "todo" && work.owner === "bca" && !hasContent && !part.section.custom;
  if (waitingOnBca && !open) {
    return (
      <button
        type="button"
        id={`s-${part.key.replace(":", "-")}`}
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="bp-quiet-part group flex w-full scroll-mt-6 items-center gap-3 border-t border-[var(--bp-rule)] py-3.5 text-left"
      >
        <JobStatusCircle status="bca_todo" />
        <span className="shrink-0 text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--bp-ink)]">
          {part.section.title}
        </span>
        <span className="min-w-0 truncate text-sm text-slate-400">
          {written ? "BCA writes this for you." : "Our team fills this in from your Blueprint Call."}
        </span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden />
      </button>
    );
  }
  return <SectionView sectionRef={part} startOpen={open || undefined} />;
}

/** Zander's welcome, in the first job: a thumbnail that plays in place. */
function WelcomeVideo() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="job-soft mt-8 flex flex-col gap-4 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:gap-5 sm:pr-6">
      <div className="w-full overflow-hidden rounded-xl bg-[#051e36] sm:max-w-[16rem]">
        {playing ? (
          <video
            className="block aspect-video w-full"
            controls
            autoPlay
            playsInline
            src={WELCOME_VIDEO}
            aria-label="Why we build it for you, a welcome from Zander"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block w-full"
            aria-label="Play: why we build it for you, a welcome from Zander"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WELCOME_POSTER} alt="" className="block aspect-video w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0c5290] shadow-[0_6px_16px_rgba(2,12,27,0.3)] transition-transform group-hover:scale-105">
                <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1 px-1 pb-1 sm:p-0">
        <p className="text-sm font-semibold text-slate-900">Why we build it for you</p>
        <p className="mt-0.5 text-sm text-slate-500">A welcome from Zander · 1 min 30</p>
      </div>
    </div>
  );
}

/** The top of a chat that isn't a job: its name and what it's for, or the opening message. */
function ChatIntro({ open }: { open: JobOpen }) {
  const row = open.kind === "message" ? open.row : null;
  return (
    <div className="px-2 pb-4 pt-8 sm:pt-10">
      <div className="flex items-center gap-2.5">
        {row ? <MessageStatusCircle status={row.status} audience="coach" /> : null}
        <h1 className="text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
          {open.kind === "job" ? open.thread.label : row?.title?.trim() || "Message"}
        </h1>
      </div>
      {row ? (
        <div className="mt-3 max-w-[60ch] [&_p]:text-[15px] [&_p]:leading-normal [&_p]:text-slate-700">
          <SupportOpeningBody text={row.details} />
        </div>
      ) : (
        <p className="mt-2.5 max-w-[60ch] text-lg leading-[1.55] text-[#475569]">
          Anything that isn&rsquo;t about one of your jobs. BCA replies here.
        </p>
      )}
      <div className="mt-6 h-px bg-slate-200" aria-hidden />
    </div>
  );
}

/** A job nobody has written about yet: Blueprint comments already filed here, and a box to start. */
function StartChat({
  thread,
  comments,
  coachId,
  intro = null,
  onStarted,
}: {
  thread: LaunchThread;
  comments: SupportReply[];
  coachId: string;
  /** Shown above the messages when the chat fills the page (Help & support). */
  intro?: ReactNode;
  onStarted: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: insertError } = await supabaseClient
      .from("community_feedback_reports")
      .insert({
        created_by: coachId,
        source: "direct",
        type: thread.type,
        title: thread.label,
        details: thread.hint,
        status: "open",
        topic: thread.key,
      })
      .select("id")
      .single();
    // Already started (another tab, or BCA a moment ago): write in that one.
    const id =
      data?.id ??
      (insertError?.code === "23505"
        ? (
            await supabaseClient
              .from("community_feedback_reports")
              .select("id")
              .eq("created_by", coachId)
              .eq("topic", thread.key)
              .maybeSingle()
          ).data?.id
        : null);
    if (!id) {
      setError(insertError?.message ?? "Could not send. Try again.");
      setBusy(false);
      return;
    }
    const { error: replyError } = await supabaseClient
      .from("community_feedback_replies")
      .insert({ report_id: id, created_by: coachId, body });
    if (replyError) {
      setError(replyError.message);
      setBusy(false);
      return;
    }
    await onStarted();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
        {intro}
        {comments.length > 0 ? (
          <BlueprintCommentsBlock comments={comments} audience="coach" />
        ) : (
          <div className={`px-1 text-center ${intro ? "pt-4" : "pt-10"}`}>
            <p className="text-sm font-medium text-slate-700">No messages yet</p>
            <p className="mx-auto mt-1 max-w-[16rem] text-sm leading-snug text-slate-500">
              {thread.phase === null
                ? "Ask BCA anything that isn't about one of your jobs."
                : "Ask BCA anything about this job. Comments on its sections land here too."}
            </p>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mx-4 mb-4 mt-2 shrink-0 rounded-xl border border-slate-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500/15"
      >
        <textarea
          rows={3}
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          aria-label={`Message BCA about ${thread.label}`}
          placeholder="Write a message…"
          className="block w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 py-3 text-sm leading-normal text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-2.5 py-2">
          {error ? <p className="mr-auto text-xs text-rose-700">{error}</p> : null}
          <button type="submit" disabled={busy || !draft.trim()} className={buttonClass("main", "small")}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

type JobsLook = "white" | "grey";
const LOOK_KEY = "jobs-look";

/** The job page's look while Zander compares them (2 Nov): the white page, or grey with white parts. */
function useJobsLook(): [JobsLook, (next: JobsLook) => void] {
  const [look, setLookState] = useState<JobsLook>("grey");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice once, after hydration
    if (window.localStorage.getItem(LOOK_KEY) === "white") setLookState("white");
  }, []);
  const setLook = (next: JobsLook) => {
    setLookState(next);
    window.localStorage.setItem(LOOK_KEY, next);
  };
  return [look, setLook];
}

/** Admins only, until a look is picked: White (as it was) or Grey (grey page, white parts). */
function LookSwitch({ look, onChange }: { look: JobsLook; onChange: (next: JobsLook) => void }) {
  return (
    <div className="mr-2 hidden rounded-lg border border-slate-200 p-0.5 sm:flex" role="group" aria-label="Page look">
      {(["white", "grey"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={look === option}
          onClick={() => onChange(option)}
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            look === option ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {option === "white" ? "White" : "Grey"}
        </button>
      ))}
    </div>
  );
}
