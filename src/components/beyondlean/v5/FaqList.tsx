"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

export const FAQ_TOPICS = ["Getting started", "Is it for me?", "Working together", "Cost and results"];

export const FAQS = [
  {
    topic: "Getting started",
    q: "What is the BOSS Score?",
    a: "13 quick questions that give you a score out of 100 across the 10 areas of your business, from sales and cash to systems, your team and you as the owner. It's free and takes a few minutes.",
  },
  {
    topic: "Getting started",
    q: "What is the Constraint Call?",
    a: "Every business has one thing that holds back everything else, like the slowest machine on a line. It might be quoting, hiring, cash, or you. Fix that, and the whole business speeds up. The Constraint Call is where we find yours. It's 30 minutes, one to one with me. We look across your whole business, using your BOSS Score if you've taken it, and I tell you the one to three things to do next. You keep the notes. All I ask is that you're honest about where the business really is. If I can't help, I'll tell you.",
  },
  {
    topic: "Is it for me?",
    q: "Who do you work with?",
    a: "Owner-led UK businesses with a team and real processes, usually 10 to 50 people. Not just manufacturers: most of my work has been in manufacturing, food, finance, energy and contact centres, but if you have people and processes, I can help.",
  },
  {
    topic: "Working together",
    q: "Do we meet in person?",
    a: "Both work. I'm based in North Wales and work with owners across the UK, in person or on Zoom.",
  },
  {
    topic: "Working together",
    q: "Will you work with my team, or just me?",
    a: "Both. We work through the plan side by side, and your team learns the new way of working, so it lasts without me.",
  },
  {
    topic: "Cost and results",
    q: "What does it cost?",
    a: "The BOSS Score and the Constraint Call are free. If we work together, you'll know the full fee before you commit to anything. We agree it after the call, once we both know what's needed.",
  },
  {
    topic: "Cost and results",
    q: "How soon will I see a difference?",
    a: "We measure from the start, so you see what's changing as we go. The first fixes go after the biggest leak, so that's where you'll feel it first.",
  },
  {
    topic: "Cost and results",
    q: "What if it doesn't work?",
    a: "We measure before and after, so you'll know. If something isn't working, we change the plan. And if I can't help in the first place, I'll tell you on the Constraint Call.",
  },
];

/** Topic tabs over an open-and-close list of questions. `chevron`: a small down arrow instead of the plus button. */
export function FaqList({ chevron = false }: { chevron?: boolean }) {
  const [topic, setTopic] = useState("All questions");
  const shown = topic === "All questions" ? FAQS : FAQS.filter((f) => f.topic === topic);

  return (
    <div className="v5-faq2">
      <div className="v5-tabs v5-faq2-tabs" role="group" aria-label="Filter questions by topic">
        {["All questions", ...FAQ_TOPICS].map((t) => (
          <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="v5-faq2-list">
        {shown.map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary>
              {f.q}
              <span className="v5-faq2-ic" aria-hidden>
                {chevron ? <ChevronDown /> : <Plus />}
              </span>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
