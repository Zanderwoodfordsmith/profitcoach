"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { InstallQrCode } from "@/components/install/InstallQrCode";
import { AndroidIcon, AppleIcon } from "@/components/install/PlatformIcons";
import { useInstallDevice } from "@/lib/installDevice";

/** Settings → Profile, top of the right column: one button that opens a QR code to put the app on their phone. */
export function AddToPhoneCard() {
  const device = useInstallDevice();
  const [open, setOpen] = useState(false);

  if (device === null || device === "installed") return null;

  const buttonClass =
    "group flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 text-left hover:border-[#0c5290]/40 hover:bg-sky-50/40";
  const body = (
    <>
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
    </>
  );

  // Already on a phone: skip the QR and go straight to the install steps.
  if (device !== "desktop") {
    return (
      <a href="/install" className={buttonClass}>
        {body}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {body}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Get the app on your phone"
        titleId="add-to-phone-title"
        subtitle="Profit Coach opens full screen from your home screen, like any other app."
        maxWidthClassName="max-w-2xl"
        glass
      >
        <div className="flex flex-col items-center gap-10 px-10 pb-11 pt-7 sm:flex-row sm:items-center">
          <InstallQrCode size={188} />
          <ol className="space-y-5 text-base leading-relaxed text-slate-800">
            <Step n={1}>Open your phone&apos;s camera and point it at the code.</Step>
            <Step n={2}>
              Tap the link that appears.
              <span className="mt-2.5 flex items-center gap-2">
                <AndroidIcon className="h-5 w-5 shrink-0 text-[#3ddc84]" />
                <span>
                  <strong className="font-semibold text-slate-900">Android</strong> shows an Install button.
                </span>
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <AppleIcon className="h-5 w-5 shrink-0 text-slate-900" />
                <span>
                  <strong className="font-semibold text-slate-900">iPhone</strong> shows you the three taps.
                </span>
              </span>
            </Step>
            <Step n={3}>Open it from your home screen and sign in once. It keeps you signed in.</Step>
          </ol>
        </div>
      </Modal>
    </>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0c5290] text-sm font-semibold text-white">
        {n}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}
