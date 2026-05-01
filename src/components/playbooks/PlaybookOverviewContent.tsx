"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { PLAYBOOKS } from "@/lib/bossData";
import type { ActionItem, PlaybookContent } from "@/lib/playbookContentTypes";

/** Split text into [first sentence, rest] for bold first sentence. */
function splitFirstSentence(text: string): [string, string] {
  const match = text.match(/^([^.!?]+[.!?])\s*([\s\S]*)$/);
  return match ? [match[1], match[2].trimStart()] : [text, ""];
}

function ActionCard({ action }: { action: ActionItem }) {
  const hasDetail = action.detailSections && action.detailSections.length > 0;

  const heading = (
    <p className="text-lg font-semibold text-slate-900">
      Action {action.number}: {action.title}
    </p>
  );
  const summaryText = (
    <p className="mt-2 text-lg text-slate-700 leading-relaxed">{action.description}</p>
  );

  if (!hasDetail) {
    return (
      <li className="rounded-lg border border-slate-200 p-5">
        {heading}
        {summaryText}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-200">
      <details className="group open:pb-0">
        <summary className="cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden">
          {heading}
          {summaryText}
          <p className="mt-3 text-sm font-medium text-sky-700 group-open:hidden">
            Show full action
          </p>
          <p className="mt-3 hidden text-sm font-medium text-sky-700 group-open:block">
            Hide full action
          </p>
        </summary>
        <div className="space-y-6 border-t border-slate-100 px-5 pb-5 pt-4 text-slate-700">
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

  return (
    <article className="space-y-10">
      <header>
        <p className="text-base font-semibold uppercase tracking-[0.2em] text-slate-500">
          {content.subtitle}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
          {content.ref} {content.name} Playbook
        </h1>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">What This Is</h2>
        <div className="mt-4 space-y-4 text-lg text-slate-700 whitespace-pre-line leading-relaxed">
          {content.whatThisIs}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">What It Looks Like</h2>
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
            <p className="text-base font-semibold text-slate-800">
              {content.whatItLooksLike.broken.emoji} {content.whatItLooksLike.broken.label}
            </p>
            <p className="mt-3 text-lg text-slate-700 leading-relaxed">
              {content.whatItLooksLike.broken.content}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
            <p className="text-base font-semibold text-slate-800">
              {content.whatItLooksLike.ok.emoji} {content.whatItLooksLike.ok.label}
            </p>
            <p className="mt-3 text-lg text-slate-700 leading-relaxed">
              {content.whatItLooksLike.ok.content}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
            <p className="text-base font-semibold text-slate-800">
              {content.whatItLooksLike.working.emoji} {content.whatItLooksLike.working.label}
            </p>
            <p className="mt-3 text-lg text-slate-700 leading-relaxed">
              {content.whatItLooksLike.working.content}
            </p>
          </div>
        </div>
      </section>

      {content.thingsToThinkAbout.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-slate-900">Things to Think About</h2>
          <ul className="mt-5 space-y-4">
            {content.thingsToThinkAbout.map((item, i) => {
              const [first, rest] = splitFirstSentence(item);
              return (
                <li key={i} className="flex gap-3 text-lg text-slate-700 leading-relaxed">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
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

      {hasSectionedActions || hasFlatActions ? (
        <section>
          <h2 className="text-xl font-semibold text-slate-900">
            The Actions Inside This Playbook
          </h2>
          {content.actionsIntro ? (
            <p className="mt-3 text-lg text-slate-600 whitespace-pre-line leading-relaxed">
              {content.actionsIntro}
            </p>
          ) : (
            <p className="mt-3 text-lg text-slate-600 leading-relaxed">
              When you open this playbook in the Profit System, you will find:
            </p>
          )}
          {hasSectionedActions ? (
            <div className="mt-6 space-y-8">
              {content.actionSections!.map((sec, si) => (
                <div key={si}>
                  <h3 className="text-lg font-semibold text-slate-900">{sec.title}</h3>
                  {sec.description ? (
                    <p className="mt-2 text-lg text-slate-600 leading-relaxed">{sec.description}</p>
                  ) : null}
                  <ul className="mt-4 space-y-4">
                    {sec.actions?.map((action, ai) => (
                      <ActionCard key={`${si}-${ai}-${action.number}`} action={action} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {content.actions?.map((action) => (
                <ActionCard key={action.number} action={action} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {content.quickWins.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-slate-900">Quick Wins</h2>
          <ul className="mt-5 space-y-3">
            {content.quickWins.map((win, i) => {
              const [first, rest] = splitFirstSentence(win);
              return (
                <li key={i} className="text-lg text-slate-700 leading-relaxed">
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
          <h2 className="text-xl font-semibold text-slate-900">Related Playbooks</h2>
          <ul className="mt-4 space-y-3 text-lg text-slate-700">
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
                  {item.description ? <span> — {item.description}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
