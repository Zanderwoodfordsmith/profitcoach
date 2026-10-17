"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronLeft,
  History,
  Loader2,
  Mic,
  Phone,
  Plus,
  Sparkles,
  Square,
} from "lucide-react";

import { useAgentConversation, type AgentChatSummary } from "@/components/agent/useAgentConversation";
import { ProfitCoachAiMarkdown } from "@/components/profitCoachAi/ProfitCoachAiMarkdown";
import type { AgentActionView, AgentDisplayItem } from "@/lib/agent/types";
import {
  BLUEPRINT_SECTIONS,
  fieldFilled,
  fieldValue,
  type BlueprintLink,
} from "@/lib/practiceKnowledge/blueprint";
import type { PracticeKnowledgePayload } from "@/lib/practiceKnowledge/types";

import { avaCallIntro, avaCallProtocol } from "@/lib/practiceKnowledge/intakeCall";
import { primeCallAudio } from "./callAudio";

import { commentWhen } from "../comments/SectionCommentsUI";
import { useAutoGrow, useHalfHeight, useVoiceInput } from "../composer";
import { usePractice } from "../PracticeProvider";
import { AvaVoiceCall } from "./AvaVoiceCall";

/**
 * Ava in the Blueprint: one conversation at a time, titled by Ava, with every
 * earlier one in History. She starts from the page you are on, saves your
 * answers as you give them, and proposes new copy for you to accept.
 */

type InterviewSession = {
  id: string;
  status: string;
  started_at: string;
  turns: { role: "user" | "assistant"; content: string }[];
};

type View = { kind: "chat" } | { kind: "history" } | { kind: "call" } | { kind: "interview"; session: InterviewSession };

/** Answers still open on one page (or the whole Blueprint), leaving out what is set on the page itself. */
function openAnswers(payload: PracticeKnowledgePayload, pageSlug?: string): number {
  let open = 0;
  for (const ref of BLUEPRINT_SECTIONS) {
    if (ref.section.source === "we_build" || ref.section.face === "stored") continue;
    if (pageSlug && ref.page.slug !== pageSlug) continue;
    for (const field of ref.section.fields ?? []) {
      if (field.widget) continue;
      if (field.showIf) {
        const gate = fieldValue(payload, field.showIf.path)?.value;
        if (!field.showIf.in.includes(String(gate ?? ""))) continue;
      }
      if (!fieldFilled(payload, field)) open += 1;
    }
  }
  return open;
}

async function fetchHistory(
  authHeaders: () => Promise<Record<string, string> | null>,
  coachId: string | null
): Promise<{ chats: AgentChatSummary[]; interviews: InterviewSession[] } | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const [chatRes, interviewRes] = await Promise.all([
    fetch(coachId ? `/api/agent/chats?coach=${coachId}` : "/api/agent/chats", { headers }).catch(() => null),
    fetch("/api/coach/practice/interview/history", { headers }).catch(() => null),
  ]);
  const chatBody = chatRes?.ok ? ((await chatRes.json().catch(() => null)) as { chats?: AgentChatSummary[] } | null) : null;
  const interviewBody = interviewRes?.ok
    ? ((await interviewRes.json().catch(() => null)) as { sessions?: InterviewSession[] } | null)
    : null;
  return { chats: chatBody?.chats ?? [], interviews: interviewBody?.sessions ?? [] };
}

function AvaMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-6 w-6";
  const icon = size === "lg" ? "h-5 w-5" : "h-3 w-3";
  return (
    <span
      aria-hidden
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1a8fd4_0%,#0c5290_100%)] text-white shadow-[0_2px_8px_-2px_rgba(12,82,144,0.5)]`}
    >
      <Sparkles className={icon} strokeWidth={2} />
    </span>
  );
}

function ProposalCard({
  action,
  busy,
  onDecide,
}: {
  action: AgentActionView;
  busy: boolean;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const copy = action.tool === "propose_copy";
  const changed = action.details.find((row) => row.label === "What changed")?.value;
  const rows = action.details.filter((row) => row.label !== "What changed" && row.label !== "For" && !(copy && row.label === "Section"));
  return (
    <div className="overflow-hidden rounded-2xl border border-[#cfe3f5] bg-white shadow-[0_6px_20px_-12px_rgba(12,82,144,0.35)]">
      <div className="px-4 pb-1 pt-3.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--bp-sky)]">
          {copy ? "New version" : "Needs your OK"}
        </p>
        <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-[var(--bp-ink)]">{action.title}</p>
        {changed ? <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">{changed}</p> : null}
        {rows.length ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-[var(--bp-faint)]">{row.label}</dt>
                <dd className="min-w-0 break-words text-[var(--bp-ink)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {action.preview ? (
        <div className="bp-scroll mx-4 my-2.5 max-h-72 overflow-y-auto rounded-xl bg-[#f5f8fb] px-3.5 py-3">
          <ProfitCoachAiMarkdown content={action.preview} className="text-[13.5px] leading-relaxed text-[#1e2f44]" />
        </div>
      ) : null}
      {action.warning && action.status === "pending" ? (
        <p className="mx-4 mb-2.5 flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {action.warning}
        </p>
      ) : null}
      <div className="flex items-center gap-2 px-4 pb-3.5 pt-1">
        {action.status === "pending" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("confirm")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--bp-blue)] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {copy ? "Use this version" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("cancel")}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] disabled:opacity-50"
            >
              {copy ? "Keep mine" : "Cancel"}
            </button>
          </>
        ) : action.status === "running" ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--bp-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
          </span>
        ) : action.status === "done" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" aria-hidden /> {copy ? "In your blueprint" : "Done"}
          </span>
        ) : action.status === "cancelled" ? (
          <span className="text-sm text-[var(--bp-faint)]">{copy ? "Kept yours" : "Cancelled"}</span>
        ) : (
          <span className="text-sm font-medium text-rose-600">Didn&apos;t work{action.error ? `: ${action.error}` : ""}</span>
        )}
      </div>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  return role === "user" ? (
    <div className="flex justify-end">
      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-[var(--bp-navy)] px-4 py-2.5 text-[0.9375rem] leading-[1.6] text-white">
        {children}
      </div>
    </div>
  ) : (
    <div className="max-w-[94%] rounded-2xl rounded-tl-md bg-[var(--bp-tint)] px-4 py-3 text-[0.9375rem] leading-[1.6] text-[var(--bp-ink)]">
      {children}
    </div>
  );
}

function Feed({
  items,
  busyId,
  streaming,
  onDecide,
}: {
  items: AgentDisplayItem[];
  busyId: string | null;
  streaming: boolean;
  onDecide: (action: AgentActionView, decision: "confirm" | "cancel") => void;
}) {
  const running = [...items].reverse().find((item) => item.type === "tool" && item.ok === null);
  const last = items[items.length - 1];
  const waiting = streaming && (!last || last.type !== "assistant" || Boolean(running));
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        switch (item.type) {
          case "user":
            return (
              <Bubble key={i} role="user">
                {item.text}
              </Bubble>
            );
          case "assistant":
            return item.text.trim() ? (
              <Bubble key={i} role="assistant">
                <ProfitCoachAiMarkdown content={item.text} className="text-[0.9375rem] leading-[1.6]" />
              </Bubble>
            ) : null;
          case "tool":
            // Only what changed is worth showing: "Saved to Story · Results".
            return item.ok && item.note ? (
              <p key={i} className="flex items-center gap-1.5 pl-1 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" aria-hidden />
                {item.note}
              </p>
            ) : null;
          case "action":
            return (
              <ProposalCard
                key={item.action.id}
                action={item.action}
                busy={busyId === item.action.id || streaming}
                onDecide={(decision) => onDecide(item.action, decision)}
              />
            );
          case "link":
            return item.link.href.startsWith("/") ? (
              <Link
                key={i}
                href={item.link.href}
                className="inline-flex w-fit items-center rounded-full border border-[var(--bp-rule)] px-3 py-1.5 text-sm font-semibold text-[var(--bp-blue)] hover:bg-[var(--bp-tint)]"
              >
                {item.link.label}
              </Link>
            ) : null;
          default:
            return null;
        }
      })}
      {waiting ? (
        <p className="flex items-center gap-2 pl-1 text-sm text-[var(--bp-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {running && running.type === "tool" ? `${running.label}…` : "Ava is thinking…"}
        </p>
      ) : null}
    </div>
  );
}

export function AvaPanel({ page }: { page: BlueprintLink | null }) {
  const { authHeaders, coachId, coachName, viewer, payload, knowledge, reload, transcribe, sample, callNonce } = usePractice();
  const defaultCoach = useMemo(() => (coachId ? { id: coachId, name: coachName } : null), [coachId, coachName]);
  const convo = useAgentConversation({
    authHeaders,
    screenPath: page ? `/coach/blueprint/${page.slug}` : "/coach/blueprint",
    defaultCoach,
    onWrote: reload,
  });
  const [view, setView] = useState<View>({ kind: "chat" });
  const [draft, setDraft] = useState("");
  const [chats, setChats] = useState<AgentChatSummary[] | null>(null);
  const [interviews, setInterviews] = useState<InterviewSession[] | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const { ref: panelRef, half } = useHalfHeight<HTMLDivElement>();
  const boxRef = useAutoGrow(draft, half);
  const voice = useVoiceInput(transcribe, (said) => {
    setDraft((prev) => (prev ? `${prev} ${said}` : said));
    boxRef.current?.focus();
  });

  const seenCall = useRef(0);
  useEffect(() => {
    if (!callNonce || callNonce === seenCall.current) return;
    seenCall.current = callNonce;
    setView({ kind: "call" });
  }, [callNonce]);

  const first = coachName.split(/\s+/)[0] || "";
  const protocol = avaCallProtocol(knowledge?.interview_completed_at);
  const callIntro = avaCallIntro(protocol);
  const onPage = payload && page ? openAnswers(payload, page.slug) : 0;
  const everywhere = payload ? openAnswers(payload) : 0;
  const empty = convo.items.length === 0;

  // History: Ava's chats (for admins, every chat about this coach) and the earlier conversations.
  // Fetched again whenever a conversation starts or changes, so new titles show.
  useEffect(() => {
    if (sample) return;
    let live = true;
    void fetchHistory(authHeaders, viewer === "bca" ? coachId : null).then((found) => {
      if (!live || !found) return;
      setChats(found.chats);
      setInterviews(found.interviews);
    });
    return () => {
      live = false;
    };
  }, [authHeaders, coachId, viewer, sample, convo.chatId, convo.title]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convo.items, convo.streaming, view]);

  useEffect(() => {
    if (view.kind === "chat" && !convo.readOnly) boxRef.current?.focus();
  }, [view.kind, convo.readOnly, boxRef]);

  function send(text: string) {
    if (convo.send(text)) setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  }

  async function open(id: string) {
    if (await convo.openChat(id)) setView({ kind: "chat" });
  }

  function fresh() {
    convo.newChat();
    setDraft("");
    setView({ kind: "chat" });
  }

  if (sample) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white px-8 text-center">
        <AvaMark size="lg" />
        <p className="mt-4 text-sm leading-6 text-[var(--bp-muted)]">Choose a coach to work with Ava. Nothing saves in the empty preview.</p>
      </div>
    );
  }

  if (view.kind === "call") {
    return (
      <div ref={panelRef} className="flex h-full min-h-0 flex-col bg-white">
        <AvaVoiceCall protocol={protocol} coachId={coachId} onClose={() => setView({ kind: "chat" })} />
      </div>
    );
  }

  const header =
    view.kind === "chat" ? (convo.title ?? (empty ? "New conversation" : "Conversation")) : view.kind === "history" ? "History" : "Earlier conversation";

  return (
    <div ref={panelRef} className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-1 border-b border-[var(--bp-rule)] px-3 py-2">
        {view.kind !== "chat" ? (
          <button
            type="button"
            onClick={() => setView(view.kind === "interview" ? { kind: "history" } : { kind: "chat" })}
            aria-label="Back"
            className="rounded-md p-1 text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <p className="min-w-0 flex-1 truncate px-1 text-[0.8125rem] font-semibold text-[var(--bp-ink)]">{header}</p>
        {view.kind === "chat" ? (
          <button
            type="button"
            onClick={() => {
              primeCallAudio();
              setView({ kind: "call" });
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            Call
          </button>
        ) : null}
        {view.kind === "chat" ? (
          <button
            type="button"
            onClick={() => setView({ kind: "history" })}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            History
          </button>
        ) : null}
        <button
          type="button"
          onClick={fresh}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New
        </button>
      </div>

      <div ref={feedRef} className="bp-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {view.kind === "history" ? (
          <HistoryList
            chats={chats}
            interviews={interviews}
            coachFirst={first}
            onOpen={(id) => void open(id)}
            onInterview={(session) => setView({ kind: "interview", session })}
          />
        ) : view.kind === "interview" ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--bp-faint)]">
              From &ldquo;Talk it through&rdquo;, {new Date(view.session.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
              Everything you answered is already in your blueprint.
            </p>
            {view.session.turns.map((turn, i) => (
              <Bubble key={i} role={turn.role}>
                {turn.content}
              </Bubble>
            ))}
          </div>
        ) : empty ? (
          <div className="flex min-h-full flex-col">
            <div className="flex flex-col items-start gap-3">
              <AvaMark size="lg" />
              <div>
                <p className="text-[1.0625rem] font-semibold text-[var(--bp-ink)]">
                  {viewer === "bca" ? `Working on ${coachName || "this coach"}'s blueprint` : `Hi${first ? ` ${first}` : ""}, I'm Ava`}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
                  {protocol === "intake"
                    ? callIntro.detail
                    : "I help you finish and sharpen your blueprint. The facts come from you; I help you say them well, and I can rewrite the copy BCA wrote."}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {protocol === "intake" ? (
                <Starter
                  primary
                  onClick={() => {
                    primeCallAudio();
                    setView({ kind: "call" });
                  }}
                >
                  Start the call with Ava
                </Starter>
              ) : null}
              {onPage && page ? (
                <Starter primary={protocol !== "intake"} onClick={() => send(`Let's fill the gaps on the ${page.title} page.`)}>
                  Fill the gaps on {page.title}
                  <span className={protocol === "intake" ? "text-[var(--bp-faint)]" : "text-white/70"}> · {onPage} open</span>
                </Starter>
              ) : everywhere ? (
                <Starter primary={protocol !== "intake"} onClick={() => send("Let's keep filling in my blueprint.")}>
                  Keep filling in my blueprint
                  <span className={protocol === "intake" ? "text-[var(--bp-faint)]" : "text-white/70"}> · {everywhere} open</span>
                </Starter>
              ) : null}
              {page?.slug === "content" ? (
                <Starter primary={!onPage && !everywhere} onClick={() => send("Write this week's LinkedIn newsletter for my avatar.")}>
                  Write this week's newsletter
                </Starter>
              ) : null}
              {page ? (
                <Starter primary={!onPage && !everywhere && page.slug !== "content"} onClick={() => send(`Can you check my ${page.title} page and tell me what to improve?`)}>
                  Check my {page.title} page
                </Starter>
              ) : null}
              <p className="mt-1 pl-1 text-xs text-[var(--bp-faint)]">Or ask me anything below.</p>
            </div>
            {chats?.length ? (
              <div className="mt-auto pt-8">
                <p className="mb-1.5 pl-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--bp-faint)]">Recent</p>
                {chats.slice(0, 3).map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => void open(chat.id)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--bp-tint)]"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--bp-ink)]">{chat.title || "Conversation"}</span>
                    <span className="shrink-0 text-xs text-[var(--bp-faint)]">{commentWhen(chat.updated_at)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Feed items={convo.items} busyId={convo.deciding} streaming={convo.streaming} onDecide={(a, d) => void convo.decide(a, d)} />
        )}
      </div>

      {view.kind === "chat" ? (
        <footer className="border-t border-[var(--bp-rule)] px-4 py-3.5">
          {convo.readOnly ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bp-tint)] px-3.5 py-2.5">
              <p className="text-sm text-[var(--bp-muted)]">
                {first ? `${first}'s` : "The coach's"} conversation. You can read it, not reply.
              </p>
              <button type="button" onClick={fresh} className="shrink-0 text-sm font-semibold text-[var(--bp-blue)] hover:underline">
                Start one
              </button>
            </div>
          ) : (
            <>
              {convo.error || voice.failed ? (
                <p className="mb-2 text-sm text-[#9b2c2c]">{convo.error || voice.failed}</p>
              ) : null}
              <div className="rounded-2xl border border-[var(--bp-rule)] bg-white focus-within:border-[var(--bp-sky)] focus-within:ring-2 focus-within:ring-[#cfe6f8]">
                <textarea
                  ref={boxRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 8_000))}
                  onKeyDown={onKey}
                  rows={1}
                  placeholder={voice.transcribing ? "Turning your voice into text…" : empty ? "Ask Ava, or answer in your own words" : "Reply to Ava"}
                  className="bp-input block w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[0.9375rem] leading-6 text-[var(--bp-ink)] outline-none placeholder:text-[var(--bp-faint)]"
                />
                <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => void voice.toggle()}
                    aria-pressed={voice.recording}
                    disabled={voice.transcribing}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      voice.recording ? "bg-[#fdeeee] text-[#9b1c1c]" : "text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
                    }`}
                  >
                    {voice.transcribing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : voice.recording ? (
                      <Square className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Mic className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {voice.recording ? "Stop" : "Speak"}
                  </button>
                  <button
                    type="button"
                    onClick={() => send(draft)}
                    disabled={!draft.trim() || convo.streaming}
                    aria-label="Send"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bp-navy)] text-white transition-colors hover:bg-[var(--bp-blue)] disabled:opacity-35"
                  >
                    {convo.streaming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
              </div>
            </>
          )}
        </footer>
      ) : null}
    </div>
  );
}

function Starter({ primary = false, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
        primary
          ? "bg-[var(--bp-navy)] text-white hover:bg-[var(--bp-blue)]"
          : "border border-[var(--bp-rule)] bg-white text-[var(--bp-ink)] hover:border-[#9cc9ec] hover:bg-[var(--bp-tint)]"
      }`}
    >
      {children}
    </button>
  );
}

function HistoryList({
  chats,
  interviews,
  coachFirst,
  onOpen,
  onInterview,
}: {
  chats: AgentChatSummary[] | null;
  interviews: InterviewSession[] | null;
  coachFirst: string;
  onOpen: (id: string) => void;
  onInterview: (session: InterviewSession) => void;
}) {
  if (!chats || !interviews) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--bp-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
      </p>
    );
  }
  if (!chats.length && !interviews.length) {
    return <p className="text-sm leading-6 text-[var(--bp-muted)]">No conversations yet. They will all be here, each with its own title.</p>;
  }
  return (
    <div className="space-y-6">
      {chats.length ? (
        <ul className="space-y-1">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                onClick={() => onOpen(chat.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--bp-tint)]"
              >
                <AvaMark />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--bp-ink)]">{chat.title || "Conversation"}</span>
                  <span className="block text-xs text-[var(--bp-faint)]">
                    {commentWhen(chat.updated_at)}
                    {chat.by === "coach" ? ` · ${coachFirst || "Coach"}` : chat.by === "bca" ? " · BCA" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {interviews.length ? (
        <div>
          <p className="mb-1.5 pl-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--bp-faint)]">
            Earlier, from Talk it through
          </p>
          <ul className="space-y-1">
            {interviews.map((session) => {
              const answers = session.turns.filter((t) => t.role === "user").length;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => onInterview(session)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--bp-tint)]"
                  >
                    <span className="text-sm text-[var(--bp-ink)]">
                      {new Date(session.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                    </span>
                    <span className="text-xs text-[var(--bp-faint)]">
                      {answers} {answers === 1 ? "answer" : "answers"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
