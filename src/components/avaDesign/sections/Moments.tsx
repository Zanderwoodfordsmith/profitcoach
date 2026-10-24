"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  CircleCheck,
  Gauge,
  Hand,
  Linkedin,
  MapPin,
  MessageCircle,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { AvaMark } from "../marks";
import { CAMPAIGN, CONNECT_NOTE, PLAN_STEPS, PROSPECTS, type Prospect } from "../mock";
import { Option, SectionIntro, Seg } from "../Option";
import type { AvaState } from "../useLoop";
import "./moments.css";

/*
 * "What she shares": the moments when Ava hands the coach something in
 * the chat. Each one sits in a real room (the sunrise sky or the navy
 * room) inside a chat column, and replays its entrance on "Play again".
 */

type RoomChoice = "light" | "dark" | "both";

const glass = (dark: boolean) => (dark ? "ad-glass-dark" : "ad-glass");

/** Staggered entrance delays, so the parts of a card arrive in order. */
const at = (i: number, base = 0.2, step = 0.08): CSSProperties => ({ animationDelay: `${base + i * step}s` });

const first = (p: Prospect) => p.name.split(" ")[0];
const staffCount = (p: Prospect) => p.staff.split(" ")[0];

// Short previews of the follow-ups, for the campaign cards.
const STEP_PREVIEWS = [
  CONNECT_NOTE,
  "Thanks for connecting, Sarah. I help owners get their weekends back from the day to day. Worth a short chat some time?",
  "Would a free BOSS Score help? It takes ten minutes and shows where your time and profit go.",
];

/* ------------------------------------------------------------ Rooms */

function Rooms({ choice, label, minH, children }: { choice: RoomChoice; label: string; minH?: number; children: (dark: boolean) => ReactNode }) {
  const rooms = choice === "both" ? [false, true] : [choice === "dark"];
  return (
    <div className={`grid gap-5 ${rooms.length > 1 ? "xl:grid-cols-2" : ""}`}>
      {rooms.map((dark) => (
        <RoomPanel key={String(dark)} dark={dark} label={label} minH={minH}>
          {children(dark)}
        </RoomPanel>
      ))}
    </div>
  );
}

/** One room with a chat column in it. "Play again" remounts what is inside. */
function RoomPanel({ dark, label, minH, children }: { dark: boolean; label: string; minH?: number; children: ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <div className={`adm-room ${dark ? "dark" : ""}`} style={{ minHeight: minH }} role="group" aria-label={`${label}, ${dark ? "navy room" : "sunrise room"}`}>
      {dark ? (
        <div className="ad-sky-beam">
          <span className="ad-dust" />
          <span className="ad-beam" style={{ opacity: 0.45 }} />
        </div>
      ) : (
        <div className="ad-sky-sunrise is-chat" />
      )}
      <button type="button" className="adm-replay" onClick={() => setRun((n) => n + 1)} aria-label={`Play ${label} again`}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Play again
      </button>
      <div key={run} className="relative z-[1] px-4 pb-12 pt-16 sm:px-8">
        <div className="@container mx-auto flex w-full max-w-[760px] flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Chat parts */

function Ava({ dark, children, delay = 0.05, state = "idle" }: { dark: boolean; children: ReactNode; delay?: number; state?: AvaState }) {
  return (
    <div className="ad-arrive flex items-start gap-3" style={{ animationDelay: `${delay}s` }}>
      <span className="mt-0.5 shrink-0">
        <AvaMark id={dark ? "orbit" : "pearl"} size={24} dark={dark} state={state} />
      </span>
      <p className="ad-ava-text min-w-0 flex-1">{children}</p>
    </div>
  );
}

function You({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="flex justify-end">
      <div className="ad-user-bubble ad-arrive" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </div>
  );
}

/** Things she hands over line up under her words, not under her symbol. */
function Handed({ children }: { children: ReactNode }) {
  return <div className="@md:ml-9">{children}</div>;
}

function Face({ p, size = 44 }: { p: Prospect; size?: number }) {
  return (
    <span className="adm-face" style={{ width: size, height: size, fontSize: size * 0.33 }} aria-hidden>
      {p.initials}
    </span>
  );
}

function LinkedInLink({ small }: { small?: boolean }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className={`adm-link ${small ? "text-[13px]" : ""}`}>
      <Linkedin className="h-4 w-4" aria-hidden /> Open on LinkedIn
    </a>
  );
}

/** Add, skip or look. Every prospect option shares these, so only the look differs. */
function ProspectActions({ p, small }: { p: Prospect; small?: boolean }) {
  const [done, setDone] = useState<null | "added" | "skipped">(null);
  const s = small ? "small" : "";
  if (done) {
    return (
      <div className="ad-arrive flex flex-wrap items-center gap-x-3 gap-y-1" style={{ minHeight: small ? 34 : 40 }}>
        {done === "added" ? (
          <span className="adm-on inline-flex items-center gap-2 text-[14px] font-semibold">
            <CircleCheck className="h-4 w-4" aria-hidden /> Added to {CAMPAIGN.name}
          </span>
        ) : (
          <span className="adm-t2 text-[14px]">Skipped. I won&apos;t show you {first(p)} again.</span>
        )}
        <button type="button" className="adm-link" style={{ height: small ? 34 : 40 }} onClick={() => setDone(null)}>
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={`adm-btn ${s}`} onClick={() => setDone("added")}>
        <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden /> Add to campaign
      </button>
      <button type="button" className={`adm-ghost ${s}`} onClick={() => setDone("skipped")}>
        Skip
      </button>
      <span className="ml-auto">
        <LinkedInLink small={small} />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ 1. Prospect card */

/* A: a calm contact card. */
function ProspectContact({ dark, p = PROSPECTS[0] }: { dark: boolean; p?: Prospect }) {
  return (
    <>
      <Ava dark={dark}>I found someone you should meet.</Ava>
      <Handed>
        <article className={`${glass(dark)} ad-arrive rounded-[24px] p-5 @md:p-6`} style={at(0, 0.25)}>
          <header className="flex items-start gap-4">
            <Face p={p} size={48} />
            <div className="min-w-0 flex-1">
              <h4 className="adm-t1 text-[18px] font-bold tracking-[-0.01em]">{p.name}</h4>
              <p className="adm-t2 text-[14.5px] leading-snug">
                {p.role}, {p.firm}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="ad-num adm-t1 text-[30px] font-bold leading-none tracking-[-0.02em]">{p.fit}</div>
              <div className="adm-label mt-1.5">fit score</div>
            </div>
          </header>
          <ul className="adm-t2 ad-arrive mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]" style={at(1, 0.25)}>
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="adm-accent h-4 w-4" aria-hidden /> {p.town}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Users className="adm-accent h-4 w-4" aria-hidden /> <span className="ad-num">{p.staff}</span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Banknote className="adm-accent h-4 w-4" aria-hidden /> <span className="ad-num">{p.revenue} a year</span>
            </li>
          </ul>
          <p className="ad-arrive mt-4 max-w-[60ch] text-[15px] leading-relaxed" style={at(2, 0.25)}>
            <span className="adm-t1 font-semibold">Why now: </span>
            <span className="adm-t2">{p.why}</span>
          </p>
          <div className="adm-rule ad-arrive mt-5 border-t pt-4" style={at(3, 0.25)}>
            <ProspectActions p={p} />
          </div>
        </article>
      </Handed>
    </>
  );
}

/* B: the boarding pass discipline. Labelled segments, every figure lined up. */
function ProspectPass({ dark, p = PROSPECTS[0] }: { dark: boolean; p?: Prospect }) {
  const fields = [
    { label: "Town", value: p.town },
    { label: "Staff", value: staffCount(p) },
    { label: "Revenue", value: p.revenue },
  ];
  return (
    <>
      <Ava dark={dark}>I found someone you should meet.</Ava>
      <Handed>
        <article className={`${glass(dark)} ad-arrive overflow-hidden rounded-[22px]`} style={at(0, 0.25)}>
          <div className="grid @lg:grid-cols-[1fr_168px]">
            <div className="p-5 @md:p-6">
              <div className="adm-label">Owner</div>
              <div className="mt-2 flex items-center gap-3">
                <Face p={p} size={40} />
                <div className="min-w-0">
                  <h4 className="adm-t1 text-[19px] font-bold leading-tight tracking-[-0.01em]">{p.name}</h4>
                  <p className="adm-t2 truncate text-[14px]">
                    {p.role}, {p.firm}
                  </p>
                </div>
              </div>
              <dl className="adm-rule mt-5 grid grid-cols-3 border-t pt-4">
                {fields.map((f, i) => (
                  <div key={f.label} className={`ad-arrive min-w-0 ${i ? "adm-rule border-l pl-4" : ""}`} style={at(i, 0.4)}>
                    <dt className="adm-label">{f.label}</dt>
                    <dd className="ad-num adm-t1 mt-1 truncate text-[17px] font-semibold">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="adm-rule flex items-end justify-between border-t p-5 @md:px-6 @lg:flex-col @lg:items-start @lg:border-l @lg:border-t-0 @lg:py-6">
              <div className="adm-label">Fit score</div>
              <div className="ad-arrive text-right @lg:text-left" style={at(3, 0.4)}>
                <span className="ad-num adm-t1 text-[46px] font-bold leading-none tracking-[-0.03em]">{p.fit}</span>
                <span className="ad-num adm-t3 ml-1 text-[15px] font-semibold">/ 100</span>
              </div>
            </div>
          </div>
          <div className="adm-rule ad-arrive border-t px-5 py-4 @md:px-6" style={at(4, 0.4)}>
            <div className="adm-label">Why now</div>
            <p className="adm-t1 mt-1 text-[15px] leading-relaxed">{p.why}</p>
          </div>
          <div className="adm-rule ad-arrive border-t px-5 py-3.5 @md:px-6" style={at(5, 0.4)}>
            <ProspectActions p={p} />
          </div>
        </article>
      </Handed>
    </>
  );
}

/* C: no card at all. She just tells you, with the actions underneath. */
function ProspectInline({ dark, p = PROSPECTS[0] }: { dark: boolean; p?: Prospect }) {
  return (
    <>
      <Ava dark={dark}>I found someone you should meet.</Ava>
      <Handed>
        <div className="ad-arrive flex items-center gap-3" style={at(0, 0.3)}>
          <Face p={p} size={40} />
          <div className="min-w-0">
            <div className="adm-t1 text-[16px] font-bold">
              {p.name} <span className="ad-chip ad-num ml-1 align-[2px]">{p.fit} fit</span>
            </div>
            <div className="adm-t2 text-[14px]">
              {p.role}, {p.firm}, {p.town}
            </div>
          </div>
        </div>
        <p className="ad-ava-text ad-arrive mt-3 max-w-[62ch]" style={at(1, 0.3)}>
          She has <span className="ad-num">{staffCount(p)}</span> staff and turns over about <span className="ad-num">{p.revenue}</span>. Last week she posted about
          losing two weekends a month to quotes, so now is a good time to say hello.
        </p>
        <div className="ad-arrive mt-4" style={at(2, 0.3)}>
          <ProspectActions p={p} small />
        </div>
      </Handed>
    </>
  );
}

/* ------------------------------------------------------------ 2. Prospect list */

function ProspectList({ dark }: { dark: boolean }) {
  const stats = [
    { n: 48, label: "found" },
    { n: 41, label: "fit" },
    { n: 7, label: "too small" },
  ];
  return (
    <>
      <You>{"Find me owners of £1M+ manufacturers in Leeds"}</You>
      <Ava dark={dark} delay={0.3}>
        I found 48. 41 fit your ideal client. Here are the best three.
      </Ava>
      <Handed>
        <section className={`${glass(dark)} ad-arrive overflow-hidden rounded-[22px]`} style={at(0, 0.5)} aria-label="Prospects she found">
          <dl className="flex gap-7 px-5 pb-4 pt-5 @md:px-6">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dt className="sr-only">{s.label}</dt>
                <dd className="flex items-baseline gap-1.5">
                  <span className="ad-num adm-t1 text-[24px] font-bold tracking-[-0.02em]">{s.n}</span>
                  <span className="adm-t2 text-[14px]">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="adm-rule adm-label grid grid-cols-[1fr_64px_40px] gap-3 border-t px-5 pb-1 pt-3 @md:grid-cols-[1fr_96px_64px_40px] @md:px-6">
            <span>Owner</span>
            <span className="hidden @md:block">Town</span>
            <span className="text-right">Revenue</span>
            <span className="text-right">Fit</span>
          </div>
          <ul className="px-2 pb-2 @md:px-3">
            {PROSPECTS.map((p, i) => (
              <li key={p.name} className="ad-arrive" style={at(i, 0.75, 0.1)}>
                <button
                  type="button"
                  className="adm-row grid w-full grid-cols-[1fr_64px_40px] items-center gap-3 px-3 py-2.5 text-left @md:grid-cols-[1fr_96px_64px_40px]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Face p={p} size={36} />
                    <span className="min-w-0">
                      <span className="adm-t1 block truncate text-[15px] font-semibold">{p.name}</span>
                      <span className="adm-t2 block truncate text-[13.5px]">{p.firm}</span>
                    </span>
                  </span>
                  <span className="adm-t2 hidden text-[14px] @md:block">{p.town}</span>
                  <span className="ad-num adm-t1 text-right text-[14.5px]">{p.revenue}</span>
                  <span className="ad-num adm-accent text-right text-[15px] font-bold">{p.fit}</span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="adm-rule flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 @md:px-6">
            <span className="adm-t3 text-[13.5px]">Best fit first</span>
            <div className="flex items-center gap-1">
              <button type="button" className="adm-link text-[13.5px]">
                Why 7 don&apos;t fit
              </button>
              <button type="button" className="adm-btn small ml-1">
                See all 41 <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </footer>
        </section>
      </Handed>
    </>
  );
}

/* ------------------------------------------------------------ 3. Campaign card */

function OnLine({ onPause }: { onPause: () => void }) {
  return (
    <div className="ad-arrive flex flex-wrap items-center justify-between gap-3">
      <p className="adm-on inline-flex items-center gap-2 text-[15px] font-semibold">
        <CircleCheck className="h-5 w-5" aria-hidden /> It&apos;s on. The first 15 invites go out tomorrow at 9am.
      </p>
      <button type="button" className="adm-ghost small" onClick={onPause}>
        <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
      </button>
    </div>
  );
}

function OnOff({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${on ? "adm-on" : "adm-t2"}`} style={{ background: on ? "var(--on-soft)" : "var(--soft-2)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "var(--on)" : "var(--t3)" }} />
      {on ? "On" : "Off"}
    </span>
  );
}

const daysToInvite = Math.ceil(CAMPAIGN.people / CAMPAIGN.perDay);

/* A: one summary card, the steps down the side, a plain button. */
function CampaignSummary({ dark }: { dark: boolean }) {
  const [on, setOn] = useState(false);
  const facts = [
    { label: "People", value: String(CAMPAIGN.people) },
    { label: "Invites a day", value: String(CAMPAIGN.perDay) },
    { label: "All invited in", value: `${daysToInvite} days` },
  ];
  return (
    <>
      <Ava dark={dark}>Your campaign is ready. Have a look. Turning it on is your call.</Ava>
      <Handed>
        <article className={`${glass(dark)} ad-arrive rounded-[24px] p-5 @md:p-6`} style={at(0, 0.25)}>
          <header className="flex items-start justify-between gap-3">
            <div>
              <h4 className="adm-t1 text-[20px] font-bold tracking-[-0.015em]">{CAMPAIGN.name}</h4>
              <p className="adm-t2 text-[14px]">{CAMPAIGN.type} on LinkedIn</p>
            </div>
            <OnOff on={on} />
          </header>
          <dl className="adm-rule ad-arrive mt-5 grid grid-cols-3 border-y py-4" style={at(1, 0.3)}>
            {facts.map((f, i) => (
              <div key={f.label} className={i ? "adm-rule border-l pl-4" : ""}>
                <dt className="adm-label">{f.label}</dt>
                <dd className="ad-num adm-t1 mt-1 text-[20px] font-bold tracking-[-0.01em]">{f.value}</dd>
              </div>
            ))}
          </dl>
          <ol className="mt-5 flex flex-col">
            {CAMPAIGN.steps.map((s, i) => (
              <li key={s.day} className="ad-arrive grid grid-cols-[64px_14px_1fr] gap-x-3" style={at(i, 0.45, 0.1)}>
                <span className="ad-num adm-t1 pt-px text-[14px] font-bold">{s.day}</span>
                <span className="relative flex justify-center">
                  <span className="mt-[6px] h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />
                  {i < CAMPAIGN.steps.length - 1 ? <span className="absolute bottom-0 top-[22px] w-px" style={{ background: "var(--line)" }} /> : null}
                </span>
                <div className={i < CAMPAIGN.steps.length - 1 ? "pb-4" : ""}>
                  <div className="adm-t1 text-[15px] font-semibold">{s.what}</div>
                  <p className="adm-t2 mt-0.5 line-clamp-1 text-[14px]">{STEP_PREVIEWS[i]}</p>
                </div>
              </li>
            ))}
          </ol>
          <footer className="adm-rule ad-arrive mt-5 border-t pt-5" style={at(5, 0.45)}>
            {on ? (
              <OnLine onPause={() => setOn(false)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="adm-t2 inline-flex items-center gap-2 text-[14px]">
                  <ShieldCheck className="adm-accent h-4 w-4" aria-hidden /> Nothing sends until you say yes.
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" className="adm-ghost">
                    Change something
                  </button>
                  <button type="button" className="adm-btn big" onClick={() => setOn(true)}>
                    Turn it on
                  </button>
                </div>
              </div>
            )}
          </footer>
        </article>
      </Handed>
    </>
  );
}

/** Light fills the button while you hold it. Let go early and nothing happens. */
function HoldButton({ onDone, children }: { onDone: () => void; children: ReactNode }) {
  const [holding, setHolding] = useState(false);
  const start = () => setHolding(true);
  const stop = () => setHolding(false);
  return (
    <button
      type="button"
      className={`adm-btn big adm-hold ${holding ? "is-holding" : ""}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onBlur={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
    >
      <span
        className="fill"
        aria-hidden
        onTransitionEnd={(e) => {
          if (holding && e.propertyName === "transform") onDone();
        }}
      />
      <span className="inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

/* B: the ten days laid out like a calendar, and you hold to turn it on. */
function CampaignDays({ dark }: { dark: boolean }) {
  const [on, setOn] = useState(false);
  const marked = new Map(CAMPAIGN.steps.map((s, i) => [Number(s.day.replace("Day ", "")), i]));
  const icons = [UserPlus, MessageCircle, Gauge];
  return (
    <>
      <Ava dark={dark}>Here is what each person gets, day by day.</Ava>
      <Handed>
        <article className={`${glass(dark)} ad-arrive rounded-[24px] p-5 @md:p-6`} style={at(0, 0.25)}>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="adm-t1 text-[20px] font-bold tracking-[-0.015em]">{CAMPAIGN.name}</h4>
              <p className="adm-t2 text-[14px]">
                <span className="ad-num">{CAMPAIGN.people}</span> people, <span className="ad-num">{CAMPAIGN.perDay}</span> new invites a day
              </p>
            </div>
            <OnOff on={on} />
          </header>
          <div className="mt-5 grid grid-cols-10 gap-1" role="list" aria-label="The ten days">
            {Array.from({ length: 10 }, (_, d) => {
              const day = d + 1;
              const step = marked.get(day);
              const lit = step !== undefined;
              const Icon = lit ? icons[step] : null;
              return (
                <div
                  key={day}
                  role="listitem"
                  className="ad-arrive flex h-[64px] flex-col items-center justify-between rounded-[12px] py-2"
                  style={{
                    ...at(d, 0.35, 0.04),
                    background: lit ? (dark ? "rgba(124,195,242,0.18)" : "var(--navy)") : "var(--soft)",
                    color: lit ? (dark ? "#fff" : "#fff") : "var(--t3)",
                  }}
                >
                  <span className="ad-num text-[12px] font-semibold">{day}</span>
                  {Icon ? <Icon className="h-4 w-4" aria-label={CAMPAIGN.steps[step!].what} /> : <span className="h-1 w-1 rounded-full" style={{ background: "var(--line)" }} />}
                </div>
              );
            })}
          </div>
          <ul className="mt-5 grid gap-3 @lg:grid-cols-3">
            {CAMPAIGN.steps.map((s, i) => {
              const Icon = icons[i];
              return (
                <li key={s.day} className="ad-arrive" style={at(i, 0.75, 0.1)}>
                  <div className="flex items-center gap-2">
                    <Icon className="adm-accent h-4 w-4" aria-hidden />
                    <span className="ad-num adm-t1 text-[14px] font-bold">{s.day}</span>
                  </div>
                  <div className="adm-t1 mt-1 text-[15px] font-semibold">{s.what}</div>
                  <p className="adm-t2 mt-0.5 line-clamp-2 text-[13.5px] leading-snug">{STEP_PREVIEWS[i]}</p>
                </li>
              );
            })}
          </ul>
          <footer className="adm-rule ad-arrive mt-6 border-t pt-5" style={at(4, 0.75)}>
            {on ? (
              <OnLine onPause={() => setOn(false)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="adm-t2 max-w-[34ch] text-[14px] leading-snug">Nothing sends until you say yes. Hold the button for a second, so it can&apos;t happen by mistake.</p>
                <HoldButton onDone={() => setOn(true)}>Hold to turn on</HoldButton>
              </div>
            )}
          </footer>
        </article>
      </Handed>
    </>
  );
}

/* C: she reads back exactly what will happen, then you say yes. */
function CampaignReadBack({ dark }: { dark: boolean }) {
  const [on, setOn] = useState(false);
  const lines = [
    { icon: UserPlus, text: <>I invite <b className="ad-num">{CAMPAIGN.perDay}</b> Leeds owners a day, starting tomorrow at 9am. All <b className="ad-num">{CAMPAIGN.people}</b> are invited in <span className="ad-num">{daysToInvite}</span> days.</> },
    { icon: MessageCircle, text: <>On day 3, I thank them for connecting.</> },
    { icon: Gauge, text: <>On day 10, I offer a free BOSS Score.</> },
    { icon: Hand, text: <>If anyone replies, I stop and bring it to you.</> },
  ];
  return (
    <>
      <Ava dark={dark}>Here is what happens if you say yes.</Ava>
      <Handed>
        <article className={`${glass(dark)} ad-arrive rounded-[24px] p-5 @md:p-6`} style={at(0, 0.25)}>
          <header className="flex items-start justify-between gap-3">
            <h4 className="adm-t1 text-[20px] font-bold tracking-[-0.015em]">{CAMPAIGN.name}</h4>
            <OnOff on={on} />
          </header>
          <ul className="mt-4 flex flex-col gap-3.5">
            {lines.map(({ icon: Icon, text }, i) => (
              <li key={i} className="ad-arrive flex items-start gap-3" style={at(i, 0.4, 0.12)}>
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: "var(--soft-2)" }}>
                  <Icon className="adm-accent h-3.5 w-3.5" aria-hidden />
                </span>
                <p className="adm-t1 text-[16px] leading-relaxed [&_b]:font-bold">{text}</p>
              </li>
            ))}
          </ul>
          <footer className="adm-rule ad-arrive mt-6 border-t pt-5" style={at(5, 0.4, 0.12)}>
            {on ? (
              <OnLine onPause={() => setOn(false)} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="adm-btn big" onClick={() => setOn(true)}>
                    Yes, turn on for {CAMPAIGN.people} people
                  </button>
                  <button type="button" className="adm-link">
                    Change something
                  </button>
                </div>
                <p className="adm-t3 mt-3 text-[13.5px]">Nothing sends until you say yes. You can pause it any time.</p>
              </>
            )}
          </footer>
        </article>
      </Handed>
    </>
  );
}

/* ------------------------------------------------------------ 4. Draft to approve */

const LIMIT = 300;

function DraftApprove({ dark }: { dark: boolean }) {
  const p = PROSPECTS[0];
  const [text, setText] = useState(CONNECT_NOTE);
  const [editing, setEditing] = useState(false);
  const [sent, setSent] = useState(false);
  const over = text.length - LIMIT;
  return (
    <>
      <Ava dark={dark}>Here is the note for Sarah. Change anything you like. I only send it when you approve.</Ava>
      <Handed>
        <article className={`${glass(dark)} ad-arrive overflow-hidden rounded-[24px]`} style={at(0, 0.25)}>
          <header className="adm-rule flex items-center gap-3 border-b px-5 py-4 @md:px-6">
            <Face p={p} size={40} />
            <div className="min-w-0 flex-1">
              <h4 className="adm-t1 text-[15.5px] font-bold">To {p.name}</h4>
              <p className="adm-t2 truncate text-[13.5px]">Connection note on LinkedIn</p>
            </div>
            <Linkedin className="adm-accent h-5 w-5 shrink-0" aria-hidden />
          </header>
          <div className="ad-arrive px-5 py-5 @md:px-6" style={at(1, 0.3)}>
            {editing ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                autoFocus
                aria-label="Your note to Sarah"
                className="adm-t1 block w-full resize-none rounded-[14px] p-3 text-[16px] leading-relaxed outline-none"
                style={{ background: "var(--soft)", boxShadow: "inset 0 0 0 1px var(--line)" }}
              />
            ) : (
              <p className="adm-t1 whitespace-pre-wrap text-[16px] leading-relaxed">{text}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="adm-t3">Uses your Leeds story and her post about quotes.</span>
              <span className={`ad-num ${over > 0 ? "adm-t1 font-bold" : "adm-t3"}`}>
                {over > 0 ? `${over} too long for LinkedIn` : `${text.length} / ${LIMIT}`}
              </span>
            </div>
          </div>
          <footer className="adm-rule border-t px-5 py-4 @md:px-6">
            {sent ? (
              <p className="ad-arrive adm-on inline-flex min-h-[40px] items-center gap-2 text-[14.5px] font-semibold">
                <CircleCheck className="h-5 w-5" aria-hidden /> Sent to Sarah at <span className="ad-num">09:14</span>. I&apos;ll tell you when she replies.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="adm-ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden /> Done editing
                    </>
                  ) : (
                    <>
                      <PenLine className="h-4 w-4" aria-hidden /> Edit
                    </>
                  )}
                </button>
                <button type="button" className="adm-btn ml-auto disabled:cursor-not-allowed disabled:opacity-50" disabled={over > 0} onClick={() => setSent(true)}>
                  <Send className="h-4 w-4" aria-hidden /> Approve and send
                </button>
              </div>
            )}
          </footer>
        </article>
      </Handed>
    </>
  );
}

/* ------------------------------------------------------------ 5. Working progress */

const FOUND = 48;

function WorkingProgress({ dark }: { dark: boolean }) {
  const [cur, setCur] = useState(0);
  const [found, setFound] = useState(0);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState<number[]>([]);
  const total = PLAN_STEPS.length;
  const done = cur >= total;

  useEffect(() => {
    if (paused || done) return;
    const t = setTimeout(() => setCur((c) => c + 1), cur === 0 ? 2800 : 2000);
    return () => clearTimeout(t);
  }, [cur, paused, done]);

  useEffect(() => {
    if (paused || cur !== 0) return;
    const id = setInterval(() => setFound((n) => Math.min(FOUND, n + 2)), 110);
    return () => clearInterval(id);
  }, [cur, paused]);

  const look = (i: number) => setSeen((s) => (s.includes(i) ? s : [...s, i]));

  return (
    <>
      <You>Launch a connection campaign to manufacturing owners in Leeds</You>
      <Ava dark={dark} delay={0.3} state={done ? "idle" : "thinking"}>
        {done ? "All done. Have a look before anything goes out." : "On it. Here is my plan. I'll tick each step off as I go."}
      </Ava>
      <Handed>
        <section className={`${glass(dark)} ad-arrive rounded-[24px] p-3 @md:p-4`} style={at(0, 0.5)} aria-label="Ava's plan" aria-live="polite">
          <header className="flex items-center justify-between gap-3 px-2 pb-2 pt-1 @md:px-3">
            <h4 className="adm-t1 text-[16px] font-bold">{done ? "Campaign ready" : "Building your campaign"}</h4>
            <div className="flex items-center gap-2">
              <span className="ad-num adm-t2 text-[13.5px] font-semibold">
                Step {Math.min(cur + 1, total)} of {total}
              </span>
              {done ? null : (
                <button type="button" className="adm-ghost small" onClick={() => setPaused((v) => !v)}>
                  {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
                  {paused ? "Carry on" : "Pause"}
                </button>
              )}
            </div>
          </header>
          <ol className="flex flex-col gap-1">
            {PLAN_STEPS.map((s, i) => {
              const isDone = i < cur;
              const isNow = i === cur && !done;
              const lit = isDone && i === cur - 1 && !seen.includes(i); // only the step that just changed
              const detail = isDone ? s.detail : isNow && i === 0 ? `Sales Navigator, ${found} found` : isNow ? (paused ? "Paused" : "Working on it") : "";
              return (
                <li
                  key={s.label}
                  tabIndex={isDone ? 0 : -1}
                  onMouseEnter={() => isDone && look(i)}
                  onFocus={() => isDone && look(i)}
                  className={`adm-unseen-fade grid h-[60px] grid-cols-[24px_1fr] items-center gap-3 rounded-[14px] px-2 outline-none @md:px-3 ${lit ? "ad-unseen" : ""}`}
                  style={{ background: lit ? (dark ? "rgba(124,195,242,0.08)" : "rgba(255,255,255,0.55)") : undefined, opacity: !isDone && !isNow ? 0.45 : 1 }}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: isDone ? "var(--accent)" : "transparent", boxShadow: isDone ? undefined : "inset 0 0 0 1.5px var(--line)" }}>
                    {isDone ? <Check className="adm-flap h-3.5 w-3.5" strokeWidth={3} style={{ color: dark ? "var(--navy)" : "#fff" }} aria-label="Done" /> : null}
                    {isNow ? <span className={`h-2 w-2 rounded-full ${paused ? "" : "adm-live"}`} style={{ background: "var(--sky)" }} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[15px] font-semibold ${isNow ? "adm-accent" : "adm-t1"}`}>
                      <span className={isNow && !paused ? "ad-shimmer" : ""}>{s.label}</span>
                    </span>
                    <span className="adm-t2 block h-[20px] truncate text-[13.5px]">
                      {detail ? (
                        <span key={isDone ? "done" : "now"} className={`ad-num ${isDone ? "adm-flap" : ""}`}>
                          {detail}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <footer className="flex min-h-[52px] items-center justify-between gap-3 px-2 pt-2 @md:px-3">
            <span className="adm-t3 text-[13px]">Steps that change stay lit until you look at them.</span>
            {done ? (
              <button type="button" className="adm-btn small ad-arrive">
                See the campaign <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </footer>
        </section>
      </Handed>
    </>
  );
}

/* ------------------------------------------------------------ 6. A choice */

const WAYS = [
  { id: "nav", icon: Linkedin, name: "Sales Navigator", line: "Owners by name, with their role and firm size.", reply: "Good choice. I'll look for owners of £1M+ manufacturers in Leeds.", pick: true },
  { id: "maps", icon: MapPin, name: "Google Maps", line: "Firms near Leeds, with a phone number and reviews.", reply: "Okay. I'll find manufacturers on the map around Leeds, then look up who owns them." },
  { id: "search", icon: Search, name: "Google Search", line: "Any firm that matches the words you choose.", reply: "Okay. I'll search for Leeds manufacturers, then look up who owns them." },
] as const;

function ChoiceQuestion({ dark }: { dark: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const way = WAYS.find((w) => w.id === chosen);
  return (
    <>
      <Ava dark={dark}>How do you want to find people?</Ava>
      <Handed>
        <div className="grid gap-3 @lg:grid-cols-3" role="group" aria-label="How to find people">
          {WAYS.map((w, i) => {
            const Icon = w.icon;
            const on = chosen === w.id;
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={on}
                disabled={chosen !== null && !on}
                onClick={() => setChosen(w.id)}
                className={`${glass(dark)} adm-choice ad-arrive ${chosen && !on ? "is-other" : ""}`}
                style={at(i, 0.3, 0.1)}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-[12px]" style={{ background: "var(--soft-2)" }}>
                    <Icon className="adm-accent h-[18px] w-[18px]" aria-hidden />
                  </span>
                  {on ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: "var(--sky)" }}>
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                    </span>
                  ) : "pick" in w ? (
                    <span className="ad-chip">My pick</span>
                  ) : null}
                </span>
                <span className="adm-t1 mt-3 text-[16px] font-bold">{w.name}</span>
                <span className="adm-t2 text-[14px] leading-snug">{w.line}</span>
              </button>
            );
          })}
        </div>
      </Handed>
      {way ? (
        <>
          <You delay={0.05}>{way.name}</You>
          <Ava dark={dark} delay={0.35} state="speaking">
            {way.reply}{" "}
            <button type="button" className="adm-link inline h-auto p-0 text-[15px]" onClick={() => setChosen(null)}>
              Change my answer
            </button>
          </Ava>
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ 7. Success */

function CampaignOn({ dark }: { dark: boolean }) {
  const facts = [
    { n: String(CAMPAIGN.people), label: "people" },
    { n: String(CAMPAIGN.perDay), label: "a day" },
    { n: "9am", label: "first invites" },
  ];
  return (
    <>
      <You>Yes, turn it on</You>
      <div className="flex flex-col items-center pb-2 pt-8 text-center">
        <div className="adm-ring-wrap h-[72px] w-[72px]">
          <span className="adm-ring" style={{ animationDelay: "0.35s" }} />
          <span className="adm-ring" style={{ animationDelay: "0.9s" }} />
          <AvaMark id={dark ? "orbit" : "pearl"} size={72} dark={dark} state="speaking" />
        </div>
        <h4 className="adm-t1 ad-arrive mt-9 text-[28px] font-bold tracking-[-0.02em]" style={at(0, 0.55)}>
          The campaign is on.
        </h4>
        <p className="adm-t2 ad-arrive mt-2 max-w-[42ch] text-[16px] leading-relaxed" style={at(1, 0.55)}>
          The first 15 invites go out tomorrow at 9am. I&apos;ll tell you when people accept.
        </p>
        <dl className="ad-arrive mt-6 flex" style={at(2, 0.55)}>
          {facts.map((f, i) => (
            <div key={f.label} className={`flex flex-col-reverse px-5 ${i ? "adm-rule border-l" : ""}`}>
              <dt className="adm-t3 text-[13px]">{f.label}</dt>
              <dd className="ad-num adm-t1 text-[19px] font-bold">{f.n}</dd>
            </div>
          ))}
        </dl>
        <div className="ad-arrive mt-7 flex flex-wrap justify-center gap-2" style={at(3, 0.55)}>
          <button type="button" className="adm-ghost">
            <Pause className="h-3.5 w-3.5" aria-hidden /> Pause it
          </button>
          <button type="button" className="adm-btn">
            See the campaign <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ 8. Nudge toast */

function Nudge({ dark }: { dark: boolean }) {
  const [answer, setAnswer] = useState<null | "read" | "later">(null);
  return (
    <>
      <div className="h-[150px]" aria-hidden />
      <div className="opacity-60">
        <You>Thanks. That&apos;s all for now.</You>
      </div>
      <div className="opacity-60">
        <Ava dark={dark}>Done. The first invites go out at 9am tomorrow.</Ava>
      </div>
      {answer ? (
        <Ava dark={dark} delay={0.35} state="speaking">
          {answer === "read" ? "Here is Sarah's message and my answer. Nothing goes until you approve it." : "Okay. I'll bring it back at 4pm."}
        </Ava>
      ) : null}
      <div
        role="status"
        className={`${glass(dark)} adm-toast absolute right-4 top-[60px] w-[min(380px,calc(100%-32px))] rounded-[20px] p-4 sm:right-6 ${answer ? "is-out" : ""}`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">
            <AvaMark id={dark ? "orbit" : "pearl"} size={28} dark={dark} state="speaking" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="adm-t1 text-[15px] font-bold leading-snug">Sarah replied. I drafted an answer.</p>
              <span className="adm-t3 shrink-0 text-[12px]">Now</span>
            </div>
            <p className="adm-t2 mt-0.5 text-[14px]">She asked what it costs.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="adm-btn small" onClick={() => setAnswer("read")}>
                Read
              </button>
              <button type="button" className="adm-ghost small" onClick={() => setAnswer("later")}>
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ The tab */

function Moment({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-8 border-t border-[var(--rule)] pt-12">
      <div className="max-w-[70ch]">
        <h3 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)]">{title}</h3>
        <p className="mt-1.5 text-[16px] leading-relaxed text-[var(--slate)]">{intro}</p>
      </div>
      {children}
    </section>
  );
}

export function Moments() {
  const [room, setRoom] = useState<RoomChoice>("both");
  const R = (label: string, View: (p: { dark: boolean }) => ReactNode, minH?: number) => (
    <Rooms choice={room} label={label} minH={minH}>
      {(dark) => <View dark={dark} />}
    </Rooms>
  );
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionIntro title="What she shares">
          When Ava finds someone, builds a campaign or needs your yes, she hands it to you in the chat. Each moment is shown in her sunrise room and the navy room.
          Press Play again to watch one arrive.
        </SectionIntro>
        <Seg
          label="Which room"
          value={room}
          options={[
            { id: "both", label: "Both rooms" },
            { id: "light", label: "Sunrise" },
            { id: "dark", label: "Navy" },
          ]}
          onChange={setRoom}
        />
      </div>

      <Moment title="Someone she found" intro="One person, with why they fit and why now. Add them, skip them or look them up.">
        <Option letter="A" name="Contact card" why="A calm card: who they are, the fit score in the corner, the facts in one line. Easy to read at a glance.">
          {R("Contact card", ProspectContact)}
        </Option>
        <Option letter="B" name="Boarding pass" why="Every fact has its own labelled box and the numbers line up, like a boarding pass. Best if coaches compare lots of people.">
          {R("Boarding pass card", ProspectPass)}
        </Option>
        <Option letter="C" name="She just tells you" why="No card. She says it the way a colleague would, and the buttons sit under her words. Lightest, most human.">
          {R("Prospect in her words", ProspectInline)}
        </Option>
      </Moment>

      <Moment title="A list of people" intro="She tells you how many she found and how many fit, shows the best three, and keeps the rest one tap away.">
        {R("Prospect list", ProspectList)}
      </Moment>

      <Moment title="A campaign, ready for your yes" intro="Who it goes to, how many a day and the three steps. Turning it on is always the coach's call.">
        <Option letter="A" name="Summary card" why="The numbers on top, the three steps down the side, one clear button. The safe, familiar choice.">
          {R("Campaign summary card", CampaignSummary)}
        </Option>
        <Option letter="B" name="Ten days" why="The ten days as a row of boxes, so you can see the gaps between messages. You hold the button for a second to turn it on.">
          {R("Campaign ten days", CampaignDays)}
        </Option>
        <Option letter="C" name="She reads it back" why="Plain sentences saying exactly what will happen, including that she stops when someone replies. The button says the number.">
          {R("Campaign read back", CampaignReadBack)}
        </Option>
      </Moment>

      <Moment title="A message to approve" intro="She writes it, you can change it, and it only goes when you press Approve and send. Try Edit.">
        {R("Draft to approve", DraftApprove)}
      </Moment>

      <Moment
        title="While she works"
        intro="Her plan, one step at a time. Done steps get a tick, the step she is on has a band of light, later steps wait faintly. Like a departure board, a step that changes stays lit until you look at it, and nothing moves around."
      >
        {R("Working progress", WorkingProgress, 560)}
      </Moment>

      <Moment title="A question for you" intro="When she needs you to choose, she asks one thing and gives you big answers to tap. Tap one.">
        {R("Choice question", ChoiceQuestion)}
      </Moment>

      <Moment title="It's on" intro="A quiet moment of success: two soft rings of light leave her symbol, then it settles. No confetti.">
        {R("Campaign is on", CampaignOn)}
      </Moment>

      <Moment title="A nudge" intro="When something happens while you are elsewhere, a short note slides in from the side. Read it now or later.">
        {R("Nudge", Nudge, 340)}
      </Moment>
    </div>
  );
}
