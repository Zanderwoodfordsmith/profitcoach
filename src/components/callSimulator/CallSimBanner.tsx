"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { PROSPECTS } from "@/lib/callSimulator/prospects";
import "@/components/academy/classroomSystemBanner.css";

/**
 * Under the script cards: the Call simulator's way in. Built like
 * Classroom's Portfolio System bar (mist copy, picture on the right), with
 * the owners' faces in the navy room where Classroom has its map.
 */
export function CallSimBanner() {
  const pathname = usePathname() ?? "";
  const onAdmin = pathname.startsWith("/admin");
  const prefix = onAdmin ? "/admin" : "/coach";
  // The middle face is largest, the others step down and fade either side.
  const order = [PROSPECTS[4], PROSPECTS[2], PROSPECTS[0], PROSPECTS[3], PROSPECTS[5]].filter(Boolean);

  return (
    <Link
      href={`${prefix}/script/simulator`}
      className="classroom-system-banner group mt-6 flex flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.24),0_8px_18px_rgba(15,23,42,0.1),0_0_0_1px_rgba(12,82,144,0.12),0_0_22px_rgba(12,82,144,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="classroom-system-banner__preview !bg-[radial-gradient(120%_90%_at_50%_100%,#0c5290_0%,#051e36_62%)]">
        <div className="absolute inset-0 flex items-center justify-center gap-[3%] px-[6%]">
          {order.map((p, i) => {
            const far = Math.abs(i - 2);
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.face}
                alt=""
                loading="lazy"
                className="aspect-square rounded-full object-cover shadow-[0_0_40px_rgba(122,184,240,0.35)] transition duration-500 group-hover:scale-[1.04]"
                style={{
                  width: far === 0 ? "26%" : far === 1 ? "17%" : "12%",
                  opacity: far === 0 ? 1 : far === 1 ? 0.8 : 0.5,
                  filter: far === 0 ? "none" : `blur(${far}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="classroom-system-banner__copy classroom-system-banner__copy--mist flex flex-col justify-center p-5 sm:p-6">
        <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-900">
          Call simulator
        </h2>
        <p className="mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-slate-600">
          Practise these calls out loud with AI owners, from a cold call to the close. Pick the objections to face, start at any part, and get a score with notes on every line.
        </p>
        <span className="classroom-system-banner__button mt-4 inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0c5290] shadow-sm transition group-hover:bg-sky-50">
          Start practising
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
