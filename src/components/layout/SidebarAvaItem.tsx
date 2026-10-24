"use client";

import Link from "next/link";

import { AvaHalo } from "@/components/ava/AvaHalo";

/**
 * Ava at the top of the sidebar, opening her own page. The same item in the
 * coach and admin sidebars. Admin-only until she opens to coaches.
 */
export function SidebarAvaItem({
  collapsed,
  isAdmin,
  href,
  active,
  linkClass,
}: {
  collapsed: boolean;
  isAdmin: boolean;
  href: string;
  active: boolean;
  linkClass: (active: boolean) => string;
}) {
  if (!isAdmin) return null;
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        data-hint-label="Ava"
        data-hint-description="Ask Ava to find prospects, write messages or run a campaign"
        className={linkClass(active)}
      >
        <AvaHalo size={22} dark state={active ? "listening" : "idle"} className="shrink-0" />
        {collapsed ? <span className="sr-only">Ava</span> : "Ava"}
      </Link>
    </li>
  );
}
