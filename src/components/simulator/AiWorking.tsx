"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import "./sim.css";

/**
 * "The AI is working": rings turning around a glowing core, with the steps
 * ticking off underneath. The steps move on a rough clock (the work itself
 * is one request), and the last one waits until the work is really done.
 * Used for scoring, building a custom client and checking a replay.
 */
export function AiWorking({
  title,
  steps,
  seconds,
  done = false,
}: {
  title: string;
  /** What's happening, in order. */
  steps: string[];
  /** Roughly how long the whole thing takes, to pace the steps. */
  seconds: number;
  done?: boolean;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (done) return;
    const each = Math.max(1200, (seconds * 1000) / Math.max(1, steps.length));
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), each);
    return () => window.clearInterval(t);
  }, [done, seconds, steps.length]);
  const current = done ? steps.length : step;

  return (
    <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
      <div className="sim-ai" aria-hidden>
        <span className="sim-ai-ring one" />
        <span className="sim-ai-ring two" />
        <span className="sim-ai-ring three" />
        <span className="sim-ai-core" />
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="sim-ai-spark" style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <p className="mt-8 text-[clamp(1.4rem,2.6vw,2rem)] font-light tracking-[-0.02em] text-[var(--sim-cream)]">{title}</p>
      <ol className="mt-5 space-y-2 text-left">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2.5 text-sm transition-colors duration-500 ${
              i < current ? "text-[var(--sim-cream-soft)]" : i === current ? "text-[var(--sim-cream)]" : "text-[var(--sim-cream-faint)] opacity-60"
            }`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full ${i < current ? "bg-[var(--sim-cream)] text-[var(--sim-navy)]" : "border border-[var(--sim-cream-line)]"}`}>
              {i < current ? <Check className="h-3 w-3" /> : i === current ? <span className="sim-ai-dot" /> : null}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
