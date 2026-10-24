"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Search } from "lucide-react";
import { openLostSearch } from "@/lib/search/overlay";
import { sanitizeLoginReturnPath } from "@/lib/auth/loginReturnPath";
import { EmptyBossWheel } from "./EmptyBossWheel";

/**
 * A missing page inside the app: the sidebar and top bar stay, and search
 * opens straight away to help find the page. This is what's left behind if
 * they close it.
 */
export function InAppNotFound({ prefix }: { prefix: "/coach" | "/admin" }) {
  const pathname = usePathname() ?? "";
  // Members sent here from a missing page outside the app carry it in ?from=.
  const from = sanitizeLoginReturnPath(useSearchParams().get("from")) ?? pathname;

  // A frame later, so the layout's search overlay is listening.
  useEffect(() => {
    const frame = requestAnimationFrame(() => openLostSearch(from));
    return () => cancelAnimationFrame(frame);
  }, [from]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center">
      <EmptyBossWheel className="w-40" />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">
        That page isn’t here
      </h1>
      <p className="mt-3 max-w-md text-lg leading-relaxed text-slate-700">
        The link may be old, or the page has moved. Search for it, or head to Community.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => openLostSearch(from)}
          className="inline-flex items-center gap-2 rounded-full bg-[#0c5290] px-5 py-2.5 text-base font-semibold text-white transition hover:bg-[#0a4274] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          Search
        </button>
        <Link
          href={`${prefix}/community`}
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-base font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        >
          Go to Community
        </Link>
      </div>
    </div>
  );
}
