"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarClock, Gauge, Lock, Map, MessageCircleQuestion, PhoneIncoming, Send, type LucideIcon } from "lucide-react";

import { CallSimBanner } from "@/components/callSimulator/CallSimBanner";
import { cardClass } from "@/components/ui/Card";
import { SCRIPTS, type ScriptCard } from "@/lib/salesCall/library";

const ICONS: Record<ScriptCard["icon"], LucideIcon> = {
  send: Send,
  phone: PhoneIncoming,
  gauge: Gauge,
  map: Map,
  calendar: CalendarClock,
  message: MessageCircleQuestion,
};

/**
 * Get Clients → Scripts: one card per script, in call order, built like the
 * Classroom and Vault course cards (cover, eyebrow, title, two lines), with
 * the text a size up for older eyes and a grey "Open" bar where
 * Classroom has its progress bar. ?v=1 shows the first version, with icons.
 */
export function ScriptsOverview() {
  const prefix = usePathname()?.startsWith("/admin") ? "/admin" : "/coach";
  if (useSearchParams().get("v") === "1") return <ScriptsOverviewV1 />;
  return (
    <div className="mx-auto w-[80%] max-w-6xl pt-11">
      <ul className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-y-8">
        {SCRIPTS.map((s) => (
          <li key={s.id}>
            <Link
              href={`${prefix}/script/${s.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.24),0_8px_18px_rgba(15,23,42,0.1),0_0_0_1px_rgba(12,82,144,0.12),0_0_22px_rgba(12,82,144,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.cover} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-kicker font-semibold uppercase" style={{ color: s.eyebrowColour }}>
                  {s.eyebrow}
                </p>
                <h2 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-slate-900">{s.title}</h2>
                <p className="mt-1.5 text-read leading-relaxed text-slate-600">{s.blurb}</p>
                <div className="mt-auto pt-4">
                  {/* On hover, the sidebar's selected blue (SIDEBAR_NAV_ACTIVE). */}
                  <span className="box-border flex h-[29px] w-full items-center justify-center gap-1.5 rounded-full border border-slate-300/50 bg-slate-200/90 text-xs font-semibold text-slate-600 transition group-hover:border-transparent group-hover:bg-[linear-gradient(155deg,#0a6fa8_0%,#1aa3e0_100%)] group-hover:text-white">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <CallSimBanner />
      {prefix === "/admin" ? (
        <Link
          href="/admin/script/levers"
          className={cardClass("raised", "group mt-6 flex items-center justify-between gap-4 px-5 py-4 transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400")}
        >
          <span>
            <span className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-slate-900">
              Your levers
              <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="Admin only" />
            </span>
            <span className="mt-0.5 block text-sm text-slate-600">How many messages one client takes, and what each script is worth.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#0c5290] transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** The first version (22 Oct): full width, icon covers. Kept for comparison. */
function ScriptsOverviewV1() {
  const prefix = usePathname()?.startsWith("/admin") ? "/admin" : "/coach";
  return (
    <div className="space-y-6 py-2">
      <p className="max-w-2xl text-read leading-relaxed text-slate-600">
        Every conversation with an owner, in order. Reach out or call a new lead to book a BOSS Score Review. The review gives real value. The Profit Roadmap call is where they decide.
      </p>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {SCRIPTS.map((s) => {
          const Icon = ICONS[s.icon];
          const count = s.parts?.length;
          return (
            <li key={s.id}>
              <Link
                href={`${prefix}/script/${s.id}`}
                className={cardClass("raised", "group flex h-full flex-col overflow-hidden transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2")}
              >
                <div className="relative flex aspect-[16/7] flex-col justify-between p-5" style={{ backgroundColor: s.colour }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
                    <Icon className="h-6 w-6 text-white" aria-hidden />
                  </span>
                  <div>
                    <p className="text-kicker font-light uppercase text-white/80">{s.eyebrow}</p>
                    <p className="mt-1 text-lg font-semibold leading-snug tracking-tight text-white">{s.title}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="text-base leading-relaxed text-slate-600">{s.summary}</p>
                  <p className="mt-auto pt-3 text-xs text-slate-500">{count ? `${count} parts` : "Live call screen"}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
