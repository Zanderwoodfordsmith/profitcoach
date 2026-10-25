"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";

import type { SimMoment, SimNote, TranscriptLine } from "@/lib/simulator/types";

import { useSimHeaders } from "./simApi";
import "./sim.css";

/** The AI sometimes wraps quotes in its own quote marks; the page adds curly ones. */
export function unquote(text: string): string {
  return text.trim().replace(/^["'“‘]+|["'”’]+$/g, "");
}

type Remark = { kind: "good" | "missed" | "tip"; text: string; tryInstead?: string };

const REMARK: Record<Remark["kind"], { dot: string; label: string }> = {
  good: { dot: "bg-[var(--sim-good)]", label: "Worked well" },
  missed: { dot: "bg-[var(--sim-amber)]", label: "Missed chance" },
  tip: { dot: "bg-sky-300", label: "Tip" },
};

const VERDICT: Record<"better" | "same" | "not-yet", string> = {
  better: "Better",
  same: "About the same",
  "not-yet": "Not quite yet",
};

export type ReplayShown = { line: number; verdict: "better" | "same" | "not-yet"; note: string; tryNext: string };

const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

/** The examiner's notes, keyed by line. Older reports only have moments, matched by their quote. */
function remarksByLine(report: { notes?: SimNote[]; moments: SimMoment[] }, lines: TranscriptLine[]): Map<number, Remark[]> {
  const out = new Map<number, Remark[]>();
  const add = (i: number, r: Remark) => {
    if (i < 0 || i >= lines.length) return;
    out.set(i, [...(out.get(i) ?? []), r]);
  };
  // Moments first; a side note that says the same kind of thing about the same line is left out.
  for (const m of report.moments) {
    let i = m.line ?? -1;
    if (i < 0) {
      const q = squash(unquote(m.quote)).slice(0, 48);
      i = q ? lines.findIndex((l) => l.role === "coach" && squash(l.text).includes(q)) : -1;
    }
    add(i, { kind: m.kind, text: m.note, tryInstead: m.tryInstead || undefined });
  }
  for (const n of report.notes ?? []) {
    if ((out.get(n.line) ?? []).some((r) => r.kind === n.kind)) continue;
    add(n.line, { kind: n.kind, text: n.text });
  }
  return out;
}

function clock(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec)) return "";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Where a line sits in the recording. Older sessions only have seconds since the start, which is close for a call with no time outs. */
function placeOf(l: TranscriptLine, parts: number): { part: number; t: number } | null {
  if (l.t !== undefined) return { part: l.part ?? 0, t: l.t };
  if (parts === 1 && l.at !== undefined) return { part: 0, t: Math.max(0, l.at - 3) };
  return null;
}

const FIRST_LINES = 16;
const BARS = 150;

type Loaded = { url: string; peaks: number[]; duration: number };

/**
 * The call as a chat with the examiner's notes down the side, and a player
 * on top: play, scrub along a waveform split into the session's chapters, and
 * the line being spoken lights up. Shared with the Call simulator.
 */
export function Transcript({
  lines,
  conversationIds,
  audioUrl,
  face,
  name,
  report,
  chapters,
  stageLabels,
  onReplay,
  replays,
}: {
  lines: TranscriptLine[];
  conversationIds: string[];
  audioUrl: (part: number) => string;
  face: string;
  name: string;
  report: { notes?: SimNote[]; moments: SimMoment[] };
  /** Where each part of the session starts, from the report. */
  chapters?: { stage: string; line: number }[];
  stageLabels?: Record<string, string>;
  /** Shows "Try that moment again" on missed chances in the coach's own lines. */
  onReplay?: (line: number) => void;
  replays?: ReplayShown[];
}) {
  const headers = useSimHeaders();
  const remarks = useMemo(() => remarksByLine(report, lines), [report, lines]);
  const parts = Math.max(1, conversationIds.length);
  const places = useMemo(() => lines.map((l) => placeOf(l, parts)), [lines, parts]);
  const [part, setPart] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, Loaded | "loading" | "error">>({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [all, setAll] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // As many bars as fit (about one per 5px), so the waveform reads on a phone too.
  const waveRef = useRef<HTMLDivElement>(null);
  const [barCount, setBarCount] = useState(BARS);
  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const measure = () => setBarCount(Math.max(36, Math.min(BARS, Math.floor(el.clientWidth / 5))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [conversationIds.length]);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  const scrubbing = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const current = loaded[part];
  const ready = current && current !== "loading" && current !== "error" ? current : null;

  // The line being spoken now: the last one in this part that has started.
  const nowLine = useMemo(() => {
    if (!ready) return -1;
    let best = -1;
    places.forEach((p, i) => {
      if (p && p.part === part && p.t <= time + 0.25) best = i;
    });
    return best;
  }, [places, part, time, ready]);

  useEffect(() => {
    if (!playing || nowLine < 0) return;
    if (nowLine >= FIRST_LINES && !all) setAll(true);
    lineRefs.current[nowLine]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [nowLine, playing, all]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, ready]);

  async function load(p: number): Promise<Loaded | null> {
    const have = loaded[p];
    if (have && have !== "loading" && have !== "error") return have;
    setLoaded((l) => ({ ...l, [p]: "loading" }));
    try {
      const h = await headers();
      const res = h ? await fetch(audioUrl(p), { headers: h }) : null;
      if (!res?.ok) throw new Error("not ready");
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      let peaks: number[] = [];
      let duration = 0;
      try {
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(buffer.slice(0));
        duration = audio.duration;
        const data = audio.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / BARS));
        for (let i = 0; i < BARS; i++) {
          let peak = 0;
          for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 16) peak = Math.max(peak, Math.abs(data[j]));
          peaks.push(peak);
        }
        const top = Math.max(...peaks, 0.01);
        peaks = peaks.map((v) => Math.max(0.06, v / top));
        void ctx.close();
      } catch {
        peaks = Array.from({ length: BARS }, (_, i) => 0.3 + 0.25 * Math.abs(Math.sin(i * 0.7)));
      }
      const done = { url: URL.createObjectURL(blob), peaks, duration };
      setLoaded((l) => ({ ...l, [p]: done }));
      return done;
    } catch {
      setLoaded((l) => ({ ...l, [p]: "error" }));
      return null;
    }
  }

  async function seek(p: number, t: number, play = true) {
    if (p !== part) {
      setPart(p);
      setTime(0);
    }
    const got = await load(p);
    if (!got) return;
    const el = audioRef.current;
    if (el && p === part && el.src === got.url) {
      el.currentTime = t;
      setTime(t);
      if (play) void el.play();
    } else {
      // The audio element switches source on the next render; seek once it has.
      pendingSeek.current = t;
      if (play) setPlaying(true);
    }
  }

  async function toggle() {
    const el = audioRef.current;
    if (!ready) {
      const got = await load(part);
      if (got) {
        pendingSeek.current = 0;
        setPlaying(true);
      }
      return;
    }
    if (el?.paused) void el.play();
    else el?.pause();
  }

  const duration = ready?.duration || 0;
  const chapterMarks = (chapters ?? [])
    .map((c) => ({ ...c, place: places[c.line] }))
    .filter((c): c is typeof c & { place: { part: number; t: number } } => Boolean(c.place && c.place.part === part && duration));

  function fromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    return x * duration;
  }

  const shown = all ? lines : lines.slice(0, FIRST_LINES);
  const bars = (() => {
    const peaks = ready?.peaks ?? Array.from({ length: BARS }, () => 0.12);
    return Array.from({ length: barCount }, (_, i) => {
      const from = Math.floor((i * peaks.length) / barCount);
      const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / barCount));
      return Math.max(...peaks.slice(from, to));
    });
  })();
  const nowChapter = [...chapterMarks].reverse().find((c) => c.place.t <= time + 0.25);
  const byReplay = new Map((replays ?? []).map((r) => [r.line, r]));

  return (
    <section className="sim-room mt-14 rounded-[2rem] px-4 pb-8 sm:px-8">
      <div className="sticky top-16 z-[5] -mx-4 rounded-t-[2rem] px-4 pb-4 pt-8 sm:-mx-8 sm:px-8" style={{ background: "linear-gradient(#0f2944 78%, rgba(15,41,68,0))" }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-light tracking-[-0.02em] text-[var(--sim-cream)]">The call</h2>
            <p className="mt-1 text-sm text-[var(--sim-cream-soft)]">
              {conversationIds.length ? "Play it back, jump to a chapter, or tap a line's time." : `${lines.length} lines`}
            </p>
          </div>
          {parts > 1 ? (
            <div className="sim-seg" role="group" aria-label="Part of the call">
              {conversationIds.map((_, i) => (
                <button key={i} type="button" aria-pressed={part === i} onClick={() => void seek(i, 0, false)}>
                  Part {i + 1}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {conversationIds.length ? (
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={() => void toggle()}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--sim-cream)] text-[var(--sim-navy)] shadow-[0_8px_30px_-8px_rgba(214,228,246,0.6)] transition hover:scale-105"
              aria-label={playing ? "Pause" : "Play the call"}
            >
              {current === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="relative h-5 text-caption text-[var(--sim-cream-faint)]">
                {nowChapter ? (
                  <span className="text-[var(--sim-cream)] sm:hidden">{stageLabels?.[nowChapter.stage] ?? nowChapter.stage}</span>
                ) : null}
                {chapterMarks.map((c) => (
                  <button
                    key={c.line}
                    type="button"
                    onClick={() => void seek(part, c.place.t)}
                    className="absolute top-0 hidden whitespace-nowrap rounded-full px-1.5 hover:text-[var(--sim-cream)] sm:block"
                    style={{ left: `${(c.place.t / duration) * 100}%` }}
                  >
                    {stageLabels?.[c.stage] ?? c.stage}
                  </button>
                ))}
              </div>
              <div
                ref={waveRef}
                className="relative flex h-12 cursor-pointer touch-none items-center gap-[2px]"
                role="slider"
                tabIndex={0}
                aria-label="Position in the call"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(time)}
                aria-valuetext={clock(time)}
                onKeyDown={(e) => {
                  if (!ready) return;
                  if (e.key === "ArrowRight") void seek(part, Math.min(duration, time + 5), !audioRef.current?.paused);
                  if (e.key === "ArrowLeft") void seek(part, Math.max(0, time - 5), !audioRef.current?.paused);
                }}
                onPointerDown={(e) => {
                  if (!ready) {
                    void toggle();
                    return;
                  }
                  scrubbing.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const t = fromPointer(e);
                  setTime(t);
                  if (audioRef.current) audioRef.current.currentTime = t;
                }}
                onPointerMove={(e) => {
                  if (!scrubbing.current) return;
                  const t = fromPointer(e);
                  setTime(t);
                  if (audioRef.current) audioRef.current.currentTime = t;
                }}
                onPointerUp={() => {
                  scrubbing.current = false;
                }}
              >
                {bars.map((v, i) => {
                  const played = duration ? i / bars.length < time / duration : false;
                  return (
                    <span
                      key={i}
                      className="flex-1 rounded-full transition-colors"
                      style={{ height: `${Math.round(v * 100)}%`, background: played ? "var(--sim-cream)" : "rgba(244,238,228,0.24)" }}
                    />
                  );
                })}
                {chapterMarks.map((c) => (
                  <span key={c.line} className="pointer-events-none absolute inset-y-0 w-px bg-[rgba(245,207,138,0.7)]" style={{ left: `${(c.place.t / duration) * 100}%` }} aria-hidden />
                ))}
              </div>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
              <span className="tabular-nums text-sm text-[var(--sim-cream)]">
                {clock(time)} <span className="text-[var(--sim-cream-faint)]">/ {duration ? clock(duration) : "–"}</span>
              </span>
              <button
                type="button"
                onClick={() => setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
                className="rounded-full border border-[var(--sim-cream-line)] px-2 py-0.5 text-xs text-[var(--sim-cream-soft)] hover:text-[var(--sim-cream)]"
                aria-label="Playback speed"
              >
                {rate}×
              </button>
            </div>
          </div>
        ) : null}
        {current === "error" ? <p className="mt-2 text-sm text-[var(--sim-amber)]">The recording isn&rsquo;t ready yet. Try again in a minute.</p> : null}
        {ready ? (
          <audio
            ref={audioRef}
            src={ready.url}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = rate;
              if (pendingSeek.current !== null) {
                e.currentTarget.currentTime = pendingSeek.current;
                pendingSeek.current = null;
                if (playing) void e.currentTarget.play();
              }
            }}
            onTimeUpdate={(e) => {
              if (!scrubbing.current) setTime(e.currentTarget.currentTime);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        ) : null}
      </div>

      <ol className="relative z-[2] mt-4 space-y-4">
        {shown.map((l, i) => {
          const notes = remarks.get(i) ?? [];
          const coach = l.role === "coach";
          const missed = notes.some((n) => n.kind === "missed");
          const place = places[i];
          const speaking = i === nowLine && playing;
          const replay = byReplay.get(i);
          return (
            <li key={i} ref={(el) => void (lineRefs.current[i] = el)} className="grid items-start gap-x-8 gap-y-2 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className={`flex items-end gap-2.5 ${coach ? "justify-end" : ""}`}>
                {!coach ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={face} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : null}
                <div className={`max-w-[min(85%,560px)] ${coach ? "text-right" : ""}`}>
                  <p className="mb-1 px-1 text-caption text-[var(--sim-cream-faint)]">
                    {coach ? "You" : name}
                    {place && conversationIds.length ? (
                      <button type="button" onClick={() => void seek(place.part, place.t)} className="ml-1 rounded px-1 underline-offset-2 hover:text-[var(--sim-cream)] hover:underline" aria-label={`Play from ${clock(place.t)}`}>
                        · {parts > 1 ? `Part ${place.part + 1}, ` : ""}
                        {clock(place.t)}
                      </button>
                    ) : l.at !== undefined ? (
                      ` · ${clock(l.at)}`
                    ) : (
                      ""
                    )}
                  </p>
                  <p
                    className={`whitespace-pre-wrap px-4 py-2.5 text-left text-read leading-relaxed transition-shadow duration-300 ${
                      coach
                        ? "rounded-2xl rounded-br-md bg-[var(--sim-cream)] text-[var(--sim-navy)]"
                        : "rounded-2xl rounded-bl-md border border-[var(--sim-cream-line)] bg-[rgba(5,30,54,0.55)] text-[var(--sim-cream)]"
                    } ${speaking ? "shadow-[0_0_0_2px_#f4eee4,0_0_28px_rgba(214,228,246,0.55)]" : missed ? "ring-2 ring-[rgba(245,207,138,0.6)]" : ""}`}
                  >
                    {l.text.replace(/\[[a-z ,'-]{2,40}\]\s*/gi, "")}
                  </p>
                </div>
              </div>
              {notes.length || replay ? (
                <div className="space-y-2 pl-10 lg:pl-0 lg:pt-4">
                  {notes.map((n, j) => (
                    <div key={j} className="sim-glass rounded-2xl px-3.5 py-2.5">
                      <p className="flex items-center gap-1.5 text-kicker font-semibold uppercase text-[var(--sim-cream-faint)]">
                        <span className={`h-1.5 w-1.5 rounded-full ${REMARK[n.kind].dot}`} aria-hidden />
                        {REMARK[n.kind].label}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-[var(--sim-cream)]">{n.text}</p>
                      {n.tryInstead ? (
                        <p className="mt-1.5 text-sm leading-snug text-[var(--sim-cream-soft)]">Try: &ldquo;{unquote(n.tryInstead)}&rdquo;</p>
                      ) : null}
                      {onReplay && coach && n.kind === "missed" && j === notes.findIndex((x) => x.kind === "missed") ? (
                        <button type="button" onClick={() => onReplay(i)} className="sim-pill sim-pill-solid mt-2.5 !px-3 !py-1.5 text-xs">
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try that moment again
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {replay ? (
                    <div className="rounded-2xl border border-[rgba(143,227,184,0.35)] bg-[rgba(143,227,184,0.08)] px-3.5 py-2.5">
                      <p className="text-kicker font-semibold uppercase text-[var(--sim-good)]">Your second try · {VERDICT[replay.verdict]}</p>
                      <p className="mt-1 text-sm leading-snug text-[var(--sim-cream)]">{replay.note}</p>
                      {replay.tryNext ? <p className="mt-1.5 text-sm leading-snug text-[var(--sim-cream-soft)]">Next time: &ldquo;{unquote(replay.tryNext)}&rdquo;</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="hidden lg:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      {lines.length > FIRST_LINES ? (
        <div className="relative z-[2] mt-6 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} className="sim-pill sim-pill-line">
            {all ? "Show less" : `Show the whole call · ${lines.length - FIRST_LINES} more lines`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
