"use client";

import Link from "next/link";

import { SECTION_SOURCES, blueprintPage, topicCards } from "@/lib/practiceKnowledge/blueprint";
import { guidePage } from "@/lib/practiceKnowledge/clientSessions";

import { SessionGuide } from "./SessionGuide";
import { usePractice } from "./PracticeProvider";

const STATUS_CLASS = {
  Ready: "text-[#0c5290]",
  Open: "text-slate-700",
  Building: "text-slate-500",
} as const;

export function BlueprintTopic({ slug }: { slug: string }) {
  const page = blueprintPage(slug);
  const guide = guidePage(slug);
  const { knowledge, payload, approveSection, href } = usePractice();
  if (!page || !knowledge || !payload) return null;
  if (guide) return <SessionGuide guide={guide} />;
  const cards = topicCards(slug, knowledge);
  const approved = payload.review.approved_sections?.value ?? {};

  return (
    <article>
      <div className="space-y-3">
        {cards.map((card) => (
          <details key={card.title} open={card.status !== "Building"} className="border-b border-slate-200 pb-4">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] text-[#0f172a]">
              <span className="min-w-0">{card.title}</span>
              <span className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  aria-pressed={Boolean(approved[`${slug}:${card.title}`])}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    approveSection(`${slug}:${card.title}`);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    approved[`${slug}:${card.title}`]
                      ? "bg-[#0c5290] text-white"
                      : "bg-white text-slate-800 ring-1 ring-slate-300"
                  }`}
                >
                  {approved[`${slug}:${card.title}`] ? "Approved" : "Approve"}
                </button>
                <span
                  title={SECTION_SOURCES[card.source].hint}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-slate-600"
                >
                  {SECTION_SOURCES[card.source].label}
                </span>
                <span className={`text-xs font-medium ${STATUS_CLASS[card.status]}`}>{card.status}</span>
              </span>
            </summary>
            <div className="mt-2 space-y-2 text-[1.0625rem] leading-[1.55] text-[#1e293b]">
              {card.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
      {slug !== "blueprint" ? (
        <p className="mt-8 text-sm text-slate-600">
          Facts are captured in{" "}
          <Link href={href("/coach/practice/blueprint")} className="font-medium text-[#0c5290]">
            Your Practice Blueprint
          </Link>
          . This page only shows the slice that belongs here.
        </p>
      ) : null}
    </article>
  );
}
