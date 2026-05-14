"use client";

import { useRouter } from "next/navigation";
import { LEVELS, PLAYBOOKS } from "@/lib/bossData";
import {
  computePillarScores,
  type AnswersMap,
} from "@/lib/bossScores";
import { BossQuestionTooltipPortal, useBossQuestionTooltip } from "./bossQuestionTooltip";
import { SpeedDials } from "./SpeedDials";

export type BossGridProps = {
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

// Diamond/plateau bevel: sharp edges, light from top-left, facets from each corner inwards
const KEY_BEVEL_CLASS =
  "rounded-sm shadow-[2px_0_0_rgba(255,255,255,0.75),0_2px_0_rgba(255,255,255,0.75),0_0_0_1px_rgba(255,255,255,0.5),1px_0_0_rgba(0,0,0,0.2),0_1px_0_rgba(0,0,0,0.2),inset_6px_6px_8px_-4px_rgba(0,0,0,0.08),inset_-6px_-6px_8px_-4px_rgba(255,255,255,0.35),3px_3px_8px_rgba(0,0,0,0.12)]";

// Subtle gradient straight up from bottom; borders 70–75% visible
const GRADIENT = "0deg";
const BORDER_COLORS = {
  0: "rgba(239, 68, 68, 0.7)",   // red
  1: "rgba(250, 204, 21, 0.7)",  // yellow
  2: "rgba(34, 197, 94, 0.7)",   // green
} as const;

function getScoreStyle(score: 0 | 1 | 2 | undefined): React.CSSProperties {
  const borderColor = score === undefined ? "rgba(148, 163, 184, 0.7)" : BORDER_COLORS[score];
  let background: string;
  if (score === 0)
    background = `linear-gradient(${GRADIENT}, rgba(239, 68, 68, 0.35) 0%, #ffffff 35%, #ffffff 100%)`;
  else if (score === 1)
    background = `linear-gradient(${GRADIENT}, rgba(250, 204, 21, 0.35) 0%, #ffffff 35%, #ffffff 100%)`;
  else if (score === 2)
    background = `linear-gradient(${GRADIENT}, rgba(34, 197, 94, 0.35) 0%, #ffffff 35%, #ffffff 100%)`;
  else
    background = `linear-gradient(${GRADIENT}, rgba(148, 163, 184, 0.25) 0%, #ffffff 35%, #ffffff 100%)`;
  return {
    background,
    borderBottom: `5px solid ${borderColor}`,
  };
}

function getScoreClass(score: 0 | 1 | 2 | undefined): string {
  return score === undefined ? "text-slate-600" : "text-slate-800";
}

function getStatusBorderClass(_score: 0 | 1 | 2 | undefined): string {
  return "";
}

export function BossGrid({
  answers,
  showDials = true,
  showHeaders = true,
  interactive = false,
  onScoreChange,
  playbookLinkBase,
}: BossGridProps) {
  const router = useRouter();
  const pillarScores = computePillarScores(answers);
  const { tooltip, tooltipVisible, handleCellHover, dismissTooltip } = useBossQuestionTooltip();

  const LEVEL_COL_WIDTH = 92;
  const gridCols = `${LEVEL_COL_WIDTH}px 1fr 3fr 3fr 3fr`;

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
        aria-label="BOSS playbook grid"
      >
        {showHeaders && (
          <>
            {/* Row 1: corner, pillar headers */}
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
        {/* Level column: row 2 empty, rows 3-7 level labels */}
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
        {/* Four pillar cards: each spans rows 2-8, white bg */}
        {PILLAR_AREA_INDICES.map((areaIndices, pillarIdx) => (
          <div
            key={pillarIdx}
            className="rounded-b-lg"
            style={{ gridColumn: pillarIdx + 2, gridRow: "2 / 8" }}
          >
            <PillarCard
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
              keyBevelClass={KEY_BEVEL_CLASS}
              onCellHover={handleCellHover}
            />
          </div>
        ))}
      </div>
      <BossQuestionTooltipPortal
        tooltip={tooltip}
        tooltipVisible={tooltipVisible}
        getPlaybookUrl={
          playbookLinkBase ? (ref: string) => `${playbookLinkBase}/${ref}` : undefined
        }
        onDismiss={playbookLinkBase ? dismissTooltip : undefined}
      />
    </div>
  );
}

function PillarCard({
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
  keyBevelClass,
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
  keyBevelClass: string;
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
              className={`flex flex-row items-center py-2.5 pl-4 pr-2 min-w-0 text-left font-light leading-snug ${keyBevelClass} ${
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

