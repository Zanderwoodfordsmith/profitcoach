"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabBase =
  "-mb-px border-b-[3px] pb-2 text-base font-semibold leading-tight transition-colors";
const tabActive = "border-sky-600 text-sky-700";
const tabInactive =
  "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800";

export function CoachesHubTabs() {
  const pathname = usePathname();
  const onCoachesList =
    pathname === "/admin" || pathname === "/admin/";
  const onClientSuccess =
    pathname === "/admin/client-success" ||
    Boolean(pathname?.startsWith("/admin/client-success/"));

  return (
    <nav
      className="flex flex-wrap items-end gap-x-6 gap-y-1"
      aria-label="Coaches views"
    >
      <Link
        href="/admin"
        className={`${tabBase} ${onCoachesList ? tabActive : tabInactive}`}
      >
        Coaches
      </Link>
      <Link
        href="/admin/client-success"
        className={`${tabBase} ${onClientSuccess ? tabActive : tabInactive}`}
      >
        Client success
      </Link>
    </nav>
  );
}
