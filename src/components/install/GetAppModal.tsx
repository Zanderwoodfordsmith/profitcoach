"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { InstallQrCode } from "@/components/install/InstallQrCode";
import { InstallSteps } from "@/components/install/InstallSteps";
import { AndroidIcon, AppleIcon } from "@/components/install/PlatformIcons";
import { useInstallDevice } from "@/lib/installDevice";

/** Put the app on their phone without leaving the page: a QR code on a computer, the taps on a phone. */
export function GetAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const device = useInstallDevice();
  if (device === null || device === "installed") return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Get the app on your phone"
      titleId="get-app-title"
      subtitle="Profit Coach opens full screen from your home screen, like any other app."
      maxWidthClassName={device === "desktop" ? "max-w-2xl" : "max-w-sm"}
      glass
    >
      {device === "desktop" ? (
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
      ) : (
        <div className="px-6 pb-8 pt-5">
          <InstallSteps device={device} />
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            Then open it from your home screen and sign in once. It keeps you signed in after that.
          </p>
        </div>
      )}
    </Modal>
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
