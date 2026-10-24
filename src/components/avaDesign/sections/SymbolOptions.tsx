"use client";

import { useState } from "react";

import { AvaMark, MARKS } from "../marks";
import { Option, SectionIntro, Seg } from "../Option";
import type { AvaState } from "../useLoop";

const STATES: { id: AvaState; label: string }[] = [
  { id: "idle", label: "Resting" },
  { id: "listening", label: "Listening" },
  { id: "thinking", label: "Working" },
  { id: "speaking", label: "Talking" },
];

/** Her name set beside or under the symbol, as it would appear on a splash screen or app store. */
function Lockups({ state }: { state: AvaState }) {
  const [run, setRun] = useState(0);
  return (
    <Option
      letter="★"
      name="Her name with the symbol"
      why="Three ways to set the word Ava with her mark. Every few seconds a light runs across the letters of her name, like the HyperOS clip. Shown with the Halo with a centre; any symbol works."
      aside={
        <button type="button" onClick={() => setRun((r) => r + 1)} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--blue)] hover:bg-[var(--mist)]">
          Play the light again
        </button>
      }
    >
      <div key={run} className="grid gap-3 md:grid-cols-3">
        <div className="grid h-[220px] place-items-center rounded-2xl" style={{ background: "linear-gradient(180deg,#f7fafd,#e6f0f9)" }}>
          <span className="flex items-center gap-4">
            <AvaMark id="haloCore" size={64} state={state} />
            <span className="ad-sweep text-[64px] font-bold leading-none tracking-[-0.04em] text-[var(--ink)]">Ava</span>
          </span>
        </div>
        <div className="grid h-[220px] place-items-center rounded-2xl" style={{ background: "radial-gradient(80% 70% at 50% 110%, #0c5290 0%, #051e36 65%)" }}>
          <span className="flex items-center gap-4">
            <AvaMark id="haloCore" size={56} state={state} dark />
            <span className="ad-sweep dark text-[60px] font-light leading-none tracking-[-0.03em] text-white">ava</span>
          </span>
        </div>
        <div className="grid h-[220px] place-items-center rounded-2xl bg-white">
          <span className="flex flex-col items-center gap-3">
            <AvaMark id="haloCore" size={72} state={state} />
            <span className="text-center leading-tight">
              <span className="ad-sweep block text-[30px] font-bold tracking-[-0.02em] text-[var(--ink)]">Ava</span>
              <span className="block text-[13px] font-medium text-[var(--slate)]">by The Profit Coach</span>
            </span>
          </span>
        </div>
      </div>
    </Option>
  );
}

export function SymbolOptions() {
  const [state, setState] = useState<AvaState>("idle");
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionIntro title="Ava's symbol">
          Her mark, not her face: it sits on the start screen, in the sidebar, beside her messages and on the app icon. Each one
          moves a little all the time and changes when she listens, works or talks. Switch her state to see it.
        </SectionIntro>
        <Seg label="Ava's state" value={state} options={STATES} onChange={setState} />
      </div>

      <Lockups state={state} />

      {MARKS.map((m, i) => (
        <Option key={m.id} letter={String.fromCharCode(65 + i)} name={m.name} why={m.line}>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px]">
            <div className="relative grid h-[300px] place-items-center overflow-hidden rounded-2xl" style={{ background: "linear-gradient(180deg,#f7fafd,#e6f0f9)" }}>
              <AvaMark id={m.id} size={150} state={state} />
            </div>
            <div className="relative grid h-[300px] place-items-center overflow-hidden rounded-2xl" style={{ background: "radial-gradient(80% 70% at 50% 110%, #0c5290 0%, #051e36 65%)" }}>
              <AvaMark id={m.id} size={150} state={state} dark />
            </div>
            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white p-5">
              <p className="text-[13px] font-semibold text-[var(--slate)]">Small sizes</p>
              <div className="flex items-end gap-5">
                <AvaMark id={m.id} size={56} state={state} />
                <AvaMark id={m.id} size={32} state={state} />
                <AvaMark id={m.id} size={22} state={state} />
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[var(--mist)] px-3 py-2.5">
                <AvaMark id={m.id} size={26} state={state} />
                <span className="text-[14px] font-semibold text-[var(--ink)]">Ava</span>
                <span className="text-[12px] text-[var(--slate)]">{state === "thinking" ? "working on it" : state === "speaking" ? "talking" : state === "listening" ? "listening" : "here when you need her"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-[60px] w-[60px] place-items-center rounded-[16px]" style={{ background: "linear-gradient(160deg,#0a2c4d,#051e36)", boxShadow: "0 8px 20px -10px rgba(5,30,54,.7)" }}>
                  <AvaMark id={m.id} size={34} state={state} dark />
                </span>
                <span className="text-[12px] leading-snug text-[var(--slate)]">As a phone app icon</span>
              </div>
            </div>
          </div>
        </Option>
      ))}
    </div>
  );
}
