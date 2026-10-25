"use client";

import { useState } from "react";
import { ChevronRight, Smartphone } from "lucide-react";
import { GetAppModal } from "@/components/install/GetAppModal";
import { useInstallDevice } from "@/lib/installDevice";
import { cardClass } from "@/components/ui/Card";

/** Settings → Profile, top of the right column: one button that opens the get-the-app modal. */
export function AddToPhoneCard() {
  const device = useInstallDevice();
  const [open, setOpen] = useState(false);

  if (device === null || device === "installed") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cardClass("raised", "group flex w-full items-center gap-3 px-4 py-3.5 text-left hover:border-[#0c5290]/40 hover:bg-sky-50/40")}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0c5290] text-white">
          <Smartphone className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Get the app on your phone</span>
          <span className="block text-xs text-slate-500">
            {device === "desktop" ? "Scan a code, add it to your home screen" : "Add it to your home screen"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#0c5290]" aria-hidden />
      </button>
      <GetAppModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
