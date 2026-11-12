"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Which Overview to show: the checklist unless ?v=timeline (6 Nov 2026, until Zander picks one). */
export function blueprintVersion(v: string | null): "checklist" | "timeline" {
  return v === "timeline" ? "timeline" : "checklist";
}

const VERSIONS = [
  ["checklist", "Checklist"],
  ["timeline", "Timeline"],
] as const;

/**
 * Checklist | Timeline in the top bar, left of search, on the Blueprint Overview only.
 * Admins only: the top bar renders it for admins. Remove it, and the version that loses, once he picks.
 */
export function BlueprintVersionSwitch() {
  const pathname = usePathname();
  const params = useSearchParams();
  if (!pathname || !/^\/coach\/blueprint\/?$/.test(pathname)) return null;
  const current = blueprintVersion(params.get("v"));
  const hrefFor = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("v", v);
    return `${pathname}?${next.toString()}`;
  };
  return (
    <div role="group" aria-label="Blueprint overview version (admin)" className="mr-1 flex shrink-0 items-center rounded-md border border-slate-200 p-0.5 text-[13px]">
      {VERSIONS.map(([v, label]) => (
        <Link
          key={v}
          href={hrefFor(v)}
          scroll={false}
          aria-current={current === v ? "page" : undefined}
          className={
            current === v
              ? "rounded px-2 py-0.5 font-medium text-slate-900 bg-slate-100"
              : "rounded px-2 py-0.5 text-slate-500 hover:text-slate-900"
          }
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
