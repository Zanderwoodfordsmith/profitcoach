"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type Props = {
  title: string;
  seconds: number;
};

function formatClock(total: number) {
  const mins = Math.floor(total / 60);
  const secs = Math.max(0, Math.floor(total % 60));
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function WorkingLessonIntro({ title, seconds }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!playing) return;
    const started = Date.now() - elapsed * 1000;
    const tick = window.setInterval(() => {
      const next = (Date.now() - started) / 1000;
      if (next >= seconds) {
        setElapsed(seconds);
        setPlaying(false);
        setCollapsed(true);
        window.clearInterval(tick);
        return;
      }
      setElapsed(next);
    }, 80);
    return () => window.clearInterval(tick);
  }, [playing, seconds, elapsed]);

  function start() {
    startedRef.current = true;
    if (elapsed >= seconds) setElapsed(0);
    setPlaying(true);
    setCollapsed(false);
  }

  function skip() {
    setPlaying(false);
    setElapsed(seconds);
    setCollapsed(true);
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          setElapsed(0);
          start();
        }}
        className="flex w-full items-center gap-3 rounded-xl bg-slate-950 px-4 py-2.5 text-left text-white transition hover:bg-slate-900"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-white/55">
            Replay · {seconds}s
          </span>
          <span className="block truncate text-sm font-medium">{title}</span>
        </span>
      </button>
    );
  }

  const ratio = seconds > 0 ? Math.min(1, elapsed / seconds) : 0;

  return (
    <div className="overflow-hidden rounded-xl bg-slate-950 text-white">
      <div className="relative flex min-h-[11.5rem] flex-col justify-end px-5 pb-4 pt-6 md:min-h-[13rem] md:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, #051e36 0%, #0c5290 52%, #1a8fd4 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"
        />
        <div className="relative">
          <p className="text-xs font-medium text-white/70">
            {seconds} seconds
          </p>
          <p className="mt-1 max-w-xl text-lg font-semibold tracking-tight md:text-xl">
            {title}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80">
            One market to start. Then you check the recommendation and lock it.
            Skip if you already know why you are here.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (playing ? setPlaying(false) : start())}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              {playing ? (
                <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              )}
              {playing ? "Pause" : startedRef.current ? "Resume" : "Play"}
            </button>
            <button
              type="button"
              onClick={skip}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Skip
            </button>
            {playing || elapsed > 0 ? (
              <span className="text-xs font-medium tabular-nums text-white/65">
                {formatClock(elapsed)} / {formatClock(seconds)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="h-1 bg-white/15">
        <div
          className="h-full bg-white transition-[width] duration-75"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
