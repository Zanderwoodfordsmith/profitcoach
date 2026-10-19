"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { useInstallDevice } from "@/lib/installDevice";
import { InstallQrCode } from "@/components/install/InstallQrCode";
import { InstallArrow, InstallSteps } from "@/components/install/InstallSteps";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Public /install page. Android gets a one-tap install button; iPhone gets the taps, because Apple doesn't let a site add itself. */
export function InstallGuide() {
  const device = useInstallDevice();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [promptChecked, setPromptChecked] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Chrome usually offers the prompt within a second; after that, show the menu steps instead.
    const timer = window.setTimeout(() => setPromptChecked(true), 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    setInstalling(true);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setInstalling(false);
    setPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
  };

  const done = installed || device === "installed";
  const showSteps =
    !done &&
    device !== null &&
    device !== "desktop" &&
    !(device === "android" && (prompt || !promptChecked));

  return (
    <main className="flex min-h-dvh items-start justify-center bg-slate-50 px-4 pb-16 pt-20 sm:items-center sm:py-10">
      {showSteps ? <InstallArrow device={device} /> : null}
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/app-icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-[18px] shadow-sm ring-1 ring-black/5"
          />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            {done ? "You're all set" : "Put Profit Coach on your phone"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {done
              ? "Open Profit Coach from your home screen. Sign in once and it keeps you signed in."
              : "It opens full screen like any other app, one tap from your home screen."}
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200/80 bg-white p-5">
          {device === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              {device === "installed" ? (
                <a
                  href="/coach"
                  className="w-full rounded-lg bg-[#0c5290] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#0a4578]"
                >
                  Open Profit Coach
                </a>
              ) : null}
            </div>
          ) : device === "desktop" ? (
            <div className="flex flex-col items-center gap-3">
              <InstallQrCode size={200} />
              <p className="text-center text-sm text-slate-600">
                Point your phone&apos;s camera at the code and tap the link that appears.
              </p>
            </div>
          ) : device === "android" && prompt ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={installing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0c5290] px-4 py-3.5 text-base font-semibold text-white hover:bg-[#0a4578] disabled:opacity-60"
            >
              {installing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-5 w-5" aria-hidden />
              )}
              Install Profit Coach
            </button>
          ) : device === "android" && !promptChecked ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
            </div>
          ) : (
            <InstallSteps device={device} />
          )}
        </div>

        {!done && device !== null && device !== "desktop" ? (
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
            Then open it from your home screen and sign in once (your phone can fill in a saved
            password). It keeps you signed in after that.
          </p>
        ) : null}
      </div>
    </main>
  );
}
