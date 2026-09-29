"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VIEWS = [
  { href: "/admin/blueprint/coach", label: "Coach view" },
  { href: "/admin/blueprint/records", label: "Coach records" },
  { href: "/admin/blueprint/map", label: "Map" },
];

/** The coach-facing pages, each coach's record, and the page map behind them. */
export function BlueprintAdminViews() {
  const pathname = usePathname();
  return (
    <nav aria-label="Blueprint views" className="inline-flex self-start rounded-full bg-slate-100 p-1 text-sm">
      {VIEWS.map((view) => {
        const active = pathname === view.href || Boolean(pathname?.startsWith(`${view.href}/`));
        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 font-medium ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
