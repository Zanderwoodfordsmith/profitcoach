"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, History, Plus } from "lucide-react";

import type { AgentChatSummary, useAgentConversation } from "@/components/agent/useAgentConversation";
import { useAutoGrow, useHalfHeight, useVoiceInput } from "@/components/practice/composer";
import { useQueuedAiPrompt } from "@/lib/profitCoachAi/queuedPrompt";

import { AvaAction, AvaComposer, AvaFeed, AvaHistoryList, AvaOrb, AvaRecent, AvaStarter, useAvaRoom } from "./AvaKit";

/**
 * One conversation with Ava, as every surface shows it: the conversation
 * bar (title, History, New), the empty state with starters, the feed, and
 * the composer. The surface around it supplies the conversation, what Ava
 * offers on that page, and its own top bar.
 */

export type AvaConversation = ReturnType<typeof useAgentConversation>;

export type AvaStarterSpec = { key: string; label: ReactNode; primary?: boolean; onPick: () => void };

export function AvaChat({
  convo,
  transcribe,
  chats,
  greeting,
  intro,
  starters,
  footnote,
  actions,
  historyExtra,
  detail = null,
  coachFirst,
  showCoach = false,
  readOnlyNote = "You can read this conversation, not reply.",
  placeholder = "Ask Ava anything",
  draft,
  setDraft,
  headerSlot = null,
  onHistory,
  onNew,
  onNavigate,
}: {
  convo: AvaConversation;
  transcribe: (blob: Blob) => Promise<string | null>;
  /** Ava's past conversations, for History and Recent. Null while loading. */
  chats: AgentChatSummary[] | null;
  greeting: string;
  /** One or two lines on what Ava does here. */
  intro: ReactNode;
  starters: AvaStarterSpec[];
  footnote?: ReactNode;
  /** Extra buttons on the conversation bar, before History (the Blueprint's Call). */
  actions?: ReactNode;
  historyExtra?: ReactNode;
  /** Something opened from History that isn't an Ava chat (an earlier interview). */
  detail?: { title: string; body: ReactNode; onBack: () => void } | null;
  coachFirst?: string;
  showCoach?: boolean;
  readOnlyNote?: string;
  placeholder?: string;
  draft: string;
  setDraft: (next: string | ((prev: string) => string)) => void;
  /** On the stage, the conversation bar renders into the stage header. */
  headerSlot?: HTMLElement | null;
  onHistory?: () => void;
  onNew?: () => void;
  onNavigate?: () => void;
}) {
  const room = useAvaRoom();
  const stage = room === "stage";
  const [view, setView] = useState<"chat" | "history">("chat");
  const feedRef = useRef<HTMLDivElement>(null);
  const { ref: panelRef, half } = useHalfHeight<HTMLDivElement>();
  const boxRef = useAutoGrow(draft, stage ? Math.min(half, 240) : half);
  const voice = useVoiceInput(transcribe, (said) => {
    setDraft((prev) => (prev ? `${prev} ${said}` : said));
    boxRef.current?.focus();
  });
  const empty = convo.items.length === 0;

  // "Ask AI" from search: the words land in this box, ready to send.
  useQueuedAiPrompt((text) => {
    setView("chat");
    setDraft(text);
    requestAnimationFrame(() => boxRef.current?.focus());
  }, !convo.readOnly);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convo.items, convo.streaming, view]);

  useEffect(() => {
    if (view === "chat" && !detail && !convo.readOnly) boxRef.current?.focus();
  }, [view, detail, convo.readOnly, boxRef]);

  function send(text: string) {
    if (convo.send(text)) setDraft("");
  }

  async function open(id: string) {
    if (await convo.openChat(id)) setView("chat");
  }

  function fresh() {
    convo.newChat();
    setDraft("");
    setView("chat");
    onNew?.();
  }

  const title = detail
    ? detail.title
    : view === "history"
      ? "History"
      : (convo.title ?? (empty ? "New conversation" : "Conversation"));
  const back = detail ? detail.onBack : view === "history" ? () => setView("chat") : null;
  const onChat = view === "chat" && !detail;

  const bar = (
    <div
      className={
        stage
          ? "flex min-w-0 flex-1 items-center gap-2"
          : "flex items-center gap-1 border-b border-[var(--ava-rule)] px-3 py-2"
      }
    >
      {back ? (
        stage ? (
          <AvaAction icon={<ChevronLeft className="h-4 w-4" aria-hidden />} label="Back" onClick={back} />
        ) : (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="rounded-md p-1 text-[var(--ava-muted)] outline-none hover:bg-[var(--ava-tint)] hover:text-[var(--ava-ink)] focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        )
      ) : null}
      <p
        className={`min-w-0 flex-1 truncate ${
          stage ? "text-sm font-medium text-[var(--ava-muted)]" : "px-1 text-[0.8125rem] font-semibold text-[var(--ava-ink)]"
        }`}
      >
        {title}
      </p>
      {onChat ? actions : null}
      {onChat ? (
        <AvaAction
          icon={<History className={stage ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />}
          label="History"
          onClick={() => {
            setView("history");
            onHistory?.();
          }}
        />
      ) : null}
      <AvaAction icon={<Plus className={stage ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />} label="New" onClick={fresh} />
    </div>
  );

  const body = detail ? (
    detail.body
  ) : view === "history" ? (
    <AvaHistoryList chats={chats} coachFirst={coachFirst} onOpen={(id) => void open(id)} extra={historyExtra} />
  ) : !empty ? (
    <AvaFeed
      items={convo.items}
      busyId={convo.deciding}
      streaming={convo.streaming}
      showCoach={showCoach}
      onDecide={(action, decision) => void convo.decide(action, decision)}
      onNavigate={onNavigate}
    />
  ) : stage ? (
    <div className="flex min-h-full flex-col items-center justify-center pb-8 text-center">
      <AvaOrb motion className="ava-hero-orb mb-9" style={{ width: "clamp(132px, 22vh, 196px)", height: "clamp(132px, 22vh, 196px)" }} />
      <p className="ava-hero-hello mb-2 text-[0.9375rem] font-medium text-[var(--ava-muted)]">{greeting}</p>
      <h2 className="ava-hero-title max-w-[26rem] text-balance text-[2.25rem] font-bold leading-[1.15] tracking-[-0.025em] sm:text-[2.5rem]">
        How can <em>I help</em> you <em>today?</em>
      </h2>
      <div className="ava-hero-actions mt-4 flex max-w-[34rem] flex-col items-center gap-6">
        <p className="text-pretty text-[0.9375rem] leading-6 text-[var(--ava-muted)]">{intro}</p>
        {starters.length ? (
          <div className="flex flex-wrap justify-center gap-2.5">
            {starters.map((starter) => (
              <AvaStarter key={starter.key} primary={starter.primary} onClick={starter.onPick}>
                {starter.label}
              </AvaStarter>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col items-start gap-3.5">
        <AvaOrb size={44} motion />
        <div>
          <p className="text-[1.0625rem] font-semibold text-[var(--ava-ink)]">{greeting}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--ava-muted)]">{intro}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {starters.map((starter) => (
          <AvaStarter key={starter.key} primary={starter.primary} onClick={starter.onPick}>
            {starter.label}
          </AvaStarter>
        ))}
        {footnote ? <p className="mt-1 pl-1 text-xs text-[var(--ava-faint)]">{footnote}</p> : null}
      </div>
      {chats?.length ? (
        <div className="mt-auto pt-8">
          <AvaRecent chats={chats} onOpen={(id) => void open(id)} />
        </div>
      ) : null}
    </div>
  );

  return (
    <div ref={panelRef} className="flex h-full min-h-0 flex-col">
      {stage ? (headerSlot ? createPortal(bar, headerSlot) : null) : bar}

      <div
        ref={feedRef}
        className={`ava-scroll min-h-0 flex-1 overflow-y-auto ${
          stage ? "relative z-[1] px-4 pb-4 pt-2 [mask-image:linear-gradient(to_bottom,transparent,#000_20px)] sm:px-8" : "px-4 py-5"
        }`}
      >
        <div className={stage ? "mx-auto h-full w-full max-w-[46rem]" : "h-full"}>{body}</div>
      </div>

      {onChat ? (
        <footer
          className={
            stage
              ? "relative z-[2] shrink-0 px-4 pb-5 pt-2 sm:px-8"
              : "shrink-0 border-t border-[var(--ava-rule)] px-4 py-3.5"
          }
        >
          <div className={stage ? "mx-auto w-full max-w-[42.5rem]" : ""}>
            {convo.readOnly ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ava-tint)] px-3.5 py-2.5">
                <p className="text-sm text-[var(--ava-muted)]">{readOnlyNote}</p>
                <button type="button" onClick={fresh} className="shrink-0 text-sm font-semibold text-[var(--ava-sky)] hover:underline">
                  Start one
                </button>
              </div>
            ) : (
              <>
                {convo.error || voice.failed ? (
                  <p className="mb-2 text-sm text-[var(--ava-danger)]">{convo.error || voice.failed}</p>
                ) : null}
                <AvaComposer
                  boxRef={boxRef}
                  value={draft}
                  onChange={setDraft}
                  onSend={() => send(draft)}
                  placeholder={empty ? placeholder : "Reply to Ava"}
                  busy={convo.streaming}
                  voice={voice}
                />
              </>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
