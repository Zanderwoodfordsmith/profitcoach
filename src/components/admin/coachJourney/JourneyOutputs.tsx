"use client";

import Link from "next/link";

import { BUILD_STATUS_LABEL } from "@/lib/activation/coachJourney";
import { COACH_OUTPUT_GROUPS } from "@/lib/activation/coachOutputs";

import { STATUS_DOT } from "./JourneyTable";

/**
 * What every coach gets live, and where each piece comes from (28 Nov,
 * Zander: "put our output list somewhere with links to the relevant
 * artifacts"). One row per output: template, skill, page, what's still open.
 */
export function JourneyOutputs() {
  const cols = "grid-cols-[minmax(220px,1.2fr)_minmax(120px,0.55fr)_minmax(90px,0.4fr)_minmax(220px,1fr)_minmax(220px,1fr)]";
  return (
    <div className="rounded-lg border border-slate-200 bg-white max-lg:overflow-x-auto">
      <div className="min-w-[1000px]">
        <div className={`grid ${cols} border-b border-slate-200 text-sm font-semibold text-slate-900`}>
          <div className="px-3 py-2.5">Output</div>
          <div className="px-3 py-2.5">How custom</div>
          <div className="px-3 py-2.5">Coach checks</div>
          <div className="px-3 py-2.5">Made from</div>
          <div className="px-3 py-2.5">Still open</div>
        </div>
        {COACH_OUTPUT_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">{group.name}</h3>
            {group.outputs.map((o) => (
              <div key={o.id} className={`grid ${cols} border-b border-slate-100`}>
                <div className="flex items-start gap-2 px-3 py-3">
                  <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[o.status]}`} title={BUILD_STATUS_LABEL[o.status]}>
                    <span className="sr-only">{BUILD_STATUS_LABEL[o.status]}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{o.name}</p>
                    <p className="mt-0.5 text-sm leading-snug text-slate-600">{o.what}</p>
                    {o.inLaunchChain ? <p className="mt-1 text-xs text-slate-500">Ava drafts it at launch</p> : null}
                  </div>
                </div>
                <div className="px-3 py-3 text-sm text-slate-700">{o.custom}</div>
                <div className="px-3 py-3 text-sm text-slate-700">{o.coachChecks ? "Yes" : "No"}</div>
                <div className="flex flex-col gap-1 px-3 py-3 text-sm">
                  {o.templates.map((t) => (
                    <Link key={t.href} href={t.href} className="text-[#0C5290] underline-offset-2 hover:underline">
                      Template: {t.label}
                    </Link>
                  ))}
                  {o.pages.map((p) => (
                    <Link key={p.href} href={p.href} className="text-[#0C5290] underline-offset-2 hover:underline">
                      {p.label}
                    </Link>
                  ))}
                  {o.skills.map((s) => (
                    <span key={s} className="break-all text-xs text-slate-500" title="Skill file in the repo">
                      {s}
                    </span>
                  ))}
                  {!o.templates.length && !o.pages.length && !o.skills.length ? (
                    <span className="text-slate-500">{o.status === "live" ? "Built into the app" : "Nothing yet"}</span>
                  ) : null}
                </div>
                <div className="px-3 py-3 text-sm leading-snug text-slate-700">{o.open ?? <span className="text-slate-400">Decided</span>}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
