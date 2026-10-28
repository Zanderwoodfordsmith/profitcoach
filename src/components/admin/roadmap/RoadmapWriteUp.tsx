"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { academyGuideProseClassName } from "@/components/academy/academyProseClassName";

/**
 * The write-up on a project's or initiative's page, like Linear's: an open
 * page you type straight into (no box, no Edit button). It saves a moment
 * after you stop typing, and shows headings and lists formatted once you
 * click away. Markdown: # heading, - list, **bold**, [link](https://…).
 */
export function RoadmapWriteUp({
  value,
  placeholder,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  onSave: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSaved = useRef(value ?? "");
  const timer = useRef<number | null>(null);

  const blank = !(value ?? "").trim();
  const writing = editing || blank;

  // The page grows with the writing.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`;
  }, [draft, writing]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const save = (text: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (text === lastSaved.current) return;
    lastSaved.current = text;
    onSave(text.trim() ? text : null);
    setState("saved");
  };

  const change = (text: string) => {
    setDraft(text);
    setState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(text), 1000);
  };

  const start = () => {
    setDraft(value ?? "");
    lastSaved.current = value ?? "";
    setEditing(true);
  };

  if (writing) {
    return (
      <div>
        <textarea
          ref={boxRef}
          autoFocus={editing}
          value={editing ? draft : blank ? draft : value ?? ""}
          onFocus={() => {
            if (!editing) start();
          }}
          onChange={(e) => change(e.target.value)}
          onBlur={() => {
            save(draft);
            setEditing(false);
          }}
          placeholder={placeholder}
          aria-label="Write-up"
          className="block w-full resize-none border-0 bg-transparent p-0 text-[1.0625rem] leading-[1.75] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <p className="mt-2 h-4 text-xs text-slate-400" aria-live="polite">
          {editing
            ? state === "saving"
              ? "Saving…"
              : state === "saved"
                ? "Saved"
                : "# heading, - list, **bold**, [link](https://…)"
            : null}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${academyGuideProseClassName} cursor-text`}
      onClick={(e) => {
        // Links open; anywhere else starts writing.
        if (!(e.target as HTMLElement).closest("a")) start();
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-[#0c5290] underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {value ?? ""}
      </ReactMarkdown>
    </div>
  );
}
