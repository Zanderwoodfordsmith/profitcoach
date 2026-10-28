"use client";

import Link from "next/link";
import type { LandingCopyOverrideKey } from "@/lib/landingCopy";

/** Passed down while the coach edits their landing page in place. */
export type LandingCopyEditor = {
  save: (key: LandingCopyOverrideKey, value: string) => void;
};

/** Field look on the dark hero: same type as the live text, dashed outline until focused. */
export const LANDING_EDIT_FIELD =
  "block w-full resize-none overflow-hidden rounded-md bg-white/[0.04] outline-1 outline-dashed outline-offset-4 outline-white/35 hover:outline-[#6cd6ff]/80 focus:outline-2 focus:outline-solid focus:outline-[#6cd6ff] placeholder:text-white/40";

export type LandingSaveState = "saved" | "saving" | "error";

type BarProps = {
  /** Coach's name when an admin edits someone else's page. */
  ownerName: string | null;
  mode: "edit" | "live";
  onMode: (mode: "edit" | "live") => void;
  save: LandingSaveState;
  error: string | null;
  hasChanges: boolean;
  onReset: () => void;
  doneHref: string;
};

/** Floating bar at the bottom of the landing page while the coach edits it. */
export function LandingEditBar({
  ownerName,
  mode,
  onMode,
  save,
  error,
  hasChanges,
  onReset,
  doneHref,
}: BarProps) {
  const segClass = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      on ? "bg-white text-[#031a2e]" : "text-white/75 hover:text-white"
    }`;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {error ? (
        <p
          role="alert"
          className="pointer-events-auto rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 shadow-lg"
        >
          {error}
        </p>
      ) : null}
      <div
        role="toolbar"
        aria-label="Edit your landing page"
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-white/15 bg-[#031a2e]/90 px-3 py-2 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md sm:rounded-full"
      >
        <span className="flex items-center gap-2 pl-1 text-sm text-white/80" aria-live="polite">
          <i
            aria-hidden
            className={`size-2 rounded-full ${
              save === "saving" ? "bg-amber-300" : save === "error" ? "bg-rose-400" : "bg-emerald-400"
            }`}
          />
          {ownerName ? `${ownerName}'s page · ` : ""}
          {save === "saving" ? "Saving…" : save === "error" ? "Not saved" : "Saved"}
        </span>
        <span className="flex rounded-full bg-white/10 p-0.5">
          <button type="button" aria-pressed={mode === "edit"} onClick={() => onMode("edit")} className={segClass(mode === "edit")}>
            Edit
          </button>
          <button type="button" aria-pressed={mode === "live"} onClick={() => onMode("live")} className={segClass(mode === "live")}>
            Live view
          </button>
        </span>
        {hasChanges ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full px-2 py-1 text-sm font-medium text-white/75 hover:text-white"
          >
            Use BCA wording
          </button>
        ) : null}
        <Link
          href={doneHref}
          className="rounded-full bg-[#30a8ee] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1f97dd]"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
