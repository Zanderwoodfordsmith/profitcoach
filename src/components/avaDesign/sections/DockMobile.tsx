"use client";

import { type ReactNode } from "react";
import {
  ArrowUp,
  AudioLines,
  BatteryFull,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Compass,
  Ellipsis,
  Home,
  Keyboard,
  LayoutGrid,
  Library,
  Maximize2,
  Menu,
  Mic,
  MicOff,
  PenLine,
  PhoneOff,
  Plus,
  Rocket,
  Settings,
  Signal,
  SquarePen,
  Target,
  Users,
  Volume2,
  Wifi,
  X,
} from "lucide-react";

import { AvaMark, type MarkId } from "../marks";
import { ASK, CAMPAIGN, COACH, CONNECT_NOTE, PROSPECTS } from "../mock";
import { AppRail, Composer, LogoIcon, TwoWeight } from "../parts";
import { FACES } from "./FaceOptions";
import "./dockMobile.css";

/* ------------------------------------------------------------ The page behind her */

type Campaign = {
  name: string;
  status: string;
  tone: "ready" | "live" | "paused" | "busy";
  invited: number;
  accepted: number;
  replies: number;
  calls: number;
};

const CAMPAIGNS: Campaign[] = [
  {
    name: CAMPAIGN.name,
    status: "Waiting for your yes",
    tone: "ready",
    invited: 0,
    accepted: 0,
    replies: 0,
    calls: 0,
  },
  {
    name: "Sheffield engineering firms",
    status: "Running",
    tone: "live",
    invited: 120,
    accepted: 46,
    replies: 11,
    calls: 3,
  },
  {
    name: "York family businesses",
    status: "Running",
    tone: "live",
    invited: 85,
    accepted: 29,
    replies: 6,
    calls: 1,
  },
  {
    name: "Bradford trade suppliers",
    status: "Paused",
    tone: "paused",
    invited: 60,
    accepted: 18,
    replies: 2,
    calls: 0,
  },
];

const TOTALS = [
  { label: "Invited this month", value: "265" },
  { label: "Accepted", value: "93" },
  { label: "Replies", value: "19" },
  { label: "Calls booked", value: "4" },
];

const STATUS_STYLE: Record<Campaign["tone"], { color: string; background: string }> = {
  ready: { color: "#0c5290", background: "rgba(26,143,212,0.12)" },
  busy: { color: "#0c5290", background: "rgba(26,143,212,0.12)" },
  live: { color: "#0f7a5c", background: "rgba(15,122,92,0.1)" },
  paused: { color: "#5a6b80", background: "rgba(90,107,128,0.1)" },
};

/** A believable Get clients page: title, the month's numbers and the campaign list. */
function GetClientsPage({ building }: { building?: boolean }) {
  const rows = building
    ? [
        {
          ...CAMPAIGNS[0],
          status: "Ava is building it, 62%",
          tone: "busy" as const,
        },
        ...CAMPAIGNS.slice(1),
      ]
    : CAMPAIGNS;
  return (
    <div className="absolute inset-0 overflow-hidden px-14 pt-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.02em] text-[var(--ink)]">Get clients</h1>
          <p className="mt-1 text-[16px] text-[var(--slate)]">Find owners, start campaigns, book calls.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--navy)] px-5 py-2.5 text-[14px] font-semibold text-white">
          <Plus className="h-4 w-4" aria-hidden /> New campaign
        </span>
      </div>

      <div className="mt-8 flex gap-1 border-b border-[var(--rule)] text-[15px] font-semibold">
        {["Campaigns", "Prospects", "Scripts", "Calls"].map((t, i) => (
          <span
            key={t}
            className="px-4 pb-3"
            style={i === 0 ? { color: "#0b1b2e", boxShadow: "inset 0 -2px 0 #0c5290" } : { color: "#5a6b80" }}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-4 rounded-[20px] bg-white py-6 shadow-[0_1px_2px_rgba(5,30,54,0.06),0_12px_30px_-24px_rgba(5,30,54,0.4)]">
        {TOTALS.map((t, i) => (
          <div key={t.label} className="px-7" style={i ? { borderLeft: "1px solid rgba(12,82,144,0.1)" } : undefined}>
            <div className="ad-num text-[32px] font-bold tracking-[-0.02em] text-[var(--ink)]">{t.value}</div>
            <div className="mt-1 text-[14px] text-[var(--slate)]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(5,30,54,0.06),0_12px_30px_-24px_rgba(5,30,54,0.4)]">
        <div className="grid grid-cols-[2.2fr_1.6fr_repeat(4,1fr)] px-7 py-4 text-[13px] font-semibold text-[var(--slate)]">
          <span>Campaign</span>
          <span>Status</span>
          <span className="text-right">Invited</span>
          <span className="text-right">Accepted</span>
          <span className="text-right">Replies</span>
          <span className="text-right">Calls</span>
        </div>
        {rows.map((c) => (
          <div
            key={c.name}
            className="grid grid-cols-[2.2fr_1.6fr_repeat(4,1fr)] items-center border-t border-[var(--rule)] px-7 py-[18px] text-[15px]"
          >
            <span className="font-semibold text-[var(--ink)]">{c.name}</span>
            <span>
              <span className="inline-flex rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={STATUS_STYLE[c.tone]}>
                {c.status}
              </span>
            </span>
            {[c.invited, c.accepted, c.replies, c.calls].map((n, i) => (
              <span key={i} className="ad-num text-right text-[var(--body)]">
                {n}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The app with its slim brand rail. Ava's layer sits only over the page, never the rail. */
function AppWithPage({ mark, building, children }: { mark: MarkId; building?: boolean; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex bg-[var(--ground)]">
      <AppRail tone="brand" mark={mark} />
      <div className="relative flex-1">
        <GetClientsPage building={building} />
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Shared bits */

function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--ice)] font-bold text-[var(--navy)]"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** The campaign Ava has built, as she hands it over. */
function CampaignCard() {
  return (
    <div className="ad-arrive rounded-[20px] bg-white/90 p-5 shadow-[0_1px_2px_rgba(5,30,54,0.06),0_16px_32px_-22px_rgba(12,82,144,0.5)]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mist)] text-[var(--blue)]">
          <Rocket className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[16px] font-bold text-[var(--ink)]">{CAMPAIGN.name}</div>
          <div className="ad-num text-[13px] text-[var(--slate)]">
            {CAMPAIGN.type}, {CAMPAIGN.people} owners, {CAMPAIGN.perDay} a day
          </div>
        </div>
      </div>
      <ol className="mt-4 flex flex-col gap-2.5">
        {CAMPAIGN.steps.map((s) => (
          <li key={s.day} className="flex items-center gap-3 text-[14px]">
            <span className="ad-num w-[52px] shrink-0 font-semibold text-[var(--blue)]">{s.day}</span>
            <span className="text-[var(--body)]">{s.what}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex items-center gap-2">
        <span className="rounded-full bg-[var(--navy)] px-4 py-2.5 text-[14px] font-semibold text-white">Approve and start</span>
        <span className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-[var(--blue)] hover:bg-[var(--mist)]">
          Change something
        </span>
      </div>
      <p className="mt-3 text-[12.5px] text-[var(--slate)]">Nothing sends until you approve.</p>
    </div>
  );
}

function StatusBar({ dark }: { dark?: boolean }) {
  const c = dark ? "#ffffff" : "#0b1b2e";
  return (
    <div className="relative z-[3] flex h-[50px] items-end justify-between px-8 pb-1.5" style={{ color: c }}>
      <span className="ad-num text-[16px] font-semibold">9:41</span>
      <span className="flex items-center gap-1.5">
        <Signal className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        <Wifi className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        <BatteryFull className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </span>
    </div>
  );
}

function HomeBar({ dark }: { dark?: boolean }) {
  return (
    <span
      className="absolute bottom-2 left-1/2 z-[4] h-[5px] w-[134px] -translate-x-1/2 rounded-full"
      style={{ background: dark ? "rgba(255,255,255,0.85)" : "#0b1b2e" }}
    />
  );
}

/* ------------------------------------------------------------ Group 1: beside a page */

/* A · Glass panel: floats on the right, the page dims and softens behind it. */
export function GlassPanel({ mark }: { mark: MarkId }) {
  return (
    <AppWithPage mark={mark}>
      <div className="dm-dim" />
      <aside className="ad-glass ad-edge bottom-4 right-4 top-4 flex w-[420px] flex-col rounded-[28px]" style={{ position: "absolute" }}>
        <header className="flex items-center gap-3 px-5 pb-3 pt-5">
          <AvaMark id={mark} size={34} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[16px] font-bold text-[var(--ink)]">Ava</div>
            <div className="text-[12.5px] text-[var(--slate)]">Looking at Get clients with you</div>
          </div>
          <span className="ad-icon-btn" title="Past chats">
            <Clock3 className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="ad-icon-btn" title="Full screen">
            <Maximize2 className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <span className="ad-icon-btn" title="Close">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </span>
        </header>
        <div className="ad-scroll flex flex-1 flex-col gap-5 overflow-hidden px-5 pt-3">
          <div className="flex justify-end">
            <div className="ad-user-bubble" style={{ maxWidth: "86%" }}>
              {ASK}
            </div>
          </div>
          <p className="ad-ava-text">Done. I found 48 owners and 41 fit your ideal client. Here is the campaign, ready for your yes.</p>
          <CampaignCard />
          <p className="ad-ava-text">Sarah Mills is the best fit of the 41. Want me to write her a personal note as well?</p>
          <div className="flex flex-wrap gap-2">
            <span className="ad-pill" style={{ padding: "8px 14px" }}>
              Yes, write it
            </span>
            <span className="ad-pill" style={{ padding: "8px 14px" }}>
              Not now
            </span>
          </div>
        </div>
        <div className="p-3">
          <Composer variant="glass" width="100%" tall={false} placeholder="Ask Ava, or tell her what to change" context="Get clients" />
        </div>
      </aside>
    </AppWithPage>
  );
}

const WIDE_NAV = [
  { icon: Home, label: "Home" },
  { icon: LayoutGrid, label: "Blueprint" },
  { icon: Target, label: "Get clients", on: true },
  { icon: Users, label: "Keep clients" },
  { icon: BookOpen, label: "Classroom" },
  { icon: Library, label: "Vault" },
  { icon: Compass, label: "Community" },
];

/* C · In the sidebar: Ava lives at the foot of the nav and shows what she is doing now. */
export function SidebarAva({ mark }: { mark: MarkId }) {
  return (
    <div className="absolute inset-0 flex bg-[var(--ground)]">
      <aside
        className="dark relative z-[2] flex h-full w-[272px] shrink-0 flex-col px-4 pb-5 pt-6"
        style={{
          background: "linear-gradient(165deg, #051e36 0%, #0c5290 52%, #1a8fd4 100%)",
        }}
      >
        <div className="flex items-center gap-2.5 px-3">
          <span className="-mb-5">
            <LogoIcon white size={26} />
          </span>
          <span className="text-[16px] font-bold text-white">The Profit Coach</span>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {WIDE_NAV.map(({ icon: Icon, label, on }) => (
            <span
              key={label}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold"
              style={
                on
                  ? {
                      background: "rgba(255,255,255,0.14)",
                      color: "#fff",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
                    }
                  : { color: "rgba(234,244,252,0.78)" }
              }
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={1.7} aria-hidden />
              {label}
            </span>
          ))}
        </nav>

        <div
          className="mt-auto rounded-[22px] p-4"
          style={{
            background: "linear-gradient(160deg, rgba(5,30,54,0.42), rgba(5,30,54,0.22))",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(207,230,248,0.22)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 36px -20px rgba(5,30,54,0.7)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <AvaMark id={mark} size={30} dark state="thinking" />
            <span className="text-[15px] font-bold text-white">Ava</span>
            <span className="ml-auto text-[12px] font-semibold text-[var(--sky-2)]">Working</span>
          </div>
          <div className="mt-3 text-[14.5px] font-semibold leading-snug text-white">Building your Leeds list</div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="dm-progress flex-1">
              <span style={{ width: "62%" }} />
            </div>
            <span className="ad-num text-[13px] font-semibold text-white">62%</span>
          </div>
          <div className="ad-num mt-1.5 text-[12.5px] text-[rgba(207,230,248,0.85)]">26 of 41 owners checked</div>
          <div
            className="mt-4 flex h-10 items-center gap-1 rounded-full pl-3.5 pr-1"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(207,230,248,0.2)",
            }}
          >
            <span className="flex-1 text-[14px] text-[rgba(234,244,252,0.7)]">Ask Ava</span>
            <span className="grid h-8 w-8 place-items-center rounded-full text-[rgba(234,244,252,0.8)]" title="Dictate">
              <Mic className="h-4 w-4" aria-hidden />
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[var(--navy)]" title="Send">
              <ArrowUp className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ice)] text-[13px] font-bold text-[var(--navy)]">
            {COACH.initials}
          </span>
          <span className="flex-1 text-[14px] font-semibold text-white">{COACH.first} Woodford</span>
          <Settings className="h-[18px] w-[18px] text-[rgba(234,244,252,0.72)]" strokeWidth={1.7} aria-hidden />
        </div>
      </aside>
      <div className="relative flex-1">
        <GetClientsPage building />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Group 2: phone */

/* A · Sunrise home: pale sky, light rising from below, the screen's edges lit like glass. */
export function PhoneSunrise({ mark }: { mark: MarkId }) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="ad-sky-sunrise" />
      <div className="dm-edge" />
      <div className="dm-rim" style={{ borderRadius: 50 }} />
      <StatusBar />
      <div className="relative z-[2] flex items-center justify-between px-4 pt-2">
        <span className="ad-icon-btn" title="Past chats">
          <Menu className="h-5 w-5" aria-hidden />
        </span>
        <span className="ad-icon-btn" title="New chat">
          <SquarePen className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="relative z-[2] flex flex-col items-center px-6 pt-10">
        <AvaMark id={mark} size={124} />
        <div className="mt-8">
          <TwoWeight light={`Hey ${COACH.first},`} bold="welcome back." size={34} />
        </div>
        <p className="mt-3 text-center text-[15px] leading-snug text-[var(--slate)]">Sarah replied overnight, and 6 owners accepted.</p>
        <div className="mt-7 flex flex-col items-center gap-2.5">
          {[
            { icon: PenLine, label: "Read Sarah's reply" },
            { icon: Rocket, label: "Check the Leeds campaign" },
            { icon: Mic, label: "Practise my pitch" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="ad-pill">
              <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-9 z-[2] flex flex-col items-center gap-4 px-5">
        <div className="flex w-full items-center gap-3">
          <span
            className="ad-glass grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full text-[var(--slate)]"
            title="Type instead"
          >
            <Keyboard className="h-5 w-5" aria-hidden />
          </span>
          <span className="ad-glass ad-edge flex h-[64px] flex-1 items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold text-[var(--ink)]">
            <AudioLines className="h-5 w-5 text-[var(--blue)]" aria-hidden />
            Hold to speak
          </span>
          <span
            className="ad-glass grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full text-[var(--slate)]"
            title="Add a photo or file"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

/* B · In a chat: the conversation, one thing she has made, and the composer. */
export function PhoneChat({ mark }: { mark: MarkId }) {
  const p = PROSPECTS[0];
  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--ground)]">
      <div className="ad-sky-sunrise is-chat" />
      <div
        className="relative z-[3]"
        style={{
          background: "rgba(246,249,252,0.72)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(12,82,144,0.08)",
        }}
      >
        <StatusBar />
        <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
          <span className="ad-icon-btn" title="Back">
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </span>
          <AvaMark id={mark} size={30} />
          <div className="flex-1 leading-tight">
            <div className="text-[16px] font-bold text-[var(--ink)]">Ava</div>
            <div className="text-[12.5px] text-[var(--slate)]">Get clients</div>
          </div>
          <span className="ad-icon-btn" title="More">
            <Ellipsis className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>
      <div className="relative z-[2] flex flex-col gap-4 px-4 pt-5">
        <div className="flex justify-end">
          <div className="ad-user-bubble" style={{ maxWidth: "80%" }}>
            Who should I message first?
          </div>
        </div>
        <p className="ad-ava-text">Sarah. She posted last week about losing weekends to quotes, so I wrote a note that picks up on it.</p>
        <div className="ad-arrive rounded-[22px] bg-white p-4 shadow-[0_1px_2px_rgba(5,30,54,0.06),0_16px_32px_-22px_rgba(12,82,144,0.5)]">
          <div className="flex items-center gap-3">
            <Avatar initials={p.initials} size={44} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[15.5px] font-bold text-[var(--ink)]">{p.name}</div>
              <div className="truncate text-[13px] text-[var(--slate)]">
                {p.role}, {p.firm}
              </div>
            </div>
            <span className="ad-chip ad-num">{p.fit} fit</span>
          </div>
          <p className="mt-3.5 rounded-2xl bg-[var(--mist)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--body)]">{CONNECT_NOTE}</p>
          <div className="mt-3.5 flex gap-2">
            <span className="flex-1 rounded-full bg-[var(--navy)] py-2.5 text-center text-[14px] font-semibold text-white">
              Approve and send
            </span>
            <span className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-[var(--blue)]">Edit</span>
          </div>
          <p className="mt-2.5 text-center text-[12px] text-[var(--slate)]">Goes from your LinkedIn only when you approve.</p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[3] px-3 pb-8 pt-3">
        <div className="ad-glass ad-edge flex h-[56px] items-center gap-1 rounded-full pl-1.5 pr-2">
          <span className="ad-icon-btn" title="Add a file">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1 text-[16px] text-[#7d8ca0]">Message Ava</span>
          <span className="ad-icon-btn" title="Dictate">
            <Mic className="h-5 w-5" aria-hidden />
          </span>
          <span className="ad-send" style={{ width: 40, height: 40 }} title="Send">
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
          </span>
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

/* C · Voice: her face fades into navy mist, captions run live, the symbol moves with her voice. */
export function PhoneVoice({ mark, face }: { mark: MarkId; face: "navy" | "glassNavy" }) {
  const f = FACES[face];
  return (
    <div className="dark absolute inset-0 flex flex-col" style={{ background: f.room }}>
      <div
        className="ad-breathe absolute inset-x-0 top-0 h-[600px] bg-cover"
        style={{
          backgroundImage: `url(${f.src})`,
          backgroundPosition: "50% 18%",
          WebkitMaskImage: "linear-gradient(180deg, #000 40%, transparent 92%)",
          maskImage: "linear-gradient(180deg, #000 40%, transparent 92%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 60% at 50% 100%, ${f.room} 30%, rgba(5,30,54,0) 75%), linear-gradient(180deg, rgba(5,30,54,0.45) 0%, rgba(5,30,54,0) 22%)`,
        }}
      />
      <StatusBar dark />
      <div className="relative z-[2] flex items-center px-4 pt-2">
        <span className="ad-icon-btn" title="Make smaller">
          <ChevronDown className="h-6 w-6" aria-hidden />
        </span>
        <div className="flex-1 text-center leading-tight">
          <div className="text-[16px] font-bold text-white">Ava</div>
          <div className="ad-num text-[12.5px] text-[rgba(207,230,248,0.8)]">02:14</div>
        </div>
        <span className="ad-icon-btn" title="Speaker">
          <Volume2 className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-[178px] z-[2] flex flex-col items-center px-7">
        <AvaMark id={mark} size={64} dark state="speaking" />
        <p className="mt-6 text-center text-[15px] leading-snug text-[rgba(207,230,248,0.55)]">
          Sarah replied overnight. She asked what it costs.
        </p>
        <p
          className="mt-2 text-center text-[21px] font-semibold leading-snug tracking-[-0.01em] text-[rgba(255,255,255,0.92)]"
          style={{ textWrap: "balance" }}
        >
          I drafted an answer that points her to the free BOSS <span className="dm-caption-now">Score</span> first. Want to hear it?
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-12 z-[2] flex items-start justify-center gap-9">
        {[
          { icon: MicOff, label: "Mute" },
          { icon: PhoneOff, label: "End", main: true },
          { icon: Keyboard, label: "Type" },
        ].map(({ icon: Icon, label, main }) => (
          <span key={label} className="flex flex-col items-center gap-2">
            <span
              className={`grid place-items-center rounded-full ${main ? "" : "ad-glass-dark"}`}
              style={
                main
                  ? {
                      width: 72,
                      height: 72,
                      background: "#fff",
                      color: "#051e36",
                      boxShadow: "0 10px 30px -10px rgba(124,195,242,0.7)",
                    }
                  : { width: 62, height: 62, color: "#eaf4fc", marginTop: 5 }
              }
            >
              <Icon className={main ? "h-7 w-7" : "h-6 w-6"} strokeWidth={main ? 2 : 1.8} aria-hidden />
            </span>
            <span className="text-[13px] font-semibold text-[rgba(234,244,252,0.85)]">{label}</span>
          </span>
        ))}
      </div>
      <HomeBar dark />
    </div>
  );
}

/* D · Bottom sheet: Ava rises over the page you are on, so you never lose your place. */
export function PhoneSheet({ mark }: { mark: MarkId }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--ground)]">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-3">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--ink)]">Get clients</h1>
        <span className="ad-icon-btn" title="Updates">
          <Bell className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="mx-5 mt-4 grid grid-cols-2 rounded-[18px] bg-white py-4 shadow-[0_1px_2px_rgba(5,30,54,0.06)]">
        {TOTALS.slice(0, 2).map((t, i) => (
          <div key={t.label} className="px-4" style={i ? { borderLeft: "1px solid rgba(12,82,144,0.1)" } : undefined}>
            <div className="ad-num text-[24px] font-bold text-[var(--ink)]">{t.value}</div>
            <div className="text-[12.5px] text-[var(--slate)]">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="mx-5 mt-4 overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(5,30,54,0.06)]">
        {CAMPAIGNS.map((c, i) => (
          <div
            key={c.name}
            className="flex items-center justify-between px-4 py-3.5"
            style={i ? { borderTop: "1px solid rgba(12,82,144,0.1)" } : undefined}
          >
            <div>
              <div className="text-[15px] font-semibold text-[var(--ink)]">{c.name}</div>
              <div className="ad-num text-[12.5px] text-[var(--slate)]">
                {c.invited} invited, {c.accepted} accepted
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dm-sheet-dim" style={{ background: "rgba(5,30,54,0.28)" }} />
      <div
        className="ad-glass absolute inset-x-0 bottom-0 z-[3] flex flex-col rounded-t-[32px] px-5 pb-9 pt-2.5"
        style={{ borderBottom: 0 }}
      >
        <span className="mx-auto h-[5px] w-10 rounded-full bg-[rgba(90,107,128,0.35)]" />
        <div className="mt-4 flex items-center gap-3">
          <AvaMark id={mark} size={32} />
          <span className="flex-1 text-[16px] font-bold text-[var(--ink)]">Ava</span>
          <span className="ad-icon-btn" title="Close">
            <X className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <p className="ad-ava-text mt-3">6 Leeds owners accepted overnight. I wrote a short thank-you for each, in your words.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex">
            {PROSPECTS.map((x, i) => (
              <span key={x.initials} className="rounded-full ring-2 ring-white" style={{ marginLeft: i ? -6 : 0 }}>
                <Avatar initials={x.initials} size={36} />
              </span>
            ))}
          </div>
          <span className="text-[13.5px] text-[var(--slate)]">Sarah, David, Helen and 3 more</span>
        </div>
        <div className="mt-5 flex gap-2">
          <span className="flex-1 rounded-full bg-[var(--navy)] py-3 text-center text-[15px] font-semibold text-white">
            Read and approve
          </span>
          <span className="rounded-full px-5 py-3 text-[15px] font-semibold text-[var(--blue)]">Later</span>
        </div>
        <div
          className="mt-4 flex h-[50px] items-center gap-1 rounded-full bg-white/80 pl-4 pr-1.5"
          style={{ border: "1px solid rgba(12,82,144,0.1)" }}
        >
          <span className="flex-1 text-[15px] text-[#7d8ca0]">Ask Ava something else</span>
          <span className="ad-icon-btn" title="Dictate">
            <Mic className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>
      <HomeBar />
    </div>
  );
}

/* ------------------------------------------------------------ The tab */
