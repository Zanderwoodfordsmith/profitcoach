import type { ReactNode } from "react";
import { caveat as hand } from "@/fonts";
import { Ellipsis, EllipsisVertical, Share } from "lucide-react";

export type StepsDevice = "ios-safari" | "ios-chrome" | "ios-other" | "android";

/** A small picture of the button to look for, sat in the sentence. */
function Key({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-300 bg-white px-1 align-middle text-slate-800 shadow-[0_1px_0_rgb(15_23_42/0.08)]">
      {children}
    </span>
  );
}

/** iPhone's green switch, so they know what "on" looks like. */
function OnSwitch() {
  return (
    <span className="mx-0.5 inline-flex h-[22px] w-9 items-center justify-end rounded-full bg-[#34c759] p-0.5 align-middle" aria-hidden>
      <span className="h-[18px] w-[18px] rounded-full bg-white shadow" />
    </span>
  );
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-900">{children}</strong>;
}

const icon = "h-[18px] w-[18px]";

const STEPS: Record<StepsDevice, ReactNode[]> = {
  "ios-safari": [
    <>
      Tap <Key><Ellipsis className={icon} aria-label="three dots" /></Key> at the bottom right of Safari, then{" "}
      <B>Share</B>. (Or tap <Key><Share className={icon} aria-label="Share" /></Key> if you see it.)
    </>,
    <>
      Tap <B>View More</B> in the row of buttons, then scroll down and tap <B>Add to Home Screen</B>.
    </>,
    <>
      Leave <B>Open as Web App</B> on <OnSwitch /> and tap <B>Add</B>.
    </>,
  ],
  "ios-chrome": [
    <>
      Tap <Key><Share className={icon} aria-label="Share" /></Key> at the top right, next to the web address.
    </>,
    <>
      Tap <B>View More</B> in the row of buttons, then scroll down and tap <B>Add to Home Screen</B>.
    </>,
    <>
      Leave <B>Open as Web App</B> on <OnSwitch /> and tap <B>Add</B>.
    </>,
  ],
  "ios-other": [
    <>This app&apos;s browser can&apos;t add to your home screen.</>,
    <>
      Tap <Key><Ellipsis className={icon} aria-label="three dots" /></Key> and choose <B>Open in Safari</B>.
    </>,
    <>Then follow the steps on the page that opens.</>,
  ],
  android: [
    <>
      Tap <Key><EllipsisVertical className={icon} aria-label="menu" /></Key> at the top right of Chrome.
    </>,
    <>
      Tap <B>Add to Home screen</B>, then <B>Install</B>.
    </>,
    <>
      Tap <B>Install</B> again to confirm.
    </>,
  ],
};

/** Where the first button lives on screen, for the hand-drawn arrow. */
const ARROW: Partial<Record<StepsDevice, "top" | "bottom">> = {
  "ios-chrome": "top",
  android: "top",
  "ios-safari": "bottom",
};

export function InstallSteps({ device }: { device: StepsDevice }) {
  return (
    <ol className="space-y-5">
      {STEPS[device].map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0c5290]/10 text-sm font-semibold text-[#0c5290]">
            {i + 1}
          </span>
          <span className="pt-0.5 text-[15px] leading-7 text-slate-800">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** A curved, hand-drawn arrow in the screen corner pointing at the browser button from step 1. */
export function InstallArrow({ device }: { device: StepsDevice }) {
  const where = ARROW[device];
  if (!where) return null;
  const top = where === "top";
  return (
    <div
      className={`pointer-events-none fixed right-3 z-10 flex items-end gap-1 text-[#0c5290] ${
        top ? "top-1 flex-row" : "bottom-1 flex-row items-start"
      }`}
      aria-hidden
    >
      <span className={`${hand.className} text-2xl leading-none ${top ? "mb-1" : "mt-1"}`}>
        {device === "ios-safari" ? "tap here" : "this button"}
      </span>
      <svg
        viewBox="0 0 64 64"
        className="h-14 w-14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={top ? undefined : { transform: "scaleY(-1)" }}
      >
        <path d="M6 58c10-4 22-14 30-26s14-20 20-24" />
        <path d="M42 8l14 0l-2 14" />
      </svg>
    </div>
  );
}
