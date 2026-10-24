"use client";

import { useState } from "react";
import { ArrowRight, Clock3, MessageSquareText, PenLine, Rocket, Search, SquarePen, Users } from "lucide-react";

import { AvaMark, type MarkId } from "../marks";
import { AWAY, COACH } from "../mock";
import { Option, SectionIntro, Seg } from "../Option";
import { AppRail, Composer, Screen, Starters, TwoWeight } from "../parts";
import { WIDE } from "./FaceOptions";

type MarkChoice = "own" | Exclude<MarkId, "current">;

const MARK_CHOICES: { id: MarkChoice; label: string }[] = [
  { id: "own", label: "Each its own" },
  { id: "pearl", label: "Pearl" },
  { id: "orbit", label: "Orbit" },
  { id: "halo", label: "Halo" },
  { id: "haloCore", label: "Halo + centre" },
  { id: "dawn", label: "Sunrise" },
];

type Time = "morning" | "afternoon" | "evening" | "night";

export function TopActions({ dark }: { dark?: boolean }) {
  return (
    <div className={`absolute right-8 top-6 z-[3] flex items-center gap-1 ${dark ? "dark" : ""}`}>
      <span className="ad-icon-btn" title="Past chats">
        <Clock3 className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="ad-icon-btn" title="New chat">
        <SquarePen className="h-[18px] w-[18px]" aria-hidden />
      </span>
    </div>
  );
}

/* A · Sunrise: the pale sky with light rising from the bottom edge. */
export function SunriseStart({ mark }: { mark: MarkId }) {
  return (
    <div className="absolute inset-0 flex">
      <div className="ad-sky-sunrise" />
      <AppRail tone="glass" mark={mark} />
      <main className="relative z-[1] flex flex-1 flex-col items-center pt-[132px]">
        <TopActions />
        <div className="ad-glass grid h-[148px] w-[148px] place-items-center rounded-[38px]">
          <AvaMark id={mark} size={96} />
        </div>
        <div className="mt-9">
          <TwoWeight light={`Good morning, ${COACH.first}.`} bold="How can I help today?" size={46} />
        </div>
        <div className="mt-10">
          <Composer variant="glass" width={760} />
        </div>
        <div className="mt-6 max-w-[820px]">
          <Starters kind="pill" />
        </div>
        <p className="absolute bottom-7 text-[13px] font-medium text-[#3d5a7a]/80">Ava never sends anything without your yes.</p>
      </main>
    </div>
  );
}

/* B · Beam: the black reference, in brand navy. */
export function BeamStart({ mark }: { mark: MarkId }) {
  return (
    <div className="dark absolute inset-0 flex">
      <div className="ad-sky-beam">
        <span className="ad-streaks" />
        <span className="ad-dust" />
        <span className="ad-beam" />
        <span className="ad-beam core" />
      </div>
      <AppRail tone="glass" mark={mark} dark />
      <main className="relative z-[1] flex flex-1 flex-col items-center pt-[176px]">
        <TopActions dark />
        <AvaMark id={mark} size={150} dark state="idle" />
        <h2 className="mt-10 text-[52px] font-semibold tracking-[-0.03em] text-white">How can I help, {COACH.first}?</h2>
        <div className="mt-10">
          <Composer variant="dark" width={860} context="Get clients" placeholder="What do you want to get done?" />
        </div>
        <div className="mt-8">
          <Starters
            kind="tile"
            dark
            items={[
              { icon: Rocket, label: "Launch a campaign" },
              { icon: Search, label: "Find prospects" },
              { icon: MessageSquareText, label: "Reply to messages" },
              { icon: PenLine, label: "Write a LinkedIn post" },
            ]}
          />
        </div>
      </main>
    </div>
  );
}

/* C · Ava in the room: her face fades into the pale mist beside you. */
export function RoomStart({ mark }: { mark: MarkId }) {
  return (
    <div className="absolute inset-0 flex">
      <div className="ad-sky-mist" />
      <div
        className="ad-breathe absolute inset-y-0 right-0 w-[78%] bg-cover"
        style={{
          backgroundImage: `url(${WIDE.mist})`,
          backgroundPosition: "70% 30%",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 38%)",
          maskImage: "linear-gradient(90deg, transparent 0%, #000 38%)",
        }}
      />
      <AppRail tone="brand" mark={mark} />
      <main className="relative z-[1] flex flex-1 flex-col justify-center pl-[112px] pr-10">
        <div className="flex items-center gap-3">
          <AvaMark id={mark} size={34} />
          <span className="text-[15px] font-semibold text-[var(--ink)]">Ava</span>
          <span className="text-[14px] text-[var(--slate)]">ready when you are</span>
        </div>
        <div className="mt-6 max-w-[620px]">
          <TwoWeight light={`Hi ${COACH.first}, I'm Ava.`} bold="What shall we get done?" size={58} align="left" />
        </div>
        <div className="mt-10">
          <Composer variant="cream" width={600} placeholder="Tell me, or hold the mic and say it" />
        </div>
        <div className="mt-6 flex max-w-[640px] flex-wrap gap-2.5">
          <Starters kind="pill" items={[
            { icon: Search, label: "Find prospects" },
            { icon: Rocket, label: "Launch a campaign" },
            { icon: Users, label: "Prep for a call" },
          ]} />
        </div>
      </main>
    </div>
  );
}

/* E · Ava in the room, navy: her face in the navy mist with the Beam's glass box and buttons. */
export function RoomNavyStart({ mark }: { mark: MarkId }) {
  return (
    <div className="dark absolute inset-0 flex">
      <div className="absolute inset-0" style={{ background: "radial-gradient(80% 90% at 75% 40%, #1d3a5c 0%, #10263f 45%, #081a2e 100%)" }}>
        <span className="ad-dust" />
      </div>
      <div
        className="ad-breathe absolute inset-y-0 right-0 w-[86%] bg-cover"
        style={{
          backgroundImage: `url(${WIDE.navyV2})`,
          backgroundPosition: "62% 30%",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 42%), linear-gradient(0deg, transparent 0%, #000 22%)",
          WebkitMaskComposite: "source-in",
          maskImage: "linear-gradient(90deg, transparent 0%, #000 42%), linear-gradient(0deg, transparent 0%, #000 22%)",
          maskComposite: "intersect",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: "radial-gradient(70% 100% at 40% 120%, rgba(26,143,212,.35), rgba(26,143,212,0) 70%)" }} />
      <AppRail tone="glass" mark={mark} dark />
      <main className="relative z-[1] flex flex-1 flex-col justify-center pl-[112px] pr-10">
        <div className="flex items-center gap-3">
          <AvaMark id={mark} size={34} dark />
          <span className="text-[15px] font-semibold text-white">Ava</span>
          <span className="text-[14px] text-[rgba(207,230,248,.75)]">ready when you are</span>
        </div>
        <div className="mt-6 max-w-[620px]">
          <TwoWeight light={`Hi ${COACH.first}, I'm Ava.`} bold="What shall we get done?" size={58} align="left" dark />
        </div>
        <div className="mt-10">
          <Composer variant="dark" width={620} context="Get clients" placeholder="Tell me, or hold the mic and say it" />
        </div>
        <div className="mt-6 flex max-w-[680px]">
          <Starters
            kind="tile"
            dark
            items={[
              { icon: Rocket, label: "Launch a campaign" },
              { icon: Search, label: "Find prospects" },
              { icon: MessageSquareText, label: "Reply to messages" },
            ]}
          />
        </div>
      </main>
    </div>
  );
}

const GREETING: Record<Time, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Working late",
};

/* D · Daylight: the sky follows the coach's day, and she leads with what's ready. */
export function DaylightStart({ mark, time }: { mark: MarkId; time: Time }) {
  const dark = time === "evening" || time === "night";
  return (
    <div className={`absolute inset-0 flex ${dark ? "dark" : ""}`}>
      <div className="ad-sky-day" data-time={time}>{time === "night" ? <span className="ad-dust" /> : null}</div>
      <AppRail tone="glass" mark={mark} dark={dark} />
      <main className="relative z-[1] flex flex-1 flex-col items-center pt-[96px]">
        <TopActions dark={dark} />
        <AvaMark id={mark} size={92} dark={dark} state="speaking" />
        <div className="mt-7">
          <TwoWeight light={`${GREETING[time]}, ${COACH.first}.`} bold="Three things are ready for you." size={44} dark={dark} />
        </div>
        <div className="mt-9 grid w-[1000px] grid-cols-3 gap-4">
          {AWAY.map((a, i) => (
            <div
              key={a.title}
              className={`${dark ? "ad-glass-dark" : "ad-glass"} ad-arrive flex flex-col rounded-[22px] p-5 ${a.fresh ? "ad-unseen" : ""}`}
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}
            >
              <span className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: dark ? "#7cc3f2" : "#0c5290" }}>
                {a.fresh ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--sky)]" /> : null}
                {a.fresh ? "New" : "Coming up"}
              </span>
              <span className="mt-2 text-[17px] font-bold" style={{ color: dark ? "#fff" : "#0b1b2e" }}>
                {a.title}
              </span>
              <span className="mt-1 flex-1 text-[14px] leading-snug" style={{ color: dark ? "rgba(207,230,248,.8)" : "#5a6b80" }}>
                {a.line}
              </span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: dark ? "#fff" : "#0b1b2e" }}>
                {a.action} <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Composer variant={dark ? "dark" : "glass"} width={1000} tall={false} placeholder="Or ask for something else" />
        </div>
      </main>
    </div>
  );
}

export function StartScreens() {
  const [choice, setChoice] = useState<MarkChoice>("own");
  const [time, setTime] = useState<Time>("morning");
  const m = (own: MarkId): MarkId => (choice === "own" ? own : choice);
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionIntro title="Start screen, before a chat">
          What a coach sees when they open Ava full screen. Each one has her symbol, a greeting, the glass chat box and the jobs she can start.
          Try any symbol on any screen.
        </SectionIntro>
        <Seg label="Symbol on these screens" value={choice} options={MARK_CHOICES} onChange={setChoice} />
      </div>

      <Option letter="A" name="Sunrise" why="The pale sky with light rising from the bottom, like your first reference but in our white-blue. Calm, light and Apple-like.">
        <Screen label="Sunrise start screen">
          <SunriseStart mark={m("pearl")} />
        </Screen>
      </Option>

      <Option letter="B" name="Beam" why="Your black reference in brand navy: a shaft of light over her symbol, fine light streaks behind the glass box, and big square buttons underneath.">
        <Screen label="Beam start screen">
          <BeamStart mark={m("orbit")} />
        </Screen>
      </Option>

      <Option letter="C" name="Ava in the room" why="She is there with you: her face fades into the mist on the right, the words and the chat box sit on the left. The Doer feel in our colours.">
        <Screen label="Ava in the room start screen">
          <RoomStart mark={m("halo")} />
        </Screen>
      </Option>

      <Option
        letter="E"
        name="Ava in the room, navy"
        why="New, 24 Oct: option C with the face you liked, in the navy room, with the Beam's glass box and buttons. Shown with the Halo with a centre."
      >
        <Screen label="Ava in the room, navy start screen">
          <RoomNavyStart mark={m("haloCore")} />
        </Screen>
      </Option>

      <Option
        letter="D"
        name="Daylight"
        why="The sky follows the coach's day: dawn in the morning, clear blue after lunch, dusk and night later. She opens with what she has ready, not an empty box. New things stay lit until seen."
        aside={
          <Seg
            label="Time of day"
            value={time}
            options={[
              { id: "morning", label: "Morning" },
              { id: "afternoon", label: "Afternoon" },
              { id: "evening", label: "Evening" },
              { id: "night", label: "Night" },
            ]}
            onChange={setTime}
          />
        }
      >
        <Screen label="Daylight start screen">
          <DaylightStart mark={m("dawn")} time={time} />
        </Screen>
      </Option>
    </div>
  );
}
