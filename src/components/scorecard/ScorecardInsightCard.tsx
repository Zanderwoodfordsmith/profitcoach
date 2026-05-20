"use client";

import {
  FOCUS_TOPICS_HEADING,
  insightTextForFocusArea,
  SCORE_FOCUS_STYLE,
} from "@/lib/bossScorecardCopy";
import type { ScorecardFocusItem } from "@/lib/bossScorecardScores";
import { getPlaybooksForScorecardQuestion } from "@/lib/scorecardAreaPlaybooks";

export function ScorecardInsightCard({
  index,
  item,
}: {
  index: number;
  item: ScorecardFocusItem;
}) {
  const style = SCORE_FOCUS_STYLE[item.score];
  const playbooks = getPlaybooksForScorecardQuestion(item.id);

  return (
    <div className="relative overflow-hidden rounded-3xl text-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.45)]">
      <div
        className="absolute inset-0"
        style={{ background: style.gradient }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(15,23,42,0.05) 0%,rgba(15,23,42,0.45) 35%,rgba(15,23,42,0.88) 100%)",
        }}
      />
      <span
        className="absolute right-6 top-6 text-[72px] font-black leading-none tracking-tight"
        style={{ color: "rgba(255,255,255,0.16)", fontVariantNumeric: "tabular-nums" }}
      >
        0{index}.
      </span>
      <div className="relative flex min-h-[360px] flex-col p-6">
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{
              background: style.accent,
              color: style.lightBadgeText ? "white" : "#1c1917",
            }}
          >
            <span
              className={`h-2 w-2 rounded-full ${style.lightBadgeText ? "bg-white/90" : "bg-amber-950/80"}`}
            />
            {style.label}
          </span>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight">
            {item.areaName}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            {insightTextForFocusArea(item.id, item.score)}
          </p>
        </div>
        {playbooks.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/75">
              {FOCUS_TOPICS_HEADING}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {playbooks.map((name) => (
                <li
                  key={name}
                  className="text-base font-medium leading-snug text-white/95"
                >
                  · {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
