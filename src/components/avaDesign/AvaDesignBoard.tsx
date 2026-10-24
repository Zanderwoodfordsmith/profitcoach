"use client";

import { useEffect, useState, type ComponentType } from "react";

import { figtree } from "@/fonts";

import "./avaDesign.css";
import { Decided, PhoneOpen } from "./sections/Decided";
import { FaceOptions } from "./sections/FaceOptions";
import { MoreScreens } from "./sections/MoreScreens";

type Tab = { id: string; label: string; View: ComponentType };

/** What he has picked, then only what is still open. */
const TABS: Tab[] = [
  { id: "decided", label: "Decided", View: Decided },
  { id: "face", label: "Face", View: FaceOptions },
  { id: "phone", label: "Phone", View: PhoneOpen },
  { id: "more", label: "More screens", View: MoreScreens },
];

/**
 * Ava's look (admin only): the choices made so far and the ones still
 * open, at true size. Nothing here changes the live Ava.
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

  const View = TABS.find((t) => t.id === tab)?.View ?? Decided;

  return (
    <div className={`ad ${figtree.className} min-h-full bg-[var(--ground)] px-5 pb-24 pt-8 sm:px-10`}>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
        <header className="max-w-[64ch]">
          <h2 className="text-[34px] leading-tight tracking-[-0.025em]">
            <span className="font-light text-[var(--slate)]">Ava&apos;s look: </span>
            <span className="font-bold text-[var(--ink)]">what we chose, what is left</span>
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-[var(--slate)]">
            Your picks first, then only what is still open. Open any screen at full size to judge it properly. The live Ava is unchanged.
          </p>
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
