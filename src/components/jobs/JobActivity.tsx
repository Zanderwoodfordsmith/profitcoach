"use client";

import { AlertTriangle, ArrowUpRight, ChevronDown, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AvaHalo } from "@/components/ava/AvaHalo";
import { Blocks } from "@/components/practice/document/Blocks";
import { usePractice } from "@/components/practice/PracticeProvider";
import { buttonClass } from "@/components/ui/Button";
import { changedSince, missingLabel, type AvaWork } from "@/lib/launch/avaWork";
import { sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import type { ActivityItem, AnswerFill, JobSkill } from "@/lib/launch/jobActivity";
import { formatSupportRelativeCompact } from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";

import { BcaMark } from "./jobParts";

/** What Ava works on: a Blueprint page ("page:market") or a launch job, and what she can do there. */
export type AvaScope = { key: string; label: string; ava: AvaWork };

/**
 * Ava's Activity, BCA only (job 172): Ava working for BCA on a Blueprint page
 * or a job. Her drafts wait here until Save puts them in the coach's
 * Blueprint; her messages wait until Send puts them in the chat as Ava. BCA
 * can talk to her about it at the bottom. On a Blueprint page it sits pinned
 * at the top of Ava's panel instead (embedded): what's waiting, and BCA talks
 * to the full Ava below it (4 Nov).
 */

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function post(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/launch/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (res?.ok) return null;
  const data = (await res?.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Something went wrong. Try again.";
}

/** Ava's drafts, messages and answers waiting for BCA, per job, for one coach. */
export function useAvaOpen(coachId: string | null, enabled: boolean, refreshKey = 0): Record<string, number> {
  const [open, setOpen] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!coachId || !enabled) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/admin/launch/activity?coachId=${encodeURIComponent(coachId)}`, {
        headers: await authHeaders(),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { open?: Record<string, number> } | null;
      if (!cancelled && data?.open) setOpen(data.open);
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, enabled, refreshKey]);
  return open;
}

type Feed = {
  items: ActivityItem[];
  score: { saved: number; asWritten: number };
  chase: { chases: number; sentToday: boolean; replies: number };
  skills: JobSkill[];
  /** Who wrote each note: BCA staff by id. */
  authors: Record<string, { name: string; avatar_url: string | null }>;
};

export function ActivityTab({
  coachId,
  coachName,
  scope,
  onChanged,
  onOpenPart,
  className = "mt-6",
  embedded = false,
  refreshKey = 0,
}: {
  coachId: string;
  coachName: string;
  scope: AvaScope;
  className?: string;
  /** At the top of Ava's tab: only what's waiting (earlier on request), and no chat box of its own. */
  embedded?: boolean;
  /** Load again when this changes (Ava finished a turn). Null waits. */
  refreshKey?: number | null;
  /** Something reached the Blueprint or the chat: reload them. */
  onChanged: () => void;
  /** Open a Blueprint part, in this job or another, where a missing thing is filled in. */
  onOpenPart: (jobKey: string | null, sectionKey: string) => void;
}) {
  const jobKey = scope.key;
  const first = coachName.trim().split(/\s+/)[0] || "the coach";
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/admin/launch/activity?coachId=${encodeURIComponent(coachId)}&job=${encodeURIComponent(jobKey)}`,
      { headers: await authHeaders() }
    ).catch(() => null);
    const data = (await res?.json().catch(() => null)) as (Feed & { error?: string }) | null;
    if (!res?.ok || !data?.items) {
      setLoadError(data?.error ?? "Could not load the activity.");
      return;
    }
    setLoadError(null);
    setFeed(data);
  }, [coachId, jobKey]);

  useEffect(() => {
    if (refreshKey === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the job's activity when it opens
    void load();
  }, [load, refreshKey]);

  /** Run one action; `label` says what Ava is doing while it runs. */
  const act = async (label: string, body: Record<string, unknown>, opts: { changes?: boolean } = {}) => {
    if (busy) return false;
    setBusy(label);
    setError(null);
    const failed = await post({ coachId, job: jobKey, ...body });
    await load();
    setBusy(null);
    if (failed) {
      setError(failed);
      return false;
    }
    if (opts.changes) onChanged();
    if (!embedded) window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
    return true;
  };

  if (loadError) return <p className="mt-8 text-sm text-rose-700">{loadError}</p>;
  if (!feed) return <p className="mt-8 text-sm text-slate-500">Loading the activity…</p>;

  const hasOpenDraft = feed.items.some((i) => i.kind === "draft" && i.status === "open");
  const earlier = embedded ? feed.items.filter((i) => i.status !== "open").length : 0;
  const items = embedded && !showEarlier ? feed.items.filter((i) => i.status === "open") : feed.items;

  return (
    <div className={className}>
      {embedded ? null : (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
          <Lock className="h-3 w-3" aria-hidden />
          Only BCA sees this. Nothing here reaches {first} until you save or send it.
        </p>
      )}

      <AvaCard
        scope={scope}
        first={first}
        feed={feed}
        hasOpenDraft={hasOpenDraft}
        embedded={embedded}
        busy={busy}
        onRun={() => void act("Ava is writing. This takes a minute or two.", { action: "run" })}
        onAsk={() => void act(`Ava is writing a message to ${first}…`, { action: "ask" })}
        onFill={() => void act(`Ava is reading ${first}'s reply…`, { action: "fill" })}
        onOpenPart={onOpenPart}
      />

      {items.length ? (
      <ol className={embedded ? "mt-3 space-y-3" : "mt-6 space-y-3"}>
        {items.map((item) => (
          <li key={item.id}>
            <FeedItem
              item={item}
              author={item.created_by ? feed.authors[item.created_by] : undefined}
              first={first}
              busy={Boolean(busy)}
              onSave={(id) => void act("Saving to the Blueprint…", { action: "save", id }, { changes: true })}
              onSend={(id, text) => act(`Sending to ${first}…`, { action: "send", id, text }, { changes: true })}
              onSaveAnswers={(id, answers) => act("Putting the answers in…", { action: "save_answers", id, answers }, { changes: true })}
              onDismiss={(id) => void act("Dismissing…", { action: "dismiss", id })}
            />
          </li>
        ))}
      </ol>
      ) : null}
      {earlier ? (
        <button
          type="button"
          onClick={() => setShowEarlier((v) => !v)}
          aria-expanded={showEarlier}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          {showEarlier ? "Hide earlier" : `Earlier on this page (${earlier})`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showEarlier ? "rotate-180" : ""}`} aria-hidden />
        </button>
      ) : null}

      {busy ? (
        <p className="mt-4 flex items-center gap-2.5 text-sm text-slate-600" role="status">
          <AvaHalo size={22} state="thinking" />
          {busy}
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      {embedded ? null : (
      <Composer
        disabled={Boolean(busy)}
        placeholder={
          hasOpenDraft
            ? `Ask Ava to change the draft, or ask her anything about this ${jobKey.startsWith("page:") ? "page" : "job"}…`
            : `Talk to Ava about this ${jobKey.startsWith("page:") ? "page" : "job"}…`
        }
        onSend={(text) => act("Ava is thinking…", { action: "talk", text })}
      />
      )}
      <div ref={endRef} />
    </div>
  );
}

/** What Ava can do on this job right now, and the buttons to make her do it. */
function AvaCard({
  scope,
  first,
  feed,
  hasOpenDraft,
  embedded,
  busy,
  onRun,
  onAsk,
  onFill,
  onOpenPart,
}: {
  scope: AvaScope;
  first: string;
  feed: Feed;
  hasOpenDraft: boolean;
  embedded: boolean;
  busy: string | null;
  onRun: () => void;
  onAsk: () => void;
  onFill: () => void;
  onOpenPart: (jobKey: string | null, sectionKey: string) => void;
}) {
  const { ava } = scope;
  const titles = (keys: string[]) => keys.map((k) => sectionByKey(k)?.section.title ?? k).join(", ");
  const coachMissing = ava.missing.filter((m) => m.coach);
  const tiredOut = feed.chase.chases >= 2;
  const canFill = feed.chase.replies > 0 && ava.missing.some((m) => m.kind === "answer");
  const { saved, asWritten } = feed.score;

  let line: React.ReactNode;
  if (!ava.toWrite.length) {
    line =
      scope.key === "linkedin-profile" || scope.key === "page:linkedin"
        ? embedded
          ? "Ask Ava to write or rewrite the LinkedIn profile. Save on her draft puts it in the editor."
          : "The LinkedIn profile has its own editor. Ava doesn't write it from here yet."
        : hasOpenDraft
          ? "Ava's draft is below, waiting for you."
          : embedded
            ? "Nothing for Ava to write here right now. Ask her anything."
            : "Nothing for Ava to write here right now.";
  } else if (ava.ready) {
    line = (
      <>
        <span className="font-semibold text-slate-900">Ava ready.</span> She has what she needs to write {titles(ava.toWrite)}.
      </>
    );
  } else {
    line = (
      <>
        Ava can write {titles(ava.toWrite)}, but needs these first:
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {ava.missing.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpenPart(m.jobKey, m.sectionKey)}
                className={m.coach ? COACH_CHIP : BCA_CHIP}
                title={`${m.coach ? `${first} fills this in` : "BCA fills this in"}. Open it in the Blueprint.`}
              >
                {missingLabel(m, scope.key)}
                <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className={`job-soft ${embedded ? "" : "mt-4"} rounded-xl bg-slate-50 px-4 py-4 ring-1 ring-inset ring-slate-200/70`} aria-label="What Ava can do">
      <div className="flex items-start gap-3">
        <AvaHalo size={30} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1 text-[15px] leading-normal text-slate-700">
          {line}
          {ava.toWrite.length || canFill ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {ava.toWrite.length ? (
                <button type="button" disabled={Boolean(busy)} onClick={onRun} className={buttonClass(ava.ready ? "main" : "second", "small")}>
                  {hasOpenDraft ? "Write it again" : ava.ready ? "Run Ava" : "Write anyway"}
                </button>
              ) : null}
              {canFill ? (
                <button type="button" disabled={Boolean(busy)} onClick={onFill} className={buttonClass("main", "small")}>
                  Put {first}&rsquo;s answers in
                </button>
              ) : null}
              {coachMissing.length && !tiredOut ? (
                <button type="button" disabled={Boolean(busy)} onClick={onAsk} className={buttonClass("second", "small")}>
                  Ask {first}
                </button>
              ) : null}
            </div>
          ) : null}
          {coachMissing.length && tiredOut ? (
            <p className="mt-3 text-sm text-orange-900">
              Ava has asked {first} twice with no reply. Over to you: a call or a personal message.
            </p>
          ) : null}
          {coachMissing.length && !tiredOut && feed.chase.sentToday ? (
            <p className="mt-2 text-xs text-slate-500">Ava already messaged {first} today. One a day is the rule.</p>
          ) : null}
        </div>
      </div>
      {feed.skills.length || saved > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-2.5 text-xs text-slate-500">
          {feed.skills.length ? (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>{feed.skills.length === 1 ? "Skill she uses:" : "Skills she uses:"}</span>
              {feed.skills.map((skill) => (
                <a
                  key={skill.id}
                  href={`/admin/ava?open=${encodeURIComponent(skill.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`For ${skill.sections.join(", ")}. Opens in Admin → Ava.`}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 font-medium text-[#0c5290] ring-1 ring-inset ring-slate-200 hover:ring-[#0c5290]/40"
                >
                  {skill.name}
                  <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden />
                </a>
              ))}
            </p>
          ) : null}
          {saved > 0 ? (
            <p>
              Ava&rsquo;s drafts for {scope.label}, all coaches: saved as she wrote them {asWritten} of {saved} times.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Missing things: orange when the coach fills them in (as Needs you), grey when BCA does. */
const COACH_CHIP =
  "inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-900 ring-1 ring-inset ring-orange-200 hover:bg-orange-100";
const BCA_CHIP = "inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200";


const STATUS_TEXT: Record<string, string> = {
  open: "Waiting for you",
  saved: "Saved",
  sent: "Sent",
  dismissed: "Dismissed",
  replaced: "Replaced",
};

function When({ at }: { at: string }) {
  return (
    <time dateTime={at} className="shrink-0 text-caption tabular-nums text-slate-400" title={new Date(at).toLocaleString("en-GB")}>
      {formatSupportRelativeCompact(at)}
    </time>
  );
}

function FeedItem({
  item,
  author,
  first,
  busy,
  onSave,
  onSend,
  onSaveAnswers,
  onDismiss,
}: {
  item: ActivityItem;
  author?: { name: string; avatar_url: string | null };
  first: string;
  busy: boolean;
  onSave: (id: string) => void;
  onSend: (id: string, text: string) => Promise<boolean>;
  onSaveAnswers: (id: string, answers: AnswerFill[]) => Promise<boolean>;
  onDismiss: (id: string) => void;
}) {
  if (item.kind === "event") {
    return (
      <p className="flex items-baseline gap-2 px-1 text-sm text-slate-500">
        <span className="min-w-0 flex-1">{item.body}</span>
        <When at={item.created_at} />
      </p>
    );
  }
  if (item.kind === "note" || item.kind === "ava") {
    const ava = item.kind === "ava";
    return (
      <div className="flex gap-3 px-1">
        {ava ? (
          <AvaHalo size={28} className="mt-0.5 shrink-0" />
        ) : author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.avatar_url} alt="" referrerPolicy="no-referrer" className="mt-0.5 h-7 w-7 shrink-0 rounded-md object-cover" />
        ) : (
          <BcaMark className="mt-0.5 h-7 w-7" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">{ava ? "Ava" : (author?.name ?? "BCA")}</span>
            <When at={item.created_at} />
          </p>
          <p className="whitespace-pre-wrap text-[15px] leading-normal text-slate-700">{item.body}</p>
        </div>
      </div>
    );
  }
  if (item.kind === "draft") return <DraftCard item={item} busy={busy} onSave={onSave} onDismiss={onDismiss} />;
  if (item.kind === "message") return <MessageCard item={item} first={first} busy={busy} onSend={onSend} onDismiss={onDismiss} />;
  return <AnswersCard item={item} first={first} busy={busy} onSave={onSaveAnswers} onDismiss={onDismiss} />;
}

function CardHead({ item, title }: { item: ActivityItem; title: string }) {
  const open = item.status === "open";
  return (
    <div className="flex items-center gap-2.5">
      <AvaHalo size={22} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</span>
      {item.status ? (
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
            open ? "bg-[#0c5290] text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {STATUS_TEXT[item.status]}
        </span>
      ) : null}
      <When at={item.created_at} />
    </div>
  );
}

/** Ava's draft of the job's sections. Saving puts them in the Blueprint for the coach to check. */
function DraftCard({
  item,
  busy,
  onSave,
  onDismiss,
}: {
  item: ActivityItem;
  busy: boolean;
  onSave: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { knowledge, payload } = usePractice();
  const open = item.status === "open";
  const [shown, setShown] = useState(open);
  const sections = item.payload.sections ?? [];
  const row = knowledge && payload ? { ...knowledge, payload } : null;
  const version = item.payload.version ?? 1;
  return (
    <article className={`rounded-xl px-4 py-3.5 ring-1 ring-inset ${open ? "bg-white ring-[#0c5290]/30 shadow-sm" : "bg-white ring-slate-200"}`}>
      <CardHead item={item} title={`Ava's draft${version > 1 ? ` · version ${version}` : ""}: ${sections.map((s) => s.title).join(", ")}`} />
      {item.payload.changes ? <p className="mt-1.5 text-sm text-slate-500">Changed: &ldquo;{item.payload.changes}&rdquo;</p> : null}
      {item.body ? <p className="mt-1.5 text-sm text-orange-800">{item.body}</p> : null}
      {item.payload.failed?.length ? (
        <p className="mt-1.5 text-sm text-rose-700">Couldn&rsquo;t write: {item.payload.failed.join(", ")}.</p>
      ) : null}
      {!open ? (
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-expanded={shown}
          className="mt-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          {shown ? "Hide" : "Show"} the draft
          <ChevronDown className={`h-3.5 w-3.5 transition ${shown ? "rotate-180" : ""}`} aria-hidden />
        </button>
      ) : null}
      {shown ? (
        <div className="mt-3 space-y-6">
          {sections.map((section) => {
            const changed = open && row ? changedSince(section.key, row, section.drafted_at) : [];
            return (
              <section key={section.key} className="border-t border-slate-100 pt-4">
                <h3 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-slate-900">{section.title}</h3>
                {changed.length ? (
                  <p className="mt-2 flex items-start gap-2 rounded-md bg-orange-50 px-2.5 py-1.5 text-sm text-orange-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Out of date: {changed.join(", ")} changed after Ava wrote this. Write it again before you save.
                  </p>
                ) : null}
                <div className="mt-3">
                  <Blocks blocks={section.blocks} />
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      {open ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button type="button" disabled={busy} onClick={() => onSave(item.id)} className={buttonClass("main", "small")}>
            Save to the Blueprint
          </button>
          <button type="button" disabled={busy} onClick={() => onDismiss(item.id)} className={buttonClass("quiet", "small")}>
            Dismiss
          </button>
          <span className="text-xs text-slate-500">Saving shows it to the coach to check. To change it, tell Ava below.</span>
        </div>
      ) : null}
    </article>
  );
}

/** A message Ava wants to send the coach in the job's chat. Edit it, then send. */
function MessageCard({
  item,
  first,
  busy,
  onSend,
  onDismiss,
}: {
  item: ActivityItem;
  first: string;
  busy: boolean;
  onSend: (id: string, text: string) => Promise<boolean>;
  onDismiss: (id: string) => void;
}) {
  const open = item.status === "open";
  const [text, setText] = useState(item.body);
  return (
    <article className={`rounded-xl px-4 py-3.5 ring-1 ring-inset ${open ? "bg-white ring-[#0c5290]/30 shadow-sm" : "bg-white ring-slate-200"}`}>
      <CardHead item={item} title={open ? `Ava wants to send this to ${first} in the chat` : `Message to ${first}`} />
      {open ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(10, Math.max(3, text.split("\n").length + 1))}
            aria-label={`Ava's message to ${first}`}
            className="mt-3 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[15px] leading-normal text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !text.trim()} onClick={() => void onSend(item.id, text)} className={buttonClass("main", "small")}>
              Send as Ava
            </button>
            <button type="button" disabled={busy} onClick={() => onDismiss(item.id)} className={buttonClass("quiet", "small")}>
              Dismiss
            </button>
            <span className="text-xs text-slate-500">
              {item.job_key.startsWith("page:")
                ? "Goes into this page's chat, signed Ava."
                : "Goes into the job's chat, signed Ava, and by email."}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-normal text-slate-600">{item.body}</p>
      )}
    </article>
  );
}

/** Answers Ava picked out of the coach's chat reply. Check them, then put them in the Blueprint. */
function AnswersCard({
  item,
  first,
  busy,
  onSave,
  onDismiss,
}: {
  item: ActivityItem;
  first: string;
  busy: boolean;
  onSave: (id: string, answers: AnswerFill[]) => Promise<boolean>;
  onDismiss: (id: string) => void;
}) {
  const open = item.status === "open";
  const [answers, setAnswers] = useState<AnswerFill[]>(item.payload.answers ?? []);
  return (
    <article className={`rounded-xl px-4 py-3.5 ring-1 ring-inset ${open ? "bg-white ring-[#0c5290]/30 shadow-sm" : "bg-white ring-slate-200"}`}>
      <CardHead item={item} title={`${first}'s answers, from the chat`} />
      <div className="mt-3 space-y-3">
        {answers.map((answer, i) => (
          <label key={answer.path} className="block">
            <span className="text-sm font-medium text-slate-900">{answer.label}</span>
            {open ? (
              <textarea
                value={answer.value}
                onChange={(e) => setAnswers((list) => list.map((a, j) => (j === i ? { ...a, value: e.target.value } : a)))}
                rows={Math.min(8, Math.max(2, answer.value.split("\n").length + 1))}
                className="mt-1 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[15px] leading-normal text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
              />
            ) : (
              <span className="mt-0.5 block whitespace-pre-wrap text-[15px] text-slate-600">{answer.value}</span>
            )}
          </label>
        ))}
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void onSave(item.id, answers)} className={buttonClass("main", "small")}>
            Put into the Blueprint
          </button>
          <button type="button" disabled={busy} onClick={() => onDismiss(item.id)} className={buttonClass("quiet", "small")}>
            Dismiss
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Composer({
  disabled,
  placeholder,
  onSend,
}: {
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const send = async () => {
    const text = draft.trim();
    if (!text || disabled) return;
    if (await onSend(text)) setDraft("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="mt-6 rounded-xl border border-slate-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500/15"
    >
      <textarea
        rows={2}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void send();
          }
        }}
        aria-label="Talk to Ava about this job"
        placeholder={placeholder}
        className="block w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 py-3 text-sm leading-normal text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
        <span className="text-xs text-slate-400">Only BCA sees this. &#8984;&#8629; to send.</span>
        <button type="submit" disabled={disabled || !draft.trim()} className={buttonClass("main", "small")}>
          Send to Ava
        </button>
      </div>
    </form>
  );
}
