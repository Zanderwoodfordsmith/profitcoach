"use client";

import Link from "next/link";

import { commandCenter } from "@/lib/practiceKnowledge/blueprint";

import { usePractice } from "./PracticeProvider";

export function CommandCenter() {
  const { knowledge, href } = usePractice();
  if (!knowledge) return null;
  const model = commandCenter(knowledge);

  return (
    <article>
      <p className="text-[1.125rem] font-semibold leading-snug text-[#0f172a]">{model.lead}</p>
      <p className="mt-3 text-[1.0625rem] leading-[1.55] text-[#1e293b]">{model.detail}</p>
      <Link
        href={href(model.action.href)}
        className="mt-6 inline-flex rounded-lg bg-[#0c5290] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4478]"
      >
        {model.action.label}
      </Link>

      <dl className="mt-10 space-y-5 text-[1.0625rem] leading-[1.55]">
        <div>
          <dt className="font-semibold text-slate-950">Blueprint</dt>
          <dd className="text-slate-700">{model.completion}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Milestone</dt>
          <dd className="text-slate-700">{model.milestone}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">What BCA is building</dt>
          <dd className="text-slate-700">{model.building}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Upcoming call</dt>
          <dd className="text-slate-700">{model.call}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Latest recommendation</dt>
          <dd className="text-slate-700">{model.recommendation}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Current blocker</dt>
          <dd className="text-slate-700">{model.blocker}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Since you joined</dt>
          <dd className="text-slate-700">{model.progress.join(". ")}.</dd>
        </div>
      </dl>
    </article>
  );
}
