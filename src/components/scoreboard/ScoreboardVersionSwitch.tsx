"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Which Scoreboard to show: ?v=1 is the original, anything else V2 (5 Nov 2026, until Zander picks one). */
export function scoreboardVersion(v: string | null): 1 | 2 {
  return v === "1" ? 1 : 2;
}

/**
 * V1 | V2 in the top bar, left of search, on the Scoreboard only. Admins only: the top bar renders it for admins
 * who aren't viewing as a coach. Remove it, and the version that loses, once he picks.
 */
export function ScoreboardVersionSwitch() {
  const pathname = usePathname();
  const params = useSearchParams();
  if (!pathname || !/^\/(coach|admin)\/scoreboard(\/|$)/.test(pathname)) return null;
  const current = scoreboardVersion(params.get("v"));
  const hrefFor = (v: 1 | 2) => {
    const next = new URLSearchParams(params.toString());
    next.set("v", String(v));
    return `${pathname}?${next.toString()}`;
  };
  return (
    <div role="group" aria-label="Scoreboard version (admin)" className="mr-1 flex shrink-0 items-center rounded-md border border-slate-200 p-0.5 text-[13px]">
      {([1, 2] as const).map((v) => (
        <Link
          key={v}
          href={hrefFor(v)}
          aria-current={current === v ? "page" : undefined}
          className={
            current === v
              ? "rounded px-2 py-0.5 font-medium text-slate-900 bg-slate-100"
              : "rounded px-2 py-0.5 text-slate-500 hover:text-slate-900"
          }
        >
          V{v}
        </Link>
      ))}
    </div>
  );
}
