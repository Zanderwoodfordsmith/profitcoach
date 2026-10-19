"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { openSearchOverlay } from "@/lib/search/overlay";
import { SEARCH_INPUT_ID } from "@/lib/search/types";

type SearchTopBarTriggerProps = {
  className?: string;
};

/** Opens the search overlay; on the results page it puts the cursor back in the box. */
export function SearchTopBarTrigger({ className = "" }: SearchTopBarTriggerProps) {
  const pathname = usePathname();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const onSearchPage = pathname === `${prefix}/search`;

  return (
    <button
      type="button"
      aria-label="Search"
      title="Search (Ctrl or ⌘ K)"
      aria-current={onSearchPage ? "page" : undefined}
      onClick={() =>
        onSearchPage
          ? document.getElementById(SEARCH_INPUT_ID)?.focus()
          : openSearchOverlay()
      }
      className={`rounded-full p-2 transition ${
        onSearchPage
          ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      } ${className}`}
    >
      <Search className="h-6 w-6" strokeWidth={1.75} />
    </button>
  );
}
