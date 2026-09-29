"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { BLUEPRINT_SECTIONS, commandCenter } from "@/lib/practiceKnowledge/blueprint";

import { BuildBar, StillNeeded, useBlueprintProgress } from "./document/DocumentParts";
import { usePractice } from "./PracticeProvider";

function Stage({ label, value, detail, pct }: { label: string; value: string; detail: string; pct: number }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.8125rem] font-semibold text-[var(--bp-muted)]">{label}</p>
      <p className="bp-display bp-num mt-1 text-[1.75rem] font-medium leading-none text-[var(--bp-navy)]">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bp-tint-strong)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(pct > 0 ? 6 : 0, pct)}%`, background: "linear-gradient(90deg, #0c5290, #1a8fd4)" }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--bp-muted)]">{detail}</p>
    </div>
  );
}

export function CommandCenter() {
  const { knowledge, payload, href, setAssistantOpen } = usePractice();
  const progress = useBlueprintProgress();
  if (!knowledge || !payload || !progress) return null;
  const model = commandCenter(knowledge);
  const captureTotal = BLUEPRINT_SECTIONS.filter(
    (r) => r.section.source === "from_you" || r.section.source === "imported"
  ).length;
  const captured = captureTotal - progress.needed.length;
  const recent = Object.entries(knowledge.built_sections)
    .sort((a, b) => (b[1].generated_at || "").localeCompare(a[1].generated_at || ""))
    .slice(0, 4)
    .map(([key, built]) => ({ ref: BLUEPRINT_SECTIONS.find((r) => r.key === key), built }))
    .filter((r) => r.ref);

  return (
    <article className="space-y-10">
      <div>
        <p className="bp-display text-[1.75rem] font-medium leading-[1.2] tracking-[-0.02em] text-[var(--bp-navy)] @2xl:text-[2.125rem]">
          {model.lead}
        </p>
        <p className="mt-3 max-w-[60ch] text-[1.0625rem] leading-[1.6] text-[var(--bp-muted)]">{model.detail}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {progress.needed.length ? (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--bp-navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--bp-blue)]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Talk it through
            </button>
          ) : null}
          <Link
            href={href("/coach/practice/blueprint")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[var(--bp-ink)] ring-1 ring-[var(--bp-rule)] hover:ring-[var(--bp-sky)]"
          >
            Open your blueprint
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <section aria-label="Progress" className="grid gap-6 rounded-2xl border border-[var(--bp-rule)] px-6 py-6 @xl:grid-cols-3">
        <Stage
          label="Captured"
          value={`${captured} of ${captureTotal}`}
          detail="What we know about you and your practice."
          pct={(captured / Math.max(1, captureTotal)) * 100}
        />
        <Stage
          label="Written by BCA"
          value={`${progress.written} of ${progress.toWrite}`}
          detail="Avatar, pain points, messages, profile, offer and plan."
          pct={(progress.written / Math.max(1, progress.toWrite)) * 100}
        />
        <Stage
          label="Approved by you"
          value={`${progress.approved} of ${progress.reviewable}`}
          detail="Read each section and approve it, or tell us what is off."
          pct={(progress.approved / Math.max(1, progress.reviewable)) * 100}
        />
      </section>

      <StillNeeded />
      <BuildBar />

      {recent.length ? (
        <section>
          <h2 className="text-[1.0625rem] font-semibold text-[var(--bp-ink)]">Recently written</h2>
          <ul className="mt-3 divide-y divide-[var(--bp-rule)] border-y border-[var(--bp-rule)]">
            {recent.map(({ ref, built }) => (
              <li key={ref!.key}>
                <Link
                  href={`${href(ref!.page.href)}#s-${ref!.key.replace(":", "-")}`}
                  className="group flex items-center justify-between gap-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--bp-ink)] group-hover:text-[var(--bp-blue)]">
                      {ref!.section.title}
                    </span>
                    <span className="block text-sm text-[var(--bp-muted)]">{ref!.page.title}</span>
                  </span>
                  <span className="bp-num shrink-0 text-xs text-[var(--bp-faint)]">
                    {new Date(built.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="grid gap-x-8 gap-y-4 text-[0.9375rem] leading-[1.6] @xl:grid-cols-[minmax(8rem,12rem)_1fr]">
        <dt className="font-semibold text-[var(--bp-muted)]">Milestone</dt>
        <dd className="text-[var(--bp-ink)]">{model.milestone}</dd>
        <dt className="font-semibold text-[var(--bp-muted)]">What BCA is doing</dt>
        <dd className="text-[var(--bp-ink)]">{model.building}</dd>
        <dt className="font-semibold text-[var(--bp-muted)]">Decision Call</dt>
        <dd className="text-[var(--bp-ink)]">{model.call}</dd>
        <dt className="font-semibold text-[var(--bp-muted)]">Since you joined</dt>
        <dd className="text-[var(--bp-ink)]">{model.progress.join(". ")}.</dd>
      </dl>
    </article>
  );
}
