"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  Captions,
  Check,
  Clock3,
  LayoutGrid,
  Link2Off,
  LoaderCircle,
  Mic,
  MicOff,
  Minimize2,
  NotebookPen,
  PenLine,
  PhoneOff,
  Reply,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  SquarePen,
  TrendingUp,
  UserCheck,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { AvaMark, HaloMark, type MarkId } from "../marks";
import { ASK, AWAY, CAMPAIGN, COACH, HISTORY, PLAN_STEPS } from "../mock";
import { Option, SectionIntro, Seg } from "../Option";
import { AppRail, Composer, Screen, TwoWeight, Typing } from "../parts";
import { fakeVoice, prefersReducedMotion } from "../useLoop";
import { FACES } from "./FaceOptions";
import "./moreScreens.css";

type Mark = MarkId;
type CallState = "speaking" | "listening" | "thinking";

const CALL_STATES: { id: CallState; label: string }[] = [
  { id: "speaking", label: "Talking" },
  { id: "listening", label: "Listening" },
  { id: "thinking", label: "Thinking" },
];

/** Delay for one step of a sequence (see .ms-seq). */
const at = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

/**
 * Mounts its children the first time they scroll into view, so a sequence
 * that plays on mount starts when someone can actually see it.
 */
function WhenSeen({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <div ref={box} className="absolute inset-0">
      {seen ? children : null}
    </div>
  );
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const easeOut = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 4);

/* ------------------------------------------------------------ Canvas stage */

/**
 * A full-screen canvas that draws every frame while on screen. Unlike the
 * symbol loop it keeps its own width and height, for wide light effects.
 * With reduced motion it paints one settled frame.
 */
function useStage(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void, settle = 6) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = true;
    let last = 0;
    const start = performance.now();
    const still = prefersReducedMotion();

    const paint = (t: number, dt: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, w, h, t, dt);
    };
    const fit = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) paint(settle, 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !still) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function frame(now: number) {
      raf = 0;
      if (!visible) return;
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, last ? t - last : 0.016);
      last = t;
      paint(t, dt);
      raf = requestAnimationFrame(frame);
    }
    if (!still) raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [settle]);

  return ref;
}

type Spark = { a: number; d: number; v: number; s: number; tw: number };

/**
 * The light of a voice call, after the phone reference Zander liked: an arc
 * of light rises from the bottom edge with her voice, sinks low while she
 * listens, and while she thinks, sparkles drift in and gather at `focus`.
 */
function VoiceStage({ state, focus }: { state: CallState; focus: { x: number; y: number } }) {
  const mem = useRef({ level: 0, arc: 1, spark: 0, parts: [] as Spark[] });
  const ref = useStage((ctx, w, h, t, dt) => {
    const m = mem.current;
    const target = state === "speaking" ? fakeVoice(t, true) : state === "listening" ? 0.4 * fakeVoice(t * 0.85 + 4, true) : 0;
    m.level += (target - m.level) * Math.min(1, dt * 12);
    m.arc += ((state === "thinking" ? 0.3 : state === "listening" ? 0.7 : 1) - m.arc) * Math.min(1, dt * 2.5);
    m.spark += ((state === "thinking" ? 1 : 0) - m.spark) * Math.min(1, dt * 1.8);

    // The rising arc of light.
    const cx = w / 2;
    const base = h + 30;
    const breath = 0.5 + 0.5 * Math.sin(t * 0.8);
    const ry = (64 + 20 * breath + 190 * m.level) * m.arc + 18;
    const rx = w * 0.5;
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(1, (ry + 30) / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(236,248,255,${0.95 * m.arc})`);
    g.addColorStop(0.25, `rgba(150,210,250,${0.75 * m.arc})`);
    g.addColorStop(0.55, `rgba(26,143,212,${0.36 * m.arc})`);
    g.addColorStop(1, "rgba(26,143,212,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const lg = ctx.createLinearGradient(cx - rx * 0.62, 0, cx + rx * 0.62, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, `rgba(255,255,255,${0.9 * m.arc * m.arc})`);
    lg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.strokeStyle = lg;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(124,195,242,0.95)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(cx, base, rx * 0.62, ry * 0.92 + 14, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Sparkles gathering while she thinks.
    if (m.spark < 0.01) return;
    if (!m.parts.length) {
      m.parts = Array.from({ length: 90 }, () => ({
        a: Math.random() * Math.PI * 2,
        d: 60 + Math.random() * 520,
        v: 50 + Math.random() * 90,
        s: 0.8 + Math.random() * 2,
        tw: Math.random() * 6,
      }));
    }
    const glow = ctx.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, 170);
    glow.addColorStop(0, `rgba(170,220,255,${0.22 * m.spark * (0.7 + 0.3 * Math.sin(t * 2.4))})`);
    glow.addColorStop(1, "rgba(170,220,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(focus.x - 170, focus.y - 170, 340, 340);
    for (const p of m.parts) {
      p.d -= p.v * dt * (0.5 + p.d / 520);
      p.a += dt * 0.35;
      if (p.d < 26) {
        p.d = 360 + Math.random() * 260;
        p.a = Math.random() * Math.PI * 2;
      }
      const near = Math.min(1, (p.d - 26) / 90);
      const far = Math.min(1, (620 - p.d) / 160);
      const a = m.spark * near * far * (0.45 + 0.55 * Math.sin(t * 5 + p.tw) ** 2);
      if (a < 0.02) continue;
      const x = focus.x + Math.cos(p.a) * p.d;
      const y = focus.y + Math.sin(p.a) * p.d * 0.78;
      ctx.fillStyle = `rgba(226,242,255,${a})`;
      ctx.shadowColor = "rgba(124,195,242,0.9)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, p.s, 0, Math.PI * 2);
      ctx.fill();
      if (p.s > 2.2) {
        ctx.strokeStyle = `rgba(226,242,255,${a * 0.7})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - p.s * 3, y);
        ctx.lineTo(x + p.s * 3, y);
        ctx.moveTo(x, y - p.s * 3);
        ctx.lineTo(x, y + p.s * 3);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  });
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

/* ------------------------------------------------------------ Voice call parts */

const SAY = "Sarah Mills replied overnight. She asked what it costs, so I wrote an answer in your words. Shall I read it to you?";
const SAY_WORDS = SAY.split(" ");

function LiveCaption({ state, width = 820 }: { state: CallState; width?: number }) {
  const [n, setN] = useState(SAY_WORDS.length);
  useEffect(() => {
    if (state !== "speaking" || prefersReducedMotion()) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = i >= SAY_WORDS.length + 8 ? 0 : i + 1;
      setN(i);
    }, 240);
    return () => window.clearInterval(id);
  }, [state]);

  const lineCls = "text-center text-[30px] font-medium leading-[1.35] tracking-[-0.015em]";
  if (state === "listening") {
    return (
      <p className={lineCls} style={{ maxWidth: width, color: "rgba(234,244,252,0.92)" }}>
        Yes, read it to me. Then we can change the price bit
        <span className="ms-caret" aria-hidden />
      </p>
    );
  }
  if (state === "thinking") {
    return (
      <p className={lineCls} style={{ maxWidth: width, color: "rgba(207,230,248,0.62)" }}>
        <span className="ad-shimmer">Opening her message</span>
      </p>
    );
  }
  return (
    <p className={lineCls} style={{ maxWidth: width }} aria-label={SAY}>
      {SAY_WORDS.map((word, i) => (
        <span key={i} className="ms-caption-word" style={{ color: i < n ? "#ffffff" : "rgba(207,230,248,0.3)" }}>
          {word}{" "}
        </span>
      ))}
    </p>
  );
}

function CallTimer() {
  const [s, setS] = useState(222);
  useEffect(() => {
    const id = window.setInterval(() => setS((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="ad-num">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

function CallTop() {
  return (
    <div className="dark absolute inset-x-8 top-6 z-[3] flex items-center">
      <span className="flex items-center gap-2.5 text-[15px] text-[rgba(234,244,252,0.85)]">
        <span className="h-2 w-2 rounded-full bg-[var(--sky-2)] shadow-[0_0_10px_rgba(124,195,242,0.9)]" />
        <span className="font-semibold text-white">Talking with Ava</span>
        <CallTimer />
      </span>
      <span className="ad-chip ml-auto">Get clients</span>
      <span className="ad-icon-btn ml-2" title="Make smaller">
        <Minimize2 className="h-[18px] w-[18px]" aria-hidden />
      </span>
    </div>
  );
}

function CallControls({
  muted,
  onMute,
  transcript,
  onTranscript,
}: {
  muted: boolean;
  onMute: () => void;
  transcript: boolean;
  onTranscript: () => void;
}) {
  const label = "text-[13px] font-medium text-[rgba(234,244,252,0.78)]";
  return (
    <div className="absolute inset-x-0 bottom-8 z-[3] flex items-end justify-center gap-12">
      <div className="flex w-[110px] flex-col items-center gap-2.5">
        <button type="button" className="ms-call-btn" aria-pressed={muted} onClick={onMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <MicOff className="h-6 w-6" aria-hidden /> : <Mic className="h-6 w-6" aria-hidden />}
        </button>
        <span className={label}>{muted ? "Unmute" : "Mute"}</span>
      </div>
      <div className="flex w-[110px] flex-col items-center gap-2.5">
        <button type="button" className="ms-call-btn end" aria-label="End the call">
          <PhoneOff className="h-7 w-7" aria-hidden />
        </button>
        <span className={label}>End</span>
      </div>
      <div className="flex w-[110px] flex-col items-center gap-2.5">
        <button
          type="button"
          className="ms-call-btn"
          aria-pressed={transcript}
          onClick={onTranscript}
          aria-label={transcript ? "Hide transcript" : "Show transcript"}
        >
          <Captions className="h-6 w-6" aria-hidden />
        </button>
        <span className={label}>{transcript ? "Hide transcript" : "Show transcript"}</span>
      </div>
    </div>
  );
}

const TRANSCRIPT = [
  { who: "You", text: "What came in overnight?" },
  {
    who: "Ava",
    text: "Three things. Sarah Mills replied, 38 owners were invited, and you have a call with David at 2pm.",
  },
  { who: "You", text: "Start with Sarah." },
  { who: "Ava", text: SAY, now: true },
];

function Transcript({ mark }: { mark: Mark }) {
  return (
    <aside
      className="ad-glass-dark ad-scroll ms-panel-in absolute right-6 top-[78px] bottom-[150px] z-[3] w-[360px] overflow-auto rounded-[24px] p-6"
      aria-label="Transcript"
    >
      <h3 className="text-[17px] font-bold text-white">Transcript</h3>
      <p className="mt-1 text-[13px] text-[rgba(207,230,248,0.7)]">Saved to your past chats when you hang up.</p>
      <ol className="mt-5 flex flex-col gap-4">
        {TRANSCRIPT.map((line, i) => (
          <li key={i} className="flex gap-3">
            {line.who === "Ava" ? (
              <AvaMark id={mark} size={22} dark state={line.now ? "speaking" : "idle"} />
            ) : (
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[var(--ice)] text-[9px] font-bold text-[var(--navy)]">
                {COACH.initials}
              </span>
            )}
            <p
              className="text-[15px] leading-relaxed"
              style={{
                color: line.who === "Ava" ? "rgba(234,244,252,0.92)" : "rgba(207,230,248,0.7)",
              }}
            >
              {line.text}
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/** When the transcript opens, her face or symbol and the captions move left to make room. */
const SHIFT = 190;
const slide = (open: boolean): CSSProperties => ({
  transform: open ? `translateX(-${SHIFT}px)` : "none",
  transition: "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
});

function useCallChrome() {
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState(false);
  return {
    muted,
    transcript,
    onMute: () => setMuted((m) => !m),
    onTranscript: () => setTranscript((x) => !x),
  };
}

/* A · Her face, large, fading into the navy mist. */
function FaceCall({ mark, state }: { mark: Mark; state: CallState }) {
  const c = useCallChrome();
  const face = FACES.navy;
  return (
    <div
      className="dark absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(60% 70% at 50% 32%, #22405f 0%, ${face.room} 48%, #071a2e 100%)`,
      }}
    >
      <div className="absolute inset-0" style={slide(c.transcript)}>
        <div
          className="ad-breathe absolute bg-cover"
          style={{
            left: 720 - 300,
            top: -40,
            width: 600,
            height: 745,
            backgroundImage: `url(${face.src})`,
            backgroundPosition: "50% 20%",
            WebkitMaskImage: "radial-gradient(ellipse 50% 54% at 50% 40%, #000 52%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 50% 54% at 50% 40%, #000 52%, transparent 100%)",
          }}
        />
      </div>
      <VoiceStage state={state} focus={{ x: c.transcript ? 720 - SHIFT : 720, y: 300 }} />
      <CallTop />
      <div className="absolute inset-x-0 top-[598px] z-[2] flex flex-col items-center gap-3" style={slide(c.transcript)}>
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[rgba(207,230,248,0.85)]">
          {state === "listening" ? (
            <>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ice)] text-[10px] font-bold text-[var(--navy)]">
                {COACH.initials}
              </span>
              You
            </>
          ) : (
            <>
              <AvaMark id={mark} size={28} dark state={state} />
              Ava
            </>
          )}
        </span>
        <LiveCaption state={state} width={c.transcript ? 760 : 820} />
      </div>
      <CallControls {...c} />
      {c.transcript ? <Transcript mark={mark} /> : null}
    </div>
  );
}

/* B · No face: her symbol, large, in the beam of light. */
function SymbolCall({ mark, state }: { mark: Mark; state: CallState }) {
  const c = useCallChrome();
  return (
    <div className="dark absolute inset-0 overflow-hidden">
      <div className="ad-sky-beam">
        <span className="ad-dust" />
        <span className="ad-beam" />
        <span className="ad-beam core" />
      </div>
      <VoiceStage state={state} focus={{ x: c.transcript ? 720 - SHIFT : 720, y: 290 }} />
      <CallTop />
      <div className="absolute inset-x-0 top-[150px] z-[2] flex justify-center" style={slide(c.transcript)}>
        <AvaMark id={mark} size={280} dark state={state} />
      </div>
      <div className="absolute inset-x-0 top-[528px] z-[2] flex flex-col items-center gap-3" style={slide(c.transcript)}>
        <span className="text-[14px] font-semibold text-[rgba(207,230,248,0.8)]">{state === "listening" ? "You" : "Ava"}</span>
        <LiveCaption state={state} width={c.transcript ? 760 : 860} />
      </div>
      <CallControls {...c} />
      {c.transcript ? <Transcript mark={mark} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------ First meeting */

const PROMISES: { icon: LucideIcon; text: string }[] = [
  { icon: Search, text: "I find the right people." },
  { icon: PenLine, text: "I write the messages in your words." },
  { icon: ShieldCheck, text: "I never send anything without your yes." },
];

/* C · Her ring builds itself, she says hello, three promises, one button. */
function FirstMeeting() {
  return (
    <div className="absolute inset-0">
      <div className="ad-sky-sunrise" />
      <main className="relative z-[1] flex h-full flex-col items-center pt-[112px]">
        <HaloMark size={156} state="speaking" />
        <div className="ms-seq mt-8" style={at(1.5)}>
          <TwoWeight light="Hi, I'm Ava." bold="I help you win clients." size={54} />
        </div>
        <ul className="mt-12 flex flex-col gap-4">
          {PROMISES.map(({ icon: Icon, text }, i) => (
            <li key={text} className="ms-seq flex items-center gap-4" style={at(2.5 + i * 0.5)}>
              <span className="ad-glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
                <Icon className="h-[19px] w-[19px] text-[var(--blue)]" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="text-[21px] font-medium tracking-[-0.01em] text-[var(--ink)]">{text}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ms-seq mt-12 inline-flex items-center gap-2.5 rounded-full bg-[var(--navy)] px-8 py-4 text-[17px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(5,30,54,0.7)] transition-colors hover:bg-[var(--blue)]"
          style={at(4.2)}
        >
          Let&apos;s start <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ While you were away */

type Group = "needs" | "done" | "coming";

const GROUPS: { id: Group; title: string }[] = [
  { id: "needs", title: "Needs you" },
  { id: "done", title: "Done" },
  { id: "coming", title: "Coming up" },
];

const DIGEST: {
  id: string;
  group: Group;
  icon: LucideIcon;
  title: string;
  line: string;
  when: string;
  action: string;
  fresh: boolean;
}[] = [
  {
    id: "sarah",
    group: "needs",
    icon: Reply,
    title: AWAY[0].title,
    line: AWAY[0].line,
    when: "07:12",
    action: AWAY[0].action,
    fresh: AWAY[0].fresh,
  },
  {
    id: "post",
    group: "needs",
    icon: PenLine,
    title: "Your LinkedIn post is ready",
    line: "The quoting trap. It goes out at 8am if you say yes.",
    when: "06:30",
    action: "Check the post",
    fresh: true,
  },
  {
    id: "invites",
    group: "done",
    icon: UserCheck,
    title: AWAY[1].title,
    line: AWAY[1].line,
    when: "Overnight",
    action: AWAY[1].action,
    fresh: AWAY[1].fresh,
  },
  {
    id: "helen",
    group: "done",
    icon: TrendingUp,
    title: "Moved Helen Price to warm",
    line: "She looked at your profile twice this week.",
    when: "Yesterday",
    action: "Open her card",
    fresh: false,
  },
  {
    id: "week",
    group: "done",
    icon: LayoutGrid,
    title: "Wrote up your week",
    line: "12 new connections, 3 replies, 1 call booked.",
    when: "Yesterday",
    action: "See the week",
    fresh: false,
  },
  {
    id: "david",
    group: "coming",
    icon: CalendarClock,
    title: AWAY[2].title,
    line: AWAY[2].line,
    when: "2:00pm",
    action: AWAY[2].action,
    fresh: AWAY[2].fresh,
  },
  {
    id: "thanks",
    group: "coming",
    icon: Clock3,
    title: "Thank-you notes go out Thursday",
    line: "Day 3 of the Leeds campaign, to the 6 who accepted.",
    when: "Thu 9am",
    action: "Check them",
    fresh: false,
  },
];

/* D · What she did, and what needs your yes. */
function AwayDigest({ mark }: { mark: Mark }) {
  const [seen, setSeen] = useState<Set<string>>(() => new Set(DIGEST.filter((d) => !d.fresh).map((d) => d.id)));
  const see = (id: string) => setSeen((s) => new Set(s).add(id));
  const unseen = DIGEST.filter((d) => !seen.has(d.id)).length;
  const needs = DIGEST.filter((d) => d.group === "needs").length;
  return (
    <div className="absolute inset-0 flex">
      <div className="ad-sky-day" data-time="morning" />
      <AppRail tone="glass" mark={mark} />
      <main className="relative z-[1] flex flex-1 gap-16 pl-[88px] pr-16 pt-[64px]">
        <div className="flex w-[360px] shrink-0 flex-col pt-2">
          <AvaMark id={mark} size={64} state="speaking" />
          <div className="mt-7">
            <TwoWeight light="While you were away," bold={`${needs} things need your yes.`} size={40} align="left" />
          </div>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--slate)]">
            Since 6:40pm yesterday I did <span className="ad-num">{DIGEST.filter((d) => d.group === "done").length}</span> things and lined
            up 2 more. Nothing went out without you.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSeen(new Set(DIGEST.map((d) => d.id)))}
              disabled={!unseen}
              className="ad-pill disabled:pointer-events-none disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden />
              {unseen ? "Mark all as seen" : "All seen"}
            </button>
            {unseen ? (
              <span className="text-[14px] font-medium text-[var(--blue)]">
                <span className="ad-num">{unseen}</span> new
              </span>
            ) : null}
          </div>
          <div className="mt-auto pb-10">
            <Composer variant="glass" width={360} tall={false} placeholder="Ask about any of these" />
          </div>
        </div>

        <div className="flex w-[700px] flex-col gap-7">
          {GROUPS.map((g) => {
            const rows = DIGEST.filter((d) => d.group === g.id);
            return (
              <section key={g.id} className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--ink)]">
                  {g.title}
                  <span className="ad-num text-[14px] font-medium text-[var(--faint)]">{rows.length}</span>
                </h3>
                {rows.map((d) => {
                  const lit = !seen.has(d.id);
                  const Icon = d.icon;
                  const done = d.group === "done";
                  return (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => see(d.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && see(d.id)}
                      className={`ad-glass ms-row flex cursor-pointer items-center gap-4 rounded-[18px] px-4 py-3 ${lit ? "ad-unseen" : ""}`}
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                        style={{
                          background: done ? "rgba(15,122,92,0.1)" : "rgba(26,143,212,0.1)",
                          color: done ? "#0f7a5c" : "#0c5290",
                        }}
                      >
                        {done ? (
                          <Check className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
                        ) : (
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[16px] font-bold text-[var(--ink)]">
                          {d.title}
                          {lit ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--sky)]" aria-label="New" /> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[14px] text-[var(--slate)]">{d.line}</span>
                      </span>
                      <span className="ad-num shrink-0 text-[13px] text-[var(--faint)]">{d.when}</span>
                      {g.id === "needs" ? (
                        <span className="shrink-0 rounded-full bg-[var(--navy)] px-4 py-2 text-[13.5px] font-semibold text-white">
                          {d.action}
                        </span>
                      ) : (
                        <span className="inline-flex w-[124px] shrink-0 items-center justify-end gap-1 text-[13.5px] font-semibold text-[var(--blue)]">
                          {d.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ Past chats */

type Made = { icon: LucideIcon; label: string };

const MADE: Record<string, Made> = {
  campaign: { icon: Rocket, label: "Campaign" },
  reply: { icon: Reply, label: "Reply" },
  post: { icon: PenLine, label: "Post" },
  practice: { icon: Mic, label: "Practice" },
  blueprint: { icon: LayoutGrid, label: "Blueprint" },
  prep: { icon: NotebookPen, label: "Prep notes" },
};

const CHATS: Record<
  string,
  {
    time: string;
    made?: keyof typeof MADE;
    ask: string;
    reply: string;
    thing?: { title: string; line: string };
  }
> = {
  "Leeds manufacturers campaign": {
    time: "09:12",
    made: "campaign",
    ask: ASK,
    reply: "Done. 41 owners fit your ideal client, the note uses your Leeds story, and nothing sends until you say yes.",
    thing: {
      title: CAMPAIGN.name,
      line: `${CAMPAIGN.people} people · ${CAMPAIGN.perDay} a day · ${CAMPAIGN.steps.length} steps`,
    },
  },
  "Reply to Sarah Mills": {
    time: "07:40",
    made: "reply",
    ask: "Sarah asked what it costs. Help me answer.",
    reply: "Here is a draft in your words. It gives her the range, then offers a free BOSS Score first.",
    thing: {
      title: "Reply to Sarah Mills",
      line: "86 words · waiting for your yes",
    },
  },
  "LinkedIn post: the quoting trap": {
    time: "4:15pm",
    made: "post",
    ask: "Write a post about owners stuck doing all the quotes.",
    reply: "Here is a post in your voice. One story, 180 words, and a question at the end to get replies.",
    thing: {
      title: "The quoting trap",
      line: "180 words · goes out tomorrow at 8am",
    },
  },
  "Practise the pitch with a sceptical owner": {
    time: "11:02",
    made: "practice",
    ask: "Let me practise my pitch with a sceptical owner.",
    reply: "Good session. You handled the price question well. Next time, ask about his weekends before you talk about the roadmap.",
    thing: { title: "Pitch practice", line: "12 minutes · score 7 out of 10" },
  },
  "Fill in my Blueprint offer": {
    time: "Wed",
    made: "blueprint",
    ask: "Help me fill in my offer.",
    reply: "I wrote your offer from what you told me. Have a read and change anything that doesn't sound like you.",
    thing: { title: "Your offer", line: "Blueprint · 3 of 4 parts done" },
  },
  "Who should I target first?": {
    time: "Tue",
    ask: "Who should I target first?",
    reply: "Start with manufacturers in Leeds. You know the area, you have two clients there, and owners there post a lot about staff.",
  },
  "Prep for David Okafor": {
    time: "Mon",
    made: "prep",
    ask: "Get me ready for my call with David.",
    reply: "His BOSS Score is 54. Hiring is his biggest worry. I put three questions to ask and one story to tell in your notes.",
    thing: { title: "Call prep: David Okafor", line: "3 questions · 1 story" },
  },
};

/* E · Search everything she has done with you. */
function PastChats({ mark }: { mark: Mark }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(HISTORY[0].items[0]);
  const query = q.trim().toLowerCase();
  const groups = HISTORY.map((g) => ({
    ...g,
    items: g.items.filter((t) => !query || t.toLowerCase().includes(query) || CHATS[t].ask.toLowerCase().includes(query)),
  })).filter((g) => g.items.length);
  const chat = CHATS[pick];
  const made = chat.made ? MADE[chat.made] : null;
  const day = HISTORY.find((g) => g.items.includes(pick))?.when ?? "";

  return (
    <div className="absolute inset-0 flex">
      <div className="ad-sky-mist" />
      <AppRail tone="glass" mark={mark} />
      <aside className="relative z-[1] flex w-[400px] shrink-0 flex-col border-r border-white/90 bg-white/45 px-5 pt-7 backdrop-blur-xl">
        <div className="flex items-center px-2">
          <h2 className="text-[22px] font-bold tracking-[-0.015em] text-[var(--ink)]">Past chats</h2>
          <span className="ad-icon-btn ml-auto" title="New chat">
            <SquarePen className="h-[18px] w-[18px]" aria-hidden />
          </span>
        </div>
        <label className="ad-glass mt-5 flex items-center gap-2.5 rounded-full px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-[var(--slate)]" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your chats"
            aria-label="Search your chats"
            className="ms-search w-full bg-transparent text-[15px] text-[var(--ink)] outline-none"
          />
        </label>
        <div className="ad-scroll -mx-2 mt-5 flex-1 overflow-auto px-2 pb-6">
          {groups.length ? (
            groups.map((g) => (
              <section key={g.when} className="mb-5">
                <h3 className="px-3 pb-1.5 text-[13px] font-semibold text-[var(--slate)]">{g.when}</h3>
                {g.items.map((title) => {
                  const c = CHATS[title];
                  const m = c.made ? MADE[c.made] : null;
                  const MIcon = m?.icon;
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => setPick(title)}
                      aria-current={pick === title}
                      className="ms-chat-item flex w-full flex-col items-start gap-1.5 rounded-[14px] px-3 py-2.5 text-left transition-colors"
                    >
                      <span className="w-full truncate text-[15px] font-semibold text-[var(--ink)]">{title}</span>
                      <span className="flex items-center gap-2">
                        {m && MIcon ? (
                          <span className="ad-chip !py-0.5">
                            <MIcon className="h-3 w-3" aria-hidden />
                            {m.label}
                          </span>
                        ) : null}
                        <span className="ad-num text-[12.5px] text-[var(--faint)]">{c.time}</span>
                      </span>
                    </button>
                  );
                })}
              </section>
            ))
          ) : (
            <p className="px-3 pt-4 text-[15px] leading-relaxed text-[var(--slate)]">
              No chats match &ldquo;{q}&rdquo;. Try a name, a town or a word from what you asked.
            </p>
          )}
        </div>
      </aside>

      <main className="relative z-[1] flex flex-1 flex-col px-16 pt-9">
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--ink)]">{pick}</h2>
            <p className="mt-1 flex items-center gap-2 text-[14px] text-[var(--slate)]">
              <span className="ad-num">
                {day}, {chat.time}
              </span>
              {made ? <span className="ad-chip">{made.label}</span> : null}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--navy)] px-5 py-2.5 text-[14px] font-semibold text-white">
            Carry on this chat <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </header>

        <div key={pick} className="ad-arrive mx-auto mt-12 flex w-full max-w-[720px] flex-col gap-6">
          <div className="flex justify-end">
            <div className="ad-user-bubble">{chat.ask}</div>
          </div>
          <div className="flex gap-3.5">
            <AvaMark id={mark} size={30} />
            <div className="flex-1">
              <p className="ad-ava-text">{chat.reply}</p>
              {made && chat.thing ? (
                <div className="ad-glass mt-5 flex items-center gap-4 rounded-[18px] p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[rgba(26,143,212,0.1)] text-[var(--blue)]">
                    <made.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[var(--blue)]">{made.label}</span>
                    <span className="block text-[16px] font-bold text-[var(--ink)]">{chat.thing.title}</span>
                    <span className="ad-num block text-[14px] text-[var(--slate)]">{chat.thing.line}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--blue)]">
                    Open <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-auto w-full max-w-[720px] pb-8">
          <Composer variant="glass" width="100%" tall={false} placeholder="Carry on where you left off" />
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ States */

function StateRoom({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <div className="ad-sky-sunrise is-chat" />
      <div className="relative z-[1] mx-auto flex h-full w-[580px] flex-col justify-center gap-5">{children}</div>
    </div>
  );
}

/** The plan forms one step at a time, then starts again. */
function ThinkingState({ mark }: { mark: Mark }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = i >= PLAN_STEPS.length + 2 ? 0 : i + 1;
      setN(i);
    }, 1100);
    return () => window.clearInterval(id);
  }, []);
  return (
    <StateRoom>
      <div className="flex justify-end">
        <div className="ad-user-bubble !text-[14px]">{ASK}</div>
      </div>
      <div className="flex gap-3.5">
        <AvaMark id={mark} size={34} state="thinking" />
        <div className="flex-1">
          <p className="text-[16px] font-semibold text-[var(--blue)]">
            <span className="ad-shimmer">Making a plan</span>
          </p>
          <ol className="mt-3 flex flex-col gap-2.5">
            {PLAN_STEPS.map((s, i) => {
              const done = i < n - 1;
              const now = i === n - 1;
              const shown = i < n;
              return (
                <li key={s.label} className="flex items-center gap-3 transition-opacity duration-500" style={{ opacity: shown ? 1 : 0.28 }}>
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                    style={{
                      background: done ? "#0f7a5c" : "transparent",
                      boxShadow: done ? "none" : "inset 0 0 0 1.5px rgba(12,82,144,0.35)",
                    }}
                  >
                    {done ? (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
                    ) : now ? (
                      <LoaderCircle className="ms-spin h-3.5 w-3.5 text-[var(--sky)]" aria-hidden />
                    ) : null}
                  </span>
                  <span className={`text-[15px] ${now ? "font-semibold text-[var(--ink)]" : "text-[var(--body)]"}`}>{s.label}</span>
                  {done ? <span className="ml-auto text-[13px] text-[var(--faint)]">{s.detail}</span> : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </StateRoom>
  );
}

function LinkedInDownState({ mark }: { mark: Mark }) {
  const [phase, setPhase] = useState<"idle" | "trying" | "failed">("idle");
  const tryNow = () => {
    setPhase("trying");
    window.setTimeout(() => setPhase("failed"), 1600);
  };
  return (
    <StateRoom>
      <div className="flex gap-3.5">
        <AvaMark id={mark} size={34} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgba(244,217,176,0.55)] text-[#8a5a14]">
              <Link2Off className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <p className="text-[18px] font-bold text-[var(--ink)]">I can&apos;t reach LinkedIn right now.</p>
          </div>
          <p className="ad-ava-text mt-3">
            Your Leeds campaign is paused, so nothing is lost and nobody gets a message twice. I&apos;ll try again at 10:30 and tell you
            when it&apos;s back.
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={tryNow}
              disabled={phase === "trying"}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--navy)] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--blue)] disabled:opacity-80"
            >
              {phase === "trying" ? (
                <LoaderCircle className="ms-spin h-4 w-4" aria-hidden />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden />
              )}
              {phase === "trying" ? "Trying" : "Try now"}
            </button>
            <span className="ad-pill !py-2.5">Reconnect LinkedIn</span>
          </div>
          {phase === "failed" ? (
            <p className="ad-arrive mt-3 text-[14px] text-[var(--slate)]">Still no luck. I&apos;ll keep trying and let you know.</p>
          ) : null}
        </div>
      </div>
    </StateRoom>
  );
}

function OfflineState() {
  return (
    <StateRoom>
      <div className="flex justify-center">
        <span className="ad-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold text-[var(--ink)]">
          <WifiOff className="h-4 w-4 text-[var(--slate)]" aria-hidden />
          You&apos;re offline
        </span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="ad-user-bubble !text-[14px] opacity-60">Who replied to the Leeds campaign?</div>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--slate)]">
          <Clock3 className="h-3.5 w-3.5" aria-hidden /> Waiting to send
        </span>
      </div>
      <p className="text-center text-[15px] leading-relaxed text-[var(--slate)]">
        No internet. Your message is saved and sends as soon as you&apos;re back online. Your campaigns keep running while you&apos;re away.
      </p>
      <Composer variant="glass" width="100%" tall={false} placeholder="You can keep typing" />
    </StateRoom>
  );
}

function LimitState({ mark }: { mark: Mark }) {
  return (
    <StateRoom>
      <div className="flex gap-3.5">
        <AvaMark id={mark} size={34} />
        <div className="flex-1">
          <p className="text-[18px] font-bold text-[var(--ink)]">That&apos;s today&apos;s 15 invites sent.</p>
          <p className="ad-ava-text mt-2">I stop at 15 a day to keep your LinkedIn account safe. The next 15 go out tomorrow at 9am.</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: CAMPAIGN.perDay }, (_, i) => (
                <span key={i} className="h-2 w-4 rounded-full bg-[var(--sky)]" />
              ))}
            </span>
            <span className="ad-num text-[13px] font-semibold text-[var(--slate)]">15 of 15 today</span>
          </div>
          <div className="mt-5 flex gap-2.5">
            <span className="ad-pill !py-2.5">See who got one</span>
            <span className="ad-pill !py-2.5">Why 15?</span>
          </div>
        </div>
      </div>
    </StateRoom>
  );
}

/* F · The four not-normal moments, side by side. */
function StatesBoard({ mark }: { mark: Mark }) {
  const tiles = [
    {
      title: "Thinking",
      line: "Her symbol speeds up and the plan forms step by step.",
      node: <ThinkingState mark={mark} />,
    },
    {
      title: "Can't reach LinkedIn",
      line: "Says what's paused, when she'll retry, and gives a Try now.",
      node: <LinkedInDownState mark={mark} />,
    },
    {
      title: "Offline",
      line: "Your message waits and sends itself when you're back.",
      node: <OfflineState />,
    },
    {
      title: "Limit reached for today",
      line: "Why she stopped, and when she starts again.",
      node: <LimitState mark={mark} />,
    },
  ];
  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      {tiles.map((t) => (
        <div key={t.title} className="flex flex-col gap-3">
          <div>
            <h4 className="text-[16px] font-bold text-[var(--ink)]">{t.title}</h4>
            <p className="text-[14px] text-[var(--slate)]">{t.line}</p>
          </div>
          <Screen w={720} h={450} label={t.title}>
            {t.node}
          </Screen>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Waking up */

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Scattered points of light drift in and lock into her ring, then it glows once. */
function WakeRing({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  const ref = useStage((ctx, w, h, t) => {
    const N = 48;
    const settled = smooth(1.7, 2.2, t);
    const flash = Math.exp(-(((t - 2.05) / 0.28) ** 2));

    // Soft light behind the ring once it closes.
    const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    halo.addColorStop(0, `rgba(124,195,242,${0.1 * settled + 0.3 * flash})`);
    halo.addColorStop(1, "rgba(124,195,242,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - R * 2.4, cy - R * 2.4, R * 4.8, R * 4.8);

    for (let i = 0; i < N; i++) {
      const f = i / N;
      const delay = rnd(i + 7) * 0.55;
      const k = easeOut((t - 0.15 - delay) / 1.35);
      const a = f * Math.PI * 2 - Math.PI / 2 + t * 0.12;
      const wave = 0.5 + 0.5 * Math.sin(a * 3 - t * 1.3);
      const tx = cx + Math.cos(a) * R;
      const ty = cy + Math.sin(a) * R;
      const sx = rnd(i) * w;
      const sy = rnd(i + 100) * h;
      const x = sx + (tx - sx) * k;
      const y = sy + (ty - sy) * k;

      // A short tail while it travels.
      if (k > 0.02 && k < 0.98) {
        const k0 = Math.max(0, k - 0.09);
        ctx.strokeStyle = `rgba(150,210,250,${0.35 * (1 - k)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx + (tx - sx) * k0, sy + (ty - sy) * k0);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      const twinkle = 0.5 + 0.5 * Math.sin(t * 6 + i * 2.1);
      const alpha = (1 - k) * (0.25 + 0.45 * twinkle) + k * (0.55 + 0.45 * wave);
      const size = 1.6 + k * (2.6 + 2.2 * wave * settled) + 1.5 * flash;
      ctx.fillStyle = `rgba(${Math.round(124 + 131 * wave * k)},${Math.round(195 + 60 * wave * k)},255,${alpha})`;
      ctx.shadowColor = "rgba(124,195,242,0.95)";
      ctx.shadowBlur = 6 + 10 * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 4);
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.32);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  });
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

/* G · The moment she opens. */
function WakeUp() {
  return (
    <div className="dark absolute inset-0 overflow-hidden">
      <div className="ad-sky-beam">
        <span className="ad-dust" />
      </div>
      <WakeRing cx={720} cy={350} R={96} />
      <div className="absolute inset-x-0 top-[500px] z-[2] flex flex-col items-center">
        <div className="ms-wordmark text-[104px] font-semibold leading-none" style={at(2)}>
          Ava
          <span className="ms-glint" aria-hidden>
            Ava
          </span>
        </div>
        <p className="ms-seq mt-7 flex items-center gap-3 text-[19px] text-[rgba(207,230,248,0.85)]" style={at(3.2)}>
          Good morning, {COACH.first}. Getting your day ready <Typing />
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Tab */

function Replay({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ad-pill">
      <RotateCcw className="h-4 w-4" aria-hidden />
      Replay
    </button>
  );
}

export function MoreScreens() {
  const mark: Mark = "haloCore";
  const [faceState, setFaceState] = useState<CallState>("speaking");
  const [symbolState, setSymbolState] = useState<CallState>("speaking");
  const [meetRun, setMeetRun] = useState(0);
  const [wakeRun, setWakeRun] = useState(0);

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionIntro title="More screens">
          The other places Ava turns up: on a call, the first time you meet her, when you come back, your past chats, when something goes
          wrong, and the second she wakes up.
        </SectionIntro>
      </div>

      <Option
        letter="A"
        name="Call with her face"
        why="She looks at you while she talks. Her face fades into navy mist, her words appear under her as she says them, and light rises from the bottom when she speaks."
        aside={<Seg label="What Ava is doing" value={faceState} options={CALL_STATES} onChange={setFaceState} />}
      >
        <Screen label="Voice call with her face">
          <FaceCall mark={mark} state={faceState} />
        </Screen>
      </Option>

      <Option
        letter="B"
        name="Call with her symbol"
        why="No face, just her symbol in the beam of light. Like the phone you liked: light rises in an arc while she talks, and sparkles gather while she thinks."
        aside={<Seg label="What Ava is doing" value={symbolState} options={CALL_STATES} onChange={setSymbolState} />}
      >
        <Screen label="Voice call with her symbol">
          <SymbolCall mark={mark} state={symbolState} />
        </Screen>
      </Option>

      <Option
        letter="C"
        name="First meeting"
        why="The first time a coach opens Ava. Her ring builds itself, she says hello, makes three promises, then one button. Always the Halo here, because it is the symbol that builds itself."
        aside={<Replay onClick={() => setMeetRun((r) => r + 1)} />}
      >
        <Screen label="First meeting with Ava">
          <WhenSeen>
            <FirstMeeting key={meetRun} />
          </WhenSeen>
        </Screen>
      </Option>

      <Option
        letter="D"
        name="While you were away"
        why="What she did and what needs your yes, in three groups, each with one action. New things stay lit until you have seen them. Click one to see it settle."
      >
        <Screen label="While you were away">
          <AwayDigest mark={mark} />
        </Screen>
      </Option>

      <Option
        letter="E"
        name="Past chats"
        why="Every chat by day, each tagged with what it made, like a campaign or a post, so you can find it again. The search works: try typing Sarah."
      >
        <Screen label="Past chats">
          <PastChats mark={mark} />
        </Screen>
      </Option>

      <Option
        letter="F"
        name="When things are not normal"
        why="Thinking, LinkedIn down, offline, and the daily limit. Each one says what happened and what happens next, in plain words, without alarm."
      >
        <StatesBoard mark={mark} />
      </Option>

      <Option
        letter="G"
        name="Waking up"
        why="The second she opens: scattered points of light gather into her ring, it glows once, and a light passes over her name. About three seconds."
        aside={<Replay onClick={() => setWakeRun((r) => r + 1)} />}
      >
        <Screen label="Ava waking up">
          <WhenSeen>
            <WakeUp key={wakeRun} />
          </WhenSeen>
        </Screen>
      </Option>
    </div>
  );
}
