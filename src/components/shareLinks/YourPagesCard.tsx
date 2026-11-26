"use client";

import { useState } from "react";
import { Check, Copy, Gauge, PencilLine, Target, type LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { callPagesLive } from "@/lib/callPage/live";

type PageRow = {
  key: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  path: string;
};

/**
 * The coach's public pages in one place: open one to change its words on the page itself,
 * or copy its link. Shown in Win Clients → Calls → Booking pages and Get Calls → Toolkit → Links.
 * Each calendar's booking page is edited from its own row there (CalendarPageButtons).
 */
export function YourPagesCard({ slug, appOrigin }: { slug: string; appOrigin: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const s = encodeURIComponent(slug);
  const rows: PageRow[] = [
    ...(callPagesLive()
      ? [
          {
            key: "call",
            icon: Target,
            title: "Constraint Call page",
            detail: "Explains your first call, then books it. Ava can write it for you.",
            path: `/call/${s}`,
          },
        ]
      : []),
    {
      key: "score",
      icon: Gauge,
      title: "BOSS Score page",
      detail: "Where owners start your BOSS Score.",
      path: `/score/${s}`,
    },
  ];

  const origin = (appOrigin || (typeof window !== "undefined" ? window.location.origin : "")).replace(
    /\/$/,
    "",
  );

  async function copy(row: PageRow) {
    try {
      await navigator.clipboard.writeText(`${origin}${row.path}`);
      setCopied(row.key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className={cardClass("plain", "overflow-hidden")} aria-labelledby="your-pages-title">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 id="your-pages-title" className="text-sm font-semibold text-slate-900">
          Your pages
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Open a page to change the words right on it. Changes save as you go.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-ui font-medium text-slate-900">{row.title}</p>
                <p className="text-sm text-slate-500">{row.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={row.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("second", "small")}
                >
                  <PencilLine className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} aria-hidden />
                  Edit page
                </a>
                <button
                  type="button"
                  onClick={() => void copy(row)}
                  aria-label={copied === row.key ? `${row.title} link copied` : `Copy ${row.title} link`}
                  title={copied === row.key ? "Copied" : "Copy link"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  {copied === row.key ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
