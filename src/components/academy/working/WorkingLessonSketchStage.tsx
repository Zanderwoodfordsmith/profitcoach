"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import {
  WorkingLessonChat,
  type WorkingChatMessage,
} from "@/components/academy/working/WorkingLessonChat";
import type { WorkingLessonId } from "@/lib/academy/workingLessons";

type Row = { label: string; value: string };

type Sketch = {
  source: string;
  headline: string;
  rows: Row[];
  opening: string;
};

const SKETCHES: Record<Exclude<WorkingLessonId, "core-client">, Sketch> = {
  "understand-ideal-client": {
    source: "From the locked core client · UK manufacturing owners",
    headline: "Language they actually use",
    rows: [
      {
        label: "They say",
        value: "I am still in every decision. The managers will not own it. I cannot take a week off.",
      },
      {
        label: "Pains",
        value: "Cash surprises. The sales pipeline is in their head. Hiring feels like a gamble.",
      },
      {
        label: "Hooks",
        value: "Still the bottleneck at £4M? A score for the whole business, including you.",
      },
    ],
    opening:
      "Your core client is locked, so I drafted the words they use. This is the layer every message and the LinkedIn About will copy. What is off?",
  },
  "buyer-avatar": {
    source: "From the locked core client + pain language",
    headline: "One person to write to",
    rows: [
      {
        label: "Snapshot",
        value: "David, 52. MD of a 28-person fabrication firm in the Midlands. Still signs every purchase over £2k.",
      },
      {
        label: "Wants",
        value: "A management team that runs the week. A Friday that ends at 4. A business that does not need him in the van.",
      },
      {
        label: "Objects",
        value: "Coaching is therapy. Consultants write a report and leave. I have tried KPIs before.",
      },
    ],
    opening:
      "This is the person inside the market. Write every line to David, not to manufacturing. What would he argue with?",
  },
  "linkedin-profile": {
    source: "Written to the locked core client",
    headline: "Headline and About, ready to paste",
    rows: [
      {
        label: "Headline",
        value: "I help UK manufacturing owners get out of the day-to-day without losing control",
      },
      {
        label: "About",
        value:
          "You are still the bottleneck. Every decision comes to you. I used a simple system as MD of a precision plant, then with owners like you. Start with a BOSS Score. Then we fix the one area that is costing you the most.",
      },
    ],
    opening:
      "Two variants are ready. This is the recommended pair: who you help, then pain, mechanism, proof you already have. Want a more discreet version?",
  },
  "outreach-messages": {
    source: "First campaign · locked core client",
    headline: "Connection note and the first three follow-ups",
    rows: [
      {
        label: "Connect",
        value: "Hi {First Name}, I work with UK manufacturing owners around the £2–10M mark. Worth connecting.",
      },
      {
        label: "Message 1",
        value:
          "I ask because most MDs I speak to are still in every decision. Are you looking to get the managers owning the week?",
      },
      {
        label: "Proof",
        value:
          "At Hale Precision I used a simple system to grow the plant and step out of the daily grind. Happy to show you how it maps.",
      },
    ],
    opening:
      "The sequence uses the locked market, their words, and your proof. Nothing invented. Which line feels least like you?",
  },
};

type Props = {
  lessonId: Exclude<WorkingLessonId, "core-client">;
  locked: boolean;
  onLock: () => void;
};

export function WorkingLessonSketchStage({ lessonId, locked, onLock }: Props) {
  const sketch = SKETCHES[lessonId];
  const [messages, setMessages] = useState<WorkingChatMessage[]>([
    { role: "ai", content: sketch.opening },
  ]);

  function handleSend(text: string) {
    const lower = text.toLowerCase();
    const ai =
      locked
        ? "This one is locked. Open it again when you want to change a line."
        : lower.includes("looks right") || lower.includes("lock")
          ? "Lock it when you are happy. Later lessons will reuse these lines."
          : "This page is a sketch of the same format. Core Client is the one that is fully wired. Say Looks right to see the lock, or open How To Choose Your Core Client.";

    setMessages((current) => [
      ...current,
      { role: "user", content: text },
      { role: "ai", content: ai },
    ]);
  }

  return (
    <div className="overflow-hidden rounded-xl bg-[#f4f8fb] ring-1 ring-slate-200/80">
      <div
        aria-hidden
        className="h-1"
        style={{
          background: "linear-gradient(90deg, #051e36 0%, #0c5290 48%, #1a8fd4 100%)",
        }}
      />
      <div className="px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0c5290]">{sketch.source}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 md:text-[1.35rem]">
              {sketch.headline}
            </p>
          </div>
          {locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
              Locked
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500">
              Sketch of the format
            </span>
          )}
        </div>

        <dl className="mt-5 divide-y divide-slate-200/80 border-y border-slate-200/80">
          {sketch.rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="text-sm font-semibold text-slate-900">{row.label}</dt>
              <dd className="text-[15px] leading-relaxed text-slate-700">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 border-t border-slate-200/80 pt-5">
          <WorkingLessonChat
            messages={messages}
            onSend={handleSend}
            replies={locked ? [] : ["Looks right"]}
            footer={
              !locked ? (
                <button
                  type="button"
                  onClick={onLock}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-sky-400 hover:text-sky-800 sm:w-auto"
                >
                  Lock this draft
                </button>
              ) : (
                <p className="text-sm font-medium text-emerald-800">
                  Locked. Next working lesson can start from this.
                </p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
