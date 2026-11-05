"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";

import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { expandCommunityCalendar } from "@/lib/communityCalendarExpand";
import { loadCommunityCalendarData } from "@/lib/communityCalendarData";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";

function calendarHrefFromCommunity(href: string): string {
  const path = href.split("?")[0] ?? href;
  return `${path}/calendar`;
}

function formatCallWhen(start: DateTime, zone: string): string {
  const now = DateTime.now().setZone(zone);
  const time = start.toFormat(start.minute === 0 ? "ha" : "h:mma").toLowerCase();
  if (start.hasSame(now, "day")) return `today, ${time}`;
  return `${start.toFormat("ccc d LLL")}, ${time}`;
}

function NextCallLine({ calendarHref, align = "center" }: { calendarHref: string; align?: "center" | "start" }) {
  const [when, setWhen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const zone = defaultCommunityCalendarTimezone();
    void (async () => {
      let events;
      let exceptions;
      try {
        ({ events, exceptions } = await loadCommunityCalendarData());
      } catch {
        return;
      }
      if (cancelled) return;
      const start = DateTime.now().setZone(zone).startOf("day");
      const occurrences = expandCommunityCalendar(
        events,
        start,
        start.plus({ days: 21 }).endOf("day"),
        exceptions
      );
      const nowMs = Date.now();
      const next = occurrences.find((occurrence) => {
        if (occurrence.isCancelled) return false;
        return new Date(occurrence.startsAtIso).getTime() > nowMs;
      });
      if (!next || cancelled) return;
      const when = formatCallWhen(
        DateTime.fromISO(next.startsAtIso, { zone: "utc" }).setZone(zone),
        zone
      );
      setWhen(when);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!when) return null;
  return (
    <div className={`mt-6 flex ${align === "start" ? "justify-start" : "justify-center"}`}>
      <Link
        href={calendarHref}
        className="inline-flex items-center rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        Next support call · {when}
      </Link>
    </div>
  );
}

/** Support's welcome (Zander loved it): the greeting, New chat, and who answers. */
export function SupportWelcome({
  firstName,
  communityHref,
  onNewChat,
}: {
  firstName: string | null;
  communityHref: string;
  onNewChat: () => void;
}) {
  const name = firstName?.trim() || null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-xl text-center">
        <h2 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          {name ? `Hi, ${name}` : "Hi"}
        </h2>
        <p className="mt-4 text-xl leading-snug text-slate-600">
          How can we help? Zander, Pam, and the other coaches are ready.
          No silly questions. Always ask.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onNewChat} className={buttonClass("main")}>
            <Plus className="h-5 w-5" aria-hidden />
            New chat
          </button>
          <Link href={communityHref} className={buttonClass("second")}>
            Post in community
          </Link>
        </div>
        <ul className="mt-10 space-y-4 text-left">
          <li className={cardClass("soft", "flex items-center gap-4 p-4")}>
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200">
              <img
                src="/support/zander.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-slate-900">
                Zander
              </span>
              <span className="mt-1 block text-base leading-snug text-slate-600">
                The app. Setup, bugs, and how things work in here.
              </span>
            </span>
          </li>
          <li className={cardClass("soft", "flex items-center gap-4 p-4")}>
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200">
              <img
                src="/pam/pam-portrait.jpg"
                alt=""
                className="h-full w-full origin-top scale-[1.45] object-cover object-[center_18%]"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-slate-900">
                Pam
              </span>
              <span className="mt-1 block text-base leading-snug text-slate-600">
                Coaching. Sessions, the method, and what to say to a client.
              </span>
            </span>
          </li>
        </ul>
        <p className="mt-5 text-base leading-snug text-slate-600">
          Don&apos;t worry who to ask. Just ask. We&apos;ll send it to the right
          person.
          <span className="block">
            We aim to reply within 2 business days.
          </span>
        </p>
        <NextCallLine calendarHref={calendarHrefFromCommunity(communityHref)} />
      </div>
    </div>
  );
}
