"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type BossProNavToggleProps = {
  sidebarVisible: boolean;
  onToggle: () => void;
};

export function BossProNavToggle({ sidebarVisible, onToggle }: BossProNavToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`fixed top-4 z-[95] flex h-6 w-6 items-center justify-center rounded-full border border-sky-200 bg-sky-100 text-sky-800 shadow-md hover:bg-sky-200 sm:top-[1.125rem] ${
        sidebarVisible
          ? "left-3 md:left-64 md:-translate-x-1/2"
          : "left-3 md:left-0 md:translate-x-1/2"
      }`}
      aria-expanded={sidebarVisible}
      aria-label={sidebarVisible ? "Hide main menu" : "Show main menu"}
    >
      {sidebarVisible ? (
        <ChevronLeft className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
      )}
    </button>
  );
}
