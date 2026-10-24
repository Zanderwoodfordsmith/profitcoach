"use client";

import { useState } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  Clock3,
  Linkedin,
  ListChecks,
  Megaphone,
  PenLine,
  Plus,
  Settings2,
  SquarePen,
  Users,
  Wand2,
} from "lucide-react";

import { AvaMark, type MarkId } from "../marks";
import { ASK, CAMPAIGN, CONNECT_NOTE, HISTORY, PLAN_STEPS, PROSPECTS, type Prospect } from "../mock";
import { Option, SectionIntro, Seg } from "../Option";
import { AppRail, Composer, Screen, Typing } from "../parts";
import { FACES } from "./FaceOptions";

type MarkChoice = "own" | Exclude<MarkId, "current">;

/* ---------------------------------------------------------- Shared bits */

/** Ava's plan, with the step she is on lit by a passing band of light. */
function Plan({ at, dark }: { at: number; dark?: boolean }) {
  return (
    <ol className="mt-3 flex flex-col gap-2.5">
      {PLAN_STEPS.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={s.label} className="flex items-start gap-3">
            <span
              className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full"
              style={{
                background: done ? (dark ? "#7cc3f2" : "#0c5290") : "transparent",
                boxShadow: done ? undefined : `inset 0 0 0 1.5px ${now ? (dark ? "#7cc3f2" : "#1a8fd4") : dark ? "rgba(207,230,248,.3)" : "rgba(12,82,144,.25)"}`,
              }}
            >
              {done ? <Check className="h-3 w-3" strokeWidth={3} style={{ color: dark ? "#051e36" : "#fff" }} aria-hidden /> : null}
              {now ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--sky)]" /> : null}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-[14.5px] font-semibold ${now ? "ad-shimmer" : ""}`}
                style={{ color: done || now ? (dark ? "#fff" : "#0b1b2e") : dark ? "rgba(207,230,248,.45)" : "#8494a7" }}
              >
                {s.label}
              </span>
              {done ? (
                <span className="block text-[13px]" style={{ color: dark ? "rgba(207,230,248,.7)" : "#5a6b80" }}>
                  {s.detail}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Fit({ n, dark }: { n: number; dark?: boolean }) {
  return (
    <span className="ad-num inline-flex items-baseline gap-0.5 text-[13px] font-bold" style={{ color: dark ? "#7cc3f2" : "#0c5290" }}>
      {n}
      <span className="text-[11px] font-semibold opacity-70">% fit</span>
    </span>
  );
}

function MiniProspect({ p, dark }: { p: Prospect; dark?: boolean }) {
  return (
    <div className={`${dark ? "ad-glass-dark" : "ad-glass"} flex flex-col gap-2 rounded-[18px] p-4`}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: dark ? "rgba(124,195,242,.18)" : "#e3eef8", color: dark ? "#cfe6f8" : "#0c5290" }}>
          {p.initials}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[14px] font-bold" style={{ color: dark ? "#fff" : "#0b1b2e" }}>
            {p.name}
          </span>
          <span className="block truncate text-[12px]" style={{ color: dark ? "rgba(207,230,248,.7)" : "#5a6b80" }}>
            {p.firm}
          </span>
        </span>
      </div>
      <p className="text-[12.5px] leading-snug" style={{ color: dark ? "rgba(207,230,248,.8)" : "#24364a" }}>
        {p.why}
      </p>
      <div className="mt-auto flex items-center justify-between">
        <span className="ad-num text-[12px]" style={{ color: dark ? "rgba(207,230,248,.6)" : "#8494a7" }}>
          {p.revenue} · {p.staff}
        </span>
        <Fit n={p.fit} dark={dark} />
      </div>
    </div>
  );
}

function AvaSays({ mark, dark, children }: { mark: MarkId; dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 shrink-0">
        <AvaMark id={mark} size={26} dark={dark} />
      </span>
      <div className="ad-ava-text min-w-0 flex-1">{children}</div>
    </div>
  );
}

function YouSay({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="ad-user-bubble">{children}</div>
    </div>
  );
}

function NoteDraft({ dark }: { dark?: boolean }) {
  return (
    <div className={`${dark ? "ad-glass-dark" : "ad-glass"} mt-3 rounded-[18px] p-4`}>
      <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: dark ? "#7cc3f2" : "#0c5290" }}>
        <Linkedin className="h-3.5 w-3.5" aria-hidden /> Connection note · <span className="ad-num">{CONNECT_NOTE.length}</span> of 300 characters
      </div>
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: dark ? "#fff" : "#0b1b2e" }}>
        {CONNECT_NOTE}
      </p>
      <div className="mt-3 flex gap-2">
        <span className="ad-pill !py-2 text-[13px]">
          <PenLine className="h-3.5 w-3.5" aria-hidden /> Change it
        </span>
        <span className="ad-pill !py-2 text-[13px]" style={{ background: dark ? "#fff" : "#051e36", color: dark ? "#051e36" : "#fff", borderColor: "transparent" }}>
          <Check className="h-3.5 w-3.5" style={{ color: "inherit" }} aria-hidden /> Use this
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- A · Column */

export function ColumnChat({ mark }: { mark: MarkId }) {
  return (
    <div className="absolute inset-0 flex">
      <div className="ad-sky-sunrise is-chat" />
      <AppRail tone="glass" mark={mark} />
      <main className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 px-8 pt-6">
          <AvaMark id={mark} size={30} state="thinking" />
          <span className="text-[16px] font-bold text-[var(--ink)]">Leeds manufacturers campaign</span>
          <span className="ad-chip">Get clients</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="ad-icon-btn" title="Past chats">
              <Clock3 className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="ad-icon-btn" title="New chat">
              <SquarePen className="h-[18px] w-[18px]" aria-hidden />
            </span>
          </span>
        </header>
        <div
          className="ad-scroll flex-1 overflow-hidden"
          style={{ WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 64px, #000 calc(100% - 40px), transparent)", maskImage: "linear-gradient(180deg, transparent 0, #000 64px, #000 calc(100% - 40px), transparent)" }}
        >
          <div className="mx-auto flex h-full w-[780px] flex-col justify-end gap-7 pb-8 pt-12">
            <YouSay>{ASK}</YouSay>
            <AvaSays mark={mark}>
              On it. Here is my plan. I will stop before anything is sent.
              <Plan at={3} />
            </AvaSays>
            <AvaSays mark={mark}>
              I found <b className="ad-num">48</b> owners and <b className="ad-num">41</b> fit your ideal client. These three look strongest.
              <div className="mt-3 grid grid-cols-3 gap-3">
                {PROSPECTS.map((p) => (
                  <MiniProspect key={p.name} p={p} />
                ))}
              </div>
            </AvaSays>
            <AvaSays mark={mark}>
              Here is the connection note, written from your Blueprint.
              <NoteDraft />
            </AvaSays>
            <AvaSays mark={mark}>
              <Typing />
            </AvaSays>
          </div>
        </div>
        <div className="flex justify-center pb-8">
          <Composer variant="glass" width={780} tall={false} placeholder="Reply to Ava" />
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------- B · Beside you */

export function BesideChat({ mark }: { mark: MarkId }) {
  const face = FACES.mist;
  return (
    <div className="absolute inset-0 flex" style={{ background: "linear-gradient(160deg, #f1f5f9 0%, #dde8f3 48%, #c3d4e7 100%)" }}>
      <AppRail tone="brand" mark={mark} />
      {/* Past chats */}
      <aside className="flex w-[268px] shrink-0 flex-col px-5 pb-6 pt-7">
        <span className="inline-flex items-center justify-center gap-2 rounded-full bg-[#fbfaf6] px-4 py-2.5 text-[14px] font-semibold text-[var(--ink)] shadow-[0_10px_24px_-16px_rgba(5,30,54,.5)]">
          <Plus className="h-4 w-4" aria-hidden /> New chat
        </span>
        <div className="mt-6 flex flex-col gap-5">
          {HISTORY.slice(0, 2).map((g) => (
            <div key={g.when}>
              <p className="px-2 text-[12px] font-semibold text-[var(--faint)]">{g.when}</p>
              <ul className="mt-1.5 flex flex-col">
                {g.items.map((it, i) => (
                  <li
                    key={it}
                    className="truncate rounded-xl px-2 py-2 text-[14px]"
                    style={g.when === "Today" && i === 0 ? { background: "rgba(255,255,255,.7)", color: "#0b1b2e", fontWeight: 600 } : { color: "#3d5068" }}
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-auto flex gap-2">
          {[
            { icon: Users, n: 41, t: "prospects" },
            { icon: Megaphone, n: 2, t: "campaigns" },
            { icon: PenLine, n: 1, t: "draft" },
          ].map(({ icon: Icon, n, t }) => (
            <span key={t} className="ad-num inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-[12.5px] font-semibold text-[var(--body)]" title={t}>
              <Icon className="h-3.5 w-3.5 text-[var(--blue)]" aria-hidden />
              {n}
            </span>
          ))}
        </div>
      </aside>
      {/* The conversation */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-1.5 px-6 pt-7 text-[15px] font-semibold text-[var(--ink)]">
          Chat <ChevronDown className="h-4 w-4 text-[var(--slate)]" aria-hidden />
        </header>
        <div className="flex flex-1 flex-col gap-5 overflow-hidden px-10 pt-8">
          <div className="flex justify-end">
            <div className="max-w-[70%] rounded-[22px] bg-[#fbfaf6] px-5 py-3 text-[15px] text-[var(--ink)] shadow-[0_10px_24px_-18px_rgba(5,30,54,.5)]">{ASK}</div>
          </div>
          <div className="flex max-w-[78%] gap-3">
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={face.src} alt="" className="h-full w-full scale-150 object-cover object-[50%_28%]" />
            </span>
            <div className="rounded-[22px] bg-[#0a2c4d] px-5 py-4 text-[15px] leading-relaxed text-white shadow-[0_18px_36px_-22px_rgba(5,30,54,.8)]">
              Done. I found 41 owners who fit, wrote the note in your words, and built the campaign.
              <span className="mt-3 block text-[rgba(207,230,248,.8)]">Here is what it will do:</span>
              <ul className="mt-2 flex flex-col gap-1.5">
                {CAMPAIGN.steps.map((s) => (
                  <li key={s.day} className="flex gap-3 text-[14px]">
                    <span className="ad-num w-14 shrink-0 font-semibold text-[#7cc3f2]">{s.day}</span>
                    <span>{s.what}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-3 block">It sends {CAMPAIGN.perDay} a day. Shall I turn it on?</span>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[70%] rounded-[22px] bg-[#fbfaf6] px-5 py-3 text-[15px] text-[var(--ink)] shadow-[0_10px_24px_-18px_rgba(5,30,54,.5)]">
              Yes, but start Monday.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={face.src} alt="" className="h-full w-full scale-150 object-cover object-[50%_28%]" />
            </span>
            <div className="rounded-[22px] bg-[#0a2c4d] px-5 py-3.5">
              <Typing />
            </div>
          </div>
        </div>
        <div className="flex justify-center px-10 pb-8">
          <Composer variant="cream" width="100%" tall={false} placeholder="Type a message…" />
        </div>
      </main>
      {/* Ava herself, fading into the room */}
      <aside className="relative w-[400px] shrink-0">
        <div
          className="ad-breathe absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url(${face.src})`,
            backgroundPosition: "50% 12%",
            WebkitMaskImage: "radial-gradient(64% 58% at 58% 32%, #000 40%, transparent 100%)",
            maskImage: "radial-gradient(64% 58% at 58% 32%, #000 40%, transparent 100%)",
            opacity: 0.96,
          }}
        />
        <div className="absolute inset-x-0 bottom-10 text-center">
          <p className="text-[22px] font-bold text-[var(--ink)]">Ava</p>
          <p className="text-[13.5px] text-[var(--slate)]">Your assistant</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/60 px-3.5 py-1.5 text-[13px] font-semibold text-[var(--body)] backdrop-blur">
            <AvaMark id={mark} size={18} state="thinking" /> Waiting for your yes
          </span>
        </div>
        <div className="ad-glass absolute right-5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full p-1.5">
          {[Wand2, Brain, Settings2].map((Icon, i) => (
            <span key={i} className="ad-icon-btn">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------- C · Workspace */

export function WorkspaceChat({ mark }: { mark: MarkId }) {
  const rows = [
    ...PROSPECTS,
    { name: "Tom Hardcastle", role: "MD", firm: "Hardcastle Engineering", town: "Bradford", staff: "28 staff", revenue: "£3.1M", fit: 79, why: "", initials: "TH" },
    { name: "Priya Shah", role: "Owner", firm: "Shah Plastics", town: "Leeds", staff: "17 staff", revenue: "£1.9M", fit: 77, why: "", initials: "PS" },
    { name: "Mark Ellis", role: "Director", firm: "Ellis Steel Stockholders", town: "Leeds", staff: "40 staff", revenue: "£6.0M", fit: 74, why: "", initials: "ME" },
  ];
  return (
    <div className="absolute inset-0 flex">
      <AppRail tone="brand" mark={mark} />
      {/* Chat on the navy side */}
      <section className="dark relative flex w-[470px] shrink-0 flex-col overflow-hidden">
        <div className="ad-sky-beam">
          <span className="ad-dust" />
        </div>
        <header className="relative z-[1] flex items-center gap-3 px-6 pt-6">
          <AvaMark id={mark} size={28} dark state="thinking" />
          <span className="text-[15px] font-bold text-white">Ava</span>
          <span className="text-[13px] text-[rgba(207,230,248,.7)]">building with you</span>
        </header>
        <div className="relative z-[1] flex flex-1 flex-col gap-6 overflow-hidden px-6 pt-8">
          <YouSay>{ASK}</YouSay>
          <AvaSays mark={mark} dark>
            Building it on the right as I go. You can change anything there.
            <Plan at={3} dark />
          </AvaSays>
          <AvaSays mark={mark} dark>
            41 people are in. Want me to leave out anyone under £2M?
          </AvaSays>
        </div>
        <div className="relative z-[1] px-5 pb-6">
          <Composer variant="dark" width="100%" tall={false} placeholder="Reply to Ava" />
        </div>
      </section>
      {/* The thing she is building */}
      <section className="relative flex min-w-0 flex-1 flex-col" style={{ background: "linear-gradient(180deg,#f7fafd,#eaf2fa)" }}>
        <header className="flex items-center gap-4 border-b border-[var(--rule)] px-9 pb-5 pt-7">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--slate)]">{CAMPAIGN.type}</p>
            <h3 className="text-[26px] font-bold tracking-[-0.02em] text-[var(--ink)]">{CAMPAIGN.name}</h3>
          </div>
          <span className="ml-3 inline-flex items-center gap-2 rounded-full bg-[#fff7e8] px-3 py-1 text-[13px] font-semibold text-[#8a5a12]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d99a2b]" /> Waiting for your yes
          </span>
          <span className="ml-auto flex gap-2">
            <span className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-[var(--body)] hover:bg-white">Not yet</span>
            <span className="ad-send !h-auto !w-auto rounded-full px-5 py-2.5 text-[14px] font-semibold">Turn it on</span>
          </span>
        </header>
        <div className="grid flex-1 grid-cols-[1.35fr_1fr] gap-6 overflow-hidden p-9">
          <div className="ad-glass flex flex-col overflow-hidden rounded-[22px]">
            <div className="flex items-center gap-2 px-5 pb-3 pt-4">
              <Users className="h-4 w-4 text-[var(--blue)]" aria-hidden />
              <span className="text-[15px] font-bold text-[var(--ink)]">Who</span>
              <span className="ad-num text-[14px] text-[var(--slate)]">41 people</span>
              <span className="ml-auto text-[13px] font-semibold text-[var(--blue)]">See all</span>
            </div>
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="text-[12px] text-[var(--faint)]">
                  <th className="px-5 py-2 font-semibold">Name</th>
                  <th className="py-2 font-semibold">Firm</th>
                  <th className="py-2 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-2 text-right font-semibold">Fit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.name} className={`border-t border-[var(--rule)] ${i >= 4 ? "ad-arrive" : ""}`} style={{ animationDelay: `${(i - 4) * 0.35}s`, background: i === 5 ? "rgba(26,143,212,.07)" : undefined }}>
                    <td className="px-5 py-3 font-semibold text-[var(--ink)]">{p.name}</td>
                    <td className="py-3 text-[var(--body)]">{p.firm}</td>
                    <td className="ad-num py-3 text-right text-[var(--body)]">{p.revenue}</td>
                    <td className="px-5 py-3 text-right">
                      <Fit n={p.fit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-auto flex items-center gap-2 px-5 pb-4 pt-3 text-[13px] text-[var(--slate)]">
              <AvaMark id={mark} size={16} state="thinking" /> <span className="ad-shimmer font-semibold">Checking 7 more…</span>
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <div className="ad-glass rounded-[22px] p-5">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[var(--blue)]" aria-hidden />
                <span className="text-[15px] font-bold text-[var(--ink)]">What it sends</span>
              </div>
              <ol className="mt-4 flex flex-col gap-4">
                {CAMPAIGN.steps.map((s, i) => (
                  <li key={s.day} className="flex gap-3">
                    <span className="ad-num w-[52px] shrink-0 pt-0.5 text-[13px] font-bold text-[var(--blue)]">{s.day}</span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-semibold text-[var(--ink)]">{s.what}</span>
                      {i === 0 ? <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-[var(--slate)]">{CONNECT_NOTE}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="ad-glass rounded-[22px] p-5">
              <span className="text-[15px] font-bold text-[var(--ink)]">How fast</span>
              <div className="mt-3 flex items-end gap-3">
                <span className="ad-num text-[40px] font-bold leading-none tracking-[-0.03em] text-[var(--ink)]">{CAMPAIGN.perDay}</span>
                <span className="pb-1 text-[14px] text-[var(--slate)]">invites a day, weekdays only. All 41 in about 3 weeks.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ChatScreens() {
  const [choice, setChoice] = useState<MarkChoice>("own");
  const m = (own: MarkId): MarkId => (choice === "own" ? own : choice);
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionIntro title="Once a chat has started">
          The same job in each: you ask Ava to launch a campaign to manufacturing owners in Leeds, and she works through it with you.
        </SectionIntro>
        <Seg
          label="Symbol on these screens"
          value={choice}
          options={[
            { id: "own", label: "Each its own" },
            { id: "pearl", label: "Pearl" },
            { id: "orbit", label: "Orbit" },
            { id: "halo", label: "Halo" },
            { id: "haloCore", label: "Halo + centre" },
            { id: "dawn", label: "Sunrise" },
          ]}
          onChange={setChoice}
        />
      </div>
      <Option letter="A" name="One calm column" why="Goes with the Sunrise start screen. The light sinks lower once you start talking. Her words sit on the sky with no bubble; what she makes arrives as glass cards.">
        <Screen label="One calm column chat">
          <ColumnChat mark={m("pearl")} />
        </Screen>
      </Option>
      <Option letter="B" name="Ava beside you" why="The Doer layout in our blues: past chats on the left, the conversation in the middle, and Ava herself on the right, fading into the mist with what she is waiting on.">
        <Screen label="Ava beside you chat">
          <BesideChat mark={m("halo")} />
        </Screen>
      </Option>
      <Option letter="C" name="Build it together" why="Chat on the navy side, and the real thing she is making on the right, filling in as she works. You can see and change the campaign before you say yes.">
        <Screen label="Build it together chat">
          <WorkspaceChat mark={m("orbit")} />
        </Screen>
      </Option>
    </div>
  );
}
