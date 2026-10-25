"use client";

import Link from "next/link";
import { createContext, useContext, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { AlertTriangle, ArrowUp, AudioLines, Check, ExternalLink, Loader2, Mic, Square } from "lucide-react";

import type { AgentChatSummary } from "@/components/agent/useAgentConversation";
import { commentWhen } from "@/components/practice/comments/SectionCommentsUI";
import { ProfitCoachAiMarkdown } from "@/components/profitCoachAi/ProfitCoachAiMarkdown";
import type { AgentActionView, AgentDisplayItem } from "@/lib/agent/types";

import { AvaHalo } from "./AvaHalo";
import "./ava.css";

/**
 * The parts every Ava surface is built from. The Blueprint side panel, the
 * app-wide panel and the full-screen stage all use these, so Ava looks and
 * behaves the same wherever she opens. The room decides layout; colours
 * come from the tokens in ava.css.
 */

export type AvaRoom = "panel" | "stage";

/** Where Ava is drawn, and whether that room is her dark blue one. */
const AvaRoomContext = createContext<{ room: AvaRoom; dark: boolean }>({ room: "panel", dark: false });

export function AvaRoomProvider({ room, dark = room === "stage", children }: { room: AvaRoom; dark?: boolean; children: ReactNode }) {
  return <AvaRoomContext.Provider value={{ room, dark }}>{children}</AvaRoomContext.Provider>;
}

export function useAvaRoom(): AvaRoom {
  return useContext(AvaRoomContext).room;
}

/** True in her dark blue room: her page, her full screen and the side panel. */
export function useAvaDark(): boolean {
  return useContext(AvaRoomContext).dark;
}

export type AvaVoice = {
  recording: boolean;
  transcribing: boolean;
  failed: string | null;
  toggle: () => Promise<void> | void;
};

/** A header action: a labelled pill in the panel, a round glass button on the stage. */
export function AvaAction({
  icon,
  label,
  onClick,
  active = false,
  iconOnly = false,
  showLabel = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  /** Panel only: drop the label (expand, close). */
  iconOnly?: boolean;
  /** Stage only: a glass pill with the word, not just the icon (Ava's page). */
  showLabel?: boolean;
}) {
  const room = useAvaRoom();
  if (room === "stage") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={showLabel ? undefined : label}
        title={showLabel ? undefined : label}
        className={`ava-glass-btn ${showLabel ? "is-labelled" : ""} ${active ? "is-active" : ""}`}
      >
        {icon}
        {showLabel ? label : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={`ava-action inline-flex shrink-0 items-center gap-1 rounded-full text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)] ${
        iconOnly ? "p-1.5" : "px-2 py-1"
      } ${
        active
          ? "bg-[var(--ava-tint-strong)] text-[var(--ava-ink)]"
          : "text-[var(--ava-muted)] hover:bg-[var(--ava-tint)] hover:text-[var(--ava-ink)]"
      }`}
    >
      {icon}
      {iconOnly ? null : label}
    </button>
  );
}

export function AvaBubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  return role === "user" ? (
    <div className="flex justify-end">
      <div className="ava-user-bubble max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-[var(--ava-user-bg)] px-4 py-2.5 text-[0.9375rem] leading-[1.6] text-[var(--ava-user-ink)]">
        {children}
      </div>
    </div>
  ) : (
    <div className="ava-reply max-w-[94%] rounded-2xl rounded-tl-md bg-[var(--ava-reply-bg)] px-4 py-3 text-[0.9375rem] leading-[1.6] text-[var(--ava-ink)]">
      {children}
    </div>
  );
}

/** Anything that changes the account or the Blueprint waits here for an OK. */
export function AvaProposalCard({
  action,
  busy,
  showCoach,
  onDecide,
}: {
  action: AgentActionView;
  busy: boolean;
  /** Admins work across coaches, so the card names whose account it touches. */
  showCoach?: boolean;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  // A Blueprint draft: nothing is saved until Save. A rewrite can be read before and after.
  const copy = Boolean(action.draft) || action.tool === "propose_copy";
  const [showing, setShowing] = useState<"new" | "now">("new");
  const before = action.before && action.status === "pending" ? action.before : null;
  const changed = action.details.find((row) => row.label === "What changed")?.value;
  const rows = action.details.filter(
    (row) => row.label !== "What changed" && row.label !== "For" && !(copy && row.label === "Section")
  );
  return (
    <div className="ava-card overflow-hidden rounded-2xl border border-[var(--ava-card-rule)] bg-[var(--ava-card)] shadow-[var(--ava-card-shadow)]">
      <div className="px-4 pb-1 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--ava-sky)]">
            {copy ? (action.before ? "New version" : "Draft") : "Needs your OK"}
          </p>
          {showCoach && action.coachName ? (
            <span className="shrink-0 rounded-full bg-[var(--ava-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ava-muted)]">
              {action.coachName}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-[var(--ava-ink)]">{action.title}</p>
        {changed ? <p className="mt-1 text-sm leading-6 text-[var(--ava-muted)]">{changed}</p> : null}
        {rows.length ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-[var(--ava-faint)]">{row.label}</dt>
                <dd className="min-w-0 break-words text-[var(--ava-ink)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {before ? (
        <div className="mx-4 mt-2.5 flex gap-1" role="tablist" aria-label="Before and after">
          {(["new", "now"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={showing === tab}
              onClick={() => setShowing(tab)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                showing === tab ? "bg-[var(--ava-tint)] text-[var(--ava-ink)]" : "text-[var(--ava-muted)] hover:text-[var(--ava-ink)]"
              }`}
            >
              {tab === "new" ? "New version" : "What it says now"}
            </button>
          ))}
        </div>
      ) : null}
      {action.preview ? (
        <div className="ava-scroll mx-4 my-2.5 max-h-72 overflow-y-auto rounded-xl bg-[var(--ava-tint)] px-3.5 py-3">
          <ProfitCoachAiMarkdown
            content={before && showing === "now" ? before : action.preview}
            className="ava-md text-[13.5px] leading-relaxed text-[var(--ava-body)]"
          />
        </div>
      ) : null}
      {action.warning && action.status === "pending" ? (
        <p className="ava-warn mx-4 mb-2.5 flex gap-1.5 rounded-lg px-2.5 py-2 text-[13px]">
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
              className="ava-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {copy ? "Save to Blueprint" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("cancel")}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--ava-muted)] hover:bg-[var(--ava-tint)] hover:text-[var(--ava-ink)] disabled:opacity-50"
            >
              {copy ? "Change it" : "Cancel"}
            </button>
          </>
        ) : action.status === "running" ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--ava-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
          </span>
        ) : action.status === "done" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ava-ok)]">
            <Check className="h-3.5 w-3.5" aria-hidden /> {copy ? "In the Blueprint" : "Done"}
          </span>
        ) : action.status === "cancelled" ? (
          <span className="text-sm text-[var(--ava-faint)]">{copy ? "Not saved" : "Cancelled"}</span>
        ) : (
          <span className="text-sm font-medium text-[var(--ava-danger)]">Didn&apos;t work{action.error ? `: ${action.error}` : ""}</span>
        )}
      </div>
    </div>
  );
}

const linkPill =
  "inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--ava-field-rule)] px-3 py-1.5 text-sm font-semibold text-[var(--ava-sky)] hover:bg-[var(--ava-tint)]";

/** The conversation: bubbles, what Ava saved, cards waiting for an OK, and links. */
export function AvaFeed({
  items,
  busyId,
  streaming,
  showCoach,
  onDecide,
  onNavigate,
}: {
  items: AgentDisplayItem[];
  busyId: string | null;
  streaming: boolean;
  showCoach?: boolean;
  onDecide: (action: AgentActionView, decision: "confirm" | "cancel") => void;
  /** Called when a link inside the app is followed (the stage docks itself). */
  onNavigate?: () => void;
}) {
  const dark = useAvaDark();
  const running = [...items].reverse().find((item) => item.type === "tool" && item.ok === null);
  const last = items[items.length - 1];
  const waiting = streaming && (!last || last.type !== "assistant" || Boolean(running));
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        switch (item.type) {
          case "user":
            return (
              <AvaBubble key={i} role="user">
                {item.text}
              </AvaBubble>
            );
          case "assistant":
            return item.text.trim() ? (
              <AvaBubble key={i} role="assistant">
                <ProfitCoachAiMarkdown content={item.text} className="ava-md text-[0.9375rem] leading-[1.6]" />
              </AvaBubble>
            ) : null;
          case "tool":
            // Only what changed is worth showing: "Saved to Story · Results".
            return item.ok && item.note ? (
              <p key={i} className="flex items-center gap-1.5 pl-1 text-xs font-semibold text-[var(--ava-ok)]">
                <Check className="h-3.5 w-3.5" aria-hidden />
                {item.note}
              </p>
            ) : null;
          case "action":
            return (
              <AvaProposalCard
                key={item.action.id}
                action={item.action}
                showCoach={showCoach}
                busy={busyId === item.action.id || streaming}
                onDecide={(decision) => onDecide(item.action, decision)}
              />
            );
          case "link":
            return item.link.href.startsWith("/") ? (
              <Link key={i} href={item.link.href} onClick={onNavigate} className={linkPill}>
                {item.link.label}
              </Link>
            ) : (
              <a key={i} href={item.link.href} target="_blank" rel="noopener noreferrer" className={linkPill}>
                {item.link.label}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            );
          default:
            return null;
        }
      })}
      {waiting ? (
        <p className="flex items-center gap-2.5 pl-0.5 text-sm text-[var(--ava-muted)]">
          <AvaHalo size={20} state="thinking" dark={dark} />
          <span className="ava-shimmer">{running && running.type === "tool" ? `${running.label}…` : "Ava is thinking…"}</span>
        </p>
      ) : null}
    </div>
  );
}

/** A first step offered on an empty conversation. */
export function AvaStarter({ primary = false, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
  const room = useAvaRoom();
  if (room === "stage") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`ava-pill rounded-full border px-4 py-2 text-[0.8125rem] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)] ${
          primary ? "is-primary" : ""
        }`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)] ${
        primary
          ? "ava-primary"
          : "ava-starter-row border text-[var(--ava-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Where you write to Ava. Speak turns your voice into text in the box. */
export function AvaComposer({
  boxRef,
  value,
  onChange,
  onSend,
  placeholder,
  busy,
  voice,
}: {
  boxRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  placeholder: string;
  busy: boolean;
  voice: AvaVoice;
}) {
  const room = useAvaRoom();
  const dark = useAvaDark();
  const stage = room === "stage";

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const speak = (
    <button
      type="button"
      onClick={() => void voice.toggle()}
      aria-pressed={voice.recording}
      aria-label={stage ? (voice.recording ? "Stop and turn into text" : "Speak instead of typing") : undefined}
      title={stage ? (voice.recording ? "Stop" : "Speak") : undefined}
      disabled={voice.transcribing}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)] ${
        stage ? "h-10 w-10" : "px-3 py-1.5"
      } ${
        voice.recording
          ? "bg-[var(--ava-danger-tint)] text-[var(--ava-danger)]"
          : "text-[var(--ava-muted)] hover:bg-[var(--ava-tint)] hover:text-[var(--ava-ink)]"
      }`}
    >
      {voice.transcribing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : voice.recording ? (
        <Square className={stage ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      ) : (
        <Mic className={stage ? "h-[1.125rem] w-[1.125rem]" : "h-3.5 w-3.5"} aria-hidden />
      )}
      {stage ? null : voice.recording ? "Stop" : "Speak"}
    </button>
  );

  const send = (
    <button
      type="button"
      onClick={onSend}
      disabled={!value.trim() || busy}
      aria-label="Send"
      className={`ava-primary ava-send flex shrink-0 items-center justify-center rounded-full disabled:opacity-35 ${stage ? "h-10 w-10" : "h-8 w-8"}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
    </button>
  );

  const box = (
    <textarea
      ref={boxRef}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 8_000))}
      onKeyDown={onKey}
      rows={1}
      placeholder={voice.transcribing ? "Turning your voice into text…" : placeholder}
      className={`block w-full resize-none bg-transparent text-[0.9375rem] leading-6 text-[var(--ava-ink)] outline-none placeholder:text-[var(--ava-faint)] ${
        stage || dark ? "min-w-0 flex-1 px-1 py-2" : "px-4 pb-1 pt-3"
      }`}
    />
  );

  if (stage || dark) {
    // Her dark rooms: one glass pill. Voice sits on the right; it becomes Send once there are words to send.
    const typed = Boolean(value.trim()) || busy;
    const voiceButton = (
      <button
        type="button"
        onClick={() => void voice.toggle()}
        aria-pressed={voice.recording}
        aria-label={voice.recording ? "Stop and turn into text" : "Talk instead of typing"}
        title={voice.recording ? "Stop" : "Talk"}
        disabled={voice.transcribing}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)] ${
          voice.recording ? "bg-[var(--ava-danger-tint)] text-[var(--ava-danger)]" : "text-[var(--ava-ink)] hover:bg-[var(--ava-tint)]"
        }`}
      >
        {voice.transcribing ? (
          <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin" aria-hidden />
        ) : voice.recording ? (
          <Square className="h-4 w-4" aria-hidden />
        ) : (
          <AudioLines className="h-5 w-5" aria-hidden />
        )}
      </button>
    );
    return (
      <div className="ava-composer ava-pill-box flex items-end gap-1 border py-1.5 pl-4 pr-1.5">
        {box}
        {typed && !voice.recording && !voice.transcribing ? send : voiceButton}
      </div>
    );
  }
  return (
    <div className="ava-composer rounded-2xl border border-[var(--ava-field-rule)] bg-[var(--ava-field)] focus-within:border-[var(--ava-sky)] focus-within:ring-2 focus-within:ring-[var(--ava-ring)]">
      {box}
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
        {speak}
        {send}
      </div>
    </div>
  );
}

/** Every conversation with Ava, newest first, each with the title she gave it. */
/** Past chats in plain groups: Today, Yesterday, This week, Earlier. */
export function groupByDay(chats: AgentChatSummary[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const groups: { label: string; chats: AgentChatSummary[] }[] = [
    { label: "Today", chats: [] },
    { label: "Yesterday", chats: [] },
    { label: "This week", chats: [] },
    { label: "Earlier", chats: [] },
  ];
  for (const chat of chats) {
    const t = new Date(chat.updated_at).getTime();
    const g = t >= start.getTime() ? 0 : t >= start.getTime() - day ? 1 : t >= start.getTime() - 6 * day ? 2 : 3;
    groups[g].chats.push(chat);
  }
  return groups.filter((g) => g.chats.length);
}

export function AvaHistoryList({
  chats,
  coachFirst,
  onOpen,
  extra,
}: {
  chats: AgentChatSummary[] | null;
  coachFirst?: string;
  onOpen: (id: string) => void;
  /** More history under the chats (the Blueprint's earlier interviews). */
  extra?: ReactNode;
}) {
  if (!chats) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--ava-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
      </p>
    );
  }
  if (!chats.length && !extra) {
    return <p className="text-sm leading-6 text-[var(--ava-muted)]">No conversations yet. They will all be here, each with its own title.</p>;
  }
  // Plain glass rows grouped by day, in the panel and on the stage.
  return (
    <div className="mx-auto max-w-[40rem] space-y-6 pt-2">
      {groupByDay(chats).map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--ava-ink)]">{group.label}</h3>
          <div className="flex flex-col gap-1.5">
            {group.chats.map((chat) => (
              <button key={chat.id} type="button" onClick={() => onOpen(chat.id)} className="ava-recent-row">
                <span className="min-w-0 truncate">{chat.title || "Conversation"}</span>
                <span className="shrink-0 text-xs text-[var(--ava-muted)]">
                  {commentWhen(chat.updated_at)}
                  {chat.by === "coach" ? ` · ${coachFirst || "Coach"}` : chat.by === "bca" ? " · BCA" : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {extra}
    </div>
  );
}

/** The last few conversations, under the starters on an empty panel. */
export function AvaRecent({ chats, onOpen }: { chats: AgentChatSummary[]; onOpen: (id: string) => void }) {
  if (!chats.length) return null;
  return (
    <div>
      <p className="mb-1.5 pl-1 text-xs font-semibold text-[var(--ava-muted)]">Recent chats</p>
      {chats.slice(0, 3).map((chat) => (
        <button
          key={chat.id}
          type="button"
          onClick={() => onOpen(chat.id)}
          className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-[var(--ava-tint)] focus-visible:ring-2 focus-visible:ring-[var(--ava-ring)]"
        >
          <span className="min-w-0 truncate text-sm text-[var(--ava-ink)]">{chat.title || "Conversation"}</span>
          <span className="shrink-0 text-xs text-[var(--ava-faint)]">{commentWhen(chat.updated_at)}</span>
        </button>
      ))}
    </div>
  );
}
