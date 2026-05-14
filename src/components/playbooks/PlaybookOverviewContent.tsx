"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { PLAYBOOKS } from "@/lib/bossData";
import type { ActionItem, PlaybookContent } from "@/lib/playbookContentTypes";

import { areaHeroGradient } from "./PlaybookCard";

/** Match blog index / article rhythm (BlogContent + blog post pages). */
const PROSE =
  "font-sans text-[1.08rem] leading-[2rem] text-slate-800 md:text-[1.14rem] md:leading-[2.15rem]";
const SECTION_HEADING =
  "text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl";

/** Split text into [first sentence, rest] for bold first sentence. */
function splitFirstSentence(text: string): [string, string] {
  const match = text.match(/^([^.!?]+[.!?])\s*([\s\S]*)$/);
  return match ? [match[1], match[2].trimStart()] : [text, ""];
}

/** First sentence for hero dek (blog-style lead). */
function leadSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^([^.!?]+[.!?])/);
  return m ? m[1] : t.slice(0, 220).trim();
}

/** When the hero uses the same opening sentence, show the rest in the body only. */
function whatThisIsBody(full: string, leadFromContent: string): string {
  const t = full.trim();
  if (!t || !leadFromContent) return t;
  const lead = leadFromContent.trim();
  if (t.startsWith(lead)) {
    return t.slice(lead.length).trimStart();
  }
  return t;
}

function ActionCard({ action }: { action: ActionItem }) {
  const hasDetail = action.detailSections && action.detailSections.length > 0;

  const heading = (
    <p className="text-lg font-semibold tracking-[-0.01em] text-slate-900">
      Action {action.number}: {action.title}
    </p>
  );
  const summaryText = (
    <p className="mt-2 text-[1.05rem] leading-relaxed text-slate-700">{action.description}</p>
  );

  if (!hasDetail) {
    return (
      <li className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-slate-300/90 hover:shadow-md">
        {heading}
        {summaryText}
      </li>
    );
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:border-slate-300/90 hover:shadow-md">
      <details className="group open:pb-0">
        <summary className="cursor-pointer list-none p-6 [&::-webkit-details-marker]:hidden">
          {heading}
          {summaryText}
          <p className="mt-4 text-sm font-semibold text-[#0c5290] group-open:hidden">
            Show full action →
          </p>
          <p className="mt-4 hidden text-sm font-semibold text-[#0c5290] group-open:block">
            Hide full action
          </p>
        </summary>
        <div className="space-y-6 border-t border-slate-100 bg-slate-50/40 px-6 pb-6 pt-5 text-slate-700">
          {action.detailSections!.map((sec, i) => (
            <div key={i} className="space-y-2">
              {sec.title ? (
                <h4 className="text-base font-semibold text-slate-900">{sec.title}</h4>
              ) : null}
              <div className="max-w-none text-base leading-relaxed [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:my-2">
                <ReactMarkdown>{sec.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </details>
    </li>
  );
}

type Props = {
  content: PlaybookContent;
  /** Base path for related playbook links (e.g. /client/playbooks or /playbooks) */
  basePath?: string;
};

export function PlaybookOverviewContent({ content, basePath = "/playbooks" }: Props) {
  const hasSectionedActions =
    content.actionSections?.length &&
    content.actionSections.some((s) => s.actions?.length);
  const hasFlatActions = (content.actions?.length ?? 0) > 0;

  const firstSentence = leadSentence(content.whatThisIs);
  const dek =
    firstSentence ||
    "A Profit System playbook — practical signals, actions, and language you can use with your team.";
  const whatThisIsRemainder =
    firstSentence.length > 0 ? whatThisIsBody(content.whatThisIs, firstSentence) : "";
  const showWhatThisIsSection =
    firstSentence.length === 0 || whatThisIsRemainder.trim().length > 0;
  const whatThisIsSectionBody =
    firstSentence.length === 0 ? content.whatThisIs : whatThisIsRemainder;

  return (
    <article className="space-y-14 md:space-y-16">
      <header className="relative overflow-hidden rounded-[2rem] border border-white/65 px-6 py-10 shadow-[0_24px_60px_-28px_rgba(12,82,144,0.42)] md:px-11 md:py-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, rgba(255,228,237,0.96) 0%, rgba(234,245,255,0.96) 45%, rgba(237,255,251,0.96) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{ background: areaHeroGradient(content.area) }}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-white/18 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-14 -top-10 h-52 w-52 rounded-full bg-white/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-[120%] max-w-2xl rounded-full bg-[#0c5290]/[0.07] blur-3xl"
          aria-hidden
        />

        <div className="relative space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0c5290] md:text-[13px]">
            {content.subtitle}
          </p>
          <p className="text-sm font-medium tracking-wide text-slate-500">Playbook {content.ref}</p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 md:text-5xl md:leading-[1.05]">
            {content.name}
          </h1>
          <p className="max-w-2xl border-l-2 border-[#0c5290]/35 pl-5 text-lg font-medium leading-relaxed text-slate-700 md:text-xl md:leading-snug">
            {dek}
          </p>
        </div>
      </header>

      {showWhatThisIsSection ? (
        <section className="space-y-6">
          <h2 className={SECTION_HEADING}>What This Is</h2>
          <div className={`whitespace-pre-line ${PROSE}`}>{whatThisIsSectionBody}</div>
        </section>
      ) : null}

      <section className="space-y-8">
        <h2 className={SECTION_HEADING}>What It Looks Like</h2>
        <div className="space-y-6">
          <div
            className="rounded-2xl border border-white/70 px-6 py-6 shadow-sm md:px-8 md:py-7"
            style={{
              background:
                "linear-gradient(135deg, rgba(254,242,242,0.85) 0%, rgba(255,251,235,0.75) 100%)",
            }}
          >
            <p className="text-base font-semibold text-slate-900">
              {content.whatItLooksLike.broken.emoji} {content.whatItLooksLike.broken.label}
            </p>
            <p className={`mt-4 ${PROSE}`}>{content.whatItLooksLike.broken.content}</p>
          </div>
          <div
            className="rounded-2xl border border-white/70 px-6 py-6 shadow-sm md:px-8 md:py-7"
            style={{
              background:
                "linear-gradient(135deg, rgba(234,245,255,0.9) 0%, rgba(243,232,255,0.65) 100%)",
            }}
          >
            <p className="text-base font-semibold text-slate-900">
              {content.whatItLooksLike.ok.emoji} {content.whatItLooksLike.ok.label}
            </p>
            <p className={`mt-4 ${PROSE}`}>{content.whatItLooksLike.ok.content}</p>
          </div>
          <div
            className="rounded-2xl border border-white/70 px-6 py-6 shadow-sm md:px-8 md:py-7"
            style={{
              background:
                "linear-gradient(135deg, rgba(236,253,245,0.9) 0%, rgba(224,242,254,0.75) 100%)",
            }}
          >
            <p className="text-base font-semibold text-slate-900">
              {content.whatItLooksLike.working.emoji} {content.whatItLooksLike.working.label}
            </p>
            <p className={`mt-4 ${PROSE}`}>{content.whatItLooksLike.working.content}</p>
          </div>
        </div>
      </section>

      {content.thingsToThinkAbout.length > 0 && (
        <section className="space-y-8">
          <h2 className={SECTION_HEADING}>Things to Think About</h2>
          <ul className={`mt-8 space-y-5 ${PROSE}`}>
            {content.thingsToThinkAbout.map((item, i) => {
              const [first, rest] = splitFirstSentence(item);
              return (
                <li key={i} className="flex gap-4 leading-relaxed">
                  <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#0c5290]/50" />
                  <span>
                    <strong className="font-semibold text-slate-900">{first}</strong>
                    {rest ? ` ${rest}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hasSectionedActions || hasFlatActions ? (
        <section className="space-y-6">
          <h2 className={SECTION_HEADING}>The Actions Inside This Playbook</h2>
          {content.actionsIntro ? (
            <p className={`mt-6 whitespace-pre-line ${PROSE}`}>{content.actionsIntro}</p>
          ) : (
            <p className={`mt-6 ${PROSE}`}>
              When you open this playbook in the Profit System, you will find:
            </p>
          )}
          {hasSectionedActions ? (
            <div className="mt-10 space-y-10">
              {content.actionSections!.map((sec, si) => (
                <div key={si}>
                  <h3 className="text-xl font-semibold tracking-[-0.015em] text-slate-900">
                    {sec.title}
                  </h3>
                  {sec.description ? (
                    <p className={`mt-3 leading-relaxed ${PROSE}`}>{sec.description}</p>
                  ) : null}
                  <ul className="mt-6 space-y-5">
                    {sec.actions?.map((action, ai) => (
                      <ActionCard key={`${si}-${ai}-${action.number}`} action={action} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-8 space-y-5">
              {content.actions?.map((action) => (
                <ActionCard key={action.number} action={action} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {content.quickWins.length > 0 && (
        <section className="space-y-6">
          <h2 className={SECTION_HEADING}>Quick Wins</h2>
          <ul className={`mt-2 space-y-4 ${PROSE}`}>
            {content.quickWins.map((win, i) => {
              const [first, rest] = splitFirstSentence(win);
              return (
                <li key={i} className="leading-relaxed">
                  <strong className="font-semibold text-slate-900">{first}</strong>
                  {rest ? ` ${rest}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {content.relatedPlaybooks.length > 0 && (
        <section className="space-y-6">
          <h2 className={SECTION_HEADING}>Related Playbooks</h2>
          <ul className={`mt-2 space-y-4 ${PROSE}`}>
            {content.relatedPlaybooks.map((item) => {
              const playbookName =
                PLAYBOOKS.find((p) => p.ref === item.ref)?.name ?? item.ref;
              const label = `${item.ref} ${playbookName} Playbook`;
              return (
                <li key={item.ref}>
                  <Link
                    href={`${basePath}/${item.ref}`}
                    className="font-semibold text-[#0c5290] underline decoration-[#0c5290]/35 underline-offset-2 transition hover:text-[#094271] hover:decoration-[#094271]"
                  >
                    {label}
                  </Link>
                  {item.description ? (
                    <span className="text-slate-700"> — {item.description}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
