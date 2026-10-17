"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ExternalLink,
  Layers,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { ProfitCoachAiMarkdown } from "@/components/profitCoachAi/ProfitCoachAiMarkdown";
import type { AgentActionView, AgentCoach, AgentMode } from "@/lib/agent/types";

import { useAgentConversation } from "./useAgentConversation";

/**
 * The AI Agent chat: it does the work in Get Clients. Anything that could
 * contact people, spend money or remove data comes back as a card with a
 * Confirm button; confirming runs it and the agent carries on.
 */

type ChatSummary = { id: string; title: string; updated_at: string };

const STARTERS: Record<AgentMode, string[]> = {
  admin: [
    "Find prospects for a coach",
    "Set up a Connection campaign from a coach's blueprint",
    "Add a coach's newest list to their Connector campaign",
    "Turn a coach's campaign up a notch",
  ],
  coach: [
    "Find me new prospects",
    "Add my newest list to my Connector campaign",
    "Write the messages for my Connection campaign",
    "How do I import from Sales Navigator?",
  ],
};

function ActionCard({
  action,
  mode,
  busy,
  onDecide,
}: {
  action: AgentActionView;
  mode: AgentMode;
  busy: boolean;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const settled = action.status !== "pending";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{action.title}</p>
        {mode === "admin" && action.coachName ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {action.coachName}
          </span>
        ) : null}
      </div>
      {action.details.length ? (
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          {action.details
            // The coach is on the chip (admin) or is the reader (coach).
            .filter((row) => row.label !== "For")
            .map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="min-w-0 break-words text-slate-800">{row.value}</dd>
              </div>
            ))}
        </dl>
      ) : null}
      {action.preview ? (
        <div className="mt-2.5 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <ProfitCoachAiMarkdown content={action.preview} className="text-[13px] leading-relaxed text-slate-800" />
        </div>
      ) : null}
      {action.warning && !settled ? (
        <p className="mt-2.5 flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {action.warning}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {action.status === "pending" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("confirm")}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              Confirm
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("cancel")}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        ) : action.status === "running" ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Running…
          </span>
        ) : action.status === "done" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" aria-hidden /> Done
          </span>
        ) : action.status === "cancelled" ? (
          <span className="text-sm text-slate-500">Cancelled</span>
        ) : (
          <span className="text-sm font-medium text-rose-600">
            Didn&apos;t work{action.error ? `: ${action.error}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentChat({
  fullscreen,
  padClass,
  mode,
  defaultCoach,
  authHeaders,
  onNavigate,
}: {
  fullscreen: boolean;
  padClass: string;
  mode: AgentMode;
  defaultCoach: AgentCoach | null;
  authHeaders: () => Promise<Record<string, string> | null>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const { items, chatId, coach, streaming, deciding, error, send: sendMessage, decide, openChat, newChat: resetChat } =
    useAgentConversation({ authHeaders, screenPath: pathname, defaultCoach, onWrote: refresh });
  const [input, setInput] = useState("");
  const [recent, setRecent] = useState<ChatSummary[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, streaming]);

  useEffect(() => {
    if (chatId || items.length) return;
    let live = true;
    void authHeaders().then(async (headers) => {
      if (!headers) return;
      const res = await fetch("/api/agent/chats", { headers });
      if (!res.ok || !live) return;
      const body = (await res.json()) as { chats?: ChatSummary[] };
      if (live) setRecent(body.chats ?? []);
    });
    return () => {
      live = false;
    };
  }, [authHeaders, chatId, items.length]);

  function send(text: string) {
    if (sendMessage(text)) setInput("");
  }

  function newChat() {
    resetChat();
    textareaRef.current?.focus();
  }

  const lastItem = items[items.length - 1];
  const thinking = streaming && (!lastItem || lastItem.type === "user" || lastItem.type === "action");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`flex items-center justify-between gap-2 border-b border-slate-100 py-2 ${padClass} ${
          fullscreen ? "md:pr-24" : ""
        }`}
      >
        <p className="min-w-0 truncate text-xs text-slate-500">
          {mode === "admin" ? (
            <>
              Working on{" "}
              <span className="font-medium text-slate-800">{coach ? coach.name : "no coach yet"}</span>
            </>
          ) : (
            <>Working on your account</>
          )}
        </p>
        <button
          type="button"
          onClick={newChat}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> New
        </button>
      </div>

      <div ref={scrollRef} className={`flex-1 overflow-y-auto py-4 ${padClass}`}>
        <div className={fullscreen ? "mx-auto w-full max-w-3xl" : ""}>
          {items.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-base font-semibold text-slate-800">What should I do?</p>
              <p className="text-sm leading-relaxed text-slate-500">
                I find prospects, build lists, set up campaigns, write the messages and manage who&apos;s in
                them. Anything that sends, spends money or removes people waits for your OK.
              </p>
              <div className="flex flex-col gap-2">
                {STARTERS[mode].map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => {
                      setInput(starter);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
                  >
                    {starter}
                  </button>
                ))}
              </div>
              {recent?.length ? (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Recent</p>
                  <div className="flex flex-col">
                    {recent.slice(0, 5).map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => void openChat(chat.id)}
                        className="truncate rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        {chat.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item, i) => {
                switch (item.type) {
                  case "user":
                    return (
                      <div key={i} className="flex justify-end">
                        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2.5 text-[15px] leading-relaxed text-white">
                          {item.text}
                        </p>
                      </div>
                    );
                  case "assistant":
                    return item.text.trim() ? (
                      <ProfitCoachAiMarkdown
                        key={i}
                        content={item.text}
                        className="min-w-0 max-w-full text-[15px] leading-relaxed text-slate-800"
                      />
                    ) : null;
                  case "tool":
                    return (
                      <p key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                        {item.ok === null ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : item.ok ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        ) : (
                          <X className="h-3.5 w-3.5 text-rose-500" aria-hidden />
                        )}
                        {item.note ?? item.label}
                      </p>
                    );
                  case "capability":
                    return (
                      <p key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Layers className="h-3.5 w-3.5" aria-hidden /> {item.title}
                      </p>
                    );
                  case "action":
                    return (
                      <ActionCard
                        key={item.action.id}
                        action={item.action}
                        mode={mode}
                        busy={deciding === item.action.id || streaming}
                        onDecide={(decision) => void decide(item.action, decision)}
                      />
                    );
                  case "link":
                    return item.link.href.startsWith("/") ? (
                      <Link
                        key={i}
                        href={item.link.href}
                        onClick={onNavigate}
                        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        {item.link.label}
                      </Link>
                    ) : (
                      <a
                        key={i}
                        href={item.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        {item.link.label}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    );
                  default:
                    return null;
                }
              })}
              {thinking ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Working…
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className={`border-t border-slate-200 py-3 ${padClass}`}>
        <div className={fullscreen ? "mx-auto max-w-3xl" : ""}>
          {error ? <p className="mb-2 text-xs font-medium text-rose-600">{error}</p> : null}
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={mode === "admin" ? "Tell me what to do, and for which coach…" : "Tell me what to do…"}
              className="max-h-48 min-h-[2.5rem] w-full resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              aria-label="Send"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
