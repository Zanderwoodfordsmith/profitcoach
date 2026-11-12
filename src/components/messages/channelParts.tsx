"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { SupportChatThread } from "@/components/support/SupportChatBubbles";
import {
  LAUNCH_PHASES,
  blueprintPagesForThread,
  threadForBlueprintSection,
  type LaunchThread,
} from "@/lib/launch/threads";
import { blueprintPage, sectionByKey, type SectionRef } from "@/lib/practiceKnowledge/blueprint";
import { commentPage } from "@/lib/practiceKnowledge/pageChat";
import {
  summariseThreads,
  type CommentReaderSide,
  type CommentReads,
  type SectionComment,
} from "@/lib/practiceKnowledge/sectionCommentTypes";
import { JobStatusCircle } from "@/components/jobs/jobParts";
import {
  SUPPORT_STATUS_JOB,
  formatSupportRelativeCompact,
  type SupportReply,
  type SupportTicketStatus,
} from "@/lib/support/tickets";
import type { LaunchItem, LaunchJob, LaunchProgress } from "@/lib/launch/progress";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * The pieces of a coach's channel that look the same for BCA (Support →
 * Channels) and for the coach (My Blueprint → Messages): thread rows, group
 * cards, the welcome on an empty thread, and Blueprint comments filed by thread.
 */

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export type ThreadActivity = {
  count: number;
  lastAt: string | null;
  people: { id: string; label: string; avatarUrl: string | null }[];
};

/** Reply counts, last reply and the faces of who replied, for one channel. */
export function useChannelActivity(ticketIds: string[], refreshKey: string) {
  const [byTicket, setByTicket] = useState<Record<string, ThreadActivity>>({});
  const idsKey = ticketIds.join(",");
  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setByTicket({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabaseClient
        .from("community_feedback_replies")
        .select(
          "report_id, created_at, created_by, author:profiles!created_by ( first_name, full_name, avatar_url )"
        )
        .in("report_id", ids)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const next: Record<string, ThreadActivity> = {};
      for (const raw of (data ?? []) as Array<{
        report_id: string;
        created_at: string;
        created_by: string;
        author:
          | { first_name: string | null; full_name: string | null; avatar_url: string | null }
          | { first_name: string | null; full_name: string | null; avatar_url: string | null }[]
          | null;
      }>) {
        const author = Array.isArray(raw.author) ? raw.author[0] : raw.author;
        const entry = (next[raw.report_id] ??= { count: 0, lastAt: null, people: [] });
        entry.count += 1;
        if (!entry.lastAt) entry.lastAt = raw.created_at;
        if (entry.people.length < 3 && !entry.people.some((p) => p.id === raw.created_by)) {
          entry.people.push({
            id: raw.created_by,
            label: author?.full_name?.trim() || author?.first_name?.trim() || "?",
            avatarUrl: author?.avatar_url ?? null,
          });
        }
      }
      setByTicket(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, refreshKey]);
  return byTicket;
}

export function TinyAvatar({ label, avatarUrl }: { label: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      title={label}
      referrerPolicy="no-referrer"
      className="h-5 w-5 rounded object-cover ring-2 ring-white"
    />
  ) : (
    <span
      title={label}
      className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[9px] font-semibold text-slate-700 ring-2 ring-white"
    >
      {initialsFromLabel(label)}
    </span>
  );
}

/** "20 replies" with the faces of who replied, at the end of the row, then a chevron. */
export function ThreadActivityInline({
  activity,
  started,
}: {
  activity: ThreadActivity | undefined;
  started: boolean;
}) {
  const count = activity?.count ?? 0;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 pl-3">
      {count > 0 && activity ? (
        <>
          <span className="flex -space-x-1">
            {activity.people.map((person) => (
              <TinyAvatar key={person.id} label={person.label} avatarUrl={person.avatarUrl} />
            ))}
          </span>
          <span className="text-xs font-semibold text-sky-700">
            {count} repl{count === 1 ? "y" : "ies"}
          </span>
          {activity.lastAt ? (
            <span className="text-xs tabular-nums text-slate-400">
              {formatSupportRelativeCompact(activity.lastAt)}
            </span>
          ) : null}
        </>
      ) : (
        <span className="text-xs text-slate-400">{started ? "No replies yet" : "Not started"}</span>
      )}
      <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
    </span>
  );
}

export function ChannelGroupLabel({ label }: { label: string }) {
  return (
    <h3 className="px-3 pb-1.5 text-kicker font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </h3>
  );
}

export function ChannelCard({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-px">
      {children}
    </ul>
  );
}

export function threadRowClass(align: "center" | "start" = "start") {
  return `flex w-full gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-slate-100 ${
    align === "center" ? "items-center" : "items-start"
  }`;
}

/** Thread activity with the thread's Blueprint comments added in. */
export function withBlueprintActivity(
  activity: ThreadActivity | undefined,
  comments: SupportReply[] | undefined
): ThreadActivity | undefined {
  if (!comments?.length) return activity;
  const merged: ThreadActivity = {
    count: (activity?.count ?? 0) + comments.length,
    lastAt: activity?.lastAt ?? null,
    people: [...(activity?.people ?? [])],
  };
  for (const c of [...comments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    if (!merged.lastAt || c.created_at > merged.lastAt) merged.lastAt = c.created_at;
    if (merged.people.length < 3 && !merged.people.some((p) => p.id === c.created_by)) {
      merged.people.push({
        id: c.created_by,
        label: c.author?.full_name ?? "?",
        avatarUrl: c.author?.avatar_url ?? null,
      });
    }
  }
  return merged;
}

/**
 * Top of a pinned thread nobody has written in yet, like the Support welcome:
 * a big title and what the thread is for. The reply box sits below as usual.
 */
export function ThreadWelcome({
  thread,
  comments,
  coachLabel,
  audience = "admin",
}: {
  thread: LaunchThread | null;
  /** Blueprint comments already filed under this thread. */
  comments: SupportReply[];
  coachLabel: string;
  /** "coach": the coach reading their own thread, so "your" instead of their name. */
  audience?: "admin" | "coach";
}) {
  if (!thread) return null;
  const firstName = coachLabel.split(" ")[0];
  const phase = thread.phase ? LAUNCH_PHASES.find((p) => p.key === thread.phase)?.label : null;
  const pages = blueprintPagesForThread(thread.key);
  return (
    <div className="px-2 pb-2 pt-8 sm:pt-12">
      <p className="text-kicker font-semibold uppercase tracking-wide text-slate-400">
        {phase ?? "Pinned thread"}
      </p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        {thread.label}
      </h2>
      <p className="mt-3 text-lg leading-snug text-slate-600">
        {audience === "coach" ? thread.hint : <>{firstName}&rsquo;s thread. {thread.hint}</>}
      </p>
      {pages.length > 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Comments on {pages.join(" and ")} in {audience === "coach" ? "your" : `${firstName}’s`} Blueprint show here too.
        </p>
      ) : null}
      {comments.length > 0 ? (
        <div className="mt-10">
          <ChannelGroupLabel label="Already here from the Blueprint" />
          <SupportChatThread layout="slack" replies={comments} viewerId={null} perspective="admin" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A coach's Blueprint comments, filed under the launch thread their section
 * belongs to, shaped like support replies so threads can show them in order.
 * They stay stored with the Blueprint; each links back to its section.
 */
export function useBlueprintComments(
  coachId: string | null,
  refreshKey: number,
  sectionHref: (ref: SectionRef, key: string, coachId: string) => string
) {
  const [byThread, setByThread] = useState<Record<string, SupportReply[]>>({});
  useEffect(() => {
    setByThread({});
    if (!coachId) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) return;
      // Admins read a coach's comments by naming them; a coach only ever gets their own.
      const res = await fetch("/api/coach/practice/comments", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-impersonate-coach-id": coachId,
        },
      }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { comments?: SectionComment[] } | null;
      if (cancelled || !body?.comments) return;
      const next: Record<string, SupportReply[]> = {};
      for (const c of body.comments) {
        const ref = sectionByKey(c.section_key);
        (next[threadForBlueprintSection(c.section_key)] ??= []).push({
          id: `blueprint:${c.id}`,
          created_at: c.created_at,
          report_id: "",
          created_by: c.author_id ?? `ava:${c.author_side}`,
          body: c.body,
          community_comment_id: null,
          edited_at: c.updated_at,
          // Ava's comments show her icon, like her messages in the chat.
          as_ava: c.author_side === "ava",
          author: {
            id: c.author_id ?? "ava",
            full_name: c.author_name,
            first_name: null,
            last_name: null,
            avatar_url: c.author_avatar_url,
            role: c.author_side === "coach" ? "coach" : "admin",
          },
          origin: {
            // The page, not the part (5 Nov): one chat per page now.
            label: `Blueprint · ${blueprintPage(commentPage(c.section_key) ?? "")?.title ?? "chat"}`,
            href: ref ? sectionHref(ref, c.section_key, coachId) : null,
          },
        });
      }
      setByThread(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sectionHref is a plain helper
  }, [coachId, refreshKey]);
  return byThread;
}

/**
 * How far a thread's job has got, as the roadmap's circle: dotted not started,
 * a quarter, half or three quarters filled, and a tick once it's all done.
 */
export function JobCircle({
  job,
  className = "h-4 w-4",
  label,
}: {
  job: Pick<LaunchJob, "share" | "done"> | undefined;
  className?: string;
  /** Hover and screen-reader text, in place of the percentage. */
  label?: string;
}) {
  const share = job?.share ?? 0;
  if (job?.done) {
    return (
      <svg viewBox="0 0 14 14" className={`shrink-0 text-emerald-600 ${className}`} aria-label={label ?? "Done"} fill="none">
        {label ? <title>{label}</title> : null}
        <circle cx="7" cy="7" r="7" fill="currentColor" />
        <path d="M4.2 7.2 6.1 9 9.8 5.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const fill = share <= 0 ? 0 : share < 0.375 ? 0.25 : share < 0.625 ? 0.5 : 0.75;
  if (fill === 0) {
    return (
      <svg viewBox="0 0 14 14" className={`shrink-0 text-slate-400 ${className}`} aria-label={label ?? "Not started"} fill="none">
        {label ? <title>{label}</title> : null}
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.4 2.1" strokeLinecap="round" />
      </svg>
    );
  }
  const angle = fill * 2 * Math.PI;
  const x = 7 + 3.5 * Math.sin(angle);
  const y = 7 - 3.5 * Math.cos(angle);
  return (
    <svg
      viewBox="0 0 14 14"
      className={`shrink-0 text-sky-600 ${className}`}
      aria-label={label ?? `${Math.round(share * 100)}% done`}
      fill="none"
    >
      {label ? <title>{label}</title> : null}
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d={`M7 7 L7 3.5 A3.5 3.5 0 ${fill > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="currentColor" />
    </svg>
  );
}

/** One coach's launch jobs (admin only: it reads their Blueprint and Getting live). */
export function useLaunchProgress(coachId: string | null, refreshKey: number) {
  // Kept with the coach it belongs to, so switching coach never shows the last one's jobs.
  const [loaded, setLoaded] = useState<{ coachId: string; progress: LaunchProgress } | null>(null);
  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) return;
      const res = await fetch(`/api/admin/launch/progress?coachId=${encodeURIComponent(coachId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { progress?: LaunchProgress } | null;
      if (!cancelled && body?.progress) setLoaded({ coachId, progress: body.progress });
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, refreshKey]);
  return loaded && loaded.coachId === coachId ? loaded.progress : {};
}

/** A job's checklist for the side panel: what's still open first, then what's done. */
export function JobChecklist({
  job,
  audience,
}: {
  job: LaunchJob | undefined;
  audience: "admin" | "coach";
}) {
  if (!job || job.items.length === 0) {
    return <p className="text-sm text-slate-500">Nothing to track here yet.</p>;
  }
  const doneCount = job.items.filter((i) => i.done).length;
  const percent = Math.round((doneCount / job.items.length) * 100);
  const ordered = [...job.items.filter((i) => !i.done), ...job.items.filter((i) => i.done)];
  const waitLabel = (item: LaunchItem) =>
    item.waitsOn === "coach"
      ? audience === "coach"
        ? item.review
          ? "Check it"
          : "You"
        : item.review
          ? "Coach to check"
          : "Coach"
      : "BCA";
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-slate-900">
            {doneCount} of {job.items.length} done
          </span>
          <span className="tabular-nums text-slate-400">{percent}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${job.done ? "bg-emerald-600" : "bg-sky-600"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <ul className="space-y-3">
        {ordered.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-snug">
            <span
              className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                item.done ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"
              }`}
              aria-hidden
            >
              {item.done ? (
                <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none">
                  <path d="M3.5 7.2 6 9.6 10.5 4.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <span className={`min-w-0 flex-1 ${item.done ? "text-slate-400" : "text-slate-800"}`}>
              {item.label}
            </span>
            {!item.done && item.waitsOn ? (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-caption font-medium ${
                  item.waitsOn === "coach" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {waitLabel(item)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The top of a job thread, like a Linear project: the job, how far it's got,
 * what it is, what we need, and a button to go and do it. The conversation sits
 * below. After the first visit it folds to one line so the messages come first.
 */
export function JobBrief({
  thread,
  job,
  audience,
  coachFirstName,
  blueprintHref,
  seenKey,
}: {
  thread: LaunchThread;
  job: LaunchJob | undefined;
  audience: "admin" | "coach";
  coachFirstName: string;
  /** Where the job's Blueprint page opens for this viewer; null when it has none. */
  blueprintHref: string | null;
  /** Remembers per viewer and coach that the brief has been read. */
  seenKey: string;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const storageKey = `job-brief-seen:${seenKey}`;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fold once we know it's been read before
      if (window.localStorage.getItem(storageKey)) setOpen(false);
      else window.localStorage.setItem(storageKey, "1");
    } catch {
      /* private mode: always show it */
    }
  }, [seenKey]);

  const phase = thread.phase ? LAUNCH_PHASES.find((p) => p.key === thread.phase)?.label : null;
  const count = job?.items.length ?? 0;
  const done = job?.items.filter((i) => i.done).length ?? 0;

  return (
    <div className="px-2 pb-4 pt-6">
      <div className="flex items-center gap-2.5">
        <JobCircle job={job} className="h-5 w-5" />
        <h2 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-950">{thread.label}</h2>
        {count ? (
          <span className="shrink-0 text-sm tabular-nums text-slate-400">
            {done} of {count} done
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-expanded={open}
        >
          {open ? "Hide brief" : "Show brief"}
        </button>
      </div>
      {open && thread.brief ? (
        <div className="mt-4 space-y-4">
          {phase ? (
            <p className="text-kicker font-semibold uppercase tracking-wide text-slate-400">{phase}</p>
          ) : null}
          {thread.videoUrl ? (
            <video src={thread.videoUrl} controls preload="metadata" className="w-full max-w-xl rounded-lg bg-slate-900" />
          ) : null}
          <p className="text-[15px] leading-normal text-slate-700">{thread.brief.what}</p>
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">
              What we need from {audience === "coach" ? "you" : coachFirstName}
            </p>
            <p className="mt-1 text-[15px] leading-normal text-slate-800">{thread.brief.need}</p>
            {blueprintHref ? (
              <a
                href={blueprintHref}
                target={audience === "admin" ? "_blank" : undefined}
                rel={audience === "admin" ? "noopener noreferrer" : undefined}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
              >
                {audience === "coach" ? "Open in your Blueprint" : `Open in ${coachFirstName}’s Blueprint`}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-6 h-px bg-slate-200" aria-hidden />
    </div>
  );
}

/** Blueprint comments already filed under a thread nobody has written in yet. */
export function BlueprintCommentsBlock({ comments, audience }: { comments: SupportReply[]; audience: "admin" | "coach" }) {
  if (comments.length === 0) return null;
  return (
    <div className="pt-2">
      <ChannelGroupLabel label={audience === "coach" ? "From your Blueprint" : "From the Blueprint"} />
      <SupportChatThread layout="slack" replies={comments} viewerId={null} perspective={audience === "coach" ? "member" : "admin"} />
    </div>
  );
}

/** A one-off message's status: the jobs' own circle and words (11 Nov). */
export function MessageStatusCircle({
  status,
  audience,
}: {
  status: SupportTicketStatus;
  audience: "admin" | "coach";
}) {
  return <JobStatusCircle status={SUPPORT_STATUS_JOB[status]} audience={audience} />;
}

/**
 * A coach's Blueprint page chats, for their channel (job 26): per page, how
 * many messages, who wrote them, when the last came in and how many BCA hasn't
 * read. The chat itself stays on the page; Channels only opens it.
 */
export function useBlueprintPageChats(coachId: string | null, refreshKey: number) {
  const [byPage, setByPage] = useState<Record<string, ThreadActivity & { unread: number }>>({});
  useEffect(() => {
    setByPage({});
    if (!coachId) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token || cancelled) return;
      const res = await fetch("/api/coach/practice/comments", {
        headers: { Authorization: `Bearer ${session.access_token}`, "x-impersonate-coach-id": coachId },
      }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as
        | { comments?: SectionComment[]; reads?: CommentReads; side?: CommentReaderSide }
        | null;
      if (cancelled || !body?.comments) return;
      const unreadByKey = summariseThreads(body.comments, body.side ?? "bca", body.reads ?? {});
      const next: Record<string, ThreadActivity & { unread: number }> = {};
      for (const c of [...body.comments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
        const slug = commentPage(c.section_key);
        if (!slug) continue;
        const item = (next[slug] ??= { count: 0, lastAt: null, people: [], unread: 0 });
        item.count += 1;
        if (!item.lastAt || c.created_at > item.lastAt) item.lastAt = c.created_at;
        const id = c.author_id ?? `ava:${c.author_side}`;
        if (item.people.length < 3 && !item.people.some((p) => p.id === id)) {
          item.people.push({ id, label: c.author_name, avatarUrl: c.author_avatar_url });
        }
      }
      for (const [key, thread] of Object.entries(unreadByKey)) {
        const slug = commentPage(key);
        if (slug && next[slug]) next[slug].unread += thread.unread;
      }
      setByPage(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, refreshKey]);
  return byPage;
}
