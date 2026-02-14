"use client";

import { useState } from "react";
import { computeFocusAreas, type AnswersMap } from "@/lib/bossScores";

type FocusAreasProps = {
  scores: AnswersMap;
  variant?: "compact" | "full";
  "aria-label"?: string;
};

export function FocusAreas({
  scores,
  variant = "full",
  "aria-label": ariaLabel,
}: FocusAreasProps) {
  const items = computeFocusAreas(scores);

  if (variant === "compact") {
    return (
      <ul
        className="space-y-2 list-none p-0 m-0"
        aria-label={ariaLabel ?? "Your top 3 focus areas"}
      >
        {items.length === 0 ? (
          <li className="text-slate-600 text-sm">
            All areas are in good shape. Your BOSS grid has been updated below.
          </li>
        ) : (
          items.slice(0, 3).map((item, idx) => (
            <li
              key={item.ref}
              className="flex items-baseline gap-2 text-sm text-slate-800"
            >
              <span className="font-semibold text-slate-500 shrink-0">
                {idx + 1}.
              </span>
              <span>{item.name}</span>
              <span className="text-xs text-slate-500 shrink-0">
                Level {item.level}
              </span>
            </li>
          ))
        )}
      </ul>
    );
  }

  return (
    <FocusAreasFull items={items} aria-label={ariaLabel} />
  );
}

function FocusAreasFull({
  items,
  "aria-label": ariaLabel,
}: {
  items: ReturnType<typeof computeFocusAreas>;
  "aria-label"?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const topItems = items.slice(0, 3);
  const restItems = items.slice(3);

  return (
    <div
      className="space-y-3"
      aria-label={ariaLabel ?? "Your focus areas"}
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Your focus areas
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Your top 3 priorities for the next 90 days.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">
          All areas are in good shape. Review with your Profit Coach to maintain
          momentum.
        </p>
      ) : (
        <div className="space-y-2">
          {topItems.map((item, idx) => (
            <FocusRow key={item.ref} item={item} rank={idx + 1} isTop />
          ))}
          {restItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                {expanded
                  ? "Show less"
                  : `Show all focus areas (${restItems.length} more)`}
              </button>
              {expanded && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <span className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-500">
                      Also needs attention
                    </span>
                    <span className="flex-1 h-px bg-slate-200" />
                  </div>
                  {restItems.map((item, idx) => (
                    <FocusRow
                      key={item.ref}
                      item={item}
                      rank={4 + idx}
                      isTop={false}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">
        These are suggested based on level, urgency, and business impact. Your
        Profit Coach may adjust based on your specific situation.
      </p>
    </div>
  );
}

function FocusRow({
  item,
  rank,
  isTop,
}: {
  item: { ref: string; name: string; level: number; status: 0 | 1 };
  rank: number;
  isTop: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded ${
        isTop ? "bg-slate-50" : ""
      }`}
    >
      <span className="w-5 text-sm font-medium text-slate-600 shrink-0">
        {rank}
      </span>
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          item.status === 0 ? "bg-rose-400" : "bg-amber-400"
        }`}
      />
      <span className="text-sm text-slate-800 flex-1">{item.name}</span>
      <span className="text-xs text-slate-500 shrink-0">Level {item.level}</span>
    </div>
  );
}
