"use client";

import Link from "next/link";
import { Briefcase, FileText, Play, UserRound, type LucideIcon } from "lucide-react";
import { cardClass } from "@/components/ui/Card";
import { formatCommunityRelativeActivityAgo } from "@/lib/communityRelativeTime";
import type { RecentVisit, RecentVisitKind } from "@/lib/search/recentVisits";

export const RECENT_KIND: Record<RecentVisitKind, { label: string; icon: LucideIcon }> = {
  lesson: { label: "Lesson", icon: Play },
  resource: { label: "Resource", icon: FileText },
  prospect: { label: "Prospect", icon: UserRound },
  client: { label: "Client", icon: Briefcase },
};

export function recentVisitMeta(visit: RecentVisit): string {
  const { label } = RECENT_KIND[visit.kind];
  return visit.detail ? `${label} · ${visit.detail}` : label;
}

/** Icon square for recent and result rows; tinted, not filled, so it sits on white or glass. */
export function SearchIconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900/[0.05] transition group-hover:bg-sky-500/10 group-aria-selected:bg-sky-500/10">
      <Icon
        className="h-5 w-5 text-slate-500 transition group-hover:text-sky-700 group-aria-selected:text-sky-700"
        strokeWidth={1.75}
      />
    </span>
  );
}

/** "Recently opened" on the full search page when the box is empty. */
export function SearchRecentList({ recent }: { recent: RecentVisit[] }) {
  return (
    <section aria-labelledby="search-recent-heading" className="search-fade-in">
      <h2
        id="search-recent-heading"
        className="px-1 text-sm font-semibold text-slate-600"
      >
        Recently opened
      </h2>
      <ul className={cardClass("plain", "mt-3 divide-y divide-slate-100 overflow-hidden")}>
        {recent.map((visit) => (
          <li key={visit.href}>
            <Link
              href={visit.href}
              className="group flex items-center gap-3.5 px-4 py-3 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <SearchIconTile icon={RECENT_KIND[visit.kind].icon} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-slate-900">
                  {visit.title}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {recentVisitMeta(visit)}
                </span>
              </span>
              <span className="hidden shrink-0 text-sm tabular-nums text-slate-500 sm:block">
                {formatCommunityRelativeActivityAgo(visit.at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
