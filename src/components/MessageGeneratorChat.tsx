"use client";

import { useEffect, useRef, useState } from "react";
import { Outfit } from "next/font/google";
import { Loader2 } from "lucide-react";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

const ONBOARDING_BULLETS = [
  "Lead with a specific prospect callout (type of business / role)—not a generic opener.",
  "Use “I ask because …” plus concrete proof with numbers; avoid abstract “we doubled profits” with no scale.",
  "End on interest in the outcome (“Is this of interest?”)—not interest in being coached.",
];

function ArrowSubmitIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  );
}

type MessageGeneratorChatProps = {
  /** Use inside coach shell: no duplicate page title; fills parent height. */
  embedded?: boolean;
};

export function MessageGeneratorChat({
  embedded = false,
}: MessageGeneratorChatProps) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatStarted = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setError(null);
    const nextUser = { role: "user" as const, content: text };
    const historyForApi = [...messages, nextUser];
    setMessages(historyForApi);
    setStreaming(true);

    try {
      const res = await fetch("/api/message-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi }),
      });

      if (!res.ok) {
        const bodyText = await res.text();
        let msg = `Request failed (${res.status})`;
        try {
          const parsed = JSON.parse(bodyText) as { error?: string };
          if (parsed?.error) msg = parsed.error;
        } catch {
          if (bodyText.length > 0 && bodyText.length < 200) msg = bodyText;
        }
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistant = "";
      setMessages([...historyForApi, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages([
          ...historyForApi,
          { role: "assistant", content: assistant },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((prev) => {
        if (
          prev.length >= 2 &&
          prev[prev.length - 1]?.role === "assistant" &&
          prev[prev.length - 1]?.content === ""
        ) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const fontShell = `${outfit.variable} text-slate-900`;
  const fontStyle = {
    fontFamily: "var(--font-outfit), system-ui, sans-serif",
  } as const;

  const landingBg =
    "bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100/90";
  const landingRadial = {
    backgroundImage:
      "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,165,233,0.08), transparent)",
  } as const;

  return (
    <div
      className={`${fontShell} ${
        embedded
          ? chatStarted
            ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
            : "flex min-h-0 flex-1 flex-col"
          : chatStarted
            ? "flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col overflow-hidden"
            : "flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col"
      }`}
      style={fontStyle}
    >
      {!embedded && chatStarted ? (
        <header className="shrink-0 border-b border-slate-200/60 bg-white/70 px-4 py-4 backdrop-blur-md sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Message Generator
          </h1>
          <p className="mx-auto mt-1 max-w-3xl text-[15px] leading-relaxed text-slate-600">
            Describe what you need—connection note, follow-ups, or a full
            campaign. The assistant uses Profit Coach playbooks and real coach
            examples to explain, suggest options, and help you pick what fits
            your avatar.
          </p>
        </header>
      ) : null}

      {!chatStarted ? (
        <div
          className={
            embedded
              ? `flex flex-1 flex-col items-center justify-center px-4 py-8 ${landingBg}`
              : `flex flex-1 flex-col items-center justify-center px-4 py-6 ${landingBg}`
          }
          style={embedded ? landingRadial : landingRadial}
        >
          <div className="flex w-full max-w-3xl flex-col items-center gap-8">
            {!embedded ? (
              <div className="text-center">
                <p className="text-[17px] text-slate-600">Profit Coach messaging</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Message Generator
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
                  Connection notes, follow-ups, or full campaigns—grounded in
                  playbooks and real coach examples.
                </p>
              </div>
            ) : (
              <p className="text-center text-[17px] text-slate-600">
                What do you want to draft?
              </p>
            )}

            <div className="w-full max-w-2xl rounded-2xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800/90">
                Patterns that move the needle
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-[15px] leading-relaxed text-slate-700">
                {ONBOARDING_BULLETS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>

            <form
              className="w-full max-w-3xl"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <div className="flex gap-3 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                <label htmlFor="mg-input" className="sr-only">
                  Your request
                </label>
                <textarea
                  id="mg-input"
                  rows={5}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="e.g. Help me write a connection message for UK manufacturing owners—I have client proof from a £400K to £1.5M turnaround…"
                  disabled={streaming}
                  className="min-h-[140px] min-w-0 flex-1 resize-none rounded-xl border-0 bg-transparent px-5 py-4 text-[16px] leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="shrink-0 self-end rounded-xl bg-sky-600 px-5 py-3 text-[15px] font-semibold text-white shadow-md shadow-sky-500/25 transition hover:bg-sky-700 disabled:opacity-50 disabled:hover:bg-sky-600"
                  aria-label="Send"
                >
                  {streaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowSubmitIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </form>

            {error ? (
              <p className="text-center text-sm text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
            <p className="text-center text-xs text-slate-500">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            embedded
              ? "rounded-2xl border border-white/60 bg-white/80 shadow-lg shadow-slate-200/30 backdrop-blur-xl"
              : "mx-4 mb-4 rounded-2xl border border-white/60 bg-white/80 shadow-lg backdrop-blur-xl sm:mx-6"
          }`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "user" ? (
                    <div className="max-w-[85%] text-right sm:max-w-[80%]">
                      <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                      <div className="mt-1.5 ml-auto h-px w-full max-w-[120px] bg-slate-200/80" />
                    </div>
                  ) : (
                    <div className="max-w-[90%] border-l-2 border-sky-300/70 pl-4 pr-1 sm:max-w-[85%]">
                      <div className="text-[15px] leading-[1.65] text-slate-800 whitespace-pre-wrap break-words">
                        {m.content}
                        {streaming && i === messages.length - 1 ? (
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-400 align-middle" />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <form
            className="shrink-0 border-t border-slate-100 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {error ? (
                <p className="text-sm text-rose-600" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-3">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Reply or ask a follow-up…"
                  disabled={streaming}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="shrink-0 self-end rounded-xl bg-slate-800 px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                >
                  {streaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
              <p className="text-center text-xs text-slate-500">
                Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
