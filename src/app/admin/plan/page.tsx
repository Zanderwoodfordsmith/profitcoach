"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { StickyPageHeader } from "@/components/layout";
import { useRequireAdminRole } from "@/hooks/useRequireAdminRole";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import {
  ASKS,
  BOSS_SCORE_NOTE,
  BUGLASS_CAMPAIGN,
  CHANGES,
  COACHES,
  CURRENT_TEMPLATE,
  PLAN_DATE,
  OPEN_PROFILE_TEMPLATE,
  RECOMMENDED_TEMPLATE,
  SOURCES,
  STAGE_TONE,
  STILL_A_GUESS,
  THE_PLAN,
  WE_KNOW,
  YOUR_DECISION,
  type TemplateStep,
} from "./planData";
import { COACH_DRAFTS } from "./drafts";

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-xl font-medium text-slate-900">{children}</h2>;
}

function TemplateColumn({
  name,
  note,
  steps,
  footer,
  tone,
  badge,
}: {
  name: string;
  note: string;
  steps: TemplateStep[];
  footer?: string;
  tone: "grey" | "green";
  badge?: string;
}) {
  return (
    <div className={cardClass("plain", "p-4 sm:p-5")}>
      <div className="mb-1 flex items-center gap-2">
        <span className={badgeClass(tone)}>{badge ?? (tone === "green" ? "Recommended" : "Now")}</span>
        <span className="font-medium text-slate-900">{name}</span>
      </div>
      <p className="mb-4 text-sm text-slate-500">{note}</p>
      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.step}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium text-slate-900">{s.step}</span>
              {s.timing ? <span className="text-caption text-slate-500">{s.timing}</span> : null}
            </div>
            <div className="mt-1 space-y-2">
              {s.wordings.map((w, i) => (
                <p key={i} className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {s.wordings.length > 1 ? <span className="mr-1 font-medium text-slate-500">{String.fromCharCode(65 + i)}.</span> : null}
                  {w}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {footer ? <p className="mt-4 text-sm text-slate-600">{footer}</p> : null}
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return empty ? <p className="text-sm text-slate-400">{empty}</p> : null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

export default function AdminPlanPage() {
  useRequireAdminRole("/coach");

  return (
    <div className="flex w-full min-w-0 flex-col">
      <StickyPageHeader
        title="Done-for-you plan"
        description={`What we recommend for getting coaches live, as of ${PLAN_DATE}.`}
        actions={
          <Link href="/admin?view=getting-live" className={buttonClass("second", "small")}>
            Getting live
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8">
        <section>
          <SectionTitle>What we know</SectionTitle>
          <div className="space-y-3">
            {WE_KNOW.map((k, i) => (
              <div key={k.title} className={cardClass("plain", "p-5")}>
                <p className="text-lg font-medium text-slate-900">
                  {i + 1}. {k.title}
                </p>
                <p className="mt-1 text-base text-slate-600">{k.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-base text-slate-700">
            <span className="font-medium text-slate-900">Still a guess: </span>
            {STILL_A_GUESS}
          </p>
        </section>

        <section>
          <SectionTitle>The plan</SectionTitle>
          <ol className={cardClass("soft", "list-decimal space-y-3 p-5 pl-10 text-base text-slate-800")}>
            {THE_PLAN.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </section>

        <section>
          <SectionTitle>Next, coach by coach</SectionTitle>
          <ul className={cardClass("plain", "divide-y divide-slate-100")}>
            {COACHES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/admin/coaches/${c.slug}?tab=getting-live&from=getting-live`}
                  className="flex flex-col gap-1 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="shrink-0 text-base font-medium text-slate-900 sm:w-44">{c.name}</span>
                  <span className="text-base text-slate-700">
                    {COACH_DRAFTS[c.slug] ? <span className="font-medium text-sky-700">Drafts ready to check. </span> : null}
                    {c.next}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle>Your decision</SectionTitle>
          <p className={cardClass("soft", "p-5 text-lg text-slate-900")}>{YOUR_DECISION}</p>
        </section>

        <details className="group">
          <summary className="cursor-pointer text-base font-medium text-slate-700 hover:text-slate-900">
            The detail behind this: templates, every change and why, each coach&apos;s gaps
          </summary>
          <div className="mt-6 space-y-10">
        <section>
          <SectionTitle>About the BOSS Score</SectionTitle>
          <div className={cardClass("plain", "p-4 sm:p-5")}>
            <p className="text-sm text-slate-700">{BOSS_SCORE_NOTE.text}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {BOSS_SCORE_NOTE.numbers.map((n) => (
                <div key={n.label} className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-caption text-slate-500">{n.label}</dt>
                  <dd className="text-sm font-medium text-slate-900">{n.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section>
          <SectionTitle>Recommended template against what coaches get now</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <TemplateColumn {...CURRENT_TEMPLATE} tone="grey" />
            <TemplateColumn {...RECOMMENDED_TEMPLATE} tone="green" />
          </div>
          <div className="mt-4 lg:w-1/2 lg:pl-2 lg:ml-auto">
            <TemplateColumn {...OPEN_PROFILE_TEMPLATE} tone="green" badge="Open Profiles" />
          </div>

          <h3 className="mb-3 mt-8 font-medium text-slate-900">What changes and why</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {CHANGES.map((c) => (
              <div key={c.from} className={cardClass("plain", "p-4")}>
                <p className="text-sm text-slate-500 line-through decoration-slate-300">{c.from}</p>
                <p className="mt-0.5 font-medium text-slate-900">{c.to}</p>
                <p className="mt-2 text-sm text-slate-700">{c.why}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.evidence.map((e) => (
                    <span key={e} className={badgeClass(e === "Our data" ? "blue" : "grey")}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-caption text-slate-500">Where this comes from: {SOURCES}</p>
        </section>

        <section>
          <SectionTitle>Peter Buglass&apos;s campaign is closest</SectionTitle>
          <div className={cardClass("plain", "p-4 sm:p-5")}>
            <p className="text-sm text-slate-700">{BUGLASS_CAMPAIGN.intro}</p>
            <p className="mb-1 mt-3 text-sm font-medium text-slate-900">Fixes before turning it on</p>
            <List items={BUGLASS_CAMPAIGN.fixes} />
          </div>
        </section>

        <section>
          <SectionTitle>Coach by coach: what&apos;s missing</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {COACHES.map((c) => (
              <div key={c.slug} className={cardClass("plain", "flex flex-col p-4 sm:p-5")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {c.stage ? <span className={badgeClass(STAGE_TONE[c.stage])}>{c.stage}</span> : null}
                    {c.waitsOn ? <span className={badgeClass("grey")}>Waits on {c.waitsOn}</span> : null}
                  </span>
                </div>
                {c.have.length || c.missing.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-caption font-medium uppercase tracking-wide text-slate-500">Have</p>
                      <List items={c.have} empty="Nothing yet" />
                    </div>
                    <div>
                      <p className="mb-1 text-caption font-medium uppercase tracking-wide text-slate-500">Missing</p>
                      <List items={c.missing} empty="Nothing" />
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-slate-900">
                  <span className="font-medium">Next: </span>
                  {c.next}
                </p>
                <div className="mt-auto pt-3">
                  <Link href={`/admin/coaches/${c.slug}?tab=getting-live&from=getting-live`} className={buttonClass("quiet", "small")}>
                    Open Getting live
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>What I need from you</SectionTitle>
          <ol className={cardClass("soft", "list-decimal space-y-2 p-4 pl-9 text-sm text-slate-800 sm:p-5 sm:pl-10")}>
            {ASKS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </section>
          </div>
        </details>
      </div>
    </div>
  );
}
