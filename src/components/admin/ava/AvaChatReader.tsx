"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Link2,
  Loader2,
  MapPin,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

import { ProfitCoachAiMarkdown } from "@/components/profitCoachAi/ProfitCoachAiMarkdown";
import { commentWhen } from "@/components/practice/comments/SectionCommentsUI";
import { buttonClass } from "@/components/ui/Button";
import type { ReviewChatDetail } from "@/lib/agent/chatReview";
import type { AgentDisplayItem } from "@/lib/agent/types";
import {
  FIX_KINDS,
  FIX_LABEL,
  OUTCOME_LABEL,
  PROBLEM_LABEL,
  pageLabel,
  type FixKind,
  type MarkVerdict,
  type ReviewMark,
} from "@/lib/ava/chatReviewLabels";

import { adminHeaders } from "./avaAdminHeaders";

/**
 * One chat with Ava, read by BCA (job 225): what the person typed, what Ava
 * said and did, the page they were on, and a Good / Off mark under each of
 * Ava's replies. The AI's read sits on top; the coach's own thumbs show
 * beside BCA's mark.
 */

type Group = { turn: number; items: AgentDisplayItem[] };

/** Split the chat into the person's messages, each with everything Ava did after it. */
function groupTurns(items: AgentDisplayItem[]): Group[] {
  const groups: Group[] = [{ turn: 0, items: [] }];
  for (const item of items) {
    if (item.type === "user") groups.push({ turn: groups.length, items: [item] });
    else groups[groups.length - 1]!.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

const ACTION_STATUS: Record<string, string> = {
  pending: "Waiting for OK",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AvaChatReader({
  chatId,
  onBack,
  onNext,
  onChanged,
}: {
  chatId: string;
  /** The list layout's phone back arrow; the table layout has All chats instead. */
  onBack?: () => void;
  onNext: (() => void) | null;
  /** A mark or the AI's read changed: the list refreshes its counts. */
  onChanged: () => void;
}) {
  const [chat, setChat] = useState<ReviewChatDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  // The list mounts a fresh reader for each chat (key), so this runs once per chat.
  useEffect(() => {
    let live = true;
    void (async () => {
      const headers = await adminHeaders();
      if (!live) return;
      if (!headers) return setError("Sign in again to read this chat.");
      const res = await fetch(`/api/admin/ava/chats/${chatId}`, { headers }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { chat?: ReviewChatDetail; error?: string } | null;
      if (!live) return;
      if (!res?.ok || !body?.chat) return setError(body?.error ?? "Could not open that chat.");
      setChat(body.chat);
    })();
    return () => {
      live = false;
    };
  }, [chatId]);

  const saveMark = useCallback(
    async (turn: number, verdict: MarkVerdict | null, fix: FixKind | null, note: string) => {
      const headers = await adminHeaders();
      if (!headers) return false;
      const res = await fetch(`/api/admin/ava/chats/${chatId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ turn, verdict, fix, note }),
      }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { marks?: ReviewMark[] } | null;
      if (!res?.ok || !body?.marks) return false;
      setChat((prev) => (prev ? { ...prev, marks: body.marks! } : prev));
      onChanged();
      return true;
    },
    [chatId, onChanged]
  );

  async function readAgain() {
    setReading(true);
    setError(null);
    const headers = await adminHeaders();
    const res = headers
      ? await fetch("/api/admin/ava/chats/review", { method: "POST", headers, body: JSON.stringify({ chatId }) }).catch(() => null)
      : null;
    const body = (await res?.json().catch(() => null)) as { chat?: ReviewChatDetail; error?: string } | null;
    setReading(false);
    if (!res?.ok || !body?.chat) return setError(body?.error ?? "The AI couldn't read it. Try again.");
    setChat(body.chat);
    onChanged();
  }

  if (error && !chat) return <p className="mx-auto max-w-[54rem] px-5 py-8 text-sm text-rose-700 md:px-10">{error}</p>;
  if (!chat) {
    return (
      <p className="mx-auto flex max-w-[54rem] items-center gap-2 px-5 py-8 text-sm text-slate-500 md:px-10">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Opening the chat…
      </p>
    );
  }

  const groups = groupTurns(chat.items);
  const turns = chat.items.filter((i) => i.type === "user").length;
  const personFirst = chat.person.name.split(/\s+/)[0] ?? chat.person.name;
  const offTurns = new Set(chat.review?.offTurns ?? []);

  return (
    <article className="mx-auto w-full max-w-[54rem] px-5 pb-24 pt-4 md:px-10">
      <header className="flex items-start gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Back to the chats"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-slate-900">{chat.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
            {chat.mode === "admin" ? (
              <span>
                <span className="font-medium text-slate-700">{chat.person.name}</span> (BCA)
                {chat.coach ? <> about {coachLink(chat.coach)}</> : null}
              </span>
            ) : chat.coach ? (
              coachLink(chat.coach)
            ) : (
              <span className="font-medium text-slate-700">{chat.person.name}</span>
            )}
            {chat.who === "test" ? <span className="rounded bg-amber-50 px-1.5 text-xs font-medium text-amber-700">Test account</span> : null}
            <span aria-hidden>·</span>
            <span>{when(chat.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>
              {turns} {turns === 1 ? "message" : "messages"}
            </span>
            {chat.costUsd > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span title="What this chat cost in AI">${chat.costUsd.toFixed(2)}</span>
              </>
            ) : null}
          </p>
        </div>
        {onNext ? (
          <button type="button" onClick={onNext} className={buttonClass("second", "small", "shrink-0")}>
            Next chat
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </header>

      <AiRead chat={chat} reading={reading} onRead={() => void readAgain()} />
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <section key={group.turn} className="space-y-2.5">
            {group.turn > 0 && chat.pages[group.turn] ? (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                On {pageLabel(chat.pages[group.turn]!) ?? chat.pages[group.turn]}
              </p>
            ) : null}
            {group.items.map((item, i) => (
              <ReaderItem key={i} item={item} personFirst={personFirst} />
            ))}
            {group.turn > 0 && group.items.some((i) => i.type !== "user") ? (
              <MarkBar
                turn={group.turn}
                bca={chat.marks.find((m) => m.turn === group.turn && m.source === "bca") ?? null}
                coach={chat.marks.find((m) => m.turn === group.turn && m.source === "coach") ?? null}
                coachName={chat.mode === "coach" ? personFirst : null}
                aiOff={offTurns.has(group.turn)}
                onSave={saveMark}
              />
            ) : group.turn > 0 ? (
              <p className="pl-1 text-xs text-slate-400">No reply from Ava.</p>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

function coachLink(coach: NonNullable<ReviewChatDetail["coach"]>) {
  return coach.slug ? (
    <Link href={`/admin/coaches/${coach.slug}`} className="font-medium text-slate-700 hover:text-[#0c5290] hover:underline">
      {coach.name}
    </Link>
  ) : (
    <span className="font-medium text-slate-700">{coach.name}</span>
  );
}

/** The AI's read of the chat, or a button to get one. */
function AiRead({ chat, reading, onRead }: { chat: ReviewChatDetail; reading: boolean; onRead: () => void }) {
  const [open, setOpen] = useState(true);
  const review = chat.review;
  const turns = chat.items.filter((i) => i.type === "user").length;
  const button = (label: string) => (
    <button type="button" onClick={onRead} disabled={reading} className={buttonClass("quiet", "small", "-mr-2")}>
      {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
      {reading ? "Reading…" : label}
    </button>
  );

  if (!review) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3">
        <p className="text-sm text-slate-600">The AI hasn&apos;t read this chat yet.</p>
        {button("Ask the AI to read it")}
      </div>
    );
  }

  const outcomeTone =
    review.outcome === "done"
      ? "bg-emerald-50 text-emerald-800"
      : review.outcome === "partly"
        ? "bg-amber-50 text-amber-800"
        : review.outcome === "not_done"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-600";

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI&apos;s read</span>
          <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${outcomeTone}`}>{OUTCOME_LABEL[review.outcome]}</span>
          <span
            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${
              review.verdict === "good" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
            }`}
          >
            Ava {review.verdict === "good" ? "did well" : "needs fixing"}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "" : "-rotate-90"}`} aria-hidden />
        </button>
        {button(review.turns < turns ? "Read again (new messages)" : "Read again")}
      </div>
      {open ? (
        <div className="space-y-2.5 border-t border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700">
          <p>
            <span className="font-medium text-slate-900">Wanted: </span>
            {review.wanted}
          </p>
          <p>{review.summary}</p>
          {review.problems.length ? (
            <div className="flex flex-wrap gap-1.5">
              {review.problems.map((p) => (
                <span key={p} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {PROBLEM_LABEL[p] ?? p}
                </span>
              ))}
            </div>
          ) : null}
          {review.fix ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <span className="font-medium text-slate-900">
                Fix{review.fixKind ? ` (${FIX_LABEL[review.fixKind]})` : ""}:{" "}
              </span>
              {review.fix}
            </p>
          ) : null}
          <p className="text-xs text-slate-400">
            Read {commentWhen(review.reviewedAt)}
            {review.turns < turns ? `, before the last ${turns - review.turns} messages` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ReaderItem({ item, personFirst }: { item: AgentDisplayItem; personFirst: string }) {
  switch (item.type) {
    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%]">
            <p className="mb-1 text-right text-xs font-medium text-slate-500">{personFirst}</p>
            <div className="whitespace-pre-wrap break-words rounded-lg rounded-tr-sm bg-[#0c5290] px-3.5 py-2.5 text-[0.9375rem] leading-[1.6] text-white">
              {item.text}
            </div>
          </div>
        </div>
      );
    case "assistant":
      return item.text.trim() ? (
        <div className="max-w-[92%]">
          <div className="rounded-lg rounded-tl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-[0.9375rem] leading-[1.6] text-slate-800">
            <ProfitCoachAiMarkdown content={item.text} className="ava-md text-[0.9375rem] leading-[1.6]" />
          </div>
        </div>
      ) : null;
    case "tool":
      return (
        <p className={`flex items-center gap-1.5 pl-1 text-xs ${item.ok === false ? "text-rose-700" : "text-slate-500"}`}>
          {item.ok === false ? <X className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
          {item.label}
          {item.ok === false ? " (failed)" : ""}
          {item.note ? <span className="text-emerald-700">· {item.note}</span> : null}
        </p>
      );
    case "capability":
      return (
        <p className="flex items-center gap-1.5 pl-1 text-xs text-[#0c5290]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Opened her skill: <span className="font-medium">{item.title}</span>
        </p>
      );
    case "action":
      return (
        <div className="flex max-w-[92%] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-700">
            <span className="text-slate-500">Asked to: </span>
            {item.action.title}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
              item.action.status === "done"
                ? "bg-emerald-50 text-emerald-800"
                : item.action.status === "cancelled" || item.action.status === "failed"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {ACTION_STATUS[item.action.status] ?? item.action.status}
          </span>
        </div>
      );
    case "link":
      return (
        <p className="flex items-center gap-1.5 pl-1 text-xs text-slate-500">
          <Link2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Gave a link: <span className="font-medium text-slate-700">{item.link.label}</span>
        </p>
      );
    case "app_event":
      return <p className="text-center text-xs text-slate-400">{item.text.replace(/ Carry on from here\.$/, "")}</p>;
    default:
      return null;
  }
}

/** BCA's Good / Off on one reply, with the coach's thumbs and the AI's flag beside it. */
function MarkBar({
  turn,
  bca,
  coach,
  coachName,
  aiOff,
  onSave,
}: {
  turn: number;
  bca: ReviewMark | null;
  coach: ReviewMark | null;
  coachName: string | null;
  aiOff: boolean;
  onSave: (turn: number, verdict: MarkVerdict | null, fix: FixKind | null, note: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [fix, setFix] = useState<FixKind | null>(bca?.fix ?? null);
  const [note, setNote] = useState(bca?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(verdict: MarkVerdict | null, nextFix: FixKind | null, nextNote: string) {
    setBusy(true);
    setFailed(false);
    const ok = await onSave(turn, verdict, nextFix, nextNote);
    setBusy(false);
    if (!ok) setFailed(true);
    return ok;
  }

  function pickGood() {
    setEditing(false);
    void save(bca?.verdict === "good" ? null : "good", null, "");
  }

  function pickOff() {
    if (bca?.verdict === "off" && !editing) {
      setFix(bca.fix);
      setNote(bca.note ?? "");
      setEditing(true);
      return;
    }
    setFix(bca?.fix ?? null);
    setNote(bca?.note ?? "");
    setEditing(true);
  }

  const verdictButton = (verdict: MarkVerdict) => {
    const active = bca?.verdict === verdict || (verdict === "off" && editing);
    const Icon = verdict === "good" ? ThumbsUp : ThumbsDown;
    return (
      <button
        type="button"
        disabled={busy}
        aria-pressed={active}
        onClick={verdict === "good" ? pickGood : pickOff}
        className={`flex h-8 items-center gap-1.5 px-3 text-sm font-medium transition disabled:opacity-60 ${
          active
            ? verdict === "good"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {verdict === "good" ? "Good" : "Off"}
      </button>
    );
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-slate-200" role="group" aria-label={`Mark Ava's reply ${turn}`}>
          {verdictButton("good")}
          <span className="w-px self-stretch bg-slate-200" aria-hidden />
          {verdictButton("off")}
        </div>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden /> : null}
        {bca && !editing ? (
          <span className="min-w-0 text-xs text-slate-500">
            {bca.verdict === "off" && bca.fix ? <span className="font-medium text-slate-700">{FIX_LABEL[bca.fix]}</span> : null}
            {bca.verdict === "off" && bca.fix && bca.note ? " · " : null}
            {bca.note ? <span className="text-slate-700">&ldquo;{bca.note}&rdquo;</span> : null}
            {bca.by ? <span className="text-slate-400"> · {bca.by.split(/\s+/)[0]}, {commentWhen(bca.updatedAt)}</span> : null}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-3 text-xs">
          {coach ? (
            <span className={`flex items-center gap-1 ${coach.verdict === "good" ? "text-emerald-700" : "text-rose-700"}`} title={coach.note ?? undefined}>
              {coach.verdict === "good" ? <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> : <ThumbsDown className="h-3.5 w-3.5" aria-hidden />}
              {coachName ?? "Coach"}
              {coach.note ? <span className="max-w-[16rem] truncate text-slate-600">: &ldquo;{coach.note}&rdquo;</span> : null}
            </span>
          ) : null}
          {aiOff ? (
            <span className="flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              AI flagged this reply
            </span>
          ) : null}
        </span>
      </div>
      {editing ? (
        <form
          className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void save("off", fix, note).then((ok) => ok && setEditing(false));
          }}
        >
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What it needs">
            {FIX_KINDS.map((f) => (
              <button
                key={f.key}
                type="button"
                title={f.hint}
                aria-pressed={fix === f.key}
                onClick={() => setFix(fix === f.key ? null : f.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  fix === f.key ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
            }}
            rows={2}
            placeholder="What was wrong, or what she should have said"
            className="block w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy} className={buttonClass("main", "small")}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("quiet", "small")}>
              Cancel
            </button>
            {bca?.verdict === "off" ? (
              <button
                type="button"
                onClick={() => void save(null, null, "").then((ok) => ok && setEditing(false))}
                className="ml-auto text-xs text-slate-500 hover:text-rose-700"
              >
                Clear mark
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {failed ? <p className="mt-1.5 text-xs text-rose-700">Couldn&apos;t save that. Try again.</p> : null}
    </div>
  );
}
