"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { ProfitCoachTopMenu } from "@/components/marketing/ProfitCoachTopMenu";

type SecondaryNav = { href: string; label: string };

type Props = {
  backHref: string;
  backLabel: string;
  secondaryNav?: SecondaryNav;
  children: ReactNode;
};

/**
 * Blog-style chrome for individual playbook pages (site header + narrow article column).
 */
export function PlaybookBlogShell({ backHref, backLabel, secondaryNav, children }: Props) {
  return (
    <div className="min-h-screen bg-[#fbfbfa] text-slate-900">
      <ProfitCoachTopMenu />
      <div className="mx-auto max-w-4xl px-6 pb-28 pt-8 md:px-8 md:pb-36 md:pt-10">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link
            href={backHref}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← {backLabel}
          </Link>
          {secondaryNav ? (
            <Link
              href={secondaryNav.href}
              className="text-sm font-medium text-slate-500 transition hover:text-[#0c5290]"
            >
              {secondaryNav.label}
            </Link>
          ) : null}
        </div>
        <div className="mt-8 md:mt-10">{children}</div>
      </div>
    </div>
  );
}
