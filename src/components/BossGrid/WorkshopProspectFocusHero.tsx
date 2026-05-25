"use client";

import { getPlaybookMeta } from "@/lib/bossData";
import {
  buildProspectFocusReason,
  getRankedProspectPriorities,
  POINTS_TO_URGENCY,
  WORKSHOP_EASE_META,
  WORKSHOP_IMPACT_META,
  WORKSHOP_PRIORITY_META,
  type PlaybookProspectScores,
  type WorkshopProspectPlotPoint,
} from "@/lib/playbookSessionNotes";

export type WorkshopProspectFocusVariant = "coach" | "client";

type WorkshopProspectFocusHeroProps = {
  playbookNotes: Record<string, string>;
  clientName?: string | null;
  variant?: WorkshopProspectFocusVariant;
  onPlaybookClick?: (ref: string) => void;
};

function scorePills(scores: PlaybookProspectScores) {
  const impact = scores.impact ? WORKSHOP_IMPACT_META[scores.impact] : null;
  const urgency =
    scores.urgency !== undefined
      ? WORKSHOP_PRIORITY_META[POINTS_TO_URGENCY[scores.urgency]]
      : null;
  const ease = scores.ease ? WORKSHOP_EASE_META[scores.ease] : null;

  return (
    <div className="flex flex-wrap gap-2">
      {impact ? (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${impact.pill}`}>
          Impact: {impact.label}
        </span>
      ) : null}
      {urgency ? (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgency.pill}`}>
          Urgency: {urgency.label}
        </span>
      ) : null}
      {ease ? (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ease.pill}`}>
          Ease: {ease.label}
        </span>
      ) : null}
    </div>
  );
}

function PriorityCard({
  rank,
  plot,
  onPlaybookClick,
  highlight = false,
}: {
  rank: number;
  plot: WorkshopProspectPlotPoint;
  onPlaybookClick?: (ref: string) => void;
  highlight?: boolean;
}) {
  const name = getPlaybookMeta(plot.ref)?.name ?? plot.ref;
  const reason = buildProspectFocusReason(plot.scores);

  const body = (
    <>
      <div className="flex items-start gap-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums ${
            highlight
              ? "bg-sky-700 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className={`font-semibold text-slate-900 ${highlight ? "text-2xl" : "text-lg"}`}>
              {name}
            </h3>
            {plot.importance !== null ? (
              <span className="text-sm font-bold tabular-nums text-sky-800">
                Importance {plot.importance}/10
              </span>
            ) : null}
          </div>
          <p className={`mt-1.5 leading-relaxed text-slate-600 ${highlight ? "text-base" : "text-sm"}`}>
            {reason}
          </p>
          <div className="mt-3">{scorePills(plot.scores)}</div>
        </div>
      </div>
    </>
  );

  if (onPlaybookClick) {
    return (
      <button
        type="button"
        onClick={() => onPlaybookClick(plot.ref)}
        className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md sm:p-5 ${
          highlight
            ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm hover:border-sky-300"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        highlight
          ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm"
          : "border-slate-200 bg-white"
      }`}
    >
      {body}
    </div>
  );
}

export function WorkshopProspectFocusHero({
  playbookNotes,
  clientName,
  variant = "coach",
  onPlaybookClick,
}: WorkshopProspectFocusHeroProps) {
  const { complete, incomplete, topPick } = getRankedProspectPriorities(playbookNotes);
  const topThree = complete.slice(0, 3);
  const runnersUp = topThree.slice(1);
  const topName = topPick ? (getPlaybookMeta(topPick.ref)?.name ?? topPick.ref) : null;

  if (complete.length === 0 && incomplete.length === 0) {
    return null;
  }

  const startLabel =
    variant === "client" && clientName?.trim()
      ? `${clientName.trim()}, start here`
      : "Start here";

  return (
    <div className="space-y-6">
      {topPick ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{startLabel}</p>
          <PriorityCard
            rank={1}
            plot={topPick}
            onPlaybookClick={onPlaybookClick}
            highlight
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          {variant === "client"
            ? "Complete scoring on your top playbooks to see what to focus on first."
            : "Finish impact, urgency, and ease on at least one playbook to generate a start-here recommendation."}
        </div>
      )}

      {runnersUp.length > 0 ? (
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {variant === "client"
                ? "Your top 3 priorities for the next 90 days"
                : "Top 3 priorities"}
            </h3>
            {topName ? (
              <p className="mt-0.5 text-sm text-slate-500">
                {variant === "client"
                  ? `After ${topName}, focus on these next.`
                  : "Ranked by importance, urgency, and ease."}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            {runnersUp.map((plot, index) => (
              <PriorityCard
                key={plot.ref}
                rank={index + 2}
                plot={plot}
                onPlaybookClick={onPlaybookClick}
              />
            ))}
          </div>
        </div>
      ) : null}

      {incomplete.length > 0 ? (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {variant === "client" ? "Still to decide together" : "Incomplete scoring"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {incomplete.map((plot) => {
              const name = getPlaybookMeta(plot.ref)?.name ?? plot.ref;
              return (
                <li key={plot.ref}>
                  {onPlaybookClick ? (
                    <button
                      type="button"
                      onClick={() => onPlaybookClick(plot.ref)}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-200"
                    >
                      {name}
                    </button>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                      {name}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
