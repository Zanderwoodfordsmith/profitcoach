"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";

import { AvaMark } from "../marks";
import { SectionIntro } from "../Option";
import { Screen } from "../parts";
import { ColumnChat, WorkspaceChat } from "./ChatScreens";
import { GlassPanel, PhoneChat, PhoneSheet, PhoneSunrise, PhoneVoice, SidebarAva } from "./DockMobile";
import { WIDE } from "./FaceOptions";
import {
  CampaignDays,
  CampaignOn,
  CampaignSummary,
  ChoiceQuestion,
  DraftApprove,
  MomentMark,
  Nudge,
  ProspectInline,
  ProspectList,
  RoomPanel,
  WorkingProgress,
} from "./Moments";
import { RoomNavyStart } from "./StartScreens";

/** Her name set with the symbol. A light runs across the letters every few seconds. */
function Lockups() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="self-end rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--blue)] hover:bg-[var(--mist)]"
      >
        Play the light again
      </button>
      <div key={run} className="grid gap-3 md:grid-cols-3">
        <div className="grid h-[220px] place-items-center rounded-2xl" style={{ background: "linear-gradient(180deg,#f7fafd,#e6f0f9)" }}>
          <span className="flex items-center gap-4">
            <AvaMark id="haloCore" size={64} />
            <span className="ad-sweep text-[64px] font-bold leading-none tracking-[-0.04em] text-[var(--ink)]">Ava</span>
          </span>
        </div>
        <div
          className="grid h-[220px] place-items-center rounded-2xl"
          style={{
            background: "radial-gradient(80% 70% at 50% 110%, #0c5290 0%, #051e36 65%)",
          }}
        >
          <span className="flex items-center gap-4">
            <AvaMark id="haloCore" size={56} dark />
            <span className="ad-sweep dark text-[60px] font-light leading-none tracking-[-0.03em] text-white">ava</span>
          </span>
        </div>
        <div className="grid h-[220px] place-items-center rounded-2xl bg-white">
          <span className="flex flex-col items-center gap-3">
            <AvaMark id="haloCore" size={72} />
            <span className="text-center leading-tight">
              <span className="ad-sweep block text-[30px] font-bold tracking-[-0.02em] text-[var(--ink)]">Ava</span>
              <span className="block text-[13px] font-medium text-[var(--slate)]">by The Profit Coach</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** One decision: what was picked, a line on how it is used, then the design itself. */
function Pick({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h3 className="flex items-center gap-2 text-[19px] font-bold tracking-[-0.01em] text-[var(--ink)]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ok)] text-white" aria-hidden>
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          {title}
        </h3>
        <p className="mt-1 max-w-[70ch] pl-8 text-[15px] leading-relaxed text-[var(--slate)]">{line}</p>
      </header>
      {children}
    </section>
  );
}

/** Everything chosen so far, in one place, all with the Halo with a centre. */
export function Decided() {
  return (
    <div className="flex flex-col gap-14">
      <SectionIntro title="Decided so far">
        Your picks, all shown with her new symbol. Still open: her face, the phone, and More screens. Options you passed on have been
        removed (git still has them if we ever want one back).
      </SectionIntro>

      <Pick
        title="Her symbol: the Halo with a centre"
        line="Everywhere she appears small: the sidebar, beside her words, buttons, alerts and the app icon. A light runs across her name."
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px]">
          <div className="grid h-[260px] place-items-center rounded-2xl" style={{ background: "linear-gradient(180deg,#f7fafd,#e6f0f9)" }}>
            <AvaMark id="haloCore" size={140} />
          </div>
          <div
            className="grid h-[260px] place-items-center rounded-2xl"
            style={{
              background: "radial-gradient(80% 70% at 50% 110%, #0c5290 0%, #051e36 65%)",
            }}
          >
            <AvaMark id="haloCore" size={140} state="thinking" dark />
          </div>
          <div className="flex flex-col justify-center gap-5 rounded-2xl bg-white p-5">
            <div className="flex items-end gap-5">
              <AvaMark id="haloCore" size={56} />
              <AvaMark id="haloCore" size={32} />
              <AvaMark id="haloCore" size={22} />
            </div>
            <p className="text-[13px] leading-snug text-[var(--slate)]">Left resting, right working: the numbers spin inside the ring.</p>
          </div>
        </div>
        <Lockups />
      </Pick>

      <Pick
        title="Start screen: Ava in the room"
        line="Option E: her face in a lighter brand-blue room, the glass box and buttons beside her. The face is still to choose; this uses round three."
      >
        <Screen label="Chosen start screen">
          <RoomNavyStart mark="haloCore" tone="light" face={WIDE.v3} />
        </Screen>
      </Pick>

      <Pick
        title="Once a chat starts: one calm column, and Build it together when she makes something"
        line="On a laptop she talks in the column. When she builds a list or a campaign, the right side slides in and the chat narrows, so you see both. On a phone it opens as a sheet over the chat."
      >
        <Screen label="Chosen chat, calm column">
          <ColumnChat mark="haloCore" />
        </Screen>
        <Screen label="Chosen chat, build it together">
          <WorkspaceChat mark="haloCore" />
        </Screen>
      </Pick>

      <Pick
        title="Beside a page: the glass panel, with her card in the sidebar"
        line="Two modes of the same Ava. The panel opens over any page. When it is closed, the card at the foot of the sidebar shows what she is doing; tap it to open the panel."
      >
        <Screen label="Chosen glass panel">
          <GlassPanel mark="haloCore" />
        </Screen>
        <Screen label="Chosen sidebar card">
          <SidebarAva mark="haloCore" />
        </Screen>
      </Pick>

      <MomentMark.Provider value="haloCore">
        <Pick
          title="What she shares"
          line="Someone she found, in her words. The list of people. Your campaign, ready for your yes, with the ten days. A message to approve. Her plan while she works, a question, the moment it is on, and a nudge."
        >
          <div className="grid gap-5 xl:grid-cols-2">
            <RoomPanel dark={false} label="Someone she found">
              <ProspectInline dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="List of people">
              <ProspectList dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="Campaign ready">
              <CampaignSummary dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="Campaign ten days">
              <CampaignDays dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="Message to approve">
              <DraftApprove dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="While she works" minH={560}>
              <WorkingProgress dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="A question for you">
              <ChoiceQuestion dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="It's on">
              <CampaignOn dark={false} />
            </RoomPanel>
            <RoomPanel dark={false} label="A nudge" minH={340}>
              <Nudge dark={false} />
            </RoomPanel>
          </div>
          <p className="max-w-[70ch] text-[14px] leading-relaxed text-[var(--slate)]">
            When we build it, the campaign card gets the ten days inside it: one card, the numbers on top, the row of days under them.
          </p>
        </Pick>
      </MomentMark.Provider>
    </div>
  );
}

/** The phone, still to choose: the four phone screens with her new symbol. */
export function PhoneOpen() {
  const phones: { name: string; line: string; view: ReactNode }[] = [
    {
      name: "Home",
      line: "Light rising from below, one big button to just talk.",
      view: <PhoneSunrise mark="haloCore" />,
    },
    {
      name: "In a chat",
      line: "What she made sits in the chat, ready for your yes.",
      view: <PhoneChat mark="haloCore" />,
    },
    {
      name: "Voice call",
      line: "Her face, her words as she says them, the Halo moving with her voice.",
      view: <PhoneVoice mark="haloCore" face="navy" />,
    },
    {
      name: "Quick sheet",
      line: "She slides up over the page you are on, then slides away.",
      view: <PhoneSheet mark="haloCore" />,
    },
  ];
  return (
    <div className="flex flex-col gap-12">
      <SectionIntro title="Still to choose: the phone">
        The same picks, on a phone, with her new symbol. Which of these do you want? The home and voice screens will use her face once it is
        chosen.
      </SectionIntro>
      <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-4">
        {phones.map((p) => (
          <section key={p.name} className="flex flex-col gap-4">
            <header className="min-h-[72px]">
              <h3 className="text-[19px] font-bold tracking-[-0.01em] text-[var(--ink)]">{p.name}</h3>
              <p className="mt-0.5 text-[15px] leading-relaxed text-[var(--slate)]">{p.line}</p>
            </header>
            <Screen w={390} h={844} phone label={`Phone ${p.name}`}>
              {p.view}
            </Screen>
          </section>
        ))}
      </div>
    </div>
  );
}
