"use client";

import { PencilLine } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { callPagesLive } from "@/lib/callPage/live";
import { coachBookPath } from "@/lib/shareLinks/bookUrl";

/**
 * Edit buttons for one booking calendar: its booking page and, for the Constraint Call
 * (discovery), the full call page too. Each opens in a new tab, ready to edit in place.
 * Used on the calendar rows in Calls → Booking pages and Toolkit → Links.
 */
export function CalendarPageButtons({
  coachSlug,
  calendarSlug,
  calendarName,
}: {
  coachSlug: string;
  calendarSlug: string;
  calendarName: string;
}) {
  const slug = coachSlug.trim();
  if (!slug) return null;
  const pages = [
    ...(calendarSlug === "discovery" && callPagesLive()
      ? [
          {
            key: "call",
            label: "Call page",
            href: `/call/${encodeURIComponent(slug)}`,
            aria: `Edit the ${calendarName} page`,
            title: "Opens the full page about this call. Change the words right on it.",
          },
        ]
      : []),
    {
      key: "book",
      label: "Booking page",
      href: coachBookPath(slug, calendarSlug),
      aria: `Edit the ${calendarName} booking page`,
      title: "Opens the booking page. Change the words right on it.",
    },
  ];

  return (
    <span className="inline-flex items-center gap-1.5">
      {pages.map((page) => (
        <a
          key={page.key}
          href={page.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={page.aria}
          title={page.title}
          className={buttonClass("second", "small", "whitespace-nowrap")}
        >
          <PencilLine className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} aria-hidden />
          {page.label}
        </a>
      ))}
    </span>
  );
}
