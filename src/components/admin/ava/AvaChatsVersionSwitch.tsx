"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type ChatsVersion = "table" | "list";

/** Which Chats layout to show: the table unless ?v=list (16 Nov 2026, until Zander picks one). */
export function chatsVersion(v: string | null): ChatsVersion {
  return v === "list" ? "list" : "table";
}

const VERSIONS = [
  ["table", "Table"],
  ["list", "List"],
] as const;

/**
 * Table | List in the top bar, left of search, on Admin → Ava → Chats only.
 * Admins only: the top bar renders it for admins. Remove it, and the layout that loses, once he picks.
 */
export function AvaChatsVersionSwitch() {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname !== "/admin/ava" || params.get("tab") !== "chats") return null;
  const current = chatsVersion(params.get("v"));
  const hrefFor = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("v", v);
    return `${pathname}?${next.toString()}`;
  };
  return (
    <div role="group" aria-label="Chats layout (admin)" className="mr-1 flex shrink-0 items-center rounded-md border border-slate-200 p-0.5 text-[13px]">
      {VERSIONS.map(([v, label]) => (
        <Link
          key={v}
          href={hrefFor(v)}
          scroll={false}
          aria-current={current === v ? "page" : undefined}
          className={current === v ? "rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-900" : "rounded px-2 py-0.5 text-slate-500 hover:text-slate-900"}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
