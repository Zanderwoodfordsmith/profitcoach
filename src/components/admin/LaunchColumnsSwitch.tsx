"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type LaunchColumns = "outputs" | "pages";

const KEY = "admin-launch-columns";
const EVENT = "launch-columns-change";

/** Which columns the Launch view shows: the agreed outputs (default, 28 Nov) or the Blueprint pages, until Zander picks. */
export function readLaunchColumns(): LaunchColumns {
  try {
    return window.localStorage.getItem(KEY) === "pages" ? "pages" : "outputs";
  } catch {
    return "outputs";
  }
}

/** The board listens so the switch in the top bar changes it straight away. */
export function useLaunchColumns(): LaunchColumns {
  const [cols, setCols] = useState<LaunchColumns>("outputs");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice once on the client
    setCols(readLaunchColumns());
    const on = () => setCols(readLaunchColumns());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return cols;
}

/** Selected option: solid bright blue with white text (house rule). */
const SWITCH_ON = "rounded bg-sky-600 px-2 py-0.5 font-medium text-white";
const SWITCH_OFF = "rounded px-2 py-0.5 text-slate-500 hover:text-slate-900";

/**
 * Outputs | Pages in the top bar, left of search, on Admin → Coaches → Launch only.
 * Admins only: the top bar renders it for admins. Remove it, and the columns that lose, once he picks.
 */
export function LaunchColumnsSwitch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = useLaunchColumns();
  if (pathname !== "/admin" || params.get("view") !== "launch") return null;
  const pick = (v: LaunchColumns) => {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* not remembered */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div role="group" aria-label="Launch columns (admin)" className="mr-1 flex shrink-0 items-center rounded-md border border-slate-200 p-0.5 text-xs">
      {(
        [
          ["outputs", "Outputs"],
          ["pages", "Pages"],
        ] as const
      ).map(([v, label]) => (
        <button key={v} type="button" onClick={() => pick(v)} aria-pressed={current === v} className={current === v ? SWITCH_ON : SWITCH_OFF}>
          {label}
        </button>
      ))}
    </div>
  );
}
