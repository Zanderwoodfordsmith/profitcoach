"use client";

import Link from "next/link";
import { PLAYBOOKS } from "@/lib/bossData";
import type { PlaybookContent } from "@/lib/playbookContentTypes";

/** Split text into [first sentence, rest] for bold first sentence. */
function splitFirstSentence(text: string): [string, string] {
  const match = text.match(/^([^.!?]+[.!?])\s*([\s\S]*)$/);
  return match ? [match[1], match[2].trimStart()] : [text, ""];
}

type Props = {
  content: PlaybookContent;
  /** Base path for related playbook links (e.g. /client/playbooks or /playbooks) */
  basePath?: string;
};

export function PlaybookOverviewContent({ content, basePath = "/playbooks" }: Props) {
  return (
    <article className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          {content.subtitle}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
          {content.ref} {content.name} Playbook
        </h1>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">What This Is</h2>
        <div className="mt-3 space-y-3 text-slate-700 whitespace-pre-line">
          {content.whatThisIs}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">What It Looks Like</h2>
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-semibold text-slate-800">
              {content.whatItLooksLike.broken.emoji} {content.whatItLooksLike.broken.label}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {content.whatItLooksLike.broken.content}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-semibold text-slate-800">
              {content.whatItLooksLike.ok.emoji} {content.whatItLooksLike.ok.label}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {content.whatItLooksLike.ok.content}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-semibold text-slate-800">
              {content.whatItLooksLike.working.emoji} {content.whatItLooksLike.working.label}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {content.whatItLooksLike.working.content}
            </p>
          </div>
        </div>
      </section>

      {content.thingsToThinkAbout.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Things to Think About</h2>
          <ul className="mt-4 space-y-3">
            {content.thingsToThinkAbout.map((item, i) => {
              const [first, rest] = splitFirstSentence(item);
              return (
                <li key={i} className="flex gap-3 text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>
                    <strong>{first}</strong>
                    {rest ? ` ${rest}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(content.playsSections?.length
        ? content.playsSections.some((s) => s.plays?.length)
        : content.plays?.length) ? (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            The Plays Inside This Playbook
          </h2>
          {content.playsIntro ? (
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">
              {content.playsIntro}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              When you open this playbook in the Profit System, you will find:
            </p>
          )}
          {content.playsSections?.length ? (
            <div className="mt-6 space-y-8">
              {content.playsSections.map((sec, si) => (
                <div key={si}>
                  <h3 className="text-base font-semibold text-slate-900">
                    {sec.title}
                  </h3>
                  {sec.description ? (
                    <p className="mt-1 text-sm text-slate-600">{sec.description}</p>
                  ) : null}
                  <ul className="mt-4 space-y-3">
                    {sec.plays?.map((play) => (
                      <li key={play.number} className="rounded-lg border border-slate-200 p-4">
                        <p className="font-semibold text-slate-900">
                          Play {play.number}: {play.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{play.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {content.plays?.map((play) => (
                <li key={play.number} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">
                    Play {play.number}: {play.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{play.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {content.quickWins.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Quick Wins</h2>
          <ul className="mt-4 space-y-2">
            {content.quickWins.map((win, i) => {
              const [first, rest] = splitFirstSentence(win);
              return (
                <li key={i} className="text-sm text-slate-700">
                  <strong>{first}</strong>
                  {rest ? ` ${rest}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {content.relatedPlaybooks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Related Playbooks</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {content.relatedPlaybooks.map((item) => {
              const playbookName =
                PLAYBOOKS.find((p) => p.ref === item.ref)?.name ?? item.ref;
              const label = `${item.ref} ${playbookName} Playbook`;
              return (
                <li key={item.ref}>
                  <Link
                    href={`${basePath}/${item.ref}`}
                    className="font-medium text-sky-700 hover:text-sky-800 underline"
                  >
                    {label}
                  </Link>
                  {item.description ? (
                    <span> — {item.description}</span>
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
