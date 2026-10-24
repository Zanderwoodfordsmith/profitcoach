"use client";

import { useEffect, useState, type ComponentType } from "react";

import { figtree } from "@/fonts";

import "./avaDesign.css";
import { ChatScreens } from "./sections/ChatScreens";
import { DockMobile } from "./sections/DockMobile";
import { FaceOptions } from "./sections/FaceOptions";
import { Moments } from "./sections/Moments";
import { MoreScreens } from "./sections/MoreScreens";
import { StartScreens } from "./sections/StartScreens";
import { SymbolOptions } from "./sections/SymbolOptions";

type Tab = { id: string; label: string; View: ComponentType };

const TABS: Tab[] = [
  { id: "symbol", label: "Symbol", View: SymbolOptions },
  { id: "face", label: "Face", View: FaceOptions },
  { id: "start", label: "Start screen", View: StartScreens },
  { id: "chat", label: "In chat", View: ChatScreens },
  { id: "dock", label: "Sidebar and phone", View: DockMobile },
  { id: "moments", label: "What she shares", View: Moments },
  { id: "more", label: "More screens", View: MoreScreens },
];

/**
 * Ava design options (admin only): several choices for each part of her
 * look, side by side, at true size. Nothing here changes the live Ava.
 */
export function AvaDesignBoard() {
  const [tab, setTab] = useState(TABS[0].id);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === id)) setTab(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const pick = (id: string) => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  };

  const View = TABS.find((t) => t.id === tab)?.View ?? SymbolOptions;

  return (
    <div className={`ad ${figtree.className} min-h-full bg-[var(--ground)] px-5 pb-24 pt-8 sm:px-10`}>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-[64ch]">
            <h2 className="text-[34px] leading-tight tracking-[-0.025em]">
              <span className="font-light text-[var(--slate)]">Ava&apos;s look: </span>
              <span className="font-bold text-[var(--ink)]">options to choose from</span>
            </h2>
            <p className="mt-2 text-[16px] leading-relaxed text-[var(--slate)]">
              Pick a favourite in each tab, or mix them: any symbol works with any screen. Open any screen at full size to judge it properly.
              The live Ava is unchanged.
            </p>
          </div>
        </header>
        <nav className="sticky top-3 z-20 self-start" aria-label="Parts of Ava's look">
          <div className="ad-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ad-tab" onClick={() => pick(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
        <View />
      </div>
    </div>
  );
}
