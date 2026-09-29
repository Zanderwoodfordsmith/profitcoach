"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square, Volume2, X } from "lucide-react";

import { openQuestions, stillNeeded } from "@/lib/practiceKnowledge/blueprint";

import { BuildBar } from "./document/DocumentParts";
import { usePractice } from "./PracticeProvider";

/**
 * The AI conversation that fills the blueprint. It asks only for what is
 * still open, one question at a time, and every answer lands in the document.
 */
export function BlueprintAssistant({ onClose }: { onClose: () => void }) {
  const { knowledge, payload, session, busy, error, ttsOn, start, reply, speak, transcribe } = usePractice();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const turns = session?.turns ?? [];
  const row = knowledge && payload ? { ...knowledge, payload } : null;
  const open = row ? openQuestions(row) : [];
  const neededSections = row ? stillNeeded(row) : [];
  const active = session?.status === "active" && turns.length > 0;
  const lastQuestion = [...turns].reverse().find((t) => t.role === "assistant")?.content ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, busy]);

  useEffect(() => {
    if (active && !busy) inputRef.current?.focus();
  }, [active, busy]);

  function send() {
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    reply(value);
  }

  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const said = await transcribe(blob);
        setTranscribing(false);
        if (said) setText((prev) => (prev ? `${prev} ${said}` : said));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--bp-rule)] px-5 py-4">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">Talk it through</h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--bp-muted)]">
            {open.length
              ? `${open.length} ${open.length === 1 ? "question" : "questions"} left. Type or speak, whatever is quicker.`
              : "Everything we need is captured."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the conversation"
          className="rounded-md p-1.5 text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="bp-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {turns.length === 0 ? (
          <div className="space-y-4">
            <p className="bp-display text-[1.25rem] leading-[1.45] text-[var(--bp-ink)]">
              We already know what LinkedIn shows. A few minutes of conversation fills the rest, and every answer lands in your blueprint.
            </p>
            {open.length ? (
              <div>
                <p className="text-xs font-semibold text-[var(--bp-muted)]">First up</p>
                <ul className="mt-2 space-y-1.5">
                  {open.slice(0, 4).map((q) => (
                    <li key={q.path} className="grid grid-cols-[0.875rem_1fr] gap-2 text-sm leading-6 text-[var(--bp-body)]">
                      <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 rounded-[1px] bg-[var(--bp-sky)]" />
                      {q.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          turns.map((turn, i) =>
            turn.role === "assistant" ? (
              <div key={`${turn.at}-${i}`} className="max-w-[92%] rounded-2xl rounded-tl-md bg-[var(--bp-tint)] px-4 py-3 text-[0.9375rem] leading-[1.6] text-[var(--bp-ink)]">
                {turn.content}
              </div>
            ) : (
              <div key={`${turn.at}-${i}`} className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-[var(--bp-navy)] px-4 py-3 text-[0.9375rem] leading-[1.6] text-white">
                {turn.content}
              </div>
            )
          )
        )}
        {busy ? (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-[var(--bp-tint)] px-4 py-3 text-sm text-[var(--bp-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Writing it into your blueprint
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-[#fdeeee] px-4 py-3 text-sm text-[#8a1f1f]">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="border-t border-[var(--bp-rule)] px-4 py-4">
        {active ? (
          <div className="rounded-2xl border border-[var(--bp-rule)] bg-white focus-within:border-[var(--bp-sky)] focus-within:ring-2 focus-within:ring-[#cfe6f8]">
            <textarea
              ref={inputRef}
              value={text}
              disabled={busy}
              rows={3}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={transcribing ? "Turning your voice into text…" : "Your answer"}
              className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-3 text-[0.9375rem] leading-6 text-[var(--bp-ink)] outline-none placeholder:text-[var(--bp-faint)]"
            />
            <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  aria-pressed={recording}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    recording ? "bg-[#fdeeee] text-[#9b1c1c]" : "text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
                  }`}
                >
                  {recording ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Mic className="h-3.5 w-3.5" aria-hidden />}
                  {recording ? "Stop" : "Speak"}
                </button>
                {ttsOn && lastQuestion ? (
                  <button
                    type="button"
                    onClick={() => speak(lastQuestion)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden />
                    Hear it
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={send}
                disabled={busy || !text.trim()}
                aria-label="Send"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bp-navy)] text-white transition-colors hover:bg-[var(--bp-blue)] disabled:opacity-35"
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : open.length ? (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="w-full rounded-full bg-[var(--bp-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
          >
            {busy ? "Starting…" : turns.length ? "Pick up where we left off" : "Start the conversation"}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-[var(--bp-muted)]">
              {neededSections.length
                ? "A few items are easier to type straight into the document."
                : "That is everything. BCA can now write the rest of your blueprint."}
            </p>
            <BuildBar compact />
          </div>
        )}
      </footer>
    </div>
  );
}
