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
      className={`fixed top-4 z-[95] flex h-6 w-6 items-center justify-center rounded-full bg-[#0c5290] text-white shadow-md hover:bg-[#1664b6] sm:top-[1.125rem] md:top-auto md:bottom-6 ${
        sidebarVisible
          ? "left-3 md:left-56 md:-translate-x-1/2"
          : "left-3 md:left-0 md:translate-x-1/2"
      }`}
      aria-expanded={sidebarVisible}
      aria-label={sidebarVisible ? "Hide main menu" : "Show main menu"}
    >
      {sidebarVisible ? (
        <ChevronLeft className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2.75} aria-hidden />
      )}
    </button>
  );
}
