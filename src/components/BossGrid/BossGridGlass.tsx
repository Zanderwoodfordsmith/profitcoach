"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessmentQuestions";
import { LEVELS, PLAYBOOKS } from "@/lib/bossData";
import {
  computePillarScores,
  type AnswersMap,
  type PillarScores,
} from "@/lib/bossScores";
import { SpeedDials } from "./SpeedDials";

const TOOLTIP_DELAY_MS = 800;

export type BossGridGlassProps = {
  answers: AnswersMap;
  showDials?: boolean;
  showHeaders?: boolean;
  interactive?: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  /** When set, cells link to playbook detail (e.g. /client/playbooks or /coach/contacts/123/playbooks) */
  playbookLinkBase?: string;
};

const AREA_NAMES = [
  "Owner Performance",
  "Aligned Vision",
  "Defined Strategy",
  "Disciplined Planning",
  "Profit & Cash Flow",
  "Revenue & Marketing",
  "Operations & Delivery",
  "Financials & Metrics",
  "Infrastructure & Systems",
  "Team & Leadership",
];

const PILLAR_AREA_INDICES = [[0], [1, 2, 3], [4, 5, 6], [7, 8, 9]] as const;
const PILLAR_AREA_COLORS = ["text-[#c026d3]", "text-[#0c5290]", "text-[#42a1ee]", "text-[#1ca0c2]"] as const;

// Glass: blue-tinted cell + backdrop blur; keep 5px status bar
const BORDER_COLORS = {
  0: "rgba(239, 68, 68, 0.7)",
  1: "rgba(250, 204, 21, 0.7)",
  2: "rgba(34, 197, 94, 0.7)",
} as const;

const GLASS_CELL_BG = "rgba(147, 197, 253, 0.15)";
const GLASS_CELL_BORDER = "rgba(255, 255, 255, 0.3)";

function getScoreStyle(score: 0 | 1 | 2 | undefined): React.CSSProperties {
  const borderColor = score === undefined ? "rgba(148, 163, 184, 0.7)" : BORDER_COLORS[score];
  return {
    background: GLASS_CELL_BG,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: `1px solid ${GLASS_CELL_BORDER}`,
    borderBottom: `5px solid ${borderColor}`,
    borderRadius: 4,
  };
}

function getScoreClass(score: 0 | 1 | 2 | undefined): string {
  return score === undefined ? "text-slate-600" : "text-slate-800";
}

function getStatusBorderClass(_score: 0 | 1 | 2 | undefined): string {
  return "";
}

const PILLAR_GLASS_STYLE: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.12)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.04)",
};

export function BossGridGlass({
  answers,
  showDials = true,
  showHeaders = true,
  interactive = false,
  onScoreChange,
  playbookLinkBase,
}: BossGridGlassProps) {
  const router = useRouter();
  const pillarScores = computePillarScores(answers);
  const [tooltip, setTooltip] = useState<{ ref: string; rect: { left: number; top: number; bottom: number } } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  const handleCellHover = useCallback((ref: string | null, element: HTMLElement | null) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    if (!ref || !element) {
      setTooltip(null);
      setTooltipVisible(false);
      return;
    }
    const rect = element.getBoundingClientRect();
    setTooltip({ ref, rect: { left: rect.left, top: rect.top, bottom: rect.bottom } });
    setTooltipVisible(false);
    tooltipTimeoutRef.current = setTimeout(() => {
      tooltipTimeoutRef.current = null;
      setTooltipVisible(true);
    }, TOOLTIP_DELAY_MS);
  }, []);

  const LEVEL_COL_WIDTH = 92;
  const gridCols = `${LEVEL_COL_WIDTH}px 1fr 3fr 3fr 3fr`;

  const question = tooltip && tooltipVisible
    ? ASSESSMENT_QUESTIONS.find((q) => q.ref === tooltip.ref)
    : null;

  return (
    <div className="flex flex-col w-full min-w-[1100px]">
      {showDials && <SpeedDials pillarScores={pillarScores} gridCols={gridCols} />}
      <div
        className="grid w-full text-[0.8rem] min-w-[1100px] gap-x-3 gap-y-0"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: "auto repeat(6, auto)",
        }}
        role="grid"
        aria-label="BOSS playbook grid (glass)"
      >
        {showHeaders && (
          <>
            <div className="flex flex-col justify-center items-center p-2 min-w-0 bg-transparent" />
            <div className="flex flex-col justify-center items-center p-3 text-[calc(0.8rem+6px)] font-medium leading-tight text-white bg-[#a21caf] rounded-t-lg shadow-sm">
              Foundation
            </div>
            <div className="flex flex-col justify-center items-stretch p-3 text-[calc(0.8rem+6px)] font-medium leading-tight text-white bg-[#0c5290] rounded-t-lg shadow-sm">
              <div className="flex w-full items-center justify-between gap-2">
                <span>Clarify Vision</span>
                <span className="text-sm font-medium opacity-90">{Math.round((pillarScores.vision / 30) * 100)}%</span>
              </div>
            </div>
            <div className="flex flex-col justify-center items-stretch p-3 text-[calc(0.8rem+6px)] font-medium leading-tight text-white bg-[#42a1ee] rounded-t-lg shadow-sm">
              <div className="flex w-full items-center justify-between gap-2">
                <span>Control Velocity</span>
                <span className="text-sm font-medium opacity-90">{Math.round((pillarScores.velocity / 30) * 100)}%</span>
              </div>
            </div>
            <div className="flex flex-col justify-center items-stretch p-3 text-[calc(0.8rem+6px)] font-medium leading-tight text-white bg-[#1ca0c2] rounded-t-lg shadow-sm">
              <div className="flex w-full items-center justify-between gap-2">
                <span>Create Value</span>
                <span className="text-sm font-medium opacity-90">{Math.round((pillarScores.value / 30) * 100)}%</span>
              </div>
            </div>
          </>
        )}
        {showHeaders && <div className="bg-transparent" style={{ gridColumn: 1, gridRow: 2 }} />}
        {LEVELS.map((level, idx) => (
          <div
            key={level.id}
            className="flex flex-col justify-center items-start py-2.5 pl-3 pr-1 text-left bg-transparent min-h-[56px]"
            style={{ gridColumn: 1, gridRow: idx + 3 }}
            aria-label={`Level ${level.id}, ${level.name}`}
          >
            <span className="text-[0.65rem] font-medium text-slate-400 tracking-wide">L{level.id}</span>
            <span className="text-[18px] font-medium text-slate-500 leading-tight">{level.name}</span>
          </div>
        ))}
        {PILLAR_AREA_INDICES.map((areaIndices, pillarIdx) => (
          <div
            key={pillarIdx}
            className="rounded-b-lg"
            style={{
              gridColumn: pillarIdx + 2,
              gridRow: "2 / 8",
              ...PILLAR_GLASS_STYLE,
            }}
          >
            <PillarCardGlass
              areaIndices={areaIndices}
              areaColorClass={PILLAR_AREA_COLORS[pillarIdx]}
              answers={answers}
              interactive={interactive}
              onScoreChange={onScoreChange}
              playbookLinkBase={playbookLinkBase}
              onPlaybookClick={
                playbookLinkBase
                  ? (ref: string) => router.push(`${playbookLinkBase}/${ref}`)
                  : undefined
              }
              getScoreClass={getScoreClass}
              getScoreStyle={getScoreStyle}
              getStatusBorderClass={getStatusBorderClass}
              onCellHover={handleCellHover}
            />
          </div>
        ))}
      </div>
      {typeof document !== "undefined" &&
        question &&
        tooltip &&
        tooltipVisible &&
        createPortal(
          <div
            className="fixed z-50 max-w-sm rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
            style={{
              left: Math.min(tooltip.rect.left, typeof window !== "undefined" ? window.innerWidth - 336 : tooltip.rect.left),
              top: tooltip.rect.bottom + 6,
            }}
            role="tooltip"
          >
            <p className="mb-2 text-sm font-medium text-slate-900">{question.question}</p>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>
                <span className="font-semibold text-red-600">Not in place:</span>{" "}
                {question.scoringGuide.red}
              </li>
              <li>
                <span className="font-semibold text-amber-600">Partially:</span>{" "}
                {question.scoringGuide.amber}
              </li>
              <li>
                <span className="font-semibold text-emerald-600">Fully in place:</span>{" "}
                {question.scoringGuide.green}
              </li>
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

function PillarCardGlass({
  areaIndices,
  areaColorClass,
  answers,
  interactive,
  onScoreChange,
  playbookLinkBase,
  onPlaybookClick,
  getScoreClass,
  getScoreStyle,
  getStatusBorderClass,
  onCellHover,
}: {
  areaIndices: readonly number[];
  areaColorClass: string;
  answers: AnswersMap;
  interactive: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  playbookLinkBase?: string;
  onPlaybookClick?: (ref: string) => void;
  getScoreClass: (s: 0 | 1 | 2 | undefined) => string;
  getScoreStyle: (s: 0 | 1 | 2 | undefined) => React.CSSProperties;
  getStatusBorderClass: (s: 0 | 1 | 2 | undefined) => string;
  onCellHover?: (ref: string | null, element: HTMLElement | null) => void;
}) {
  const nCols = areaIndices.length;
  return (
    <div
      className="grid h-full w-full text-[0.8rem] gap-x-1.5 gap-y-4"
      style={{
        gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))`,
        gridTemplateRows: "auto repeat(5, 56px)",
      }}
    >
      {areaIndices.map((areaIdx) => (
        <div
          key={areaIdx}
          className={`flex flex-col justify-center items-start py-2.5 pl-3 pr-2 font-medium text-[0.9rem] leading-snug text-left ${areaColorClass}`}
        >
          {AREA_NAMES[areaIdx]}
        </div>
      ))}
      {LEVELS.map((level) =>
        areaIndices.map((areaIdx) => {
          const playbook = PLAYBOOKS.find((p) => p.level === level.id && p.area === areaIdx);
          if (!playbook) return null;
          const score = answers[playbook.ref] as 0 | 1 | 2 | undefined;
          const handleClick = () => {
            if (interactive && onScoreChange) {
              const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
              onScoreChange(playbook.ref, next);
            } else if (onPlaybookClick) {
              onPlaybookClick(playbook.ref);
            }
          };
          const handleContextMenu = onPlaybookClick
            ? (e: React.MouseEvent) => {
                e.preventDefault();
                onPlaybookClick(playbook.ref);
              }
            : undefined;
          const isClickable = (interactive && onScoreChange) || onPlaybookClick;
          return (
            <div
              key={playbook.ref}
              style={getScoreStyle(score)}
              className={`flex flex-row items-center py-2.5 pl-4 pr-2 min-w-0 text-left font-light leading-snug rounded-sm ${
                isClickable ? "cursor-pointer" : ""
              } ${getScoreClass(score)} ${getStatusBorderClass(score)}`}
              role={interactive && onScoreChange ? "button" : isClickable ? "button" : "gridcell"}
              tabIndex={isClickable ? 0 : undefined}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              onMouseEnter={onCellHover ? (e) => onCellHover(playbook.ref, e.currentTarget) : undefined}
              onMouseLeave={onCellHover ? () => onCellHover(null, null) : undefined}
              onKeyDown={
                interactive && onScoreChange
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const next = ((score ?? 0) + 1) % 3 as 0 | 1 | 2;
                        onScoreChange(playbook.ref, next);
                      }
                    }
                  : onPlaybookClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPlaybookClick(playbook.ref);
                        }
                      }
                    : undefined
              }
              aria-label={
                interactive && onScoreChange
                  ? `${playbook.name}: ${score === 0 ? "Not in place" : score === 1 ? "Partially in place" : score === 2 ? "Fully in place" : "Not scored"}. Click to cycle. Right-click to open playbook.`
                  : onPlaybookClick
                    ? `${playbook.name}. Click to open playbook.`
                    : undefined
              }
            >
              <span className="block leading-snug text-left min-w-0 capitalize text-[0.7rem] font-light">{playbook.name.replace(/ & /g, " &\n")}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
