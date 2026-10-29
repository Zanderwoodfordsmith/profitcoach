"use client";

import type { ReactNode } from "react";
import { cardClass } from "@/components/ui/Card";
import { RULEBOOK, type CoachDrafts as CoachDraftsData, type DraftPart } from "@/app/admin/plan/drafts/types";

/**
 * A coach's done-for-you drafts (LinkedIn profile and messages) for Zander to
 * check, shown on the coach's Getting live tab. Nothing here has gone to the
 * coach or LinkedIn.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-lg font-medium text-slate-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Message({ label, text }: { label?: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      {label ? <p className="mb-1 text-sm font-medium text-slate-500">{label}</p> : null}
      <p className="whitespace-pre-line text-base text-slate-900">{text}</p>
    </div>
  );
}

function Why({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">Why: {children}</p>;
}

function Part({ title, part }: { title: string; part: DraftPart }) {
  return (
    <div className={cardClass("plain", "space-y-3 p-5")}>
      <p className="text-base font-medium text-slate-900">{title}</p>
      <Message text={part.draft} />
      <Why>{part.why}</Why>
      {part.now ? (
        <details>
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">What it says now</summary>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{part.now}</p>
        </details>
      ) : null}
    </div>
  );
}

export function CoachDrafts({ d }: { d: CoachDraftsData }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-medium text-slate-900">Drafts to check</h2>
        <p className="mt-1 text-sm text-slate-500">Nothing here has gone to the coach or LinkedIn. Tell me what you&apos;d change.</p>
      </div>

      <div className={cardClass("soft", "space-y-1 p-5")}>
        <p className="text-base text-slate-900">{d.positioning}</p>
        <p className="text-sm text-slate-600">Market: {d.market}</p>
        {d.proofUsed.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {d.proofUsed.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {d.unsure.length ? (
        <Section title="For you to decide">
          <ol className={cardClass("plain", "list-decimal space-y-2 p-5 pl-10 text-base text-slate-800")}>
            {d.unsure.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ol>
        </Section>
      ) : null}

      {d.gaps.length ? (
        <Section title="Gaps to fill">
          <ul className={cardClass("plain", "divide-y divide-slate-100")}>
            {d.gaps.map((g) => (
              <li key={g.gap} className="space-y-1 px-5 py-4">
                <p className="text-base font-medium text-slate-900">{g.gap}</p>
                <p className="text-base text-slate-600">Ask: {g.ask}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="LinkedIn profile">
        <Part title="Headline" part={d.linkedin.headline} />
        {d.linkedin.aboutStyled?.length ? (
          <>
            {d.linkedin.aboutStyled.map((v) => (
              <div key={v.label} className={cardClass("plain", "space-y-3 p-5")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-medium text-slate-900">About, {v.label}</p>
                  <p className="text-sm text-slate-500">{[...v.draft].length.toLocaleString("en-GB")} of 2,600 characters</p>
                </div>
                <Message text={v.draft} />
                <Why>{v.why}</Why>
              </div>
            ))}
            <details>
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">About, the earlier plain version</summary>
              <div className="mt-3">
                <Part title="About, plain" part={d.linkedin.about} />
              </div>
            </details>
          </>
        ) : (
          <Part title="About" part={d.linkedin.about} />
        )}
        <Part title="Featured" part={d.linkedin.featured} />
        <Part title="Current role" part={d.linkedin.experience} />
        {d.linkedin.banner ? <Part title="Banner" part={d.linkedin.banner} /> : null}
      </Section>

      <Section title="Connection note">
        <div className={cardClass("plain", "space-y-3 p-5")}>
          <Message label="A" text={d.connection.a.draft} />
          <Why>{d.connection.a.why}</Why>
          <Message label="B" text={d.connection.b.draft} />
          <Why>{d.connection.b.why}</Why>
        </div>
      </Section>

      <Section title="Follow-ups">
        {d.followUps.map((f) => (
          <div key={f.step} className={cardClass("plain", "space-y-3 p-5")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-medium text-slate-900">{f.step}</p>
              <p className="text-sm text-slate-500">{f.timing}</p>
            </div>
            <Message label={f.b ? "A" : undefined} text={f.a} />
            {f.b ? <Message label="B" text={f.b} /> : null}
            <Why>{f.why}</Why>
          </div>
        ))}
      </Section>

      <Section title="Open Profile message">
        <div className={cardClass("plain", "space-y-3 p-5")}>
          <Message text={d.openProfile.draft} />
          <Why>{d.openProfile.why}</Why>
        </div>
      </Section>

      <details>
        <summary className="cursor-pointer text-base font-medium text-slate-700 hover:text-slate-900">The rules these drafts follow</summary>
        <ul className={cardClass("plain", "mt-4 divide-y divide-slate-100")}>
          {RULEBOOK.map((r) => (
            <li key={r.rule} className="px-5 py-3">
              <p className="text-base text-slate-900">{r.rule}</p>
              <p className="text-sm text-slate-500">{r.source}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
