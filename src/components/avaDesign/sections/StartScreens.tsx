"use client";

import { MessageSquareText, Rocket, Search } from "lucide-react";

import { AvaMark, type MarkId } from "../marks";
import { COACH } from "../mock";
import { AppRail, Composer, Starters, TwoWeight } from "../parts";
import { WIDE } from "./FaceOptions";

/* E · Ava in the room, navy: her face in the navy mist with the Beam's glass box and buttons. */
export function RoomNavyStart({ mark, tone = "deep", face = WIDE.navyV2 }: { mark: MarkId; tone?: "deep" | "light"; face?: string }) {
  return (
    <div className="dark absolute inset-0 flex">
      <div
        className="absolute inset-0"
        style={{
          background:
            tone === "deep"
              ? "radial-gradient(80% 90% at 75% 40%, #1d3a5c 0%, #10263f 45%, #081a2e 100%)"
              : "radial-gradient(85% 95% at 75% 40%, #3f7fbd 0%, #1f5f9c 42%, #0f4478 100%)",
        }}
      >
        <span className="ad-dust" />
      </div>
      <div
        className="ad-breathe absolute inset-y-0 right-0 w-[86%] bg-cover"
        style={{
          backgroundImage: `url(${face})`,
          backgroundPosition: "62% 30%",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 42%), linear-gradient(0deg, transparent 0%, #000 22%)",
          WebkitMaskComposite: "source-in",
          maskImage: "linear-gradient(90deg, transparent 0%, #000 42%), linear-gradient(0deg, transparent 0%, #000 22%)",
          maskComposite: "intersect",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[38%]"
        style={{
          background: "radial-gradient(70% 100% at 40% 120%, rgba(26,143,212,.35), rgba(26,143,212,0) 70%)",
        }}
      />
      {tone === "light" ? (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, rgba(6,30,60,.5) 0%, rgba(6,30,60,.28) 38%, rgba(6,30,60,0) 62%)",
          }}
        />
      ) : null}
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
