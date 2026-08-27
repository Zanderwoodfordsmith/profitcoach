"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";

export type WorkingChatMessage = {
  role: "ai" | "user";
  content: string;
};

type Props = {
  messages: WorkingChatMessage[];
  onSend: (text: string) => void;
  replies?: string[];
  placeholder?: string;
  footer?: ReactNode;
  disabled?: boolean;
};

export function WorkingLessonChat({
  messages,
  onSend,
  replies = [],
  placeholder = "Tell it what is off, or what to change…",
  footer,
  disabled = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  function submit(text: string) {
    const next = text.trim();
    if (!next || disabled) return;
    onSend(next);
    setDraft("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(draft);
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex max-h-[22rem] flex-col gap-3 overflow-y-auto pr-1">
        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={`${index}-${message.role}`} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2.5 text-[15px] leading-relaxed text-white">
                {message.content}
              </p>
            </div>
          ) : (
            <p
              key={`${index}-${message.role}`}
              className="max-w-[95%] whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800"
            >
              {message.content}
            </p>
          ),
        )}
        <div ref={endRef} />
      </div>

      {replies.length > 0 && !disabled ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {replies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => submit(reply)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:border-[#0c5290] hover:bg-[#e8f3fb] hover:text-[#0c5290]"
            >
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      {footer ? <div className="mt-3">{footer}</div> : null}

      <form onSubmit={onSubmit} className="mt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 focus-within:border-sky-400">
          <label className="sr-only" htmlFor="working-lesson-chat">
            Reply
          </label>
          <textarea
            id="working-lesson-chat"
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(draft);
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="min-h-[2.25rem] max-h-28 flex-1 resize-none bg-transparent py-1.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || !draft.trim()}
            aria-label="Send"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:bg-slate-300 disabled:text-white"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}
